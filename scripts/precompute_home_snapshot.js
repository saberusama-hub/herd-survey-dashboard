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

  // Topics — ALL fiscal years. Client filters by selected FY and re-ranks.
  // Each year carries every topic that received any federal $ that year.
  const topicsAllYears = await db.all(`
    SELECT fiscal_year AS fy, topic, tagged_amount
    FROM agg_national_topic
    WHERE tagged_amount IS NOT NULL
    ORDER BY fiscal_year, tagged_amount DESC
  `);

  // Agencies — ALL fiscal years, all 7 buckets per year.
  const agenciesAllYears = await db.all(`
    SELECT fiscal_year AS fy, agency_bucket, amount_nominal
    FROM agg_national_agency_trend
    WHERE amount_nominal IS NOT NULL
    ORDER BY fiscal_year, amount_nominal DESC
  `);

  // Sources — ALL fiscal years, per-year breakdown (replaces 20-yr cumulative).
  const sourcesAllYears = await db.all(`
    SELECT fiscal_year AS fy, source_category, SUM(amount_nominal) AS total
    FROM agg_national_overview
    WHERE amount_nominal IS NOT NULL
    GROUP BY fiscal_year, source_category
    ORDER BY fiscal_year, total DESC
  `);

  // States — ALL fiscal years × top 10 by federal $ for that year.
  const statesAllYears = await db.all(`
    WITH ranked AS (
      SELECT
        s.fiscal_year AS fy,
        i.state_code,
        SUM(s.amount_nominal) AS total,
        COUNT(DISTINCT s.institution_sk) AS n_institutions,
        ROW_NUMBER() OVER (
          PARTITION BY s.fiscal_year ORDER BY SUM(s.amount_nominal) DESC
        ) AS rk
      FROM agg_uni_source_split s
      JOIN dim_institution i USING (institution_sk)
      WHERE s.source_category = 'federal'
        AND i.state_code IS NOT NULL
        AND s.amount_nominal IS NOT NULL
      GROUP BY s.fiscal_year, i.state_code
    )
    SELECT fy, state_code, total, n_institutions
    FROM ranked
    WHERE rk <= 10
    ORDER BY fy, total DESC
  `);

  // Set of fiscal years available for the picker.
  const availableYears = await db.all(`
    SELECT DISTINCT fiscal_year AS fy
    FROM agg_national_overview
    WHERE amount_nominal IS NOT NULL
    ORDER BY fy
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
    // Flat per-FY arrays. Client filters by selected year.
    topics_by_fy: toJsonSafe(topicsAllYears),
    agencies_by_fy: toJsonSafe(agenciesAllYears),
    sources_by_fy: toJsonSafe(sourcesAllYears),
    states_by_fy: toJsonSafe(statesAllYears),
    available_years: toJsonSafe(availableYears).map((r) => r.fy),
    top10_universities: toJsonSafe(top10),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  generated_at:    ${snapshot.generated_at}`);
  console.log(`  fy24_total:      $${(snapshot.kpis.fy24_total / 1e9).toFixed(2)}B`);
  console.log(`  fy24_federal:    $${(snapshot.kpis.fy24_federal / 1e9).toFixed(2)}B`);
  console.log(`  top_uni:         ${snapshot.top10_universities[0]?.name}`);
  console.log(`  topics rows:     ${snapshot.topics_by_fy.length}`);
  console.log(`  agencies rows:   ${snapshot.agencies_by_fy.length}`);
  console.log(`  sources rows:    ${snapshot.sources_by_fy.length}`);
  console.log(`  states rows:     ${snapshot.states_by_fy.length}`);
  console.log(`  years:           ${snapshot.available_years.length}`);
  console.log(`  bytes:           ${fs.statSync(OUT_PATH).size}`);

  // Sanity check: SOURCE_ORDER values should be the only ones in sources_by_fy.
  for (const r of snapshot.sources_by_fy) {
    if (!SOURCE_ORDER.includes(r.source_category)) {
      console.warn(`  ⚠ unknown source_category: ${r.source_category}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
