// Rebuild dim_institution_crosswalk + PI-derived aggregations.
//
// Run from the dashboard repo root:
//   DASH_DIR="$(pwd)/apps/web/public/data" \
//   NODE_PATH=/tmp/duckdb-bin/node_modules \
//   node scripts/rebuild_pi_aggs.js
//
// Background
// ----------
// The original sk_crosswalk had 1014 rows, ALL self-identity — federal
// records using a different institution_sk than HERD did for the same
// university were orphaned (e.g. UW Seattle: 0 PIs despite $1.69B R&D
// because NSF references INST0000048 while HERD tracks INST0000285).
//
// This script rebuilds the crosswalk by matching aliases between the
// lake's dim_institution_aliases table and the HERD universe, weighting
// canonical-name matches 100x over alias-string matches and preferring
// HERD sks with recent (>= FY2020) R&D activity to handle legacy
// duplicate sks (e.g. INST0000597 = "UNIVERSITY OF WASHINGTON" with
// only FY2005-2009 data vs. modern INST0000285).
//
// Writes to apps/web/public/data/:
//   dim_institution_crosswalk.parquet
//   agg_uni_pi_universe.parquet
//   agg_uni_pi_distribution.parquet
//   agg_uni_team_size.parquet
//   agg_uni_nih_ic.parquet
//
// Skipped (require python _topics.py):
//   agg_uni_topic.parquet
//   agg_uni_specialization.parquet
//
// Residual blanks: HERD parent-rollup entities (n_observations < 30,
// first_seen_fy >= 2019) such as INST0010345 "University of Maryland"
// don't correspond to a single lake institution_sk — they aggregate
// multiple campuses. Those need a separate parent-child rollup step.

const Database = require('duckdb-async').Database;

const DASH = process.env.DASH_DIR;
const LAKE = process.env.LAKE_DIR ||
  '/Users/Usama/Documents/Documents - Usama’s MacBook Pro/Claude Projects/Herd Survey/data/processed';

if (!DASH) {
  console.error('Set DASH_DIR=apps/web/public/data before running.');
  process.exit(1);
}

