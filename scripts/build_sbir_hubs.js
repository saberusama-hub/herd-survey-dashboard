// Build agg_sbir_hubs.parquet — SBIR/STTR activity aggregated to the
// (firm_city, firm_state, fiscal_year) grain, with topic tagging via the
// same 30-topic regex used elsewhere in the platform.
//
//   NODE_PATH=/private/tmp/herd_node/node_modules node scripts/build_sbir_hubs.js
//
// Output: apps/web/public/data/agg_sbir_hubs.parquet

const path = require('path');
const D = require('/private/tmp/herd_node/node_modules/duckdb-async').Database;

const LAKE =
  '/Users/Usama/Documents/Documents - Usama’s MacBook Pro/Claude Projects/Herd Survey/data/processed';
const DASH = path.resolve(__dirname, '../apps/web/public/data');

// 30-topic taxonomy — same as scripts/rebuild_pi_aggs.js.
const TOPICS = [
  ['AI & ML',                            String.raw`\b(artificial intelligence|machine learning|deep learning|neural network|transformer|large language model|LLM|reinforcement learning)\b`],
  ['Computer vision',                    String.raw`\b(computer vision|image recognition|object detection|visual recognition)\b`],
  ['NLP',                                String.raw`\b(natural language processing|NLP|language model|speech recognition|machine translation)\b`],
  ['Cancer research',                    String.raw`\b(cancer|oncology|tumor|carcinoma|malignan(t|cy)|metasta(sis|tic|sized))\b`],
  ['Neuroscience & brain',               String.raw`\b(neuroscience|brain|neurolog|neuron|neuronal|cognitive|cortex|cerebr(al|um))\b`],
  ['Cardiovascular',                     String.raw`\b(cardiovascular|cardiac|heart disease|coronary|stroke|hypertension)\b`],
  ['Infectious disease & vaccines',      String.raw`\b(infectious disease|virus|viral|bacteria(l)?|pathogen|vaccine|antimicrobial|pandemic)\b`],
  ['Immunology',                         String.raw`\b(immunology|immune|autoimmune|antibody|antigen|T cell|B cell)\b`],
  ['Genomics & genetics',                String.raw`\b(genom(e|ic|ics)|genetic|DNA|RNA sequenc|CRISPR|gene editing|gene therapy)\b`],
  ['Drug discovery & pharmacology',      String.raw`\b(drug discovery|pharmacolog|small molecule|therapeutic agent|medicinal chemistry)\b`],
  ['Mental health',                      String.raw`\b(mental health|psychiatr|depression|anxiety|PTSD|schizophrenia|addiction|substance abuse)\b`],
  ['Aging & longevity',                  String.raw`\b(aging|longevity|Alzheimer|dementia|Parkinson|senescence)\b`],
  ['Diabetes & metabolic',               String.raw`\b(diabetes|obesity|metabolic|insulin)\b`],
  ['Regenerative medicine',              String.raw`\b(stem cell|regenerative medicine|tissue engineering)\b`],
  ['Bioengineering & synth bio',         String.raw`\b(bioengineering|synthetic biology|biomanufacturing|bioreactor)\b`],
  ['Public health',                      String.raw`\b(public health|epidemiolog|health disparit|health equity|population health)\b`],
  ['Quantum',                            String.raw`\b(quantum computing|quantum information|qubit|quantum cryptography|quantum sens)\b`],
  ['Materials science',                  String.raw`\b(materials science|polymer|composite|alloy|semiconductor|nanomaterial)\b`],
  ['Nanotech',                           String.raw`\b(nanotechnolog|nanoparticle|nanostructure|nanoscale)\b`],
  ['Climate & sustainability',           String.raw`\b(climate change|greenhouse|carbon dioxide|sustainability|decarbonization|emission)\b`],
  ['Renewable energy',                   String.raw`\b(solar|wind|geothermal|renewable energy|photovoltaic)\b`],
  ['Energy storage',                     String.raw`\b(battery|lithium ion|energy storage|fuel cell)\b`],
  ['Cybersecurity',                      String.raw`\b(cybersecurity|cyber security|network security|cryptograph|encryption)\b`],
  ['Robotics & autonomy',                String.raw`\b(robot(ic|s)?|autonomous (vehicle|system)|self-driving|drone)\b`],
  ['Earth observation',                  String.raw`\b(remote sensing|satellite (data|imagery)|earth observation|land cover|MODIS|landsat)\b`],
  ['Astrophysics',                       String.raw`\b(astrophysic|cosmolog|galaxy|exoplanet|dark (matter|energy)|gravitational wave)\b`],
  ['Agriculture & food',                 String.raw`\b(agricultur|crop|soil|food security|sustainable agriculture)\b`],
  ['Water resources',                    String.raw`\b(water resource|hydrolog|watershed|drinking water|wastewater)\b`],
  ['Education research',                 String.raw`\b(STEM education|science education|curriculum|pedagog|teacher training|broadening participation)\b`],
  ['Social & behavioral',                String.raw`\b(behavioral science|sociolog|economic policy|social network|inequality)\b`],
];

