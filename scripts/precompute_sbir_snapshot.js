// Precompute /sbir page data — overview KPIs + per-year aggregations the
// client sums over a chosen window (avoiding the 210-combo precompute trap).
//
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_sbir_snapshot.js
//
// Output: apps/web/public/data/snapshots/sbir-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_PATH = path.join(DATA_DIR, 'snapshots/sbir-snapshot.json');
const Database = require('duckdb-async').Database;

async function main() {
  const db = await Database.create(':memory:');
  await db.exec(
    `CREATE OR REPLACE VIEW sbir AS SELECT * FROM read_parquet('${path.join(DATA_DIR, 'sheet_06_sbir_sttr.parquet')}')`,
  );
  await db.exec(
    `CREATE OR REPLACE VIEW hubs AS SELECT * FROM read_parquet('${path.join(DATA_DIR, 'agg_sbir_hubs.parquet')}')`,
  );
  // Lookup of [lat, lon] per UPPER_CITY|StateName. Static file shipped with
  // the dashboard — top 200 SBIR hub cities geocoded once.
  const cityCoords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sbir_city_coords.json'), 'utf-8'));

  // ─── Overview KPIs ───
  const overview = (
    await db.all(`
    WITH base AS (
      SELECT
        COUNT(*) AS n_awards,
        SUM(award_amount_real_2024) / 1e9 AS total_real_b,
        COUNT(DISTINCT firm_name) AS n_firms,
        COUNT(DISTINCT ri_canonical_name) FILTER (WHERE ri_canonical_name IS NOT NULL AND TRIM(ri_canonical_name) <> '') AS n_ri_unis,
        COUNT(DISTINCT agency_name) AS n_agencies,
        MIN(fiscal_year) AS fy_min,
        MAX(fiscal_year) AS fy_max
      FROM sbir
    ),
    fy24 AS (
      SELECT
        COUNT(*) AS fy24_n_awards,
        SUM(award_amount_real_2024) / 1e6 AS fy24_total_real_m
      FROM sbir
      WHERE fiscal_year = (SELECT fy_max FROM base)
    )
    SELECT base.*, fy24.*
    FROM base, fy24
  `)
  )[0];

  // ─── Year × program × phase stack (already small) ───
  const yearStack = await db.all(`
    SELECT
      fiscal_year,
      program,
      phase,
      SUM(award_amount_real_2024) / 1e6 AS amount_real_m,
      COUNT(*)::DOUBLE AS n_awards
    FROM sbir
    WHERE program IS NOT NULL AND phase IS NOT NULL
    GROUP BY fiscal_year, program, phase
    ORDER BY fiscal_year, program, phase
  `);

  // ─── Per-year per-agency facts (client sums over window) ───
  const agencyFacts = await db.all(`
    SELECT
      fiscal_year,
      agency_name,
      COUNT(*)::DOUBLE AS n_awards,
      SUM(award_amount_real_2024) AS amount
    FROM sbir
    WHERE agency_name IS NOT NULL
    GROUP BY fiscal_year, agency_name
    ORDER BY fiscal_year, agency_name
  `);

  // ─── Per-year per-firm facts (limited to firms that hit top-100 in any year) ───
  // Avoid sending every one of ~50k firms; keep only the relevant top recipients.
  const firmFacts = await db.all(`
    WITH top100 AS (
      SELECT firm_name
      FROM sbir
      WHERE firm_name IS NOT NULL
      GROUP BY firm_name
      ORDER BY SUM(award_amount_real_2024) DESC
      LIMIT 100
    )
    SELECT
      fiscal_year,
      firm_name,
      ANY_VALUE(firm_state) AS firm_state,
      COUNT(*)::DOUBLE AS n_awards,
      SUM(award_amount_real_2024) / 1e6 AS amount_real_m
    FROM sbir
    WHERE firm_name IN (SELECT firm_name FROM top100)
    GROUP BY fiscal_year, firm_name
    ORDER BY fiscal_year, firm_name
  `);

  // ─── Per-year per-RI-uni (top 100 all-time RI partners) ───
  const riFacts = await db.all(`
    WITH top100 AS (
      SELECT ri_canonical_name
      FROM sbir
      WHERE ri_canonical_name IS NOT NULL AND TRIM(ri_canonical_name) <> ''
      GROUP BY ri_canonical_name
      ORDER BY SUM(award_amount_real_2024) DESC
      LIMIT 100
    )
    SELECT
      fiscal_year,
      ri_canonical_name,
      COUNT(*)::DOUBLE AS n_awards,
      SUM(award_amount_real_2024) / 1e6 AS amount_real_m
    FROM sbir
    WHERE ri_canonical_name IN (SELECT ri_canonical_name FROM top100)
    GROUP BY fiscal_year, ri_canonical_name
    ORDER BY fiscal_year, ri_canonical_name
  `);

  // ─── Per-year per-state (all states) ───
  const stateFacts = await db.all(`
    SELECT
      fiscal_year,
      firm_state,
      COUNT(*)::DOUBLE AS n_awards,
      SUM(award_amount_real_2024) / 1e6 AS amount_real_m
    FROM sbir
    WHERE firm_state IS NOT NULL
    GROUP BY fiscal_year, firm_state
    ORDER BY fiscal_year, firm_state
  `);

  // ─── Per-city hub facts: city × FY with top topic, top agency, $, awards. ───
  // The client filters by FY range and overlays dots on the US state map.
  // Coordinates are joined in JS (smaller payload than re-emitting per-row).
  const hubFacts = await db.all(`
    SELECT
      firm_city, firm_state, fiscal_year,
      awards::DOUBLE AS awards,
      amount_real / 1e6 AS amount_real_m,
      top_topic, top_topic_amount / 1e6 AS top_topic_amount_m,
      top_agency
    FROM hubs
    ORDER BY firm_state, firm_city, fiscal_year
  `);

  await db.close();

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

  // Inline lat/lon onto each hub row. Skip rows whose city isn't in the
  // coords lookup — those are tail-of-distribution and don't render anyway.
  const hubFactsWithCoords = hubFacts
    .map((r) => {
      const key = `${r.firm_city}|${r.firm_state}`;
      const coords = cityCoords[key];
      if (!coords) return null;
      return {
        firm_city: r.firm_city,
        firm_state: r.firm_state,
        fiscal_year: r.fiscal_year,
        awards: r.awards,
        amount_real_m: r.amount_real_m,
        top_topic: r.top_topic,
        top_topic_amount_m: r.top_topic_amount_m,
        top_agency: r.top_agency,
        lat: coords[0],
        lon: coords[1],
      };
    })
    .filter((r) => r !== null);

  const snapshot = {
    generated_at: new Date().toISOString(),
    overview: toJsonSafe(overview),
    year_stack: toJsonSafe(yearStack),
    agency_facts: toJsonSafe(agencyFacts),
    firm_facts: toJsonSafe(firmFacts),
    ri_facts: toJsonSafe(riFacts),
    state_facts: toJsonSafe(stateFacts),
    hub_facts: toJsonSafe(hubFactsWithCoords),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
  const bytes = fs.statSync(OUT_PATH).size;
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  size:           ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  year_stack:     ${snapshot.year_stack.length} rows`);
  console.log(`  agency_facts:   ${snapshot.agency_facts.length} rows`);
  console.log(`  firm_facts:     ${snapshot.firm_facts.length} rows`);
  console.log(`  ri_facts:       ${snapshot.ri_facts.length} rows`);
  console.log(`  state_facts:    ${snapshot.state_facts.length} rows`);
  console.log(`  hub_facts:      ${snapshot.hub_facts.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
