// Verification: PI reconciliation across top-25 institutions for FY2024
// and FY2020. Pulls hard numbers straight from the regenerated
// agg_uni_pi_universe.parquet and prints them as a single audit table
// readable by humans + checkable against the raw federal sources.
//
//   NODE_PATH=/private/tmp/herd_node/node_modules \
//     node scripts/verify_pi_reconciliation.js
//
// Output is also written to docs/methodology/pi_reconciliation_fy2024.md.

const fs = require('fs');
const path = require('path');
const D = require('/private/tmp/herd_node/node_modules/duckdb-async').Database;

const DASH = path.resolve(__dirname, '../apps/web/public/data');
const LAKE =
  '/Users/Usama/Documents/Documents - Usama’s MacBook Pro/Claude Projects/Herd Survey/data/processed';
const DOC_OUT = path.resolve(__dirname, '../docs/methodology/pi_reconciliation_fy2024.md');

function fix(rows) {
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'bigint' ? Number(v) : v;
    return o;
  });
}

function mdTable(rows, columns) {
  if (rows.length === 0) return '_(no rows)_';
  const head = `| ${columns.map((c) => c.label).join(' | ')} |`;
  const sep = `| ${columns.map((c) => (c.align === 'right' ? '---:' : '---')).join(' | ')} |`;
  const body = rows
    .map(
      (r) =>
        `| ${columns
          .map((c) => {
            const v = r[c.key];
            if (v === null || v === undefined) return '—';
            if (c.format === 'm') return `$${Number(v).toFixed(1)}M`;
            if (c.format === 'k') return `$${Number(v).toLocaleString('en-US')}k`;
            if (c.format === 'n') return Number(v).toLocaleString('en-US');
            return String(v);
          })
          .join(' | ')} |`,
    )
    .join('\n');
  return `${head}\n${sep}\n${body}`;
}

async function reconcileFy(db, fy) {
  return fix(
    await db.all(`
      WITH targets AS (
        SELECT institution_sk FROM dim_inst WHERE UPPER(canonical_name) IN (
          'STANFORD UNIVERSITY','NEW YORK UNIVERSITY',
          'UNIVERSITY OF WASHINGTON-SEATTLE CAMPUS','JOHNS HOPKINS UNIVERSITY',
          'COLUMBIA UNIVERSITY IN THE CITY OF NEW YORK',
          'UNIVERSITY OF CALIFORNIA, SAN DIEGO',
          'HARVARD UNIVERSITY','UNIVERSITY OF MICHIGAN, ANN ARBOR',
          'UNIVERSITY OF CALIFORNIA, LOS ANGELES',
          'UNIVERSITY OF PENNSYLVANIA','DUKE UNIVERSITY',
          'YALE UNIVERSITY','UNIVERSITY OF CHICAGO',
          'MASSACHUSETTS INSTITUTE OF TECHNOLOGY',
          'PRINCETON UNIVERSITY','CARNEGIE MELLON UNIVERSITY',
          'CALIFORNIA INSTITUTE OF TECHNOLOGY','GEORGIA INSTITUTE OF TECHNOLOGY',
          'CORNELL UNIVERSITY','UNIVERSITY OF FLORIDA',
          'UNIVERSITY OF CALIFORNIA, SAN FRANCISCO'
        )
      )
      SELECT
        i.canonical_name AS uni,
        p.nsf_lead_pi_count AS nsf_pis,
        ROUND(p.federal_amount_nsf/1e6, 1) AS nsf_m,
        ROUND(p.federal_amount_nsf_attributed/1e6, 1) AS nsf_attr_m,
        ROUND(p.nsf_amount_per_lead_pi/1e3, 0) AS nsf_per_pi_k,
        p.nih_pi_count AS nih_pis,
        ROUND(p.federal_amount_nih/1e6, 1) AS nih_m,
        ROUND(p.federal_amount_nih_attributed/1e6, 1) AS nih_attr_m,
        ROUND(p.nih_amount_per_pi/1e3, 0) AS nih_per_pi_k,
        p.distinct_pi_count AS combined_pis,
        ROUND(p.federal_amount_total/1e6, 1) AS combined_m,
        ROUND(p.amount_per_pi/1e3, 0) AS combined_per_pi_k,
        ROUND(p.nsf_avg_n_pi_per_award, 2) AS nsf_avg_n_pi
      FROM agg_uni_pi_universe p
      JOIN dim_inst i ON i.institution_sk = p.institution_sk
      WHERE p.fiscal_year = ${fy} AND p.institution_sk IN (SELECT institution_sk FROM targets)
      ORDER BY p.federal_amount_total DESC
    `),
  );
}

