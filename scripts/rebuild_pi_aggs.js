// Rebuild dim_institution_crosswalk + all PI- and topic-derived aggregations.
//
// Run from the dashboard repo root:
//   DASH_DIR="$(pwd)/apps/web/public/data" \
//   NODE_PATH=/tmp/duckdb-bin/node_modules \
//   node scripts/rebuild_pi_aggs.js
//
// What this fixes
// ---------------
// 1. Crosswalk rebuild — see commit 55d34cc. Maps federal sks to HERD sks
//    via aliases instead of self-identity only.
//
// 2. NSF time attribution — the previous aggregations used awd_eff_date
//    (award START year) for NSF, which (a) credited the full multi-year
//    award amount to the start year and (b) only counted PIs in the year
//    their grant started, not in continuing years. This script joins
//    fact_nsf_award_fy_obligation (per-FY $ obligations, 435K rows) to
//    fact_nsf_award (institution_sk + pi_sk + title metadata) so PI
//    counts and $ totals reflect each FY's actual obligation. A PI on a
//    5-year award is now counted in all 5 years.
//
// 3. Topic tagging — agg_uni_topic was previously python-only, so the
//    crosswalk rebuild in 55d34cc didn't propagate. This script now
//    regenerates it with the 30-topic regex from _topics.py and the
//    obligation-FY semantics.
//
// 4. agg_uni_specialization — depends on agg_uni_topic + agg_uni_total_rd.
//    Regenerated to pick up the new topic attributions.
//
// Outputs (apps/web/public/data/):
//   dim_institution_crosswalk.parquet
//   agg_uni_pi_universe.parquet
//   agg_uni_pi_distribution.parquet
//   agg_uni_team_size.parquet
//   agg_uni_nih_ic.parquet
//   agg_uni_topic.parquet
//   agg_uni_specialization.parquet

const Database = require('duckdb-async').Database;

const DASH = process.env.DASH_DIR;
const LAKE = process.env.LAKE_DIR ||
  '/Users/Usama/Documents/Documents - Usama’s MacBook Pro/Claude Projects/Herd Survey/data/processed';

if (!DASH) {
  console.error('Set DASH_DIR=apps/web/public/data before running.');
  process.exit(1);
}

// 30-topic taxonomy, ported from scripts/aggregations/_topics.py. Patterns
// are RE2-compatible (DuckDB regex engine). Match is case-insensitive at
// the call site.
const TOPICS = [
  ['Artificial intelligence & ML',      String.raw`\b(artificial intelligence|machine learning|deep learning|neural network|transformer|large language model|LLM|reinforcement learning)\b`],
  ['Computer vision',                    String.raw`\b(computer vision|image recognition|object detection|visual recognition)\b`],
  ['Natural language processing',        String.raw`\b(natural language processing|NLP|language model|speech recognition|machine translation)\b`],
  ['Cancer research',                    String.raw`\b(cancer|oncology|tumor|carcinoma|malignan(t|cy)|metasta(sis|tic|sized))\b`],
  ['Neuroscience & brain',               String.raw`\b(neuroscience|brain|neurolog|neuron|neuronal|cognitive|cortex|cerebr(al|um))\b`],
  ['Cardiovascular',                     String.raw`\b(cardiovascular|cardiac|heart disease|coronary|stroke|hypertension)\b`],
  ['Infectious disease & vaccines',      String.raw`\b(infectious disease|virus|viral|bacteria(l)?|pathogen|vaccine|antimicrobial|pandemic)\b`],
  ['Immunology',                         String.raw`\b(immunology|immune|autoimmune|antibody|antigen|T cell|B cell)\b`],
  ['Genomics & genetics',                String.raw`\b(genom(e|ic|ics)|genetic|DNA|RNA sequenc|CRISPR|gene editing|gene therapy)\b`],
  ['Drug discovery & pharmacology',      String.raw`\b(drug discovery|pharmacolog|small molecule|therapeutic agent|medicinal chemistry)\b`],
  ['Mental health & psychiatry',         String.raw`\b(mental health|psychiatr|depression|anxiety|PTSD|schizophrenia|addiction|substance abuse)\b`],
  ['Aging & longevity',                  String.raw`\b(aging|longevity|Alzheimer|dementia|Parkinson|senescence)\b`],
  ['Diabetes & metabolic',               String.raw`\b(diabetes|obesity|metabolic|insulin)\b`],
  ['Regenerative medicine',              String.raw`\b(stem cell|regenerative medicine|tissue engineering)\b`],
  ['Bioengineering & synthetic biology', String.raw`\b(bioengineering|synthetic biology|biomanufacturing|bioreactor)\b`],
  ['Public health & epidemiology',       String.raw`\b(public health|epidemiolog|health disparit|health equity|population health)\b`],
  ['Quantum information',                String.raw`\b(quantum computing|quantum information|qubit|quantum cryptography|quantum sens)\b`],
  ['Materials science',                  String.raw`\b(materials science|polymer|composite|alloy|semiconductor|nanomaterial)\b`],
  ['Nanotechnology',                     String.raw`\b(nanotechnolog|nanoparticle|nanostructure|nanoscale)\b`],
  ['Climate & sustainability',           String.raw`\b(climate change|greenhouse|carbon dioxide|sustainability|decarbonization|emission)\b`],
  ['Renewable energy',                   String.raw`\b(solar|wind|geothermal|renewable energy|photovoltaic)\b`],
  ['Energy storage & batteries',         String.raw`\b(battery|lithium ion|energy storage|fuel cell)\b`],
  ['Cybersecurity',                      String.raw`\b(cybersecurity|cyber security|network security|cryptograph|encryption)\b`],
  ['Robotics & autonomy',                String.raw`\b(robot(ic|s)?|autonomous (vehicle|system)|self-driving|drone)\b`],
  ['Earth observation',                  String.raw`\b(remote sensing|satellite (data|imagery)|earth observation|land cover|MODIS|landsat)\b`],
  ['Astrophysics & cosmology',           String.raw`\b(astrophysic|cosmolog|galaxy|exoplanet|dark (matter|energy)|gravitational wave)\b`],
  ['Agriculture & food',                 String.raw`\b(agricultur|crop|soil|food security|sustainable agriculture)\b`],
  ['Water resources',                    String.raw`\b(water resource|hydrolog|watershed|drinking water|wastewater)\b`],
  ['Education research',                 String.raw`\b(STEM education|science education|curriculum|pedagog|teacher training|broadening participation)\b`],
  ['Social & behavioral science',        String.raw`\b(behavioral science|sociolog|economic policy|social network|inequality)\b`],
];

