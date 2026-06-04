// Precompute the /national page's entire data payload into a single JSON.
//
// Replaces ~14 runtime DuckDB-WASM queries. Eliminates the 2-5 MB
// DuckDB-WASM bundle from the /national cold path.
//
// Run before `next build` whenever parquets change:
//   NODE_PATH=/tmp/duckdb-bin/node_modules node scripts/precompute_national_snapshot.js
//
// Output: apps/web/public/data/snapshots/national-snapshot.json

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../apps/web/public/data');
const OUT_PATH = path.join(DATA_DIR, 'snapshots/national-snapshot.json');
const Database = require('duckdb-async').Database;

const PARQUETS = [
  'agg_national_overview',
  'agg_national_agency_trend',
  'agg_national_topic',
  'agg_national_team_size',
  'agg_national_nih_ic',
  'agg_national_concentration',
  'agg_uni_field_mix',
  'agg_uni_total_rd',
  'agg_uni_source_split',
  'agg_uni_pi_distribution',
  'agg_uni_pi_universe',
  'agg_uni_growth',
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

  // §1 overview: per FY × source category
  const overview = await db.all(`
    SELECT fiscal_year, source_category, amount_nominal, amount_real
    FROM agg_national_overview
    ORDER BY fiscal_year, source_category
  `);

  // §2 agency trend
  const agencies = await db.all(`
    SELECT fiscal_year, agency_bucket, amount_nominal, amount_real
    FROM agg_national_agency_trend
    ORDER BY fiscal_year, agency_bucket
  `);

  // §3 concentration
  const concentration = await db.all(`
    SELECT fiscal_year, bucket, share
    FROM agg_national_concentration
    ORDER BY fiscal_year, bucket
  `);

  // §4 geography — per (state × FY) so the client can re-key on year change
  const stateRollup = await db.all(`
    SELECT
      i.state_code,
      t.fiscal_year,
      SUM(t.total_rd_nominal) AS total_rd_nominal,
      COUNT(DISTINCT t.institution_sk) AS n_institutions
    FROM agg_uni_total_rd t
    JOIN dim_institution i USING (institution_sk)
    WHERE t.total_rd_nominal IS NOT NULL AND i.state_code IS NOT NULL
    GROUP BY i.state_code, t.fiscal_year
    ORDER BY t.fiscal_year, total_rd_nominal DESC
  `);

  // §5 trends — already multi-FY
  const trends = await db.all(`
    WITH tot AS (
      SELECT fiscal_year, SUM(amount_nominal) AS total_rd_nominal
      FROM agg_national_overview
      GROUP BY fiscal_year
    ),
    fed AS (
      SELECT
        fiscal_year,
        SUM(CASE WHEN source_category = 'federal' THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS federal_share
      FROM agg_national_overview
      GROUP BY fiscal_year
    ),
    pi AS (
      SELECT fiscal_year, SUM(distinct_pi_count)::DOUBLE AS pi_count
      FROM agg_uni_pi_universe
      GROUP BY fiscal_year
    )
    SELECT
      t.fiscal_year,
      t.total_rd_nominal,
      f.federal_share,
      COALESCE(pi.pi_count, 0) AS pi_count
    FROM tot t
    LEFT JOIN fed f USING (fiscal_year)
    LEFT JOIN pi USING (fiscal_year)
    ORDER BY t.fiscal_year
  `);

  // §6 field mix (STEM)
  const fieldMix = await db.all(`
    SELECT fiscal_year, is_stem, SUM(amount_nominal) AS amount_nominal
    FROM agg_uni_field_mix
    GROUP BY fiscal_year, is_stem
    ORDER BY fiscal_year, is_stem
  `);

  // §7 PI distribution — per FY × decile (averaged across institutions)
  const piDist = await db.all(`
    SELECT
      fiscal_year,
      decile,
      AVG(avg_amount) AS avg_amount
    FROM agg_uni_pi_distribution
    WHERE decile IS NOT NULL AND avg_amount IS NOT NULL
    GROUP BY fiscal_year, decile
    ORDER BY fiscal_year, decile
  `);

  // §8 topics — per FY × topic
  const topics = await db.all(`
    SELECT fiscal_year, topic, tagged_amount, share_of_total, grant_count
    FROM agg_national_topic
    ORDER BY fiscal_year, tagged_amount DESC
  `);

  // §9 team size — per FY × bucket
  const teamSize = await db.all(`
    SELECT fiscal_year, team_size_bucket, total_amount, share_of_total, grant_count
    FROM agg_national_team_size
    ORDER BY fiscal_year, team_size_bucket
  `);

  // §S5.1 NIH ICs
  const nihIcs = await db.all(`
    SELECT fiscal_year, ic_code, ic_full_name, amount_nominal, pct_of_nih
    FROM agg_national_nih_ic
    ORDER BY fiscal_year, amount_nominal DESC
  `);

  // §S5.2 topic leaders: top 5 unis per topic per FY
  const topicLeaders = await db.all(`
    WITH ranked AS (
      SELECT
        s.fiscal_year,
        s.topic,
        s.institution_sk,
        di.canonical_name,
        di.state_code,
        s.uni_topic_amount,
        s.specialization_score,
        s.topic_rank_national
      FROM agg_uni_specialization s
      LEFT JOIN dim_institution di ON di.institution_sk = s.institution_sk
    )
    SELECT * FROM ranked
    WHERE topic_rank_national <= 5
    ORDER BY fiscal_year, topic, topic_rank_national
  `);

  // §S5.3 state topic leaders: top 10 states per topic per FY
  const stateTopicLeaders = await db.all(`
    WITH ranked AS (
      SELECT
        s.fiscal_year,
        s.topic,
        s.state_code,
        s.state_topic_amount,
        s.state_topic_share,
        s.top_uni_in_state,
        ROW_NUMBER() OVER (
          PARTITION BY s.fiscal_year, s.topic ORDER BY s.state_topic_amount DESC
        ) AS rn
      FROM agg_state_topic s
    )
    SELECT fiscal_year, topic, state_code, state_topic_amount, state_topic_share, top_uni_in_state
    FROM ranked
    WHERE rn <= 10
    ORDER BY fiscal_year, topic, state_topic_amount DESC
  `);

  // §S5.4 climbers / fallers — pre-baked, single window
  const climbers = await db.all(`
    SELECT
      g.institution_sk,
      di.canonical_name,
      di.state_code,
      g.fy24_total,
      g.fy19_total,
      g.cagr_5yr,
      g.rank_change_5yr
    FROM agg_uni_growth g
    LEFT JOIN dim_institution di USING (institution_sk)
    WHERE g.cagr_5yr IS NOT NULL AND g.fy24_total >= 5e6
    ORDER BY g.cagr_5yr DESC
    LIMIT 10
  `);
  const fallers = await db.all(`
    SELECT
      g.institution_sk,
      di.canonical_name,
      di.state_code,
      g.fy24_total,
      g.fy19_total,
      g.cagr_5yr,
      g.rank_change_5yr
    FROM agg_uni_growth g
    LEFT JOIN dim_institution di USING (institution_sk)
    WHERE g.cagr_5yr IS NOT NULL AND g.fy24_total >= 5e6
    ORDER BY g.cagr_5yr ASC
    LIMIT 10
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
    overview: toJsonSafe(overview),
    agencies: toJsonSafe(agencies),
    concentration: toJsonSafe(concentration),
    state_rollup: toJsonSafe(stateRollup),
    trends: toJsonSafe(trends),
    field_mix: toJsonSafe(fieldMix),
    pi_distribution: toJsonSafe(piDist),
    topics: toJsonSafe(topics),
    team_size: toJsonSafe(teamSize),
    nih_ics: toJsonSafe(nihIcs),
    topic_leaders: toJsonSafe(topicLeaders),
    state_topic_leaders: toJsonSafe(stateTopicLeaders),
    climbers: toJsonSafe(climbers),
    fallers: toJsonSafe(fallers),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
  const bytes = fs.statSync(OUT_PATH).size;
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  size:             ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  overview rows:    ${snapshot.overview.length}`);
  console.log(`  agencies rows:    ${snapshot.agencies.length}`);
  console.log(`  state_rollup:     ${snapshot.state_rollup.length}`);
  console.log(`  topics rows:      ${snapshot.topics.length}`);
  console.log(`  nih_ics rows:     ${snapshot.nih_ics.length}`);
  console.log(`  topic_leaders:    ${snapshot.topic_leaders.length}`);
  console.log(`  state_topic_lead: ${snapshot.state_topic_leaders.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