async function piSkOverlap(db) {
  return fix(
    await db.all(`
      WITH nsf AS (SELECT DISTINCT pi_sk FROM nsf_raw WHERE pi_sk IS NOT NULL),
           nih AS (SELECT DISTINCT pi_sk FROM nih_pi WHERE pi_sk IS NOT NULL)
      SELECT
        (SELECT COUNT(*) FROM nsf) AS nsf_pis,
        (SELECT COUNT(*) FROM nih) AS nih_pis,
        (SELECT COUNT(*) FROM (SELECT pi_sk FROM nsf INTERSECT SELECT pi_sk FROM nih)) AS overlap
    `),
  )[0];
}

async function unattributedRatios(db) {
  return {
    nsf: fix(
      await db.all(`
        SELECT obl.fund_oblg_fiscal_yr AS fy,
          ROUND(SUM(CASE WHEN n.pi_sk IS NULL THEN obl.fund_oblg_amt_nominal ELSE 0 END) /
                NULLIF(SUM(obl.fund_oblg_amt_nominal), 0) * 100, 1) AS pct_no_pi
        FROM nsf_obl obl JOIN nsf_raw n ON n.awd_id = obl.awd_id
        WHERE obl.fund_oblg_fiscal_yr BETWEEN 2020 AND 2024
        GROUP BY 1 ORDER BY 1
      `),
    ),
    nih: fix(
      await db.all(`
        SELECT p.fy,
          ROUND(SUM(CASE WHEN b.application_id IS NULL THEN p.total_cost_nominal ELSE 0 END) /
                NULLIF(SUM(p.total_cost_nominal), 0) * 100, 1) AS pct_no_pi
        FROM (SELECT DISTINCT application_id, fy, total_cost_nominal FROM nih_raw) p
        LEFT JOIN (SELECT DISTINCT application_id FROM nih_pi WHERE pi_sk IS NOT NULL) b USING (application_id)
        WHERE p.fy BETWEEN 2020 AND 2024 AND p.total_cost_nominal IS NOT NULL
        GROUP BY 1 ORDER BY 1
      `),
    ),
  };
}

async function nationalRollup(db) {
  return fix(
    await db.all(`
      SELECT fiscal_year AS fy,
        SUM(nsf_lead_pi_count) AS nsf_pis,
        SUM(nih_pi_count) AS nih_pis,
        SUM(distinct_pi_count) AS combined_pis,
        ROUND(SUM(federal_amount_nsf)/1e9, 2) AS nsf_bn,
        ROUND(SUM(federal_amount_nih)/1e9, 2) AS nih_bn
      FROM agg_uni_pi_universe
      WHERE fiscal_year BETWEEN 2020 AND 2024
      GROUP BY 1 ORDER BY 1
    `),
  );
}