function buildTopicUnionSql(amountAlias = 'amount') {
  return TOPICS.map(([topic, pattern]) => {
    const safePattern = pattern.replace(/'/g, "''");
    const safeTopic = topic.replace(/'/g, "''");
    return `
      SELECT
        institution_sk,
        fiscal_year,
        '${safeTopic}' AS topic,
        COUNT(*) FILTER (WHERE regexp_matches(text, '${safePattern}', 'i')) AS grant_count,
        SUM(CASE WHEN regexp_matches(text, '${safePattern}', 'i') THEN ${amountAlias} ELSE 0 END) AS tagged_amount
      FROM tagged_grants
      GROUP BY 1, 2`;
  }).join(' UNION ALL ');
}

async function main() {
  const db = await Database.create(':memory:');

  for (const [n, fp] of [
    ['dim_inst_lake', `${LAKE}/dim_institution.parquet`],
    ['aliases', `${LAKE}/dim_institution_aliases.parquet`],
    ['nsf_raw', `${LAKE}/fact_nsf_award.parquet`],
    ['nsf_obl', `${LAKE}/fact_nsf_award_fy_obligation.parquet`],
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

  // NSF time attribution view. Joins per-FY obligations to award metadata.
  // Per-FY $ comes from fund_oblg_amt_nominal. Award identity (institution,
  // PI, n_pi, title) comes from fact_nsf_award. A PI on a 5-year award now
  // gets one row per active year (vs. one row in the start year only).
  await db.exec(`
    CREATE OR REPLACE VIEW nsf_fy AS
    SELECT
      n.awd_id,
      n.institution_sk,
      n.pi_sk,
      n.n_pi,
      n.awd_titl_txt,
      n.awd_abstr_narration,
      obl.fund_oblg_fiscal_yr AS fiscal_year,
      obl.fund_oblg_amt_nominal AS fy_amount
    FROM nsf_obl obl
    JOIN nsf_raw n ON n.awd_id = obl.awd_id
    WHERE obl.fund_oblg_fiscal_yr BETWEEN 2005 AND 2024
      AND obl.fund_oblg_amt_nominal IS NOT NULL
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

  console.log('Step 2: agg_uni_pi_universe (obligation-FY)');
  await db.exec(`
    COPY (
      WITH nsf_pis AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.pi_sk
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.pi_sk IS NOT NULL AND n.institution_sk IS NOT NULL
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
               n.fiscal_year, SUM(n.fy_amount) AS amount_nsf
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.institution_sk IS NOT NULL AND n.fy_amount IS NOT NULL
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

  console.log('Step 3: agg_uni_pi_distribution (obligation-FY)');
  await db.exec(`
    COPY (
      WITH nsf_per_pi AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.pi_sk, SUM(n.fy_amount) AS pi_amount
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.pi_sk IS NOT NULL AND n.institution_sk IS NOT NULL
          AND n.fy_amount IS NOT NULL
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

  console.log('Step 4: agg_uni_team_size (obligation-FY)');
  await db.exec(`
    COPY (
      WITH nsf_grants AS (
        SELECT COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
               n.fiscal_year, n.awd_id AS grant_id,
               COALESCE(NULLIF(TRY_CAST(n.n_pi AS INTEGER), 0), 1) AS team_size,
               n.fy_amount AS amount
        FROM nsf_fy n LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
        WHERE n.institution_sk IS NOT NULL AND n.fy_amount IS NOT NULL
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

  console.log('Step 6: agg_uni_topic (obligation-FY + 30-topic regex)');
  // Tag both NSF and NIH grants against the 30-topic taxonomy. NSF text =
  // title + abstract; NIH text = title + project_terms. Same regex matches
  // both. Per-FY amount for NSF = obligation amount; for NIH = total_cost
  // (already per-FY in fact_nih_project).
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE tagged_grants AS
    SELECT
      COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
      n.fiscal_year,
      COALESCE(n.fy_amount, 0) AS amount,
      COALESCE(n.awd_titl_txt, '') || ' ' || COALESCE(n.awd_abstr_narration, '') AS text
    FROM nsf_fy n
    LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
    WHERE n.institution_sk IS NOT NULL
    UNION ALL
    SELECT
      COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
      p.fy AS fiscal_year,
      COALESCE(p.total_cost_nominal, 0) AS amount,
      COALESCE(p.project_title, '') || ' ' || COALESCE(p.project_terms, '') AS text
    FROM nih_raw p
    LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
    WHERE p.institution_sk IS NOT NULL AND p.fy BETWEEN 2005 AND 2024
  `);

  await db.exec(`
    COPY (
      SELECT institution_sk, fiscal_year, topic, grant_count, tagged_amount
      FROM (${buildTopicUnionSql('amount')})
      WHERE grant_count > 0
    ) TO '${DASH}/agg_uni_topic.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  console.log('Step 7: agg_uni_specialization');
  await db.exec(`
    CREATE OR REPLACE VIEW agg_uni_topic_v AS
      SELECT * FROM read_parquet('${DASH}/agg_uni_topic.parquet');
  `);
  await db.exec(`
    COPY (
      WITH uni_topic AS (
        SELECT institution_sk, fiscal_year, topic, tagged_amount AS uni_topic_amount
        FROM agg_uni_topic_v WHERE tagged_amount > 0
      ),
      uni_total AS (
        SELECT institution_sk, fiscal_year, total_rd_nominal AS uni_total_amount
        FROM agg_total_rd WHERE total_rd_nominal > 0
      ),
      national_topic AS (
        SELECT fiscal_year, topic, SUM(uni_topic_amount) AS national_topic_amount
        FROM uni_topic GROUP BY 1, 2
      ),
      national_total AS (
        SELECT fiscal_year, SUM(uni_total_amount) AS national_total_amount
        FROM uni_total GROUP BY 1
      ),
      joined AS (
        SELECT
          ut.institution_sk, ut.fiscal_year, ut.topic,
          ut.uni_topic_amount, nt.national_topic_amount,
          utot.uni_total_amount, ntot.national_total_amount,
          ut.uni_topic_amount / NULLIF(nt.national_topic_amount, 0) AS uni_topic_share,
          utot.uni_total_amount / NULLIF(ntot.national_total_amount, 0) AS uni_total_share
        FROM uni_topic ut
        JOIN national_topic nt USING (fiscal_year, topic)
        JOIN uni_total utot ON utot.institution_sk = ut.institution_sk AND utot.fiscal_year = ut.fiscal_year
        JOIN national_total ntot USING (fiscal_year)
      )
      SELECT institution_sk, fiscal_year, topic,
        uni_topic_amount, uni_topic_share, national_topic_amount,
        uni_total_amount, uni_total_share,
        uni_topic_share / NULLIF(uni_total_share, 0) AS specialization_score,
        CAST(
          RANK() OVER (PARTITION BY fiscal_year, topic ORDER BY uni_topic_amount DESC)
          AS INTEGER
        ) AS topic_rank_national
      FROM joined
    ) TO '${DASH}/agg_uni_specialization.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  await db.close();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