function topicTagSql() {
  return TOPICS.map(([topic, pattern]) => {
    const safePattern = pattern.replace(/'/g, "''");
    const safeTopic = topic.replace(/'/g, "''");
    return `
      SELECT
        firm_city, firm_state, fiscal_year,
        '${safeTopic}' AS topic,
        SUM(CASE WHEN regexp_matches(text, '${safePattern}', 'i') THEN 1 ELSE 0 END) AS topic_awards,
        SUM(CASE WHEN regexp_matches(text, '${safePattern}', 'i') THEN amount ELSE 0 END) AS topic_amount
      FROM tagged
      GROUP BY 1, 2, 3`;
  }).join(' UNION ALL ');
}

async function main() {
  const db = await D.create(':memory:');
  await db.exec(`CREATE VIEW sbir_raw AS SELECT * FROM read_parquet('${LAKE}/fact_sbir.parquet')`);

  // Normalize city: uppercase + trim. Restrict to in-scope records, valid FY,
  // non-null city/state, and the FY range we publish.
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE tagged AS
    SELECT
      UPPER(TRIM(firm_city)) AS firm_city,
      firm_state,
      award_year AS fiscal_year,
      COALESCE(award_title, '') AS text,
      COALESCE(award_amount_nominal, 0) AS amount,
      COALESCE(award_amount_real_2024, 0) AS amount_real,
      agency,
      branch,
      program,
      phase
    FROM sbir_raw
    WHERE in_project_scope = TRUE
      AND firm_city IS NOT NULL AND TRIM(firm_city) != ''
      AND firm_state IS NOT NULL AND TRIM(firm_state) != ''
      AND award_year BETWEEN 2005 AND 2024
  `);

  // Per-city per-FY aggregates.
  console.log('Aggregating per city × FY...');
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE city_fy AS
    SELECT
      firm_city, firm_state, fiscal_year,
      COUNT(*) AS awards,
      SUM(amount) AS amount_nominal,
      SUM(amount_real) AS amount_real
    FROM tagged
    GROUP BY 1, 2, 3
  `);

  // Topic-tagged amounts per city × FY.
  console.log('Tagging topics (30 regex passes)...');
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE city_topic AS
    ${topicTagSql()}
  `);

  // Top topic per (city, FY) — by amount, tie-break on awards.
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE city_top_topic AS
    WITH ranked AS (
      SELECT firm_city, firm_state, fiscal_year, topic, topic_awards, topic_amount,
        ROW_NUMBER() OVER (
          PARTITION BY firm_city, firm_state, fiscal_year
          ORDER BY topic_amount DESC, topic_awards DESC
        ) AS rn
      FROM city_topic
      WHERE topic_awards > 0
    )
    SELECT firm_city, firm_state, fiscal_year,
           topic AS top_topic,
           topic_awards AS top_topic_awards,
           topic_amount AS top_topic_amount
    FROM ranked WHERE rn = 1
  `);

  // Top agency per (city, FY).
  await db.exec(`
    CREATE OR REPLACE TEMPORARY TABLE city_top_agency AS
    WITH agg AS (
      SELECT firm_city, firm_state, fiscal_year, agency,
             COUNT(*) AS n, SUM(amount) AS amt
      FROM tagged
      WHERE agency IS NOT NULL
      GROUP BY 1, 2, 3, 4
    ),
    ranked AS (
      SELECT firm_city, firm_state, fiscal_year, agency, n, amt,
        ROW_NUMBER() OVER (
          PARTITION BY firm_city, firm_state, fiscal_year
          ORDER BY amt DESC, n DESC
        ) AS rn
      FROM agg
    )
    SELECT firm_city, firm_state, fiscal_year, agency AS top_agency, amt AS top_agency_amount
    FROM ranked WHERE rn = 1
  `);

  // Final: hubs = top 200 cities by all-time real $ (covers ~95% of activity).
  console.log('Selecting hub universe...');
  const universe = (await db.all(`
    SELECT firm_city, firm_state, SUM(amount_real) AS lifetime_real
    FROM city_fy
    GROUP BY 1, 2
    ORDER BY 3 DESC
    LIMIT 200
  `)).map((r) => `'${(r.firm_city || '').replace(/'/g, "''")}|${(r.firm_state || '').replace(/'/g, "''")}'`);

  console.log(`  → ${universe.length} hub cities selected`);

  await db.exec(`
    COPY (
      SELECT
        f.firm_city, f.firm_state, f.fiscal_year,
        f.awards, f.amount_nominal, f.amount_real,
        t.top_topic, t.top_topic_awards, t.top_topic_amount,
        a.top_agency, a.top_agency_amount
      FROM city_fy f
      LEFT JOIN city_top_topic t USING (firm_city, firm_state, fiscal_year)
      LEFT JOIN city_top_agency a USING (firm_city, firm_state, fiscal_year)
      WHERE (f.firm_city || '|' || f.firm_state) IN (${universe.join(',') || "''"})
      ORDER BY f.firm_state, f.firm_city, f.fiscal_year
    ) TO '${DASH}/agg_sbir_hubs.parquet' (FORMAT 'parquet', COMPRESSION 'zstd')
  `);

  const summary = (await db.all(`
    SELECT COUNT(*) AS rows,
           COUNT(DISTINCT (firm_city || '|' || firm_state)) AS cities,
           COUNT(DISTINCT firm_state) AS states
    FROM read_parquet('${DASH}/agg_sbir_hubs.parquet')
  `))[0];
  console.log(`✓ Wrote agg_sbir_hubs.parquet`);
  console.log(`  rows:   ${Number(summary.rows)}`);
  console.log(`  cities: ${Number(summary.cities)}`);
  console.log(`  states: ${Number(summary.states)}`);

  await db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