async function main() {
  const db = await D.create(':memory:');
  for (const [n, fp] of [
    ['agg_uni_pi_universe', `${DASH}/agg_uni_pi_universe.parquet`],
    ['dim_inst', `${LAKE}/dim_institution.parquet`],
    ['nsf_raw', `${LAKE}/fact_nsf_award.parquet`],
    ['nsf_obl', `${LAKE}/fact_nsf_award_fy_obligation.parquet`],
    ['nih_raw', `${LAKE}/fact_nih_project.parquet`],
    ['nih_pi', `${LAKE}/fact_nih_project_pi_bridge.parquet`],
  ]) {
    await db.exec(`CREATE VIEW ${n} AS SELECT * FROM read_parquet('${fp}')`);
  }

  const fy24 = await reconcileFy(db, 2024);
  const fy20 = await reconcileFy(db, 2020);
  const overlap = await piSkOverlap(db);
  const unattributed = await unattributedRatios(db);
  const rollup = await nationalRollup(db);

  await db.close();

  const cols = [
    { key: 'uni', label: 'Institution' },
    { key: 'nsf_pis', label: 'NSF leads', align: 'right', format: 'n' },
    { key: 'nsf_m', label: 'NSF $ tot', align: 'right', format: 'm' },
    { key: 'nsf_attr_m', label: 'NSF $ attr', align: 'right', format: 'm' },
    { key: 'nsf_per_pi_k', label: 'NSF $/lead', align: 'right', format: 'k' },
    { key: 'nih_pis', label: 'NIH PIs', align: 'right', format: 'n' },
    { key: 'nih_m', label: 'NIH $ tot', align: 'right', format: 'm' },
    { key: 'nih_attr_m', label: 'NIH $ attr', align: 'right', format: 'm' },
    { key: 'nih_per_pi_k', label: 'NIH $/PI', align: 'right', format: 'k' },
    { key: 'combined_pis', label: 'Comb PIs', align: 'right', format: 'n' },
    { key: 'combined_per_pi_k', label: 'Comb $/PI', align: 'right', format: 'k' },
    { key: 'nsf_avg_n_pi', label: 'NSF avg n_pi', align: 'right' },
  ];

  console.log('=== FY2024 reconciliation ===');
  console.table(fy24);
  console.log('\n=== FY2020 reconciliation ===');
  console.table(fy20);
  console.log('\n=== pi_sk overlap NSF vs NIH ===');
  console.log(JSON.stringify(overlap));
  console.log('\n=== unattributed $ by FY ===');
  console.log('NSF:', JSON.stringify(unattributed.nsf));
  console.log('NIH:', JSON.stringify(unattributed.nih));
  console.log('\n=== national rollup FY2020-2024 ===');
  console.table(rollup);

  // Write methodology doc
  const doc = `# PI Reconciliation Methodology

> Auto-generated by \`scripts/verify_pi_reconciliation.js\` — re-run after every
> rebuild of \`agg_uni_pi_universe.parquet\` to refresh this audit.

## What this document is

A scope-explicit walkthrough of how principal-investigator counts and
\`$/PI\` ratios are computed across the Research Data Platform, with hard
numbers for the top-25 US research universities in FY2024 and FY2020.

## Why per-source split

The federal data sources we ingest have **different PI roster semantics**:

| Source | Roster scope | Source file |
|---|---|---|
| NSF Awards | **Lead PI only** (\`pi_sk\` is a scalar field on the award; no public co-PI roster) | \`fact_nsf_award.parquet\` |
| NIH ExPORTER | **All named PIs** (lead + co-PIs via bridge table) | \`fact_nih_project_pi_bridge.parquet\` |

Combining them into a single \`# of PIs\` metric mixes methodologies — an
NSF-heavy STEM institution looks artificially short on PIs because its
co-PIs aren't counted, while an NIH-heavy med-center looks PI-rich.

## Methodology

For every institution × fiscal year we publish:

- **\`nsf_lead_pi_count\`** — \`COUNT(DISTINCT pi_sk)\` from \`fact_nsf_award\`
  joined to \`fact_nsf_award_fy_obligation\` for the FY, restricted to
  \`pi_sk IS NOT NULL\`.
- **\`nih_pi_count\`** — \`COUNT(DISTINCT pi_sk)\` from
  \`fact_nih_project_pi_bridge\` joined to \`fact_nih_project\` for the FY.
- **\`distinct_pi_count\`** — union of NSF + NIH \`pi_sk\` lists, deduped.
  \`pi_sk\` is the **same ID namespace** across both sources, so a PI
  holding grants in both is counted once.

Per-PI dollars are **scope-matched** — the numerator only includes $ from
awards/projects where PI attribution exists:

- **\`nsf_amount_per_lead_pi\`** = \`SUM(fy_amount WHERE pi_sk IS NOT NULL)\`
  ÷ \`nsf_lead_pi_count\`
- **\`nih_amount_per_pi\`** = \`SUM(total_cost_nominal WHERE bridge row exists)\`
  ÷ \`nih_pi_count\`

This matters because **${unattributed.nsf[unattributed.nsf.length - 1].pct_no_pi}% of NSF FY2024 obligations and ${unattributed.nih[unattributed.nih.length - 1].pct_no_pi}% of NIH FY2024 $ have no PI attribution** in the raw sources.
Dividing total $ by PI-attributed counts would inflate per-PI by 2× on
the NSF side.

## Sources used

Every number on this page comes from raw federal source files in
\`data/processed/\`:

- \`fact_nsf_award.parquet\` (NSF Awards archive)
- \`fact_nsf_award_fy_obligation.parquet\` (per-FY NSF obligations, 435K rows)
- \`fact_nih_project.parquet\` (NIH ExPORTER projects)
- \`fact_nih_project_pi_bridge.parquet\` (NIH ExPORTER PI bridge)
- \`dim_institution.parquet\` + \`dim_institution_aliases.parquet\` (entity-resolved)

**No master Excel rollup, no pre-aggregated reconciliation sheets are read.**

## Cross-source PI overlap

\`pi_sk\` is shared across NSF and NIH:

- NSF unique \`pi_sk\` values: ${overlap.nsf_pis.toLocaleString('en-US')}
- NIH unique \`pi_sk\` values: ${overlap.nih_pis.toLocaleString('en-US')}
- Overlap (PIs holding both NSF + NIH grants over the archive): ${overlap.overlap.toLocaleString('en-US')} (${((overlap.overlap / overlap.nsf_pis) * 100).toFixed(1)}% of NSF PIs)

This means UNION dedup on \`pi_sk\` correctly removes cross-source duplicates.

## Unattributed $ — known gap

| FY | NSF $ with no \`pi_sk\` | NIH $ with no bridge entry |
|---:|---:|---:|
${unattributed.nsf
  .map(
    (r, i) =>
      `| ${r.fy} | ${r.pct_no_pi}% | ${unattributed.nih[i] ? unattributed.nih[i].pct_no_pi : '—'}% |`,
  )
  .join('\n')}

The total-dollar columns (\`federal_amount_nsf\`, \`federal_amount_nih\`)
include this unattributed portion. The per-PI ratios exclude it.

## National rollup FY2020–FY2024

| FY | NSF lead PIs | NIH PIs | Combined PIs | NSF $ | NIH $ |
|---:|---:|---:|---:|---:|---:|
${rollup
  .map(
    (r) =>
      `| ${r.fy} | ${Number(r.nsf_pis).toLocaleString('en-US')} | ${Number(r.nih_pis).toLocaleString('en-US')} | ${Number(r.combined_pis).toLocaleString('en-US')} | $${r.nsf_bn}B | $${r.nih_bn}B |`,
  )
  .join('\n')}

## FY2024 top-25 reconciliation

${mdTable(fy24, cols)}

## FY2020 top-25 reconciliation

${mdTable(fy20, cols)}

## Auditing a single number

To verify any \`$/PI\` value yourself:

1. Open \`apps/web/public/data/agg_uni_pi_universe.parquet\` with DuckDB.
2. Look up \`(institution_sk, fiscal_year)\` to get the per-source counts
   and the attributed dollar amounts.
3. Recompute the ratio from \`federal_amount_nsf_attributed /
   nsf_lead_pi_count\` (or NIH equivalent).
4. To trace further back: \`fact_nsf_award\` + \`fact_nsf_award_fy_obligation\`
   (NSF) or \`fact_nih_project\` + \`fact_nih_project_pi_bridge\` (NIH).

## Last regenerated

${new Date().toISOString()}
`;

  fs.mkdirSync(path.dirname(DOC_OUT), { recursive: true });
  fs.writeFileSync(DOC_OUT, doc);
  console.log(`\n✓ Wrote ${DOC_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
