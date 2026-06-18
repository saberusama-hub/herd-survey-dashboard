// Precompute the /patents page snapshot from agg_uni_patents.parquet
// (= sheet_13_ip_patents from the data-lake pipeline). One ~30-50 KB JSON
// served from public/data/snapshots/ip-snapshot.json. Drives:
//   - 4 KPI tiles (total granted, total applications, federal share, citations)
//   - Year-trend table (FY2005–FY2025) with grants + applications + truncation flags
//   - Top-25 institutions leaderboard for the active year-window
//   - Federal-funding share by year (line/area trend)
//   - CPC top-section mix (for the latest mature CY)
//
// Universe: 471 HERD institutions with at least one USPTO match. Excludes the
// ~556 HERD institutions with no patent record. CY = patent grant calendar year.
//
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_ip_snapshot.js
//
// Output: apps/web/public/data/snapshots/ip-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT = path.join(DATA_DIR, 'snapshots', 'ip-snapshot.json');
const Database = require('duckdb-async').Database;

// 2-letter abbr → full state name (matches the keying in city-coord lookups)
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico',
};

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const db = await Database.create(':memory:');
  await db.exec(
    `CREATE VIEW patents AS SELECT * FROM read_parquet('${path.join(DATA_DIR, 'agg_uni_patents.parquet')}')`,
  );
  await db.exec(
    `CREATE VIEW dim AS SELECT * FROM read_parquet('${path.join(DATA_DIR, 'dim_institution.parquet')}')`,
  );

  // Static city-coord gazetteers — SBIR's top-200 firm hubs + patent_city_coords
  // for university-only hubs that SBIR didn't need (Stanford, Urbana, etc.).
  const sbirCoords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sbir_city_coords.json'), 'utf-8'));
  const patentCoords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'patent_city_coords.json'), 'utf-8'));
  const cityCoords = { ...sbirCoords, ...patentCoords };

  // National overview (FY2024 + cumulative FY2005-FY2024 mature window).
  // FY2025 is partial (applications cut off mid-cycle), FY2026 is bleed; we
  // pin the headline KPI to FY2024 — the last fully mature granted-patents
  // year for which both granted + filed are non-truncated.
  const overview = (await db.all(`
    SELECT
      (SELECT SUM(patents_granted) FROM patents WHERE fiscal_year BETWEEN 2005 AND 2024) AS total_granted_05_24,
      (SELECT SUM(applications_filed) FROM patents WHERE fiscal_year BETWEEN 2005 AND 2023) AS total_filed_05_23,
      (SELECT COUNT(DISTINCT institution_sk) FROM patents) AS n_institutions,
      (SELECT SUM(patents_granted) FROM patents WHERE fiscal_year = 2024) AS fy24_granted,
      (SELECT SUM(applications_filed) FROM patents WHERE fiscal_year = 2023) AS fy23_filed,
      (SELECT SUM(patents_granted_fed_funded) FROM patents WHERE fiscal_year = 2024) AS fy24_fed_funded,
      (SELECT AVG(avg_cites_5yr_mature) FROM patents WHERE fiscal_year = 2020 AND avg_cites_5yr_mature IS NOT NULL) AS fy20_avg_cites_5yr,
      (SELECT AVG(co_industry_share) FROM patents WHERE fiscal_year = 2024 AND co_industry_share IS NOT NULL) AS fy24_avg_industry_co_share
  `))[0];

  // Year stack: grants + applications + truncation flags + per-year totals.
  const yearStack = await db.all(`
    SELECT
      fiscal_year,
      SUM(patents_granted) AS granted,
      SUM(applications_filed) AS filed,
      SUM(patents_granted_fed_funded) AS fed_funded_granted,
      SUM(patents_granted_fed_funded) / NULLIF(SUM(patents_granted), 0) AS fed_funded_share,
      BOOL_OR(applications_truncated_flag) AS applications_truncated,
      BOOL_OR(citations_truncated_5yr_flag) AS citations_truncated
    FROM patents
    GROUP BY fiscal_year
    ORDER BY fiscal_year
  `);

  // Top institutions leaderboard, FY2020-FY2024 cumulative (a 5yr window
  // matched against the 5yr citation cohort).
  const topInstitutions = await db.all(`
    SELECT
      institution_sk,
      canonical_name,
      SUM(patents_granted) AS granted_5yr,
      SUM(applications_filed) AS filed_4yr,
      SUM(patents_granted_fed_funded) / NULLIF(SUM(patents_granted), 0) AS fed_share,
      AVG(co_industry_share) AS industry_co_share,
      AVG(avg_cites_5yr_mature) AS avg_cites_5yr,
      SUM(herd_federal_rd_M) AS fed_rd_5yr_M,
      SUM(patents_granted) / NULLIF(SUM(herd_federal_rd_M), 0) AS patents_per_M_fed_rd
    FROM patents
    WHERE fiscal_year BETWEEN 2020 AND 2024
    GROUP BY institution_sk, canonical_name
    HAVING SUM(patents_granted) > 0
    ORDER BY granted_5yr DESC
    LIMIT 50
  `);

  // CPC top-section mix for FY2024 (post-2024 is bleed-prone, pre-2020 lacks
  // the cohort the rest of the page focuses on).
  const cpcMix = await db.all(`
    WITH ranked AS (
      SELECT
        primary_cpc_top_section AS cpc_section,
        COUNT(*) AS n_inst,
        SUM(patents_granted) AS granted
      FROM patents
      WHERE fiscal_year = 2024 AND primary_cpc_top_section IS NOT NULL
      GROUP BY 1
    )
    SELECT cpc_section, n_inst, granted,
           granted / (SUM(granted) OVER ()) AS share_of_fy24
    FROM ranked
    ORDER BY granted DESC
  `);

  // Federal-funding share trend, all 20 years. Already on year_stack but
  // surfacing as its own slim array makes the page chart easier to read.
  const fedFundedTrend = yearStack.map((r) => ({
    fiscal_year: Number(r.fiscal_year),
    fed_funded_share: r.fed_funded_share === null ? null : Number(r.fed_funded_share),
    fed_funded_count: r.fed_funded_granted === null ? null : Number(r.fed_funded_granted),
    total_granted: r.granted === null ? null : Number(r.granted),
  }));

  // ─── Geography (Phase 4 follow-up) ────────────────────────────────────
  // Per-(state, CY) totals — drives the choropleth.
  const stateFacts = await db.all(`
    SELECT
      d.state_code,
      p.fiscal_year,
      SUM(p.patents_granted)::DOUBLE AS granted,
      SUM(p.applications_filed)::DOUBLE AS filed,
      COUNT(DISTINCT p.institution_sk)::DOUBLE AS n_institutions
    FROM patents p
    JOIN dim d USING (institution_sk)
    WHERE d.state_code IS NOT NULL AND d.country_code = 'US'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  // Per-(city, state, CY) hub facts — drives the bubble overlay.
  // Filter to hubs with at least 5 lifetime granted patents (tail is invisible
  // on the map anyway). Coords applied in JS below to skip un-geocoded cities.
  const hubFacts = await db.all(`
    WITH city_year AS (
      SELECT
        UPPER(d.city) AS city,
        d.state_code,
        p.fiscal_year,
        SUM(p.patents_granted) AS granted,
        SUM(p.applications_filed) AS filed
      FROM patents p
      JOIN dim d USING (institution_sk)
      WHERE d.city IS NOT NULL AND d.state_code IS NOT NULL AND d.country_code = 'US'
      GROUP BY 1, 2, 3
    ),
    lifetime AS (
      SELECT city, state_code, SUM(granted) AS lifetime_granted
      FROM city_year GROUP BY 1, 2
    )
    SELECT cy.city, cy.state_code, cy.fiscal_year,
           cy.granted::DOUBLE AS granted, cy.filed::DOUBLE AS filed
    FROM city_year cy
    JOIN lifetime l USING (city, state_code)
    WHERE l.lifetime_granted >= 5
    ORDER BY cy.state_code, cy.city, cy.fiscal_year
  `);

  await db.close();

  // BigInt-safe coercion.
  const toNum = (v) => (v === null || v === undefined ? null : typeof v === 'bigint' ? Number(v) : v);
  const cleanRow = (r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) out[k] = toNum(v);
    return out;
  };

  // Inline lat/lon on each hub row. Skip rows whose city isn't in the
  // gazetteer (long tail; would be invisible on the map regardless).
  const hubFactsWithCoords = hubFacts
    .map((r) => {
      const stateName = STATE_NAMES[r.state_code];
      if (!stateName) return null;
      const key = `${r.city}|${stateName}`;
      const coords = cityCoords[key];
      if (!coords) return null;
      return {
        city: r.city,
        state_code: r.state_code,
        fiscal_year: Number(r.fiscal_year),
        granted: toNum(r.granted),
        filed: toNum(r.filed),
        lat: coords[0],
        lon: coords[1],
      };
    })
    .filter((r) => r !== null);

  // Diagnostic: log un-geocoded city volume so future passes can extend the gazetteer.
  const ungeocoded = hubFacts.filter((r) => {
    const stateName = STATE_NAMES[r.state_code];
    if (!stateName) return true;
    return !cityCoords[`${r.city}|${stateName}`];
  });
  const ungeocodedCities = new Set(ungeocoded.map((r) => `${r.city}|${r.state_code}`));

  const snapshot = {
    overview: cleanRow(overview),
    year_stack: yearStack.map(cleanRow),
    top_institutions: topInstitutions.map(cleanRow),
    cpc_mix: cpcMix.map(cleanRow),
    fed_funded_trend: fedFundedTrend,
    state_facts: stateFacts.map(cleanRow),
    hub_facts: hubFactsWithCoords,
    generated_at: new Date().toISOString(),
    cohort_note:
      'CY2005-CY2024 mature granted-patent window; CY2025-CY2026 partial (truncation flags surfaced). Citations show 5-year forward window; mature cohort = grant CY <= 2020.',
  };

  fs.writeFileSync(OUT, JSON.stringify(snapshot));
  const bytes = fs.statSync(OUT).size;
  console.log(`✓ Wrote ${OUT}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KB`);
  console.log(
    `  ${snapshot.year_stack.length} year rows · ${snapshot.top_institutions.length} top institutions · ${snapshot.cpc_mix.length} CPC sections`,
  );
  console.log(
    `  ${snapshot.state_facts.length} state rows · ${snapshot.hub_facts.length} geocoded hub rows · ${ungeocodedCities.size} un-geocoded cities (skipped from map)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
