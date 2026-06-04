// Precompute one JSON per institution containing every section of the
// /universities/[sk] profile + /compare page payload. Replaces the 14
// per-load DuckDB-WASM queries with a single fetch of a ~5-30 KB file.
//
// Strategy: do ONE query per source table that returns every row for every
// institution, then group in JS. Avoids 1014 × 14 = 14k DuckDB queries.
//
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_profile_snapshots.js
//
// Output: apps/web/public/data/profiles/INST*.json  (~1,014 files)

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_DIR = path.join(DATA_DIR, 'profiles');
const Database = require('duckdb-async').Database;

const SOURCES = [
  'dim_institution',
  'agg_uni_total_rd',
  'agg_uni_source_split',
  'agg_uni_agency_split',
  'agg_uni_federal_funds',
  'agg_uni_pi_universe',
  'agg_uni_pi_distribution',
  'agg_uni_team_size',
  'agg_uni_topic',
  'agg_uni_field_mix',
  'agg_uni_subject_tag',
  'agg_uni_concentration',
  'agg_uni_state_context',
  'agg_uni_peers',
  'agg_uni_patents',
  'agg_uni_nih_ic',
  'agg_uni_specialization',
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Wipe stale per-profile JSONs so a renamed/deleted institution doesn't linger.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const db = await Database.create(':memory:');
  for (const f of SOURCES) {
    await db.exec(
      `CREATE OR REPLACE VIEW ${f} AS SELECT * FROM read_parquet('${path.join(DATA_DIR, `${f}.parquet`)}')`,
    );
  }

  // Universe = every institution in dim_institution that has at least one
  // row in agg_uni_total_rd (the profile pages don't render for fund-less
  // institutions).
  const universe = await db.all(`
    SELECT DISTINCT t.institution_sk, i.canonical_name, i.state_code
    FROM agg_uni_total_rd t
    JOIN dim_institution i USING (institution_sk)
    ORDER BY t.institution_sk
  `);

  console.log(`Universe: ${universe.length} institutions`);

  // Build per-institution buckets. For each source table, one "big" SELECT
  // returning all rows for the universe; then we bucket in JS.
  const profiles = new Map();
  for (const u of universe) {
    profiles.set(u.institution_sk, {
      institution_sk: u.institution_sk,
      name: u.canonical_name,
      state: u.state_code,
      totalRd: [],
      sources: [],
      agencies: [],
      federalFunds: [],
      piMetrics: [],
      piDistribution: [],
      teamSize: [],
      topics: [],
      fieldMix: [],
      subjectTags: [],
      concentration: [],
      stateContext: [],
      peers: [],
      patents: [],
      nihIcs: [],
      specialization: [],
    });
  }

  function bucket(rows, key, transform = (r) => r) {
    for (const r of rows) {
      const p = profiles.get(r.institution_sk);
      if (!p) continue;
      p[key].push(transform(r));
    }
  }

  const toNum = (v) => (v === null || v === undefined ? null : typeof v === 'bigint' ? Number(v) : v);
  const toJsonSafe = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'institution_sk') continue;
      out[k] = toNum(v);
    }
    return out;
  };

  console.log('Loading sub-queries…');

  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, total_rd_nominal, total_rd_real
                  FROM agg_uni_total_rd ORDER BY institution_sk, fiscal_year`),
    'totalRd',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, source_category, amount_nominal
                  FROM agg_uni_source_split ORDER BY institution_sk, fiscal_year, source_category`),
    'sources',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, agency_bucket, amount_nominal
                  FROM agg_uni_agency_split ORDER BY institution_sk, fiscal_year, agency_bucket`),
    'agencies',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, agency_bucket, amount_nominal, taxonomy_version
                  FROM agg_uni_federal_funds ORDER BY institution_sk, fiscal_year, agency_bucket`),
    'federalFunds',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, distinct_pi_count, federal_amount_nsf,
                         federal_amount_nih, federal_amount_total, amount_per_pi
                  FROM agg_uni_pi_universe ORDER BY institution_sk, fiscal_year`),
    'piMetrics',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, decile, min_amount, max_amount, avg_amount, pi_count
                  FROM agg_uni_pi_distribution ORDER BY institution_sk, fiscal_year, decile`),
    'piDistribution',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, team_size_bucket, grant_count, total_amount
                  FROM agg_uni_team_size ORDER BY institution_sk, fiscal_year, team_size_bucket`),
    'teamSize',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, topic, grant_count, tagged_amount
                  FROM agg_uni_topic ORDER BY institution_sk, fiscal_year, tagged_amount DESC`),
    'topics',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, field_category, is_stem, amount_nominal
                  FROM agg_uni_field_mix ORDER BY institution_sk, fiscal_year, field_category`),
    'fieldMix',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, subject_tag, tagged_amount
                  FROM agg_uni_subject_tag ORDER BY institution_sk, fiscal_year, subject_tag`),
    'subjectTags',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, hhi, shannon_entropy, cov_5yr
                  FROM agg_uni_concentration ORDER BY institution_sk, fiscal_year`),
    'concentration',
    toJsonSafe,
  );
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, uni_total, state_total, share_of_state
                  FROM agg_uni_state_context ORDER BY institution_sk, fiscal_year`),
    'stateContext',
    toJsonSafe,
  );
  // peers uses uni_sk + peer_sk (no institution_sk column directly) — alias.
  const peers = await db.all(`
    SELECT uni_sk AS institution_sk, peer_sk, peer_rank
    FROM agg_uni_peers ORDER BY uni_sk, peer_rank
  `);
  bucket(peers, 'peers', toJsonSafe);
  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, award_count, patent_count, patents_per_award
                  FROM agg_uni_patents ORDER BY institution_sk, fiscal_year`),
    'patents',
    toJsonSafe,
  );

  bucket(
    await db.all(`SELECT institution_sk, fiscal_year, ic_code, ic_full_name, amount_nominal, project_count
                  FROM agg_uni_nih_ic ORDER BY institution_sk, fiscal_year, amount_nominal DESC`),
    'nihIcs',
    toJsonSafe,
  );

  // Specialization: keep latest-FY top-5 per institution by score.
  // This matches what getUniversitySpecialization(sk, 5) returns.
  bucket(
    await db.all(`
      WITH latest AS (
        SELECT institution_sk, MAX(fiscal_year) AS fy
        FROM agg_uni_specialization
        GROUP BY institution_sk
      ),
      ranked AS (
        SELECT
          s.institution_sk,
          s.fiscal_year,
          s.topic,
          s.uni_topic_amount,
          s.uni_topic_share,
          s.national_topic_amount,
          s.uni_total_amount,
          s.uni_total_share,
          s.specialization_score,
          s.topic_rank_national,
          ROW_NUMBER() OVER (PARTITION BY s.institution_sk ORDER BY s.specialization_score DESC) AS rn
        FROM agg_uni_specialization s
        JOIN latest l USING (institution_sk)
        WHERE s.fiscal_year = l.fy
      )
      SELECT institution_sk, fiscal_year, topic, uni_topic_amount, uni_topic_share,
             national_topic_amount, uni_total_amount, uni_total_share,
             specialization_score, topic_rank_national
      FROM ranked WHERE rn <= 5
      ORDER BY institution_sk, rn
    `),
    'specialization',
    toJsonSafe,
  );

  await db.close();

  console.log('Writing per-profile JSONs…');

  let totalBytes = 0;
  let written = 0;
  let skipped = 0;
  for (const [sk, profile] of profiles) {
    // If the profile has no real data (only the universe entry), skip — those
    // institutions don't have a valid profile page anyway.
    if (profile.totalRd.length === 0) {
      skipped++;
      continue;
    }
    const json = JSON.stringify(profile);
    fs.writeFileSync(path.join(OUT_DIR, `${sk}.json`), json);
    totalBytes += json.length;
    written++;
  }

  console.log(`\n✓ Wrote ${written} profile files (${skipped} skipped — no total_rd rows)`);
  console.log(`  Total uncompressed: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Median file size:   ${(totalBytes / written / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
