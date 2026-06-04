// Precompute homepage snapshot. Runs every query the homepage currently
// fires against DuckDB-WASM at runtime and bakes the results into a static
// JSON file the page imports at compile time. The homepage no longer needs
// DuckDB-WASM at all — first paint goes from ~26s (live) to whatever Next's
// static render renders in.
//
// Run before `next build` whenever parquets change:
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_home_snapshot.js
//
// Output: apps/web/public/data/home-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_PATH = path.join(DATA_DIR, 'home-snapshot.json');

// Resolve duckdb-async from sidecar dir if NODE_PATH-loaded, else local.
const Database = require('duckdb-async').Database;

const AGENCY_BUCKETS = ['HHS', 'NSF', 'DOD', 'DOE', 'NASA', 'USDA', 'Other'];
const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'];

async function main() {
  const db = await Database.create(':memory:');

  // Register every parquet the homepage queries against.
  // Same set as in apps/web/lib/duckdb.ts.
  const FILES = [
    'dim_institution',
    'agg_uni_total_rd',
    'agg_uni_source_split',
    'agg_national_overview',
    'agg_national_agency_trend',
    'agg_national_topic',
  ];
  for (const f of FILES) {
    const p = path.join(DATA_DIR, `${f}.parquet`);
    if (!fs.existsSync(p)) {
      throw new Error(`Missing parquet: ${p}`);
    }
    await db.exec(`CREATE OR REPLACE VIEW ${f} AS SELECT * FROM read_parquet('${p}')`);
  }

  // KPI strip aggregates (single round-trip equivalent to the browser query).
  const kpis = (
    await db.all(`
    WITH herd_fys AS (SELECT MAX(fiscal_year) AS fy FROM agg_uni_total_rd)
    SELECT
      (SELECT COUNT(*) FROM dim_institution) AS total_entities,
      (SELECT COUNT(DISTINCT institution_sk) FROM agg_uni_total_rd) AS herd_universities,
      (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE fiscal_year = (SELECT fy FROM herd_fys)) AS fy24_total,
      (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE fiscal_year = (SELECT fy FROM herd_fys) AND source_category = 'federal') AS fy24_federal,
      (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE source_category = 'federal') AS cum20_federal,
      (SELECT fy FROM herd_fys) AS fy24
  `)
  )[0];

  // Largest single federal funder in the latest agency-trend FY.
  const topAgency = (
    await db.all(`
    WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_agency_trend),
    fed_total AS (
      SELECT SUM(amount_nominal) AS total
      FROM agg_national_agency_trend
      WHERE fiscal_year = (SELECT fy FROM latest)
    )
    SELECT
      (SELECT fy FROM latest) AS fy,
      agency_bucket,
      amount_nominal,
      amount_nominal / (SELECT total FROM fed_total) AS pct_of_federal
    FROM agg_national_agency_trend
    WHERE fiscal_year = (SELECT fy FROM latest)
    ORDER BY amount_nominal DESC
    LIMIT 1
  `)
  )[0];

  // Top 10 topics latest FY.
  const topics = await db.all(`
    WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_topic)
    SELECT (SELECT fy FROM latest) AS fy, topic, tagged_amount
    FROM agg_national_topic
    WHERE fiscal_year = (SELECT fy FROM latest)
    ORDER BY tagged_amount DESC
    LIMIT 10
  `);

  // Agencies latest FY (all 7 buckets, sorted).
  const agencies = await db.all(`
    WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_agency_trend)
    SELECT (SELECT fy FROM latest) AS fy, agency_bucket, amount_nominal
    FROM agg_national_agency_trend
    WHERE fiscal_year = (SELECT fy FROM latest)
    ORDER BY amount_nominal DESC
  `);

  // 20-year cumulative source totals.
  const sourceTotals = await db.all(`
    SELECT source_category, SUM(amount_nominal) AS total
    FROM agg_national_overview
    GROUP BY source_category
    ORDER BY total DESC
  `);

  // Top 10 states by federal R&D in the latest HERD FY.
  const states = await db.all(`
    WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_uni_source_split)
    SELECT
      i.state_code,
      SUM(s.amount_nominal) AS total,
      COUNT(DISTINCT s.institution_sk) AS n_institutions
    FROM agg_uni_source_split s
    JOIN dim_institution i USING (institution_sk)
    WHERE s.fiscal_year = (SELECT fy FROM latest)
      AND s.source_category = 'federal'
      AND i.state_code IS NOT NULL
      AND s.amount_nominal IS NOT NULL
    GROUP BY i.state_code
    ORDER BY total DESC
    LIMIT 10
  `);

  // Top 10 universities by FY24 total R&D (the leaderboard).
  // Mirrors `getUniversityIndex` minus columns the homepage doesn't render.
  const top10 = await db.all(`
    WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_uni_total_rd),
    fy24 AS (
      SELECT institution_sk, total_rd_nominal AS total_rd_fy2024
      FROM agg_uni_total_rd
      WHERE fiscal_year = (SELECT fy FROM latest)
    )
    SELECT
      i.institution_sk,
      i.canonical_name AS name,
      i.state_code AS state,
      fy24.total_rd_fy2024
    FROM fy24
    JOIN dim_institution i USING (institution_sk)
    WHERE fy24.total_rd_fy2024 IS NOT NULL
    ORDER BY fy24.total_rd_fy2024 DESC
    LIMIT 10
  `);

  await db.close();

  // Normalize BigInt → Number for JSON serialization, mirroring duckdb.ts
  // normalizeBigInt logic. JSON.stringify also can't serialize BigInt directly.
  const toJsonSafe = (v) => {
    if (typeof v === 'bigint') return Number(v);
    if (Array.isArray(v)) return v.map(toJsonSafe);
    if (v !== null && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = toJsonSafe(val);
      return out;
    }
    return v;
  };

  const snapshot = {
    generated_at: new Date().toISOString(),
    kpis: toJsonSafe(kpis),
    top_agency: toJsonSafe(topAgency),
    topics: toJsonSafe(topics),
    agencies: toJsonSafe(agencies),
    source_totals: toJsonSafe(sourceTotals),
    states: toJsonSafe(states),
    top10_universities: toJsonSafe(top10),
  };

  // Sort agency / source rows into the canonical orders the home page uses so
  // the rendered chart matches what DuckDB would have returned.
  const orderBy = (rows, key, canonical) => {
    const idx = new Map(canonical.map((v, i) => [v, i]));
    return [...rows].sort((a, b) => (idx.get(a[key]) ?? 99) - (idx.get(b[key]) ?? 99));
  };
  snapshot.agencies = orderBy(snapshot.agencies, 'agency_bucket', AGENCY_BUCKETS);

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  generated_at:    ${snapshot.generated_at}`);
  console.log(`  fy24_total:      $${(snapshot.kpis.fy24_total / 1e9).toFixed(2)}B`);
  console.log(`  fy24_federal:    $${(snapshot.kpis.fy24_federal / 1e9).toFixed(2)}B`);
  console.log(`  top_uni:         ${snapshot.top10_universities[0]?.name}`);
  console.log(`  top_topic:       ${snapshot.topics[0]?.topic}`);
  console.log(`  bytes:           ${fs.statSync(OUT_PATH).size}`);

  // Sanity check: SOURCE_ORDER values should be the only ones in source_totals.
  for (const r of snapshot.source_totals) {
    if (!SOURCE_ORDER.includes(r.source_category)) {
      console.warn(`  ⚠ unknown source_category: ${r.source_category}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
