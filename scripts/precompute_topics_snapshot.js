// Precompute /topics page data: per-year summary, per-topic timeline,
// top universities per topic per year, top states per topic per year.
//
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_topics_snapshot.js
//
// Output: apps/web/public/data/snapshots/topics-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_PATH = path.join(DATA_DIR, 'snapshots/topics-snapshot.json');
const Database = require('duckdb-async').Database;

const PARQUETS = [
  'agg_national_topic',
  'agg_uni_specialization',
  'agg_state_topic',
  'dim_institution',
];

async function main() {
  const db = await Database.create(':memory:');
  for (const f of PARQUETS) {
    const p = path.join(DATA_DIR, `${f}.parquet`);
    if (!fs.existsSync(p)) throw new Error(`Missing parquet: ${p}`);
    await db.exec(`CREATE OR REPLACE VIEW ${f} AS SELECT * FROM read_parquet('${p}')`);
  }

  // Per-year per-topic summary with $-share + count-share + 5y CAGR + top uni.
  // We compute the count-share denominator as SUM(grant_count) over all topics
  // for the year (same overlap-counts-twice semantics as the live query).
  const summaries = await db.all(`
    WITH grant_totals AS (
      SELECT fiscal_year, SUM(grant_count) AS t_gc
      FROM agg_national_topic
      GROUP BY fiscal_year
    ),
    topu AS (
      SELECT fiscal_year, topic, institution_sk
      FROM (
        SELECT fiscal_year, topic, institution_sk,
               ROW_NUMBER() OVER (PARTITION BY fiscal_year, topic ORDER BY uni_topic_amount DESC) AS rn
        FROM agg_uni_specialization
      ) WHERE rn = 1
    ),
    -- Adaptive trailing CAGR (cap = 5 yr). For each (FY, topic) we pick
    -- the OLDEST prior row within [FY-5, FY-1] that has tagged_amount > 0
    -- and compute the CAGR over that window. Falls back to 1-4 yr windows
    -- for FY2006–FY2009 (no pre-FY2005 data) and for topics that had
    -- zero $ in earlier years (e.g., late-emerging AI/ML).
    cagr_priors AS (
      SELECT
        cur.fiscal_year AS cur_fy,
        cur.topic,
        cur.tagged_amount AS cur_amt,
        prior.fiscal_year AS prior_fy,
        prior.tagged_amount AS prior_amt,
        ROW_NUMBER() OVER (
          PARTITION BY cur.fiscal_year, cur.topic
          ORDER BY prior.fiscal_year ASC NULLS LAST
        ) AS rn
      FROM agg_national_topic cur
      LEFT JOIN agg_national_topic prior
        ON prior.topic = cur.topic
        AND prior.fiscal_year >= cur.fiscal_year - 5
        AND prior.fiscal_year < cur.fiscal_year
        AND prior.tagged_amount > 0
    ),
    cagr AS (
      SELECT
        cur_fy AS fiscal_year,
        topic,
        CASE
          WHEN prior_amt IS NOT NULL AND prior_amt > 0 AND cur_amt > 0 AND prior_fy IS NOT NULL
            THEN (POW(cur_amt / prior_amt, 1.0 / NULLIF(cur_fy - prior_fy, 0)) - 1) * 100
          ELSE NULL
        END AS cagr_5yr_pct,
        CASE WHEN prior_fy IS NOT NULL THEN cur_fy - prior_fy ELSE NULL END AS cagr_window_yr
      FROM cagr_priors
      WHERE rn = 1
    )
    SELECT
      t.fiscal_year,
      t.topic,
      t.tagged_amount / 1e6 AS fy24_amount_m,
      t.share_of_total * 100 AS fy24_share,
      t.grant_count * 100.0 / NULLIF(gt.t_gc, 0) AS fy24_count_share,
      t.grant_count::DOUBLE AS fy24_grant_count,
      c.cagr_5yr_pct,
      c.cagr_window_yr,
      di.canonical_name AS top_uni_name
    FROM agg_national_topic t
    LEFT JOIN grant_totals gt USING (fiscal_year)
    LEFT JOIN cagr c USING (fiscal_year, topic)
    LEFT JOIN topu USING (fiscal_year, topic)
    LEFT JOIN dim_institution di ON di.institution_sk = topu.institution_sk
    ORDER BY t.fiscal_year, t.tagged_amount DESC
  `);

  // Timeline per topic: every FY with the tagged amount + grant count + share.
  const timelines = await db.all(`
    SELECT
      topic,
      fiscal_year,
      tagged_amount / 1e6 AS tagged_amount_m,
      grant_count::DOUBLE AS grant_count,
      share_of_total * 100 AS share_pct
    FROM agg_national_topic
    ORDER BY topic, fiscal_year
  `);

  // Top 15 universities per topic per year (with specialization score + rank).
  const topUnis = await db.all(`
    WITH ranked AS (
      SELECT
        s.fiscal_year,
        s.topic,
        s.institution_sk,
        di.canonical_name,
        di.state_code,
        s.uni_topic_amount / 1e6 AS uni_topic_amount_m,
        s.uni_topic_share * 100 AS uni_topic_share,
        s.specialization_score,
        s.topic_rank_national,
        ROW_NUMBER() OVER (PARTITION BY s.fiscal_year, s.topic ORDER BY s.uni_topic_amount DESC) AS rn
      FROM agg_uni_specialization s
      LEFT JOIN dim_institution di ON di.institution_sk = s.institution_sk
    )
    SELECT fiscal_year, topic, institution_sk, canonical_name, state_code,
           uni_topic_amount_m, uni_topic_share, specialization_score, topic_rank_national
    FROM ranked
    WHERE rn <= 15
    ORDER BY fiscal_year, topic, rn
  `);

  // Top 10 states per topic per year.
  const topStates = await db.all(`
    WITH ranked AS (
      SELECT
        fiscal_year,
        topic,
        state_code,
        state_topic_amount / 1e6 AS state_topic_amount_m,
        state_topic_share * 100 AS state_topic_share,
        top_uni_in_state,
        ROW_NUMBER() OVER (PARTITION BY fiscal_year, topic ORDER BY state_topic_amount DESC) AS rn
      FROM agg_state_topic
    )
    SELECT fiscal_year, topic, state_code, state_topic_amount_m,
           state_topic_share, top_uni_in_state
    FROM ranked
    WHERE rn <= 10
    ORDER BY fiscal_year, topic, rn
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

  const snapshot = {
    generated_at: new Date().toISOString(),
    summaries: toJsonSafe(summaries),
    timelines: toJsonSafe(timelines),
    top_unis: toJsonSafe(topUnis),
    top_states: toJsonSafe(topStates),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
  const bytes = fs.statSync(OUT_PATH).size;
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  size:             ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  summaries:        ${snapshot.summaries.length} rows`);
  console.log(`  timelines:        ${snapshot.timelines.length} rows`);
  console.log(`  top_unis:         ${snapshot.top_unis.length} rows`);
  console.log(`  top_states:       ${snapshot.top_states.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