async function main() {
  const db = await Database.create(':memory:');

  for (const [n, fp] of [
    ['dim_inst_lake', `${LAKE}/dim_institution.parquet`],
    ['aliases', `${LAKE}/dim_institution_aliases.parquet`],
    ['nsf_raw', `${LAKE}/fact_nsf_award.parquet`],
    ['nih_raw', `${LAKE}/fact_nih_project.parquet`],
    ['nih_pi_bridge', `${LAKE}/fact_nih_project_pi_bridge.parquet`],
    ['agg_total_rd', `${DASH}/agg_uni_total_rd.parquet`],
  ]) {
    await db.exec(`CREATE OR REPLACE VIEW ${n} AS SELECT * FROM read_parquet('${fp}')`);
  }

  await db.exec(`
    CREATE OR REPLACE VIEW dim_inst_herd AS
    SELECT DISTINCT i.institution_sk, i.canonical_name, i.state_code
    FROM (SELECT DISTINCT institution_sk FROM agg_total_rd) t
    JOIN dim_inst_lake i USING (institution_sk)
  `);

  await db.exec(`
    CREATE OR REPLACE VIEW nsf_fy AS
    SELECT *,
      CAST(CASE
        WHEN awd_eff_date IS NULL THEN NULL
        WHEN CAST(SUBSTRING(awd_eff_date, 6, 2) AS INTEGER) >= 10
          THEN CAST(SUBSTRING(awd_eff_date, 1, 4) AS INTEGER) + 1
        ELSE CAST(SUBSTRING(awd_eff_date, 1, 4) AS INTEGER)
      END AS INTEGER) AS fiscal_year
    FROM nsf_raw WHERE awd_eff_date IS NOT NULL
  `);

  console.log('Step 1: rebuild crosswalk');
  await db.exec(`
    CREATE OR REPLACE TABLE crosswalk_new AS
    WITH herd_with_freshness AS (
      SELECT h.institution_sk AS herd_sk, h.canonical_name, h.state_code,
             COALESCE(t.max_fy, 0) AS max_fy
      FROM dim_inst_herd h
      LEFT JOIN (
        SELECT institution_sk, MAX(fiscal_year) AS max_fy
        FROM agg_total_rd WHERE total_rd_nominal IS NOT NULL
        GROUP BY institution_sk
      ) t USING (institution_sk)
    ),
    herd_set AS (SELECT herd_sk, canonical_name, state_code, max_fy FROM herd_with_freshness),
    herd_names AS (
      SELECT herd_sk, UPPER(TRIM(canonical_name)) AS name_norm, state_code, 100 AS weight
      FROM herd_set WHERE canonical_name IS NOT NULL AND TRIM(canonical_name) != ''
      UNION
      SELECT h.herd_sk, UPPER(TRIM(a.alias_string)) AS name_norm,
             COALESCE(a.state_at_observation, h.state_code) AS state_code, 1 AS weight
      FROM herd_set h
      JOIN aliases a ON a.institution_sk = h.herd_sk
      WHERE a.alias_string IS NOT NULL AND TRIM(a.alias_string) != ''
    ),
    fed_active AS (
      SELECT DISTINCT institution_sk FROM nsf_raw WHERE institution_sk IS NOT NULL
      UNION
      SELECT DISTINCT institution_sk FROM nih_raw WHERE institution_sk IS NOT NULL
    ),
    lake_names AS (
      SELECT l.institution_sk AS lake_sk, UPPER(TRIM(l.canonical_name)) AS name_norm,
             l.state_code, 100 AS weight
      FROM dim_inst_lake l
      WHERE l.canonical_name IS NOT NULL AND TRIM(l.canonical_name) != ''
        AND l.institution_sk IN (SELECT institution_sk FROM fed_active)
      UNION
      SELECT a.institution_sk AS lake_sk, UPPER(TRIM(a.alias_string)) AS name_norm,
             COALESCE(a.state_at_observation, l.state_code) AS state_code, 1 AS weight
      FROM aliases a
      LEFT JOIN dim_inst_lake l ON l.institution_sk = a.institution_sk
      WHERE a.alias_string IS NOT NULL AND TRIM(a.alias_string) != ''
        AND a.institution_sk IN (SELECT institution_sk FROM fed_active)
    ),
    matches AS (
      SELECT l.lake_sk, h.herd_sk, SUM(LEAST(l.weight, h.weight)) AS score
      FROM lake_names l
      JOIN herd_names h
        ON l.name_norm = h.name_norm
       AND COALESCE(l.state_code, '') = COALESCE(h.state_code, '')
       AND l.state_code IS NOT NULL AND l.state_code != ''
      GROUP BY 1, 2
    ),
    ranked AS (
      -- Prefer (has FY2020+ R&D) > (higher score) > (more recent max_fy)
      SELECT m.lake_sk, m.herd_sk, m.score,
        ROW_NUMBER() OVER (
          PARTITION BY m.lake_sk
          ORDER BY
            (CASE WHEN COALESCE(hf.max_fy, 0) >= 2020 THEN 1 ELSE 0 END) DESC,
            m.score DESC,
            COALESCE(hf.max_fy, 0) DESC,
            m.herd_sk ASC
        ) AS rn
      FROM matches m
      LEFT JOIN herd_with_freshness hf USING (herd_sk)
    ),
    alias_matches AS (SELECT lake_sk AS fed_sk, herd_sk, score FROM ranked WHERE rn = 1),
    self_id AS (SELECT herd_sk, herd_sk AS fed_sk, 100 AS score FROM herd_set),
    combined AS (
      SELECT herd_sk, fed_sk, score FROM alias_matches
      UNION
      SELECT herd_sk, fed_sk, score FROM self_id
    ),
    final_ranked AS (
      SELECT fed_sk, herd_sk, score,
        ROW_NUMBER() OVER (PARTITION BY fed_sk ORDER BY score DESC, herd_sk ASC) AS rn
      FROM combined
    )
    SELECT
      h.herd_sk, f.fed_sk,
      CASE
        WHEN f.fed_sk = f.herd_sk THEN 'self_identity'
        WHEN f.score >= 100 THEN 'canonical_name_match'
        WHEN f.score >= 3 THEN 'alias_match_strong'
        ELSE 'alias_match_weak'
      END AS match_method,
      LEAST(1.0, f.score / 100.0) AS match_confidence,
      h.canonical_name, h.state_code
    FROM final_ranked f
    JOIN herd_set h USING (herd_sk)
    WHERE f.rn = 1
  `);

  await db.exec(`
    COPY crosswalk_new TO '${DASH}/dim_institution_crosswalk.parquet'
      (FORMAT 'parquet', COMPRESSION 'zstd')
  `);
  await db.exec(`CREATE OR REPLACE VIEW sk_crosswalk AS SELECT * FROM crosswalk_new`);

  console.log('Step 2: agg_uni_pi_universe');
  await db.exec(`
    COPY (
      WITH nsf_pis AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.pi_sk
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.pi_sk IS NOT NULL AND n.institution_sk IS NOT NULL
          AND n.fiscal_year BETWEEN 2005 AND 2024
      ),
      nih_pis AS (
        SELECT COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
               p.fy AS fiscal_year, b.pi_sk
        FROM nih_pi_bridge b
        JOIN nih_raw p ON p.application_id = b.application_id
        LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
        WHERE b.pi_sk IS NOT NULL AND p.institution_sk IS NOT NULL
          AND p.fy BETWEEN 2005 AND 2024
      ),
      all_pis AS (
        SELECT institution_sk, fiscal_year, pi_sk FROM nsf_pis
        UNION SELECT institution_sk, fiscal_year, pi_sk FROM nih_pis
      ),
      pi_counts AS (
        SELECT institution_sk, fiscal_year, COUNT(DISTINCT pi_sk) AS distinct_pi_count
        FROM all_pis GROUP BY 1, 2
      ),
      nsf_amounts AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, SUM(n.awd_amount_nominal) AS amount_nsf
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.institution_sk IS NOT NULL AND n.fiscal_year BETWEEN 2005 AND 2024
          AND n.awd_amount_nominal IS NOT NULL
        GROUP BY 1, 2
      ),
      nih_amounts AS (
        SELECT COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
               p.fy AS fiscal_year, SUM(p.total_cost_nominal) AS amount_nih
        FROM nih_raw p LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
        WHERE p.institution_sk IS NOT NULL AND p.fy BETWEEN 2005 AND 2024
          AND p.total_cost_nominal IS NOT NULL
        GROUP BY 1, 2
      )
      SELECT
        pc.institution_sk, pc.fiscal_year, pc.distinct_pi_count,
        COALESCE(na.amount_nsf, 0) AS federal_amount_nsf,
        COALESCE(nh.amount_nih, 0) AS federal_amount_nih,
        COALESCE(na.amount_nsf, 0) + COALESCE(nh.amount_nih, 0) AS federal_amount_total,
        (COALESCE(na.amount_nsf, 0) + COALESCE(nh.amount_nih, 0))
          / NULLIF(pc.distinct_pi_count, 0) AS amount_per_pi,
        CASE
          WHEN pc.fiscal_year = 2005 THEN 'fy05_entity_resolution_break'
          WHEN pc.fiscal_year = 2016 THEN 'fy16_minor_break'
          ELSE 'clean'
        END AS data_quality
      FROM pi_counts pc
      LEFT JOIN nsf_amounts na USING (institution_sk, fiscal_year)
      LEFT JOIN nih_amounts nh USING (institution_sk, fiscal_year)
      WHERE pc.distinct_pi_count > 0
    ) TO '${DASH}/agg_uni_pi_universe.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  console.log('Step 3: agg_uni_pi_distribution');
  await db.exec(`
    COPY (
      WITH nsf_per_pi AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.pi_sk, SUM(n.awd_amount_nominal) AS pi_amount
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.pi_sk IS NOT NULL AND n.institution_sk IS NOT NULL
          AND n.fiscal_year BETWEEN 2005 AND 2024 AND n.awd_amount_nominal IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      nih_per_pi AS (
        SELECT COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
               p.fy AS fiscal_year, b.pi_sk,
               SUM(p.total_cost_nominal / NULLIF((SELECT COUNT(*) FROM nih_pi_bridge b2 WHERE b2.application_id = p.application_id), 0)) AS pi_amount
        FROM nih_pi_bridge b
        JOIN nih_raw p ON p.application_id = b.application_id
        LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
        WHERE b.pi_sk IS NOT NULL AND p.institution_sk IS NOT NULL
          AND p.fy BETWEEN 2005 AND 2024 AND p.total_cost_nominal IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      pi_total AS (
        SELECT institution_sk, fiscal_year, pi_sk, SUM(pi_amount) AS pi_amount
        FROM (SELECT * FROM nsf_per_pi UNION ALL SELECT * FROM nih_per_pi)
        GROUP BY 1, 2, 3
      ),
      ranked AS (
        SELECT institution_sk, fiscal_year, pi_sk, pi_amount,
          NTILE(10) OVER (PARTITION BY institution_sk, fiscal_year ORDER BY pi_amount ASC) AS decile
        FROM pi_total WHERE pi_amount > 0
      )
      SELECT institution_sk, fiscal_year, decile,
        MIN(pi_amount) AS min_amount, MAX(pi_amount) AS max_amount,
        AVG(pi_amount) AS avg_amount, COUNT(*) AS pi_count
      FROM ranked GROUP BY 1, 2, 3
    ) TO '${DASH}/agg_uni_pi_distribution.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  console.log('Step 4: agg_uni_team_size');
  await db.exec(`
    COPY (
      WITH nsf_grants AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.awd_id AS grant_id,
               COALESCE(NULLIF(TRY_CAST(n.n_pi AS INTEGER), 0), 1) AS team_size,
               n.awd_amount_nominal AS amount
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.institution_sk IS NOT NULL AND n.fiscal_year BETWEEN 2005 AND 2024
          AND n.awd_amount_nominal IS NOT NULL
      ),
      nih_grants AS (
        SELECT COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
               p.fy AS fiscal_year, CAST(p.application_id AS VARCHAR) AS grant_id,
               (SELECT COUNT(DISTINCT pi_sk) FROM nih_pi_bridge b WHERE b.application_id = p.application_id) AS team_size,
               p.total_cost_nominal AS amount
        FROM nih_raw p LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
        WHERE p.institution_sk IS NOT NULL AND p.fy BETWEEN 2005 AND 2024
          AND p.total_cost_nominal IS NOT NULL
      ),
      all_grants AS (
        SELECT * FROM nsf_grants
        UNION ALL SELECT * FROM nih_grants WHERE team_size > 0
      ),
      bucketed AS (
        SELECT institution_sk, fiscal_year,
          CASE WHEN team_size = 1 THEN '1'
               WHEN team_size BETWEEN 2 AND 5 THEN '2-5'
               WHEN team_size BETWEEN 6 AND 10 THEN '6-10'
               WHEN team_size BETWEEN 11 AND 20 THEN '11-20'
               ELSE '21+' END AS team_size_bucket,
          grant_id, amount
        FROM all_grants
      )
      SELECT institution_sk, fiscal_year, team_size_bucket,
        COUNT(*) AS grant_count, SUM(amount) AS total_amount
      FROM bucketed GROUP BY 1, 2, 3
    ) TO '${DASH}/agg_uni_team_size.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  console.log('Step 5: agg_uni_nih_ic');
  await db.exec(`
    COPY (
      SELECT COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
        p.fy AS fiscal_year, p.admin_ic_code AS ic_code,
        COALESCE(MAX(p.admin_ic_sk), p.admin_ic_code) AS ic_full_name,
        SUM(p.total_cost_nominal) AS amount_nominal, COUNT(*) AS project_count
      FROM nih_raw p LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
      WHERE p.institution_sk IS NOT NULL AND p.fy BETWEEN 2005 AND 2024
        AND p.total_cost_nominal IS NOT NULL AND p.admin_ic_code IS NOT NULL
      GROUP BY 1, 2, 3
    ) TO '${DASH}/agg_uni_nih_ic.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  await db.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
