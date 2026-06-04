// Precompute /universities directory: every institution × every year, for
// every column the table displays. Stored COLUMNAR (parallel arrays) so
// brotli/gzip can deduplicate efficiently — JSON-of-objects would otherwise
// repeat every field name 1,014 × 20 times.
//
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_universities_snapshot.js
//
// Output: apps/web/public/data/snapshots/universities-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_PATH = path.join(DATA_DIR, 'snapshots/universities-snapshot.json');
const Database = require('duckdb-async').Database;

const FY_MIN = 2005;
const FY_MAX = 2024;
const YEARS = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MIN + i);

async function main() {
  const db = await Database.create(':memory:');
  for (const f of [
    'agg_uni_total_rd',
    'agg_uni_source_split',
    'agg_uni_pi_universe',
    'agg_uni_field_mix',
    'dim_institution',
  ]) {
    await db.exec(
      `CREATE OR REPLACE VIEW ${f} AS SELECT * FROM read_parquet('${path.join(DATA_DIR, `${f}.parquet`)}')`,
    );
  }

  // Universe = institutions that have ever reported total R&D.
  const universe = await db.all(`
    SELECT DISTINCT i.institution_sk, i.canonical_name AS name, i.state_code AS state
    FROM agg_uni_total_rd t
    JOIN dim_institution i USING (institution_sk)
    WHERE t.total_rd_nominal IS NOT NULL
    ORDER BY i.canonical_name
  `);
  const skList = universe.map((u) => u.institution_sk);
  const skToIdx = new Map(skList.map((sk, i) => [sk, i]));

  function makeColumn() {
    return Array.from({ length: skList.length }, () =>
      Array.from({ length: YEARS.length }, () => null),
    );
  }
  const totalRd = makeColumn();
  const federalShare = makeColumn();
  const piCount = makeColumn();
  const stemShare = makeColumn();

  const fyToIdx = new Map(YEARS.map((y, i) => [y, i]));

  // Single big SELECT per metric — far faster than per-year loops.
  for (const r of await db.all(`
    SELECT institution_sk, fiscal_year, total_rd_nominal AS v
    FROM agg_uni_total_rd WHERE total_rd_nominal IS NOT NULL
  `)) {
    const i = skToIdx.get(r.institution_sk);
    const j = fyToIdx.get(Number(r.fiscal_year));
    if (i !== undefined && j !== undefined) totalRd[i][j] = Number(r.v);
  }

  for (const r of await db.all(`
    SELECT
      institution_sk,
      fiscal_year,
      SUM(CASE WHEN source_category = 'federal' THEN amount_nominal ELSE 0 END)
        / NULLIF(SUM(amount_nominal), 0) AS v
    FROM agg_uni_source_split
    GROUP BY institution_sk, fiscal_year
  `)) {
    const i = skToIdx.get(r.institution_sk);
    const j = fyToIdx.get(Number(r.fiscal_year));
    if (i !== undefined && j !== undefined) federalShare[i][j] = r.v === null ? null : Number(r.v);
  }

  for (const r of await db.all(`
    SELECT institution_sk, fiscal_year, distinct_pi_count AS v
    FROM agg_uni_pi_universe WHERE distinct_pi_count IS NOT NULL
  `)) {
    const i = skToIdx.get(r.institution_sk);
    const j = fyToIdx.get(Number(r.fiscal_year));
    if (i !== undefined && j !== undefined) piCount[i][j] = Number(r.v);
  }

  for (const r of await db.all(`
    SELECT
      institution_sk,
      fiscal_year,
      SUM(CASE WHEN is_stem THEN amount_nominal ELSE 0 END)
        / NULLIF(SUM(amount_nominal), 0) AS v
    FROM agg_uni_field_mix
    GROUP BY institution_sk, fiscal_year
  `)) {
    const i = skToIdx.get(r.institution_sk);
    const j = fyToIdx.get(Number(r.fiscal_year));
    if (i !== undefined && j !== undefined) stemShare[i][j] = r.v === null ? null : Number(r.v);
  }

  await db.close();

  const snapshot = {
    generated_at: new Date().toISOString(),
    years: YEARS,
    institutions: universe.map((u) => ({
      sk: u.institution_sk,
      name: u.name,
      state: u.state ?? null,
    })),
    // Columnar: total_rd[institution_index][year_index] = nullable number.
    // Layout chosen so each year column is contiguous after transposing
    // client-side if needed; for our queries (index by sk first) this matches
    // the JS access pattern.
    total_rd: totalRd,
    federal_share: federalShare,
    pi_count: piCount,
    stem_share: stemShare,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
  const bytes = fs.statSync(OUT_PATH).size;
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  size:           ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  institutions:   ${snapshot.institutions.length}`);
  console.log(`  years:          ${snapshot.years.length}`);
  console.log(`  cells per col:  ${snapshot.institutions.length * snapshot.years.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
