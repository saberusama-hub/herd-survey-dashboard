# Research Data Platform — Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the companion spec `docs/superpowers/specs/2026-05-31-research-data-platform-restructure-design.md` first — it explains the *why* behind every decision.

**Goal:** Restructure the Next.js dashboard from a source-centric IA into a university-centric, 9-section editorial profile + cross-uni national view, with 18 comprehensive metrics, full editorial visual treatment, mobile-first responsiveness, and a deep QA stage covering 18 dimensions.

**Architecture:** Static-export Next.js 14 with DuckDB-WASM consuming pre-aggregated parquet files. New `/universities/[sk]` profile page is the centerpiece (long-scroll, 9 sections, ~18 metrics). `/national` aggregates cross-uni views. Editorial component layer (`ChartFrame`, `SectionDivider`, `Annotation`, `KpiStrip`) ensures every chart gets consistent Bloomberg/Economist treatment.

**Tech Stack:** Next.js 14 (App Router, static export), TypeScript, DuckDB-WASM, Visx (charts), Tailwind v3, Calibri (via @fontsource/carlito), Vitest + Puppeteer-core (testing/QA), Python + DuckDB (aggregations).

**Conventions:**
- Dashboard repo: `/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard/` — all paths below are relative to this root.
- Every task ends with an atomic commit + push (user has standing instruction to push directly).
- Type-check (`pnpm -C apps/web type-check`) and build (`pnpm -C apps/web build`) must stay green throughout.
- For each phase, after the last task, run the Puppeteer probe `node scripts/qa/probe_pages.js` and ensure 0 errors before moving to the next phase.

---

## File Structure

### New files (created)
```
apps/web/app/universities/page.tsx                          # P4 — index table
apps/web/app/universities/[sk]/page.tsx                     # P3 — profile page
apps/web/app/national/page.tsx                              # P5 — national dashboard
apps/web/components/charts/StackedBar.tsx                   # P2
apps/web/components/charts/GroupedBar.tsx                   # P2
apps/web/components/charts/DistributionPlot.tsx             # P2
apps/web/components/editorial/ChartFrame.tsx                # P2
apps/web/components/editorial/SectionDivider.tsx            # P2
apps/web/components/editorial/Annotation.tsx                # P2
apps/web/components/editorial/KpiStrip.tsx                  # P2
apps/web/components/editorial/UniversitySearchBox.tsx       # P7
apps/web/components/editorial/UniversityTable.tsx           # P4
apps/web/lib/annotations.ts                                 # P2 — heuristic annotation generators
apps/web/lib/mobile.ts                                      # P2 — useIsMobile hook + bar-rotation helpers
scripts/aggregations/_lib.py                                # P1 — shared duckdb helpers
scripts/aggregations/01_total_rd.py                         # P1
scripts/aggregations/02_source_split.py                     # P1
scripts/aggregations/03_agency_split.py                     # P1
scripts/aggregations/04_federal_funds.py                    # P1
scripts/aggregations/05_pi_metrics.py                       # P1
scripts/aggregations/06_pi_distribution.py                  # P1
scripts/aggregations/07_field_mix.py                        # P1
scripts/aggregations/08_subject_tag.py                      # P1
scripts/aggregations/09_concentration.py                    # P1
scripts/aggregations/10_state_context.py                    # P1
scripts/aggregations/11_peers.py                            # P1
scripts/aggregations/12_patents.py                          # P1
scripts/aggregations/13_national_overview.py                # P1
scripts/aggregations/14_national_agency_trend.py            # P1
scripts/aggregations/15_national_concentration.py           # P1
scripts/aggregations/run_all.sh                             # P1 — orchestrator
scripts/qa/probe_pages.js                                   # P9
scripts/qa/screenshots.js                                   # P9
scripts/qa/facts.json                                       # P9
scripts/qa/verify_facts.py                                  # P9
scripts/qa/check_links.js                                   # P9
scripts/qa/lighthouse.sh                                    # P9
scripts/qa/run_all.sh                                       # P9
apps/web/public/data/agg_*.parquet                          # P1 — 15 files
```

### Modified files
```
apps/web/app/page.tsx                                       # P7 — new home
apps/web/app/compare/page.tsx                               # P6 — rebuilt
apps/web/app/methodology/page.tsx                           # P5/P8 — landmines + tagging
apps/web/app/layout.tsx                                     # P2 — nav update
apps/web/app/globals.css                                    # P2 — new palette
apps/web/tailwind.config.ts                                 # P2 — new tokens
apps/web/lib/queries.ts                                     # P1 — new helpers
apps/web/components/layout/MegaNav.tsx                      # P0 — new IA
apps/web/components/charts/BarChart.tsx                     # P2 — add highlight/annotation
apps/web/components/charts/LineChart.tsx                    # P2 — direct labels
apps/web/components/charts/Dumbbell.tsx                     # P2 — minor touch-ups
apps/web/next.config.mjs                                    # P0 — redirects
```

### Deleted files
```
apps/web/app/correlations/                                  # P0
apps/web/app/nih/                                           # P0
apps/web/app/states/                                        # P0
apps/web/app/flow/                                          # P0
apps/web/app/reconciliation/                                # P0
apps/web/app/institution/                                   # P0
apps/web/app/agency/                                        # P0
apps/web/app/trends/                                        # P0
apps/web/app/map/                                           # P0
apps/web/app/three-crises/                                  # P0
apps/web/app/self-funding/                                  # P0
apps/web/app/geography/                                     # P0
apps/web/components/charts/DonutChart.tsx                   # P0
apps/web/components/charts/Ridgeline.tsx                    # P0
apps/web/components/charts/ScatterMatrix.tsx                # P0
apps/web/components/charts/Streamgraph.tsx                  # P0
apps/web/components/charts/Sunburst.tsx                     # P0
apps/web/components/charts/Treemap.tsx                      # P0
apps/web/components/charts/EChartsBase.tsx                  # P0
apps/web/components/charts/Sankey.tsx                       # P0
apps/web/components/charts/ConnectedScatter.tsx             # P0
```

---

## Phase P0: Foundation — delete dead, scaffold new

### Task P0.1: Delete the 12 dead page routes

**Files:**
- Delete: `apps/web/app/correlations/`, `apps/web/app/nih/`, `apps/web/app/states/`, `apps/web/app/flow/`, `apps/web/app/reconciliation/`, `apps/web/app/institution/`, `apps/web/app/agency/`, `apps/web/app/trends/`, `apps/web/app/map/`, `apps/web/app/three-crises/`, `apps/web/app/self-funding/`, `apps/web/app/geography/`

- [ ] **Step 1: Delete the directories**

```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard"
rm -rf apps/web/app/correlations apps/web/app/nih apps/web/app/states apps/web/app/flow apps/web/app/reconciliation apps/web/app/institution apps/web/app/agency apps/web/app/trends apps/web/app/map apps/web/app/three-crises apps/web/app/self-funding apps/web/app/geography
```

- [ ] **Step 2: Verify deletion**

```bash
ls apps/web/app/
```
Expected: only `_components`, `compare`, `downloads`, `methodology`, `layout.tsx`, `page.tsx`, `globals.css`, `providers.tsx`, `fonts.ts`, `not-found.tsx` (or similar — no deleted dirs).

- [ ] **Step 3: Verify build still passes** (orphaned imports will fail here)

```bash
pnpm -C apps/web build 2>&1 | tail -40
```
Expected: build either succeeds OR fails with import errors that point to files in the next step. Either way: read failures, note them.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: delete 12 retired page routes (P0.1)" && git push
```

---

### Task P0.2: Delete the 8 dead chart components

**Files:**
- Delete: `apps/web/components/charts/DonutChart.tsx`, `Ridgeline.tsx`, `ScatterMatrix.tsx`, `Streamgraph.tsx`, `Sunburst.tsx`, `Treemap.tsx`, `EChartsBase.tsx`, `Sankey.tsx`, `ConnectedScatter.tsx`

- [ ] **Step 1: Delete the files**

```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard/apps/web/components/charts"
rm -f DonutChart.tsx Ridgeline.tsx ScatterMatrix.tsx Streamgraph.tsx Sunburst.tsx Treemap.tsx EChartsBase.tsx Sankey.tsx ConnectedScatter.tsx
```

- [ ] **Step 2: Find and remove any remaining imports**

```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard"
grep -rn "DonutChart\|Ridgeline\|ScatterMatrix\|Streamgraph\|Sunburst\|Treemap\|EChartsBase\|Sankey\|ConnectedScatter" apps/web --include="*.tsx" --include="*.ts" | grep -v node_modules
```
Expected: 0 matches. If matches appear, remove the orphan import lines + any code that referenced the deleted component.

- [ ] **Step 3: Remove echarts from package.json**

```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard"
pnpm -C apps/web remove echarts echarts-for-react
```

- [ ] **Step 4: Verify build**

```bash
pnpm -C apps/web type-check && pnpm -C apps/web build 2>&1 | tail -20
```
Expected: type-check + build both pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: delete 9 unused chart components + echarts dependency (P0.2)" && git push
```

---

### Task P0.3: Stub new route directories

**Files:**
- Create: `apps/web/app/universities/page.tsx` (stub)
- Create: `apps/web/app/universities/[sk]/page.tsx` (stub)
- Create: `apps/web/app/national/page.tsx` (stub)

- [ ] **Step 1: Create `apps/web/app/universities/page.tsx`**

```tsx
export default function UniversitiesPage() {
  return (
    <div className="container-wide py-10">
      <h1 className="text-3xl font-bold">Universities</h1>
      <p className="mt-2 text-text-secondary">Sortable table coming in Phase P4.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/universities/[sk]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import institutions from '@/public/data/dim_institution.json';

export async function generateStaticParams() {
  return institutions.map((i: { sk: number }) => ({ sk: String(i.sk) }));
}

export default function UniversityProfilePage({ params }: { params: { sk: string } }) {
  const sk = Number(params.sk);
  if (!Number.isFinite(sk)) return notFound();
  return (
    <div className="container-wide py-10">
      <h1 className="text-3xl font-bold">University {sk}</h1>
      <p className="mt-2 text-text-secondary">Profile coming in Phase P3.</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/national/page.tsx`**

```tsx
export default function NationalPage() {
  return (
    <div className="container-wide py-10">
      <h1 className="text-3xl font-bold">National view</h1>
      <p className="mt-2 text-text-secondary">Cross-university dashboard coming in Phase P5.</p>
    </div>
  );
}
```

- [ ] **Step 4: Generate `dim_institution.json` for `generateStaticParams`**

If `apps/web/public/data/dim_institution.json` doesn't exist, create a one-time export script:

```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard"
python3 -c "
import duckdb, json
con = duckdb.connect()
rows = con.execute(\"SELECT institution_sk AS sk, institution_name AS name, state_abbrev AS state FROM read_parquet('apps/web/public/data/dim_institution.parquet')\").fetchall()
with open('apps/web/public/data/dim_institution.json', 'w') as f:
    json.dump([{'sk': r[0], 'name': r[1], 'state': r[2]} for r in rows], f)
print(f'Wrote {len(rows)} institutions')
"
```

If `dim_institution.parquet` is not at that path: locate it via `find apps/web/public -name "*institution*"` and adjust the script. Acceptable substitutes are listed in the data audit (`/tmp/data_audit.md`).

- [ ] **Step 5: Verify build**

```bash
pnpm -C apps/web build 2>&1 | tail -10
```
Expected: build succeeds; routes `/universities`, `/universities/[sk]`, `/national` are listed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/universities apps/web/app/national apps/web/public/data/dim_institution.json && git commit -m "feat: stub /universities, /universities/[sk], /national routes (P0.3)" && git push
```

---

### Task P0.4: Configure redirects

**Files:**
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Open and edit `apps/web/next.config.mjs`**

Add a `redirects()` block (Next 14 static export uses `redirects` config + a separate `_redirects` file for Cloudflare). For the static export, generate a `_redirects` file in the public dir instead.

Create `apps/web/public/_redirects`:

```
/institution            /universities                301
/institution/*          /universities                301
/agency                 /national#agencies           301
/trends                 /national#trends             301
/map                    /national#geography          301
/flow                   /national#agencies           301
/correlations           /national                    301
/reconciliation         /universities                301
/three-crises           /                            301
/self-funding           /                            301
/geography              /                            301
/story/*                /                            301
/nih                    /national#agencies           301
/states                 /national#geography          301
```

- [ ] **Step 2: Verify the build picks up the file**

```bash
pnpm -C apps/web build && ls apps/web/out/_redirects
```
Expected: `_redirects` file present in `out/`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/_redirects && git commit -m "feat: add Cloudflare redirects for retired routes (P0.4)" && git push
```

---

### Task P0.5: Rebuild MegaNav for new IA

**Files:**
- Modify: `apps/web/components/layout/MegaNav.tsx`

- [ ] **Step 1: Read the existing file**

```bash
cat "apps/web/components/layout/MegaNav.tsx" | head -100
```

- [ ] **Step 2: Replace nav items**

Replace the existing items array with:

```tsx
const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/universities', label: 'Universities' },
  { href: '/compare', label: 'Compare' },
  { href: '/national', label: 'National view' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/downloads', label: 'Downloads' },
];
```

Remove any dropdown / mega-menu sub-items that pointed to deleted routes (`/agency`, `/trends`, `/map`, `/flow`, `/story/*`, etc.) — flat nav now.

- [ ] **Step 3: Verify build + render**

```bash
pnpm -C apps/web build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 4: Commit + push**

```bash
git add apps/web/components/layout/MegaNav.tsx && git commit -m "feat: rebuild MegaNav for new IA (P0.5)" && git push
```

---

### Phase P0 verification gate

- [ ] Run Puppeteer probe (write the script in P9 first if it doesn't exist; for now use this minimal version):

```bash
mkdir -p scripts/qa
cat > scripts/qa/_probe_minimal.js <<'JS'
const puppeteer = require('puppeteer-core');
const ROUTES = ['/', '/universities', '/universities/1', '/national', '/compare', '/methodology', '/downloads'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const failures = [];
  for (const route of ROUTES) {
    const page = await browser.newPage();
    page.on('pageerror', (err) => failures.push(`${route}: ${err.message}`));
    page.on('console', (msg) => msg.type() === 'error' && failures.push(`${route}: ${msg.text()}`));
    try {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    } catch (e) {
      failures.push(`${route}: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
  if (failures.length) { console.error('FAILURES:'); failures.forEach((f) => console.error(' - ' + f)); process.exit(1); }
  console.log(`OK: ${ROUTES.length} routes clean`);
})();
JS
pnpm -C apps/web dev &
sleep 8
node scripts/qa/_probe_minimal.js
kill %1
```

Expected: `OK: 7 routes clean`. If failures: fix before proceeding to P1.

---

## Phase P1: Data layer — 15 pre-aggregated parquets

### Task P1.1: Set up `scripts/aggregations/_lib.py`

**Files:**
- Create: `scripts/aggregations/_lib.py`

- [ ] **Step 1: Create the file**

```python
"""Shared helpers for aggregation scripts.

Each aggregation script reads source parquets, computes the aggregate,
writes the result to apps/web/public/data/agg_<name>.parquet, and prints
row count + size.
"""
from __future__ import annotations

import os
import sys
import duckdb
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC = REPO_ROOT / "apps" / "web" / "public" / "data"
OUT = SRC  # write outputs into the same dir served to the browser

def run(sql: str, out_name: str) -> None:
    out_path = OUT / out_name
    con = duckdb.connect()
    # All input paths in `sql` are resolved relative to OUT/SRC by convention.
    os.chdir(OUT)
    con.execute(f"COPY ({sql}) TO '{out_path}' (FORMAT 'parquet', COMPRESSION 'zstd')")
    rows = con.execute(f"SELECT COUNT(*) FROM read_parquet('{out_path}')").fetchone()[0]
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"{out_name}: {rows:,} rows, {size_mb:.2f} MB")

def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)
```

- [ ] **Step 2: Verify imports work**

```bash
python3 -c "from scripts.aggregations._lib import run; print('ok')"
```
Expected: `ok`. If `duckdb` is missing: `pip3 install duckdb`.

- [ ] **Step 3: Commit**

```bash
git add scripts/aggregations/_lib.py && git commit -m "feat: aggregation script shared lib (P1.1)" && git push
```

---

### Tasks P1.2 – P1.16: Build 15 aggregation parquets

Each task follows the same shape. The template:

```
**Files:** Create scripts/aggregations/NN_<name>.py
- [ ] Step 1: Create the file with the SQL below
- [ ] Step 2: Run: `python3 scripts/aggregations/NN_<name>.py`
        Expected: prints "agg_<name>.parquet: N rows, X MB"
- [ ] Step 3: Verify size: `ls -lh apps/web/public/data/agg_<name>.parquet`
        Expected: < target_mb listed in spec §6.1
- [ ] Step 4: Commit `git add scripts/aggregations/NN_<name>.py apps/web/public/data/agg_<name>.parquet && git commit -m "data: agg_<name> (P1.N)" && git push`
```

Each script is structurally:

```python
#!/usr/bin/env python3
"""<one-line description>"""
from _lib import run

SQL = """
<the SQL>
"""

if __name__ == "__main__":
    run(SQL, "agg_<name>.parquet")
```

Below are the unique SQL bodies per task. Source parquet filenames assume the names in `apps/web/public/data/` as discovered by the data audit (verify each filename exists; substitute the closest equivalent if not).

#### Task P1.2: `01_total_rd.py` → `agg_uni_total_rd.parquet`

Grain: institution × fy. Used by Profile §2, /universities table.

```sql
SELECT
  institution_sk,
  fiscal_year,
  SUM(amount_usd_nominal) AS total_rd_nominal,
  SUM(amount_usd_real_2024) AS total_rd_real
FROM read_parquet('fact_herd_expenditures.parquet')
WHERE question_id = 'Q01'                -- source-of-funds totals
  AND row_label = 'All R&D fields'        -- top-level row
GROUP BY institution_sk, fiscal_year
```

#### Task P1.3: `02_source_split.py` → `agg_uni_source_split.parquet`

Grain: institution × fy × source. ~100K rows.

```sql
SELECT
  institution_sk,
  fiscal_year,
  source_category,                       -- federal | state | industry | institutional | nonprofit | other
  SUM(amount_usd_nominal) AS amount_nominal,
  SUM(amount_usd_real_2024) AS amount_real
FROM read_parquet('fact_herd_expenditures.parquet')
WHERE question_id = 'Q01'
GROUP BY institution_sk, fiscal_year, source_category
```

#### Task P1.4: `03_agency_split.py` → `agg_uni_agency_split.parquet`

HERD Q09 (institution-reported federal agency split). ~140K rows.

```sql
SELECT
  institution_sk,
  fiscal_year,
  CASE
    WHEN agency_abbrev IN ('NSF','NIH','HHS','DOD','DOE','NASA','USDA') THEN agency_abbrev
    ELSE 'Other'
  END AS agency_bucket,
  SUM(amount_usd_nominal) AS amount_nominal,
  SUM(amount_usd_real_2024) AS amount_real
FROM read_parquet('fact_herd_expenditures.parquet')
WHERE question_id = 'Q09'
GROUP BY institution_sk, fiscal_year, agency_bucket
```

#### Task P1.5: `04_federal_funds.py` → `agg_uni_federal_funds.parquet`

Federal Funds side for reconciliation. ~100K rows.

```sql
SELECT
  institution_sk,
  fiscal_year,
  CASE
    WHEN agency_abbrev IN ('NSF','NIH','HHS','DOD','DOE','NASA','USDA') THEN agency_abbrev
    ELSE 'Other'
  END AS agency_bucket,
  taxonomy_version,                      -- 'vol70_legacy' or 'vol71_current'
  SUM(amount_usd_nominal) AS amount_nominal,
  SUM(amount_usd_real_2024) AS amount_real
FROM read_parquet('fact_federal_funds.parquet')
GROUP BY institution_sk, fiscal_year, agency_bucket, taxonomy_version
```

#### Task P1.6: `05_pi_metrics.py` → `agg_uni_pi_metrics.parquet`

Distinct federal PIs + $/PI per institution × fy.

```sql
WITH nsf AS (
  SELECT institution_sk, fiscal_year, pi_sk, amount_usd_nominal
  FROM read_parquet('fact_nsf_award_fy_obligation.parquet')
),
nih AS (
  SELECT institution_sk, fiscal_year, pi_sk_canonical AS pi_sk, total_cost_usd AS amount_usd_nominal
  FROM read_parquet('fact_nih_project.parquet')
),
combined AS (SELECT * FROM nsf UNION ALL SELECT * FROM nih)
SELECT
  institution_sk,
  fiscal_year,
  COUNT(DISTINCT pi_sk) AS pi_count,
  SUM(amount_usd_nominal) AS federal_amount,
  SUM(amount_usd_nominal) / NULLIF(COUNT(DISTINCT pi_sk), 0) AS amount_per_pi
FROM combined
GROUP BY institution_sk, fiscal_year
```

#### Task P1.7: `06_pi_distribution.py` → `agg_uni_pi_distribution.parquet`

Decile distribution of $/PI per institution × fy.

```sql
WITH pi_totals AS (
  SELECT
    institution_sk,
    fiscal_year,
    pi_sk,
    SUM(amount_usd_nominal) AS pi_amount
  FROM (
    SELECT institution_sk, fiscal_year, pi_sk, amount_usd_nominal FROM read_parquet('fact_nsf_award_fy_obligation.parquet')
    UNION ALL
    SELECT institution_sk, fiscal_year, pi_sk_canonical, total_cost_usd FROM read_parquet('fact_nih_project.parquet')
  )
  GROUP BY institution_sk, fiscal_year, pi_sk
)
SELECT
  institution_sk,
  fiscal_year,
  decile,
  MIN(pi_amount) AS min_amount,
  MAX(pi_amount) AS max_amount,
  AVG(pi_amount) AS avg_amount,
  COUNT(*) AS pi_count
FROM (
  SELECT institution_sk, fiscal_year, pi_amount, NTILE(10) OVER (PARTITION BY institution_sk, fiscal_year ORDER BY pi_amount) AS decile
  FROM pi_totals
)
GROUP BY institution_sk, fiscal_year, decile
```

#### Task P1.8: `07_field_mix.py` → `agg_uni_field_mix.parquet`

STEM/non-STEM + 8 HERD field categories per institution × fy.

```sql
SELECT
  e.institution_sk,
  e.fiscal_year,
  f.field_category,                      -- one of the 8 HERD categories
  f.is_se AS is_stem,
  SUM(e.amount_usd_nominal) AS amount_nominal
FROM read_parquet('fact_herd_expenditures.parquet') e
JOIN read_parquet('dim_field_of_science.parquet') f USING (field_sk)
WHERE e.question_id = 'Q03'              -- R&D by field of science
GROUP BY e.institution_sk, e.fiscal_year, f.field_category, f.is_se
```

#### Task P1.9: `08_subject_tag.py` → `agg_uni_subject_tag.parquet`

Subject-area keyword tagging applied at aggregation time. 5 subject tags: AI, biomedical, materials, climate, quantum.

```python
#!/usr/bin/env python3
"""Subject-area tagging (AI, biomedical, materials, climate, quantum)."""
import re
from _lib import run, OUT

SUBJECT_PATTERNS = {
    "AI": r"\b(artificial intelligence|machine learning|deep learning|neural network|transformer|LLM|computer vision|NLP|natural language processing)\b",
    "biomedical": r"\b(biomedical|biomedicine|therapeutic|clinical trial|disease|cancer|immunology|oncology)\b",
    "materials": r"\b(materials science|nanomaterial|polymer|composite|alloy|semiconductor)\b",
    "climate": r"\b(climate change|carbon|greenhouse|sustainability|renewable|emission)\b",
    "quantum": r"\b(quantum computing|quantum information|qubit|quantum cryptography)\b",
}

# Build a single SQL CASE expression per tag using DuckDB regexp_matches.
def case_clause(tag: str, pattern: str) -> str:
    safe = pattern.replace("'", "''")
    return f"CASE WHEN regexp_matches(text, '{safe}', 'i') THEN 1 ELSE 0 END AS is_{tag.lower()}"

cases = ",\n  ".join(case_clause(t, p) for t, p in SUBJECT_PATTERNS.items())

SQL = f"""
WITH nsf AS (
  SELECT institution_sk, fiscal_year, amount_usd_nominal, COALESCE(award_title,'') || ' ' || COALESCE(abstract,'') AS text
  FROM read_parquet('fact_nsf_award.parquet')
),
nih AS (
  SELECT institution_sk, fiscal_year, total_cost_usd AS amount_usd_nominal, COALESCE(project_title,'') || ' ' || COALESCE(project_summary_text,'') AS text
  FROM read_parquet('fact_nih_project.parquet')
),
combined AS (
  SELECT institution_sk, fiscal_year, amount_usd_nominal,
    {cases}
  FROM (SELECT * FROM nsf UNION ALL SELECT * FROM nih)
)
SELECT
  institution_sk,
  fiscal_year,
  'AI' AS subject_tag,
  SUM(CASE WHEN is_ai = 1 THEN amount_usd_nominal ELSE 0 END) AS tagged_amount
FROM combined
GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'biomedical', SUM(CASE WHEN is_biomedical = 1 THEN amount_usd_nominal ELSE 0 END)
FROM combined GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'materials', SUM(CASE WHEN is_materials = 1 THEN amount_usd_nominal ELSE 0 END)
FROM combined GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'climate', SUM(CASE WHEN is_climate = 1 THEN amount_usd_nominal ELSE 0 END)
FROM combined GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'quantum', SUM(CASE WHEN is_quantum = 1 THEN amount_usd_nominal ELSE 0 END)
FROM combined GROUP BY institution_sk, fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_subject_tag.parquet")
```

#### Task P1.10: `09_concentration.py` → `agg_uni_concentration.parquet`

HHI, CoV, Shannon entropy per institution × fy.

```sql
WITH agency_shares AS (
  SELECT institution_sk, fiscal_year, agency_bucket, amount_nominal,
    SUM(amount_nominal) OVER (PARTITION BY institution_sk, fiscal_year) AS total
  FROM read_parquet('agg_uni_agency_split.parquet')
),
hhi AS (
  SELECT
    institution_sk,
    fiscal_year,
    SUM(POWER(amount_nominal / NULLIF(total, 0), 2)) * 10000 AS hhi,
    -SUM(
      CASE WHEN amount_nominal > 0
        THEN (amount_nominal / total) * LN(amount_nominal / total)
        ELSE 0
      END
    ) AS shannon_entropy
  FROM agency_shares
  GROUP BY institution_sk, fiscal_year
),
cov AS (
  SELECT
    institution_sk,
    fiscal_year,
    STDDEV_POP(total_rd_nominal) OVER (PARTITION BY institution_sk ORDER BY fiscal_year ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)
      / NULLIF(AVG(total_rd_nominal) OVER (PARTITION BY institution_sk ORDER BY fiscal_year ROWS BETWEEN 4 PRECEDING AND CURRENT ROW), 0) AS cov_5yr
  FROM read_parquet('agg_uni_total_rd.parquet')
)
SELECT h.institution_sk, h.fiscal_year, h.hhi, h.shannon_entropy, c.cov_5yr
FROM hhi h
LEFT JOIN cov c USING (institution_sk, fiscal_year)
```

#### Task P1.11: `10_state_context.py` → `agg_uni_state_context.parquet`

```sql
WITH state_total AS (
  SELECT i.state_abbrev, t.fiscal_year, SUM(t.total_rd_nominal) AS state_total
  FROM read_parquet('agg_uni_total_rd.parquet') t
  JOIN read_parquet('dim_institution.parquet') i USING (institution_sk)
  GROUP BY i.state_abbrev, t.fiscal_year
)
SELECT
  t.institution_sk,
  t.fiscal_year,
  i.state_abbrev,
  t.total_rd_nominal AS uni_total,
  s.state_total,
  t.total_rd_nominal / NULLIF(s.state_total, 0) AS share_of_state
FROM read_parquet('agg_uni_total_rd.parquet') t
JOIN read_parquet('dim_institution.parquet') i USING (institution_sk)
JOIN state_total s ON s.state_abbrev = i.state_abbrev AND s.fiscal_year = t.fiscal_year
```

#### Task P1.12: `11_peers.py` → `agg_uni_peers.parquet`

Top 5 peer institutions per uni: same state + ±25% R&D size (most recent FY).

```sql
WITH latest AS (
  SELECT institution_sk, MAX(fiscal_year) AS fy FROM read_parquet('agg_uni_total_rd.parquet') GROUP BY institution_sk
),
totals AS (
  SELECT t.institution_sk, t.fiscal_year, t.total_rd_nominal, i.state_abbrev
  FROM read_parquet('agg_uni_total_rd.parquet') t
  JOIN latest USING (institution_sk)
  JOIN read_parquet('dim_institution.parquet') i USING (institution_sk)
  WHERE t.fiscal_year = latest.fy
),
pairs AS (
  SELECT a.institution_sk AS uni_sk, b.institution_sk AS peer_sk,
    ROW_NUMBER() OVER (PARTITION BY a.institution_sk ORDER BY ABS(a.total_rd_nominal - b.total_rd_nominal)) AS rk
  FROM totals a
  JOIN totals b
    ON a.state_abbrev = b.state_abbrev
    AND a.institution_sk <> b.institution_sk
    AND b.total_rd_nominal BETWEEN a.total_rd_nominal * 0.75 AND a.total_rd_nominal * 1.25
)
SELECT uni_sk, peer_sk, rk AS peer_rank FROM pairs WHERE rk <= 5
```

#### Task P1.13: `12_patents.py` → `agg_uni_patents.parquet`

Patent-to-award ratio. If `fact_uspto_patents.parquet` (or equivalent) is absent, emit a stub with `patent_count = NULL` and document in methodology.

```sql
-- If patent table exists:
WITH patents AS (
  SELECT institution_sk, fiscal_year, COUNT(*) AS patent_count
  FROM read_parquet('fact_uspto_patents.parquet')
  GROUP BY institution_sk, fiscal_year
),
awards AS (
  SELECT institution_sk, fiscal_year, COUNT(DISTINCT award_id) AS award_count
  FROM read_parquet('fact_nsf_award.parquet')
  GROUP BY institution_sk, fiscal_year
)
SELECT a.institution_sk, a.fiscal_year, a.award_count, p.patent_count,
  p.patent_count::DOUBLE / NULLIF(a.award_count, 0) AS patents_per_award
FROM awards a
LEFT JOIN patents p USING (institution_sk, fiscal_year)
```

If the patent table doesn't exist, write an alternative script that returns `(institution_sk, fiscal_year, NULL AS patent_count, NULL AS patents_per_award)` and document in `/methodology`.

#### Task P1.14: `13_national_overview.py` → `agg_national_overview.parquet`

```sql
SELECT
  fiscal_year,
  source_category,
  SUM(amount_nominal) AS amount_nominal,
  SUM(amount_real) AS amount_real
FROM read_parquet('agg_uni_source_split.parquet')
GROUP BY fiscal_year, source_category
```

#### Task P1.15: `14_national_agency_trend.py` → `agg_national_agency_trend.parquet`

```sql
SELECT
  fiscal_year,
  agency_bucket,
  SUM(amount_nominal) AS amount_nominal,
  SUM(amount_real) AS amount_real
FROM read_parquet('agg_uni_agency_split.parquet')
GROUP BY fiscal_year, agency_bucket
```

#### Task P1.16: `15_national_concentration.py` → `agg_national_concentration.parquet`

```sql
WITH ranked AS (
  SELECT
    fiscal_year,
    institution_sk,
    total_rd_nominal,
    ROW_NUMBER() OVER (PARTITION BY fiscal_year ORDER BY total_rd_nominal DESC) AS rk,
    SUM(total_rd_nominal) OVER (PARTITION BY fiscal_year) AS national_total
  FROM read_parquet('agg_uni_total_rd.parquet')
)
SELECT
  fiscal_year,
  'top_10' AS bucket,
  SUM(CASE WHEN rk <= 10 THEN total_rd_nominal ELSE 0 END) / national_total AS share
FROM ranked GROUP BY fiscal_year, national_total
UNION ALL
SELECT fiscal_year, 'top_25', SUM(CASE WHEN rk <= 25 THEN total_rd_nominal ELSE 0 END) / national_total
FROM ranked GROUP BY fiscal_year, national_total
UNION ALL
SELECT fiscal_year, 'top_100', SUM(CASE WHEN rk <= 100 THEN total_rd_nominal ELSE 0 END) / national_total
FROM ranked GROUP BY fiscal_year, national_total
```

---

### Task P1.17: `run_all.sh` orchestrator

**Files:** Create `scripts/aggregations/run_all.sh`

- [ ] **Step 1: Create the file**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Running 15 aggregations…"
for script in 01_*.py 02_*.py 03_*.py 04_*.py 05_*.py 06_*.py 07_*.py 08_*.py 09_*.py 10_*.py 11_*.py 12_*.py 13_*.py 14_*.py 15_*.py; do
  echo ""
  echo "▶ $script"
  python3 "$script"
done
echo ""
echo "Total parquet size:"
du -sh ../../apps/web/public/data/agg_*.parquet | tail -20
```

- [ ] **Step 2: Make executable + run**

```bash
chmod +x scripts/aggregations/run_all.sh
./scripts/aggregations/run_all.sh
```
Expected: all 15 scripts print row counts; total under 50 MB combined.

- [ ] **Step 3: Commit + push**

```bash
git add scripts/aggregations/run_all.sh apps/web/public/data/agg_*.parquet && git commit -m "data: orchestrator + all 15 aggregations regenerated (P1.17)" && git push
```

---

### Task P1.18: New query helpers in `lib/queries.ts`

**Files:** Modify `apps/web/lib/queries.ts`

- [ ] **Step 1: Read current file**

```bash
cat apps/web/lib/queries.ts | head -80
```

- [ ] **Step 2: Add new helpers (keep existing exports intact for now — P0 already deleted their consumers, so they're dead code, but leave for grep-friendliness during P3)**

Append these exports:

```typescript
// ─────────── University profile ───────────
export interface UniversityProfile {
  institution_sk: number;
  name: string;
  state: string;
  totalRd: Array<{ fiscal_year: number; total_rd_nominal: number; total_rd_real: number }>;
  sources: Array<{ fiscal_year: number; source_category: string; amount_nominal: number }>;
  agencies: Array<{ fiscal_year: number; agency_bucket: string; amount_nominal: number }>;
  federalFunds: Array<{ fiscal_year: number; agency_bucket: string; amount_nominal: number; taxonomy_version: string }>;
  piMetrics: Array<{ fiscal_year: number; pi_count: number; amount_per_pi: number; federal_amount: number }>;
  piDistribution: Array<{ fiscal_year: number; decile: number; min_amount: number; max_amount: number; avg_amount: number; pi_count: number }>;
  fieldMix: Array<{ fiscal_year: number; field_category: string; is_stem: boolean; amount_nominal: number }>;
  subjectTags: Array<{ fiscal_year: number; subject_tag: string; tagged_amount: number }>;
  concentration: Array<{ fiscal_year: number; hhi: number; shannon_entropy: number; cov_5yr: number | null }>;
  stateContext: Array<{ fiscal_year: number; uni_total: number; state_total: number; share_of_state: number }>;
  peers: Array<{ peer_sk: number; peer_rank: number }>;
  patents: Array<{ fiscal_year: number; award_count: number; patent_count: number | null; patents_per_award: number | null }>;
}

export async function getUniversityProfile(sk: number): Promise<UniversityProfile> {
  const [name, totalRd, sources, agencies, federalFunds, piMetrics, piDistribution, fieldMix, subjectTags, concentration, stateContext, peers, patents] = await Promise.all([
    query<{ institution_name: string; state_abbrev: string }>(`SELECT institution_name, state_abbrev FROM read_parquet('${dataUrl('dim_institution.parquet')}') WHERE institution_sk = ${sk}`),
    query<UniversityProfile['totalRd'][number]>(`SELECT fiscal_year, total_rd_nominal, total_rd_real FROM read_parquet('${dataUrl('agg_uni_total_rd.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year`),
    query<UniversityProfile['sources'][number]>(`SELECT fiscal_year, source_category, amount_nominal FROM read_parquet('${dataUrl('agg_uni_source_split.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, source_category`),
    query<UniversityProfile['agencies'][number]>(`SELECT fiscal_year, agency_bucket, amount_nominal FROM read_parquet('${dataUrl('agg_uni_agency_split.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, agency_bucket`),
    query<UniversityProfile['federalFunds'][number]>(`SELECT fiscal_year, agency_bucket, amount_nominal, taxonomy_version FROM read_parquet('${dataUrl('agg_uni_federal_funds.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, agency_bucket`),
    query<UniversityProfile['piMetrics'][number]>(`SELECT fiscal_year, pi_count, amount_per_pi, federal_amount FROM read_parquet('${dataUrl('agg_uni_pi_metrics.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year`),
    query<UniversityProfile['piDistribution'][number]>(`SELECT fiscal_year, decile, min_amount, max_amount, avg_amount, pi_count FROM read_parquet('${dataUrl('agg_uni_pi_distribution.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, decile`),
    query<UniversityProfile['fieldMix'][number]>(`SELECT fiscal_year, field_category, is_stem, amount_nominal FROM read_parquet('${dataUrl('agg_uni_field_mix.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, field_category`),
    query<UniversityProfile['subjectTags'][number]>(`SELECT fiscal_year, subject_tag, tagged_amount FROM read_parquet('${dataUrl('agg_uni_subject_tag.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year, subject_tag`),
    query<UniversityProfile['concentration'][number]>(`SELECT fiscal_year, hhi, shannon_entropy, cov_5yr FROM read_parquet('${dataUrl('agg_uni_concentration.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year`),
    query<UniversityProfile['stateContext'][number]>(`SELECT fiscal_year, uni_total, state_total, share_of_state FROM read_parquet('${dataUrl('agg_uni_state_context.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year`),
    query<UniversityProfile['peers'][number]>(`SELECT peer_sk, peer_rank FROM read_parquet('${dataUrl('agg_uni_peers.parquet')}') WHERE uni_sk = ${sk} ORDER BY peer_rank`),
    query<UniversityProfile['patents'][number]>(`SELECT fiscal_year, award_count, patent_count, patents_per_award FROM read_parquet('${dataUrl('agg_uni_patents.parquet')}') WHERE institution_sk = ${sk} ORDER BY fiscal_year`),
  ]);

  if (name.length === 0) throw new Error(`Institution ${sk} not found`);

  return {
    institution_sk: sk,
    name: name[0].institution_name,
    state: name[0].state_abbrev,
    totalRd, sources, agencies, federalFunds, piMetrics, piDistribution,
    fieldMix, subjectTags, concentration, stateContext, peers, patents,
  };
}

// ─────────── National view ───────────
export async function getNationalOverview() {
  return query<{ fiscal_year: number; source_category: string; amount_nominal: number; amount_real: number }>(
    `SELECT * FROM read_parquet('${dataUrl('agg_national_overview.parquet')}') ORDER BY fiscal_year, source_category`,
  );
}

export async function getNationalAgencyTrend() {
  return query<{ fiscal_year: number; agency_bucket: string; amount_nominal: number; amount_real: number }>(
    `SELECT * FROM read_parquet('${dataUrl('agg_national_agency_trend.parquet')}') ORDER BY fiscal_year, agency_bucket`,
  );
}

export async function getNationalConcentration() {
  return query<{ fiscal_year: number; bucket: string; share: number }>(
    `SELECT * FROM read_parquet('${dataUrl('agg_national_concentration.parquet')}') ORDER BY fiscal_year, bucket`,
  );
}

// ─────────── /universities table ───────────
export interface UniversityIndexRow {
  institution_sk: number;
  name: string;
  state: string;
  total_rd_fy2024: number;
  cagr_20yr: number;
  federal_share: number;
  pi_count: number;
  stem_share: number;
}

export async function getUniversityIndex(): Promise<UniversityIndexRow[]> {
  return query<UniversityIndexRow>(`
    WITH latest AS (
      SELECT institution_sk, total_rd_nominal AS total_rd_fy2024
      FROM read_parquet('${dataUrl('agg_uni_total_rd.parquet')}')
      WHERE fiscal_year = 2024
    ),
    cagr AS (
      SELECT institution_sk,
        POWER(MAX(CASE WHEN fiscal_year = 2024 THEN total_rd_nominal END)
          / NULLIF(MAX(CASE WHEN fiscal_year = 2005 THEN total_rd_nominal END), 0), 1.0/19.0) - 1 AS cagr_20yr
      FROM read_parquet('${dataUrl('agg_uni_total_rd.parquet')}')
      GROUP BY institution_sk
    ),
    fed AS (
      SELECT institution_sk,
        SUM(CASE WHEN source_category = 'federal' THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS federal_share
      FROM read_parquet('${dataUrl('agg_uni_source_split.parquet')}')
      WHERE fiscal_year = 2024
      GROUP BY institution_sk
    ),
    pi AS (
      SELECT institution_sk, pi_count FROM read_parquet('${dataUrl('agg_uni_pi_metrics.parquet')}') WHERE fiscal_year = 2024
    ),
    stem AS (
      SELECT institution_sk,
        SUM(CASE WHEN is_stem THEN amount_nominal ELSE 0 END)
          / NULLIF(SUM(amount_nominal), 0) AS stem_share
      FROM read_parquet('${dataUrl('agg_uni_field_mix.parquet')}')
      WHERE fiscal_year = 2024
      GROUP BY institution_sk
    )
    SELECT
      l.institution_sk,
      i.institution_name AS name,
      i.state_abbrev AS state,
      l.total_rd_fy2024,
      c.cagr_20yr,
      f.federal_share,
      COALESCE(pi.pi_count, 0) AS pi_count,
      s.stem_share
    FROM latest l
    JOIN read_parquet('${dataUrl('dim_institution.parquet')}') i USING (institution_sk)
    LEFT JOIN cagr c USING (institution_sk)
    LEFT JOIN fed f USING (institution_sk)
    LEFT JOIN pi USING (institution_sk)
    LEFT JOIN stem s USING (institution_sk)
    ORDER BY l.total_rd_fy2024 DESC
  `);
}

export async function searchInstitutions(q: string): Promise<Array<{ sk: number; name: string; state: string }>> {
  const safe = q.replace(/'/g, "''");
  return query(`
    SELECT institution_sk AS sk, institution_name AS name, state_abbrev AS state
    FROM read_parquet('${dataUrl('dim_institution.parquet')}')
    WHERE LOWER(institution_name) LIKE LOWER('%${safe}%')
    ORDER BY institution_name
    LIMIT 20
  `);
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm -C apps/web type-check
```
Expected: passes.

- [ ] **Step 4: Add a Vitest test for `searchInstitutions` shape**

Create `apps/web/lib/queries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { searchInstitutions } from './queries';

vi.mock('./duckdb', () => ({
  query: vi.fn().mockResolvedValue([{ sk: 1, name: 'Johns Hopkins', state: 'MD' }]),
}));

describe('searchInstitutions', () => {
  it('returns rows with sk, name, state', async () => {
    const rows = await searchInstitutions('hopkins');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sk: 1, name: 'Johns Hopkins', state: 'MD' });
  });
});
```

Run: `pnpm -C apps/web vitest run lib/queries.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit + push**

```bash
git add apps/web/lib/queries.ts apps/web/lib/queries.test.ts && git commit -m "feat: new query helpers for university profile + national + index (P1.18)" && git push
```

---

## Phase P2: Design system — palette, typography, editorial primitives

### Task P2.1: Update color tokens in `globals.css`

**Files:** Modify `apps/web/app/globals.css`

- [ ] **Step 1: Replace the `:root` and `.dark` blocks** (the lines defining `--cat-N`, `--seq-N`, accent, paper, ink, etc.) **with**:

```css
:root {
  /* Editorial palette */
  --ink: 222 14% 5%;                    /* #0D1117 */
  --paper: 42 33% 96%;                  /* #F7F5EF — warm off-white */
  --surface: 0 0% 100%;
  --accent: 351 76% 41%;                /* #C8102E cherry */
  --accent-strong: 351 76% 31%;
  --mute-1: 220 9% 65%;                 /* #9CA3AF */
  --mute-2: 220 13% 82%;                /* #D1D5DB */
  --mute-3: 220 13% 91%;                /* #E5E7EB */
  --text-primary: var(--ink);
  --text-secondary: 220 9% 35%;
  --text-tertiary: var(--mute-1);
  --background: var(--paper);
  --border: var(--mute-3);
  --rule: var(--mute-3);

  /* Agency-categorical (fixed assignment per spec §4.1) */
  --agency-nih: 213 53% 27%;            /* #1F3A68 navy */
  --agency-nsf: 351 76% 41%;            /* #C8102E cherry — same as accent */
  --agency-dod: 91 56% 17%;             /* #2D5016 forest */
  --agency-doe: 43 90% 38%;             /* #B8860B goldenrod */
  --agency-nasa: 315 38% 28%;           /* #6B2E5E plum */
  --agency-usda: 25 53% 35%;            /* #8B5A2B sienna */
  --agency-other: 220 9% 46%;           /* #6B7280 slate */

  /* Sequential blues (choropleth) */
  --seq-1: 214 100% 96%;
  --seq-2: 214 95% 87%;
  --seq-3: 213 94% 78%;
  --seq-4: 217 91% 60%;
  --seq-5: 221 83% 53%;
  --seq-6: 224 76% 48%;
  --seq-7: 226 71% 33%;                 /* #1E3A8A */

  /* Diverging (reconciliation gap) */
  --div-neg-3: 322 78% 35%;
  --div-neg-2: 322 70% 50%;
  --div-neg-1: 322 60% 70%;
  --div-zero: 0 0% 95%;
  --div-pos-1: 134 50% 70%;
  --div-pos-2: 134 60% 45%;
  --div-pos-3: 134 70% 25%;
}

.dark {
  --ink: 220 14% 91%;                   /* #E8EAED */
  --paper: 218 18% 9%;                  /* #13161C — not pure black */
  --surface: 222 16% 12%;                /* #1A1E26 */
  --accent: 352 71% 55%;                 /* #E03A50 — desaturated 20% */
  --accent-strong: 352 71% 65%;
  --mute-1: 220 9% 55%;
  --mute-2: 220 13% 30%;
  --mute-3: 220 13% 22%;
  --text-primary: var(--ink);
  --text-secondary: 220 9% 75%;
  --background: var(--paper);
}

/* Tabular numerals — apply broadly */
.tnum {
  font-variant-numeric: tabular-nums lining-nums;
}
```

- [ ] **Step 2: Type-check + build**

```bash
pnpm -C apps/web type-check && pnpm -C apps/web build 2>&1 | tail -5
```
Expected: passes.

- [ ] **Step 3: Commit + push**

```bash
git add apps/web/app/globals.css && git commit -m "feat: editorial palette + tabular-nums utility (P2.1)" && git push
```

---

### Task P2.2: Update Tailwind config with new tokens

**Files:** Modify `apps/web/tailwind.config.ts`

- [ ] **Step 1: Read existing config**

```bash
cat apps/web/tailwind.config.ts
```

- [ ] **Step 2: In the `theme.extend.colors` block, add/replace**:

```typescript
colors: {
  ink: 'hsl(var(--ink))',
  paper: 'hsl(var(--paper))',
  surface: 'hsl(var(--surface))',
  accent: { DEFAULT: 'hsl(var(--accent))', strong: 'hsl(var(--accent-strong))' },
  mute: { 1: 'hsl(var(--mute-1))', 2: 'hsl(var(--mute-2))', 3: 'hsl(var(--mute-3))' },
  border: 'hsl(var(--border))',
  rule: 'hsl(var(--rule))',
  text: {
    primary: 'hsl(var(--text-primary))',
    secondary: 'hsl(var(--text-secondary))',
    tertiary: 'hsl(var(--text-tertiary))',
  },
  background: 'hsl(var(--background))',
  agency: {
    nih: 'hsl(var(--agency-nih))',
    nsf: 'hsl(var(--agency-nsf))',
    dod: 'hsl(var(--agency-dod))',
    doe: 'hsl(var(--agency-doe))',
    nasa: 'hsl(var(--agency-nasa))',
    usda: 'hsl(var(--agency-usda))',
    other: 'hsl(var(--agency-other))',
  },
},
```

- [ ] **Step 3: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/tailwind.config.ts && git commit -m "feat: tailwind tokens for editorial palette + agency colors (P2.2)" && git push
```

---

### Task P2.3: Build `ChartFrame` component

**Files:** Create `apps/web/components/editorial/ChartFrame.tsx`, `apps/web/components/editorial/ChartFrame.test.tsx`

- [ ] **Step 1: Create the test first**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartFrame } from './ChartFrame';

describe('ChartFrame', () => {
  it('renders eyebrow / title / dek / source line', () => {
    render(
      <ChartFrame eyebrow="Section 4" title="Federal funding" dek="By agency, FY2024" source="HERD Q09">
        <div data-testid="chart">chart</div>
      </ChartFrame>,
    );
    expect(screen.getByText('Section 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Federal funding' })).toBeInTheDocument();
    expect(screen.getByText('By agency, FY2024')).toBeInTheDocument();
    expect(screen.getByText(/HERD Q09/)).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm -C apps/web vitest run components/editorial/ChartFrame.test.tsx
```
Expected: FAIL with "Cannot find module './ChartFrame'".

- [ ] **Step 3: Implement**

```tsx
import { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  dek?: string;
  source?: string;
  note?: string;
  children: ReactNode;
}

export function ChartFrame({ eyebrow, title, dek, source, note, children }: Props) {
  return (
    <figure className="space-y-3">
      <header className="space-y-1">
        {eyebrow && <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{eyebrow}</p>}
        <h3 className="text-[17px] font-semibold text-text-primary">{title}</h3>
        {dek && <p className="text-sm italic text-text-secondary max-w-prose">{dek}</p>}
      </header>
      <div>{children}</div>
      {(source || note) && (
        <figcaption className="border-t border-rule pt-2 text-[11px] text-text-tertiary">
          {source && <span>Source: {source}</span>}
          {source && note && <span> · </span>}
          {note && <span>Note: {note}</span>}
          <span> · Chart: Research Data Platform</span>
        </figcaption>
      )}
    </figure>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm -C apps/web vitest run components/editorial/ChartFrame.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit + push**

```bash
git add apps/web/components/editorial/ChartFrame.tsx apps/web/components/editorial/ChartFrame.test.tsx && git commit -m "feat: ChartFrame editorial primitive (P2.3)" && git push
```

---

### Task P2.4: Build `SectionDivider`

**Files:** Create `apps/web/components/editorial/SectionDivider.tsx`

- [ ] **Step 1: Implement**

```tsx
interface Props {
  eyebrow: string;             // e.g., "Section 4 · Federal funding"
  title: string;
  dek?: string;
  color?: string;              // CSS var or hex (defaults to accent)
}

export function SectionDivider({ eyebrow, title, dek, color = 'hsl(var(--accent))' }: Props) {
  return (
    <div className="py-12">
      <div className="h-px w-full" style={{ background: color }} />
      <div className="mt-6 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary">{eyebrow}</span>
      </div>
      <h2 className="mt-2 text-2xl font-bold text-text-primary">{title}</h2>
      {dek && <p className="mt-1 text-sm italic text-text-secondary max-w-prose">{dek}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/editorial/SectionDivider.tsx && git commit -m "feat: SectionDivider editorial primitive (P2.4)" && git push
```

---

### Task P2.5: Build `Annotation`

**Files:** Create `apps/web/components/editorial/Annotation.tsx`

- [ ] **Step 1: Implement**

```tsx
interface Props {
  x: number; y: number;        // SVG coords of the data point
  label: string;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
}

export function Annotation({ x, y, label, anchor = 'top' }: Props) {
  const dy = anchor === 'top' ? -18 : anchor === 'bottom' ? 18 : 0;
  const dx = anchor === 'left' ? -18 : anchor === 'right' ? 18 : 0;
  const tx = anchor === 'left' ? 'end' : anchor === 'right' ? 'start' : 'middle';
  return (
    <g aria-hidden>
      <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke="hsl(var(--mute-1))" strokeWidth={1} />
      <circle cx={x} cy={y} r={3} fill="hsl(var(--accent))" />
      <text x={x + dx} y={y + dy} textAnchor={tx} className="text-[11px] fill-text-secondary">{label}</text>
    </g>
  );
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/editorial/Annotation.tsx && git commit -m "feat: Annotation SVG primitive (P2.5)" && git push
```

---

### Task P2.6: Build `KpiStrip`

**Files:** Create `apps/web/components/editorial/KpiStrip.tsx`

- [ ] **Step 1: Implement**

```tsx
import { ReactNode } from 'react';

export interface KpiTile {
  label: string;
  value: string;               // pre-formatted
  delta?: string;              // e.g., "+12% YoY"
  hint?: ReactNode;            // sparkline or note
}

interface Props {
  tiles: KpiTile[];
  /** Number of columns at lg breakpoint. Defaults to tiles.length. */
  cols?: 2 | 3 | 4;
}

export function KpiStrip({ tiles, cols }: Props) {
  const c = cols ?? Math.min(tiles.length, 4);
  const gridClass = c === 2 ? 'grid-cols-2'
    : c === 3 ? 'grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid ${gridClass} gap-4`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary tnum">{t.value}</p>
          {t.delta && <p className="mt-1 text-xs text-text-secondary tnum">{t.delta}</p>}
          {t.hint && <div className="mt-2">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/editorial/KpiStrip.tsx && git commit -m "feat: KpiStrip editorial primitive (P2.6)" && git push
```

---

### Task P2.7: Build heuristic annotation generators in `lib/annotations.ts`

**Files:** Create `apps/web/lib/annotations.ts`, `apps/web/lib/annotations.test.ts`

- [ ] **Step 1: Test first**

```typescript
import { describe, it, expect } from 'vitest';
import { peakYear, largestYoY, inflectionYear } from './annotations';

describe('annotation heuristics', () => {
  const series = [
    { x: 2020, y: 100 },
    { x: 2021, y: 120 },
    { x: 2022, y: 200 },
    { x: 2023, y: 180 },
    { x: 2024, y: 250 },
  ];

  it('peakYear returns the highest point', () => {
    expect(peakYear(series)).toEqual({ x: 2024, y: 250, label: 'Peak: 250' });
  });

  it('largestYoY returns biggest absolute YoY change', () => {
    const r = largestYoY(series);
    expect(r.x).toBe(2022);
    expect(r.label).toMatch(/jumped|grew/i);
  });

  it('inflectionYear finds the largest direction change', () => {
    const r = inflectionYear(series);
    expect(r.x).toBe(2023);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm -C apps/web vitest run lib/annotations.test.ts
```

- [ ] **Step 3: Implement**

```typescript
export interface SeriesPoint { x: number; y: number; }
export interface AnnotationResult extends SeriesPoint { label: string; }

export function peakYear(s: SeriesPoint[]): AnnotationResult {
  const p = s.reduce((a, b) => (b.y > a.y ? b : a));
  return { ...p, label: `Peak: ${p.y}` };
}

export function largestYoY(s: SeriesPoint[]): AnnotationResult {
  let max = { x: s[0].x, y: s[0].y, delta: 0 };
  for (let i = 1; i < s.length; i++) {
    const d = s[i].y - s[i - 1].y;
    if (Math.abs(d) > Math.abs(max.delta)) max = { x: s[i].x, y: s[i].y, delta: d };
  }
  const dir = max.delta > 0 ? 'jumped' : 'fell';
  return { x: max.x, y: max.y, label: `${dir} ${Math.abs(Math.round(max.delta))} from prior year` };
}

export function inflectionYear(s: SeriesPoint[]): AnnotationResult {
  if (s.length < 3) return { ...s[0], label: '' };
  let max = { x: s[1].x, y: s[1].y, score: 0 };
  for (let i = 1; i < s.length - 1; i++) {
    const prev = s[i].y - s[i - 1].y;
    const next = s[i + 1].y - s[i].y;
    const score = Math.abs(prev - next);
    if (score > max.score) max = { x: s[i + 1].x, y: s[i + 1].y, score };
  }
  return { x: max.x, y: max.y, label: 'Inflection' };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit + push**

```bash
git add apps/web/lib/annotations.ts apps/web/lib/annotations.test.ts && git commit -m "feat: heuristic annotation generators (P2.7)" && git push
```

---

### Task P2.8: Build mobile detection hook in `lib/mobile.ts`

**Files:** Create `apps/web/lib/mobile.ts`

- [ ] **Step 1: Implement**

```typescript
'use client';
import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return mobile;
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/lib/mobile.ts && git commit -m "feat: useIsMobile hook (P2.8)" && git push
```

---

### Task P2.9: Build `StackedBar`

**Files:** Create `apps/web/components/charts/StackedBar.tsx`

- [ ] **Step 1: Implement using Visx**

```tsx
'use client';
import { Group } from '@visx/group';
import { BarStack } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { useIsMobile } from '@/lib/mobile';
import { formatDollars } from '@/lib/format';

export interface StackedBarDatum { [key: string]: number | string; }

interface Props {
  data: StackedBarDatum[];
  keys: string[];                   // stack keys
  xKey: string;                     // category key (e.g., 'fiscal_year')
  colors: Record<string, string>;
  width: number;
  height: number;
  orientation?: 'vertical' | 'horizontal';
}

export function StackedBar({ data, keys, xKey, colors, width, height, orientation = 'vertical' }: Props) {
  const isMobile = useIsMobile();
  const o = isMobile ? 'horizontal' : orientation;

  const margin = { top: 16, right: 24, bottom: 32, left: 80 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xValues = data.map((d) => String(d[xKey]));
  const totals = data.map((d) => keys.reduce((s, k) => s + (Number(d[k]) || 0), 0));
  const maxTotal = Math.max(...totals);

  const xScale = scaleBand({ domain: xValues, range: [0, innerW], padding: 0.2 });
  const yScale = scaleLinear({ domain: [0, maxTotal], range: [innerH, 0], nice: true });
  const color = scaleOrdinal<string, string>({ domain: keys, range: keys.map((k) => colors[k]) });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <BarStack data={data} keys={keys} x={(d) => String(d[xKey])} xScale={xScale} yScale={yScale} color={color}>
          {(stacks) =>
            stacks.map((stack) =>
              stack.bars.map((bar) => (
                <rect key={`${stack.index}-${bar.index}`} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} />
              )),
            )
          }
        </BarStack>
        <AxisBottom top={innerH} scale={xScale} tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px]', textAnchor: 'middle' })} />
        <AxisLeft scale={yScale} tickFormat={(v) => formatDollars(Number(v))} tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px] tnum', textAnchor: 'end', dx: -4, dy: 4 })} />
      </Group>
    </svg>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm -C apps/web type-check
git add apps/web/components/charts/StackedBar.tsx && git commit -m "feat: StackedBar chart (P2.9)" && git push
```

---

### Task P2.10: Build `GroupedBar` (for reconciliation §5)

**Files:** Create `apps/web/components/charts/GroupedBar.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';
import { Group } from '@visx/group';
import { BarGroup } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { formatDollars } from '@/lib/format';

interface Props {
  data: Array<{ [key: string]: number | string }>;
  groupKey: string;                 // e.g., 'agency_bucket'
  seriesKeys: string[];             // e.g., ['herd', 'federal_funds']
  colors: Record<string, string>;
  width: number;
  height: number;
}

export function GroupedBar({ data, groupKey, seriesKeys, colors, width, height }: Props) {
  const margin = { top: 16, right: 16, bottom: 36, left: 80 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const groups = data.map((d) => String(d[groupKey]));
  const max = Math.max(...data.flatMap((d) => seriesKeys.map((k) => Number(d[k]) || 0)));

  const x0 = scaleBand({ domain: groups, range: [0, innerW], padding: 0.2 });
  const x1 = scaleBand({ domain: seriesKeys, range: [0, x0.bandwidth()], padding: 0.05 });
  const y = scaleLinear({ domain: [0, max], range: [innerH, 0], nice: true });
  const color = scaleOrdinal<string, string>({ domain: seriesKeys, range: seriesKeys.map((k) => colors[k]) });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <BarGroup data={data} keys={seriesKeys} height={innerH} x0={(d) => String(d[groupKey])} x0Scale={x0} x1Scale={x1} yScale={y} color={color}>
          {(barGroups) =>
            barGroups.map((bg) => (
              <Group key={`bg-${bg.index}`} left={bg.x0}>
                {bg.bars.map((bar) => (
                  <rect key={`${bg.index}-${bar.index}`} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} />
                ))}
              </Group>
            ))
          }
        </BarGroup>
        <AxisBottom top={innerH} scale={x0} tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px]', textAnchor: 'middle' })} />
        <AxisLeft scale={y} tickFormat={(v) => formatDollars(Number(v))} tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px] tnum', textAnchor: 'end', dx: -4, dy: 4 })} />
      </Group>
    </svg>
  );
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/charts/GroupedBar.tsx && git commit -m "feat: GroupedBar chart (P2.10)" && git push
```

---

### Task P2.11: Build `DistributionPlot` (decile bars)

**Files:** Create `apps/web/components/charts/DistributionPlot.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { scaleBand, scaleLinear } from '@visx/scale';
import { formatDollars } from '@/lib/format';

interface Props {
  data: Array<{ decile: number; avg_amount: number }>;
  width: number;
  height: number;
}

export function DistributionPlot({ data, width, height }: Props) {
  const margin = { top: 16, right: 16, bottom: 32, left: 80 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const x = scaleBand({ domain: data.map((d) => String(d.decile)), range: [0, innerW], padding: 0.15 });
  const y = scaleLinear({ domain: [0, Math.max(...data.map((d) => d.avg_amount))], range: [innerH, 0], nice: true });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {data.map((d) => (
          <rect key={d.decile} x={x(String(d.decile))} y={y(d.avg_amount)} width={x.bandwidth()} height={innerH - y(d.avg_amount)} fill="hsl(var(--accent))" />
        ))}
        <AxisBottom top={innerH} scale={x} label="Decile" tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px]', textAnchor: 'middle' })} />
        <AxisLeft scale={y} tickFormat={(v) => formatDollars(Number(v))} tickLabelProps={() => ({ className: 'fill-text-tertiary text-[11px] tnum', textAnchor: 'end', dx: -4, dy: 4 })} />
      </Group>
    </svg>
  );
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/charts/DistributionPlot.tsx && git commit -m "feat: DistributionPlot chart (P2.11)" && git push
```

---

### Task P2.12: Retrofit `BarChart` with `highlight` and `annotation` props

**Files:** Modify `apps/web/components/charts/BarChart.tsx`

- [ ] **Step 1: Read current**

```bash
cat apps/web/components/charts/BarChart.tsx | head -100
```

- [ ] **Step 2: Add to props interface**

```typescript
interface BarChartProps {
  // ...existing
  /** Index of the bar to highlight; all others render in --mute-1 */
  highlightIndex?: number;
  /** SVG-coord annotations to render on top of the chart */
  annotations?: Array<{ x: number; y: number; label: string }>;
  /** When true, render bars horizontally */
  horizontal?: boolean;
}
```

- [ ] **Step 3: Apply highlight rule in the bar fill**

```typescript
const fillFor = (i: number) => {
  if (highlightIndex == null) return 'hsl(var(--accent))';
  return i === highlightIndex ? 'hsl(var(--accent))' : 'hsl(var(--mute-1))';
};
```

- [ ] **Step 4: Render annotations inside the SVG**

```tsx
{annotations?.map((a, i) => <Annotation key={i} x={a.x} y={a.y} label={a.label} />)}
```

- [ ] **Step 5: Implement horizontal mode** (swap scales, axis positions)

```typescript
if (horizontal) {
  // x is value, y is category
  const xScale = scaleLinear({ domain: [0, max], range: [0, innerW], nice: true });
  const yScale = scaleBand({ domain: data.map((d) => String(d.label)), range: [0, innerH], padding: 0.2 });
  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {data.map((d, i) => (
          <rect key={d.label} x={0} y={yScale(String(d.label))} width={xScale(d.value)} height={yScale.bandwidth()} fill={fillFor(i)} />
        ))}
        <AxisBottom top={innerH} scale={xScale} tickFormat={(v) => formatDollars(Number(v))} />
        <AxisLeft scale={yScale} />
      </Group>
    </svg>
  );
}
```

(merge with existing vertical render path)

- [ ] **Step 6: Build + commit**

```bash
pnpm -C apps/web type-check && pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/charts/BarChart.tsx && git commit -m "feat: BarChart highlight + annotations + horizontal mode (P2.12)" && git push
```

---

### Task P2.13: Retrofit `LineChart` with direct-labeling

**Files:** Modify `apps/web/components/charts/LineChart.tsx`

- [ ] **Step 1: Add prop**

```typescript
interface LineChartProps {
  // existing
  /** Render direct labels at end of each series instead of a side legend */
  directLabels?: boolean;
  /** Optional in-chart annotations */
  annotations?: Array<{ x: number; y: number; label: string }>;
}
```

- [ ] **Step 2: After rendering lines, if `directLabels`**, render a `<text>` at the last data point of each series

```tsx
{directLabels && series.map((s) => {
  const last = s.data[s.data.length - 1];
  return (
    <text
      key={s.id}
      x={xScale(last.x) + 4}
      y={yScale(last.y)}
      className="text-[11px] fill-text-secondary tnum"
      dominantBaseline="middle"
    >
      {s.id}
    </text>
  );
})}
```

- [ ] **Step 3: Render annotations**

```tsx
{annotations?.map((a, i) => <Annotation key={i} x={a.x} y={a.y} label={a.label} />)}
```

- [ ] **Step 4: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/charts/LineChart.tsx && git commit -m "feat: LineChart direct labels + annotations (P2.13)" && git push
```

---

## Phase P3: University profile — `/universities/[sk]` (9 sections)

Each task in this phase builds one section of the profile. The page composition (`apps/web/app/universities/[sk]/page.tsx`) is updated at the end of each task to render the new section.

The shape of each task:
1. Add a new component in `apps/web/components/profile/<SectionN>.tsx` that takes a slice of `UniversityProfile`
2. Add a Vitest snapshot test
3. Wire it into the page
4. Verify build + Puppeteer probe

### Task P3.0: Rewrite `/universities/[sk]/page.tsx` to fetch + layout

**Files:** Modify `apps/web/app/universities/[sk]/page.tsx`

- [ ] **Step 1: Rewrite as client-side data-fetching shell**

```tsx
'use client';
import { useDuckDB } from '@/app/providers';
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { type UniversityProfile, getUniversityProfile } from '@/lib/queries';
import { Section1Hero } from '@/components/profile/Section1Hero';
import { Section2TotalRD } from '@/components/profile/Section2TotalRD';
import { Section3Sources } from '@/components/profile/Section3Sources';
import { Section4Agencies } from '@/components/profile/Section4Agencies';
import { Section5Reconciliation } from '@/components/profile/Section5Reconciliation';
import { Section6PIs } from '@/components/profile/Section6PIs';
import { Section7Disciplines } from '@/components/profile/Section7Disciplines';
import { Section8Concentration } from '@/components/profile/Section8Concentration';
import { Section9StateContext } from '@/components/profile/Section9StateContext';

export default function UniversityProfilePage({ params }: { params: { sk: string } }) {
  const sk = Number(params.sk);
  const { ready } = useDuckDB();
  const [profile, setProfile] = useState<UniversityProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !Number.isFinite(sk)) return;
    getUniversityProfile(sk).then(setProfile).catch((e) => setError(String(e)));
  }, [ready, sk]);

  if (!Number.isFinite(sk)) return notFound();
  if (error) return <div className="container-wide py-10 text-text-secondary">Couldn't load profile: {error}</div>;
  if (!profile) return <div className="container-wide py-10 text-text-secondary">Loading…</div>;

  return (
    <div className="container-wide py-10 md:py-14 space-y-12">
      <Section1Hero profile={profile} />
      <Section2TotalRD profile={profile} />
      <Section3Sources profile={profile} />
      <Section4Agencies profile={profile} />
      <Section5Reconciliation profile={profile} />
      <Section6PIs profile={profile} />
      <Section7Disciplines profile={profile} />
      <Section8Concentration profile={profile} />
      <Section9StateContext profile={profile} />
    </div>
  );
}
```

- [ ] **Step 2: Create empty stubs for each section component** so the build doesn't break

```bash
mkdir -p apps/web/components/profile
for n in 1Hero 2TotalRD 3Sources 4Agencies 5Reconciliation 6PIs 7Disciplines 8Concentration 9StateContext; do
  cat > "apps/web/components/profile/Section${n}.tsx" <<EOF
import { type UniversityProfile } from '@/lib/queries';
export function Section${n}({ profile }: { profile: UniversityProfile }) {
  return <section className="py-4 text-text-tertiary">Section ${n} placeholder for ${'$'}{profile.name}</section>;
}
EOF
done
```

- [ ] **Step 3: Build + commit**

```bash
pnpm -C apps/web type-check && pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/app/universities/[sk]/page.tsx apps/web/components/profile/ && git commit -m "feat: profile page shell + 9 section stubs (P3.0)" && git push
```

---

### Task P3.1: Section 1 — Hero KPIs

**Files:** Modify `apps/web/components/profile/Section1Hero.tsx`

- [ ] **Step 1: Implement**

```tsx
import { type UniversityProfile } from '@/lib/queries';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { formatDollars, formatPercent } from '@/lib/format';

export function Section1Hero({ profile }: { profile: UniversityProfile }) {
  const latest = profile.totalRd[profile.totalRd.length - 1];
  const earliest = profile.totalRd[0];
  const cagr = latest && earliest && earliest.total_rd_real > 0
    ? Math.pow(latest.total_rd_real / earliest.total_rd_real, 1 / (latest.fiscal_year - earliest.fiscal_year)) - 1
    : null;
  const federalShare = (() => {
    const fy = latest?.fiscal_year;
    if (!fy) return null;
    const rows = profile.sources.filter((s) => s.fiscal_year === fy);
    const total = rows.reduce((s, r) => s + r.amount_nominal, 0);
    const fed = rows.find((r) => r.source_category === 'federal')?.amount_nominal ?? 0;
    return total > 0 ? fed / total : null;
  })();
  // National rank computed in P5 query; for now show '—'.
  return (
    <header className="space-y-4">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">University profile · {profile.state}</p>
      <h1 className="text-3xl md:text-4xl font-bold text-text-primary">{profile.name}</h1>
      <KpiStrip
        cols={4}
        tiles={[
          { label: `Total R&D FY${latest?.fiscal_year ?? '—'}`, value: latest ? formatDollars(latest.total_rd_nominal) : '—' },
          { label: '20-yr CAGR (real)', value: cagr != null ? formatPercent(cagr) : '—' },
          { label: 'Federal share', value: federalShare != null ? formatPercent(federalShare) : '—' },
          { label: 'National rank', value: '—' },
        ]}
      />
    </header>
  );
}
```

- [ ] **Step 2: Verify `formatPercent` exists in `lib/format.ts`**; if not, add:

```typescript
export function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm -C apps/web type-check && pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section1Hero.tsx apps/web/lib/format.ts && git commit -m "feat: profile §1 hero KPIs (P3.1)" && git push
```

---

### Task P3.2: Section 2 — Total R&D timeline

**Files:** Modify `apps/web/components/profile/Section2TotalRD.tsx`

- [ ] **Step 1: Implement using `BarChart` + `ChartFrame`**

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { BarChart } from '@/components/charts/BarChart';
import { peakYear, largestYoY } from '@/lib/annotations';
import { useState } from 'react';
import { formatDollars } from '@/lib/format';

export function Section2TotalRD({ profile }: { profile: UniversityProfile }) {
  const [mode, setMode] = useState<'nominal' | 'real'>('nominal');
  const data = profile.totalRd.map((r) => ({
    label: String(r.fiscal_year),
    value: mode === 'real' ? r.total_rd_real : r.total_rd_nominal,
  }));
  const peak = peakYear(data.map((d) => ({ x: Number(d.label), y: d.value })));

  return (
    <>
      <SectionDivider eyebrow="Section 2 · Total R&D" title="Twenty years of research expenditures" dek="In-year R&D obligations as reported to HERD." color="hsl(var(--accent))" />
      <ChartFrame
        title={`Total R&D, ${profile.totalRd[0]?.fiscal_year}–${profile.totalRd[profile.totalRd.length - 1]?.fiscal_year}`}
        dek="Annual R&D expenditure across all sources."
        source="HERD Q01 totals"
        note={mode === 'real' ? 'Real FY2024 dollars (CPI-deflated)' : 'Nominal dollars'}
      >
        <div className="flex justify-end mb-2 gap-2">
          {(['nominal', 'real'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`text-xs px-2 py-1 rounded border ${mode === m ? 'bg-accent text-paper border-accent' : 'border-border text-text-secondary'}`}>
              {m === 'real' ? 'Real $2024' : 'Nominal $'}
            </button>
          ))}
        </div>
        <BarChart data={data} width={720} height={320} />
        <p className="mt-2 text-xs text-text-tertiary">Peak year: FY{peak.x} at {formatDollars(peak.y)}.</p>
      </ChartFrame>
    </>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section2TotalRD.tsx && git commit -m "feat: profile §2 total R&D timeline (P3.2)" && git push
```

---

### Task P3.3: Section 3 — R&D by source (stacked bar)

**Files:** Modify `apps/web/components/profile/Section3Sources.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { StackedBar } from '@/components/charts/StackedBar';

const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'];
const SOURCE_COLORS: Record<string, string> = {
  federal: 'hsl(var(--accent))',
  state: 'hsl(var(--agency-doe))',
  industry: 'hsl(var(--agency-dod))',
  institutional: 'hsl(var(--agency-nasa))',
  nonprofit: 'hsl(var(--agency-usda))',
  other: 'hsl(var(--mute-1))',
};

export function Section3Sources({ profile }: { profile: UniversityProfile }) {
  // Pivot to wide form for StackedBar
  const years = Array.from(new Set(profile.sources.map((s) => s.fiscal_year))).sort();
  const data = years.map((fy) => {
    const row: Record<string, number | string> = { fiscal_year: fy };
    for (const k of SOURCE_ORDER) row[k] = 0;
    profile.sources.filter((s) => s.fiscal_year === fy).forEach((s) => { row[s.source_category] = s.amount_nominal; });
    return row;
  });

  return (
    <>
      <SectionDivider eyebrow="Section 3 · Sources of R&D" title="Where the money comes from" dek="Federal, state, industry, institutional, nonprofit, and other sources." color="hsl(var(--accent))" />
      <ChartFrame title="R&D by source of funds" dek="Stacked bars show the absolute composition of each fiscal year." source="HERD Q01 (Source of funds)" note="ARDES era (FY2005–09) did not collect nonprofit data.">
        <StackedBar data={data} keys={SOURCE_ORDER} xKey="fiscal_year" colors={SOURCE_COLORS} width={720} height={360} />
      </ChartFrame>
    </>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section3Sources.tsx && git commit -m "feat: profile §3 R&D by source (P3.3)" && git push
```

---

### Task P3.4: Section 4 — Federal funding by agency (horizontal bar)

**Files:** Modify `apps/web/components/profile/Section4Agencies.tsx`

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { BarChart } from '@/components/charts/BarChart';

const AGENCY_COLORS: Record<string, string> = {
  NIH: 'hsl(var(--agency-nih))', HHS: 'hsl(var(--agency-nih))',
  NSF: 'hsl(var(--agency-nsf))', DOD: 'hsl(var(--agency-dod))',
  DOE: 'hsl(var(--agency-doe))', NASA: 'hsl(var(--agency-nasa))',
  USDA: 'hsl(var(--agency-usda))', Other: 'hsl(var(--agency-other))',
};

export function Section4Agencies({ profile }: { profile: UniversityProfile }) {
  const latestFy = Math.max(...profile.agencies.map((a) => a.fiscal_year));
  const rows = profile.agencies
    .filter((a) => a.fiscal_year === latestFy)
    .sort((a, b) => b.amount_nominal - a.amount_nominal)
    .map((a) => ({ label: a.agency_bucket, value: a.amount_nominal, color: AGENCY_COLORS[a.agency_bucket] }));

  return (
    <>
      <SectionDivider eyebrow={`Section 4 · Federal funding · FY${latestFy}`} title="Where the federal dollars come from" dek="Federal R&D obligations to this institution, by agency." color="hsl(var(--accent))" />
      <ChartFrame title={`Federal R&D by agency, FY${latestFy}`} dek="Horizontal bars, sorted from largest." source="HERD Q09 (federal R&D by agency)">
        <BarChart data={rows} width={720} height={Math.max(220, rows.length * 36)} horizontal />
      </ChartFrame>
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section4Agencies.tsx && git commit -m "feat: profile §4 federal by agency (P3.4)" && git push
```

---

### Task P3.5: Section 5 — Reconciliation (HERD vs Federal Funds)

**Files:** Modify `apps/web/components/profile/Section5Reconciliation.tsx`

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { GroupedBar } from '@/components/charts/GroupedBar';

export function Section5Reconciliation({ profile }: { profile: UniversityProfile }) {
  const latestFy = Math.max(...profile.agencies.map((a) => a.fiscal_year));
  const ffRows = profile.federalFunds.filter((r) => r.fiscal_year === latestFy);
  const herdRows = profile.agencies.filter((r) => r.fiscal_year === latestFy);
  const agencies = Array.from(new Set([...herdRows.map((r) => r.agency_bucket), ...ffRows.map((r) => r.agency_bucket)]));
  const data = agencies.map((a) => ({
    agency_bucket: a,
    herd: herdRows.find((r) => r.agency_bucket === a)?.amount_nominal ?? 0,
    federal_funds: ffRows.filter((r) => r.agency_bucket === a).reduce((s, r) => s + r.amount_nominal, 0),
  }));

  return (
    <>
      <SectionDivider eyebrow={`Section 5 · Reconciliation · FY${latestFy}`} title="Two measures of the same dollar" dek="HERD measures expenditures, Federal Funds measures obligations. A 15–25% gap is expected." color="hsl(var(--accent))" />
      <ChartFrame title="HERD-reported vs Federal Funds" dek="Grouped bars per agency: institution-reported on the left, federal-source on the right." source="HERD Q09 + NSF Federal Funds Vol 70/71" note="See Methodology for the Vol 70→71 taxonomy break at FY2015–16.">
        <GroupedBar data={data} groupKey="agency_bucket" seriesKeys={['herd', 'federal_funds']} colors={{ herd: 'hsl(var(--accent))', federal_funds: 'hsl(var(--mute-1))' }} width={720} height={360} />
      </ChartFrame>
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section5Reconciliation.tsx && git commit -m "feat: profile §5 reconciliation (P3.5)" && git push
```

---

### Task P3.6: Section 6 — PI metrics

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { LineChart } from '@/components/charts/LineChart';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { formatDollars } from '@/lib/format';

export function Section6PIs({ profile }: { profile: UniversityProfile }) {
  const latest = profile.piMetrics[profile.piMetrics.length - 1];
  const piTrend = profile.piMetrics.map((p) => ({ x: p.fiscal_year, y: p.pi_count }));
  const distLatest = profile.piDistribution.filter((d) => d.fiscal_year === latest?.fiscal_year);

  return (
    <>
      <SectionDivider eyebrow={`Section 6 · PI metrics · FY${latest?.fiscal_year ?? '—'}`} title="Principal investigators behind the numbers" dek="Distinct federally-funded PIs and the dollars they command." color="hsl(var(--agency-nih))" />
      <KpiStrip cols={3} tiles={[
        { label: 'Distinct federal PIs', value: latest ? latest.pi_count.toLocaleString() : '—' },
        { label: 'Avg federal $ per PI', value: latest ? formatDollars(latest.amount_per_pi) : '—' },
        { label: 'Federal R&D total', value: latest ? formatDollars(latest.federal_amount) : '—' },
      ]} />
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <ChartFrame title="PI count over time" source="NSF awards + NIH RePORTER">
          <LineChart series={[{ id: 'PIs', data: piTrend }]} width={360} height={220} directLabels />
        </ChartFrame>
        <ChartFrame title={`$ per PI distribution, FY${latest?.fiscal_year}`} dek="Average $ in each decile of the institution's PI population." source="NSF + NIH per-PI totals">
          <DistributionPlot data={distLatest.map((d) => ({ decile: d.decile, avg_amount: d.avg_amount }))} width={360} height={220} />
        </ChartFrame>
      </div>
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section6PIs.tsx && git commit -m "feat: profile §6 PI metrics (P3.6)" && git push
```

---

### Task P3.7: Section 7 — Discipline mix

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { BarChart } from '@/components/charts/BarChart';
import { formatPercent, formatDollars } from '@/lib/format';

export function Section7Disciplines({ profile }: { profile: UniversityProfile }) {
  const latestFy = Math.max(...profile.fieldMix.map((f) => f.fiscal_year));
  const rows = profile.fieldMix.filter((f) => f.fiscal_year === latestFy);
  const total = rows.reduce((s, r) => s + r.amount_nominal, 0);
  const stem = rows.filter((r) => r.is_stem).reduce((s, r) => s + r.amount_nominal, 0);
  const stemShare = total > 0 ? stem / total : 0;
  const subjects = profile.subjectTags.filter((s) => s.fiscal_year === latestFy);

  return (
    <>
      <SectionDivider eyebrow={`Section 7 · Discipline mix · FY${latestFy}`} title="What the research is about" dek="Field-of-science composition + subject-area keyword tags." color="hsl(var(--agency-dod))" />
      <KpiStrip cols={3} tiles={[
        { label: 'STEM share', value: formatPercent(stemShare) },
        { label: 'Non-STEM share', value: formatPercent(1 - stemShare) },
        { label: 'R&D fields represented', value: String(rows.length) },
      ]} />
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <ChartFrame title="By field of science" source="HERD Q03">
          <BarChart data={rows.map((r) => ({ label: r.field_category, value: r.amount_nominal }))} width={360} height={260} horizontal />
        </ChartFrame>
        <ChartFrame title="Subject-area tags" dek="Tagged via keyword match on award titles + abstracts." source="NSF + NIH award text">
          <BarChart data={subjects.map((s) => ({ label: s.subject_tag, value: s.tagged_amount }))} width={360} height={260} horizontal />
        </ChartFrame>
      </div>
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section7Disciplines.tsx && git commit -m "feat: profile §7 disciplines (P3.7)" && git push
```

---

### Task P3.8: Section 8 — Concentration & volatility

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { LineChart } from '@/components/charts/LineChart';

export function Section8Concentration({ profile }: { profile: UniversityProfile }) {
  const latest = profile.concentration[profile.concentration.length - 1];
  const hhiSeries = profile.concentration.map((c) => ({ x: c.fiscal_year, y: c.hhi }));

  return (
    <>
      <SectionDivider eyebrow="Section 8 · Concentration" title="How diversified is the portfolio?" dek="Herfindahl–Hirschman Index of agency mix, plus year-on-year volatility." color="hsl(var(--agency-doe))" />
      <KpiStrip cols={3} tiles={[
        { label: 'HHI (agency mix)', value: latest ? Math.round(latest.hhi).toString() : '—' },
        { label: 'Shannon entropy', value: latest ? latest.shannon_entropy.toFixed(2) : '—' },
        { label: '5-yr volatility (CoV)', value: latest?.cov_5yr != null ? (latest.cov_5yr * 100).toFixed(1) + '%' : '—' },
      ]} />
      <ChartFrame title="HHI over time" dek="An HHI below 1500 is considered diversified; above 2500 is concentrated." source="Derived from HERD Q09 agency shares">
        <LineChart series={[{ id: 'HHI', data: hhiSeries }]} width={720} height={260} directLabels />
      </ChartFrame>
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section8Concentration.tsx && git commit -m "feat: profile §8 concentration (P3.8)" && git push
```

---

### Task P3.9: Section 9 — State context & peers

```tsx
'use client';
import { type UniversityProfile } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { formatPercent } from '@/lib/format';

export function Section9StateContext({ profile }: { profile: UniversityProfile }) {
  const latest = profile.stateContext[profile.stateContext.length - 1];
  const latestPatents = profile.patents[profile.patents.length - 1];

  return (
    <>
      <SectionDivider eyebrow={`Section 9 · State context · ${profile.state}`} title="Position within the state" dek="Share of state R&D, peer institutions, patent intensity." color="hsl(var(--agency-nasa))" />
      <KpiStrip cols={3} tiles={[
        { label: `Share of ${profile.state} R&D`, value: latest ? formatPercent(latest.share_of_state) : '—' },
        { label: 'Peer institutions identified', value: String(profile.peers.length) },
        { label: 'Patents per award', value: latestPatents?.patents_per_award != null ? latestPatents.patents_per_award.toFixed(2) : '—' },
      ]} />
      {profile.peers.length > 0 && (
        <ChartFrame title="Top peer institutions" dek="Same state, within ±25% R&D size." source="dim_institution + agg_uni_total_rd">
          <ul className="space-y-1 text-sm">
            {profile.peers.map((p) => (
              <li key={p.peer_sk} className="flex items-center justify-between border-b border-rule py-1">
                <span>Peer #{p.peer_rank}: institution {p.peer_sk}</span>
                <a className="text-accent hover:underline" href={`/universities/${p.peer_sk}`}>View →</a>
              </li>
            ))}
          </ul>
        </ChartFrame>
      )}
    </>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/Section9StateContext.tsx && git commit -m "feat: profile §9 state context (P3.9)" && git push
```

---

### Task P3.10: Profile page Puppeteer probe

- [ ] **Step 1: Probe 5 representative institutions**

```bash
pnpm -C apps/web dev &
sleep 8
cat > /tmp/probe_profile.js <<'JS'
const puppeteer = require('puppeteer-core');
const SAMPLES = [1, 50, 200, 500, 800];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const failures = [];
  for (const sk of SAMPLES) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => failures.push(`uni ${sk}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && failures.push(`uni ${sk}: ${m.text()}`));
    try { await page.goto(`http://localhost:3000/universities/${sk}`, { waitUntil: 'networkidle0', timeout: 30000 }); }
    catch (e) { failures.push(`uni ${sk}: ${e.message}`); }
    await page.close();
  }
  await browser.close();
  if (failures.length) { console.error('FAIL'); failures.forEach((f) => console.error(' - ' + f)); process.exit(1); }
  console.log(`OK: ${SAMPLES.length} profiles clean`);
})();
JS
node /tmp/probe_profile.js
kill %1
```

Expected: `OK: 5 profiles clean`. Fix any failures.

- [ ] **Step 2: Commit any fixes** (no-op if none)

```bash
git add -A && git diff --cached --quiet || (git commit -m "fix: profile page issues found in probe (P3.10)" && git push)
```

---

## Phase P4: `/universities` sortable index

### Task P4.1: Build `UniversityTable` component

**Files:** Create `apps/web/components/editorial/UniversityTable.tsx`

- [ ] **Step 1: Implement** (using react-table-like sort logic)

```tsx
'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { type UniversityIndexRow } from '@/lib/queries';
import { formatDollars, formatPercent } from '@/lib/format';

type SortKey = keyof UniversityIndexRow;
type SortDir = 'asc' | 'desc';

interface Props { rows: UniversityIndexRow[]; }

const COLS: Array<{ key: SortKey; label: string; align?: 'left' | 'right'; fmt?: (v: any) => string }> = [
  { key: 'name', label: 'Institution', align: 'left' },
  { key: 'state', label: 'State', align: 'left' },
  { key: 'total_rd_fy2024', label: 'Total R&D FY24', align: 'right', fmt: (v) => formatDollars(v) },
  { key: 'cagr_20yr', label: '20-yr CAGR', align: 'right', fmt: (v) => v != null ? formatPercent(v) : '—' },
  { key: 'federal_share', label: 'Federal %', align: 'right', fmt: (v) => v != null ? formatPercent(v) : '—' },
  { key: 'pi_count', label: '# PIs', align: 'right', fmt: (v) => v?.toLocaleString() ?? '—' },
  { key: 'stem_share', label: 'STEM %', align: 'right', fmt: (v) => v != null ? formatPercent(v) : '—' },
];

export function UniversityTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_rd_fy2024');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [stateFilter, setStateFilter] = useState('');
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) =>
      (stateFilter === '' || r.state === stateFilter) &&
      (search === '' || r.name.toLowerCase().includes(search.toLowerCase())),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir, stateFilter, search]);

  const states = Array.from(new Set(rows.map((r) => r.state))).sort();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input placeholder="Search institutions…" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-border rounded px-3 py-1 text-sm bg-surface" />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="border border-border rounded px-3 py-1 text-sm bg-surface">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-xs text-text-tertiary self-center">{sorted.length} institutions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tnum border-collapse">
          <thead>
            <tr className="border-b-2 border-rule">
              {COLS.map((c) => (
                <th key={c.key} className={`py-2 px-3 text-${c.align ?? 'left'} font-semibold cursor-pointer hover:text-accent`}
                  onClick={() => {
                    if (sortKey === c.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { setSortKey(c.key); setSortDir(c.align === 'right' ? 'desc' : 'asc'); }
                  }}>
                  {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 500).map((r) => (
              <tr key={r.institution_sk} className="border-b border-rule hover:bg-mute-3">
                <td className="py-1.5 px-3"><Link className="text-accent hover:underline" href={`/universities/${r.institution_sk}`}>{r.name}</Link></td>
                <td className="py-1.5 px-3">{r.state}</td>
                {COLS.slice(2).map((c) => (
                  <td key={c.key} className={`py-1.5 px-3 text-${c.align}`}>{c.fmt ? c.fmt(r[c.key]) : String(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/editorial/UniversityTable.tsx && git commit -m "feat: UniversityTable (P4.1)" && git push
```

---

### Task P4.2: Wire `/universities/page.tsx` to data

```tsx
'use client';
import { useDuckDB } from '@/app/providers';
import { useEffect, useState } from 'react';
import { getUniversityIndex, type UniversityIndexRow } from '@/lib/queries';
import { UniversityTable } from '@/components/editorial/UniversityTable';
import { PageHeader } from '@/components/layout/PageHeader';

export default function UniversitiesPage() {
  const { ready } = useDuckDB();
  const [rows, setRows] = useState<UniversityIndexRow[] | null>(null);

  useEffect(() => { if (ready) getUniversityIndex().then(setRows); }, [ready]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-6">
      <PageHeader eyebrow="Browse" title="All universities" description="Sortable directory of every institution in the dataset." />
      {rows ? <UniversityTable rows={rows} /> : <p className="text-text-secondary">Loading…</p>}
    </div>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/app/universities/page.tsx && git commit -m "feat: /universities sortable table (P4.2)" && git push
```

---

## Phase P5: `/national` cross-uni dashboard

### Task P5.1: Build `/national/page.tsx` with 7 anchored sections

```tsx
'use client';
import { useDuckDB } from '@/app/providers';
import { useEffect, useState } from 'react';
import { getNationalOverview, getNationalAgencyTrend, getNationalConcentration } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { StackedBar } from '@/components/charts/StackedBar';
import { LineChart } from '@/components/charts/LineChart';
import { PageHeader } from '@/components/layout/PageHeader';

const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'];
const SOURCE_COLORS = {
  federal: 'hsl(var(--accent))', state: 'hsl(var(--agency-doe))',
  industry: 'hsl(var(--agency-dod))', institutional: 'hsl(var(--agency-nasa))',
  nonprofit: 'hsl(var(--agency-usda))', other: 'hsl(var(--mute-1))',
};

export default function NationalPage() {
  const { ready } = useDuckDB();
  const [overview, setOverview] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [concentration, setConcentration] = useState<any[]>([]);

  useEffect(() => {
    if (!ready) return;
    Promise.all([getNationalOverview(), getNationalAgencyTrend(), getNationalConcentration()])
      .then(([o, a, c]) => { setOverview(o); setAgencies(a); setConcentration(c); });
  }, [ready]);

  // Pivot overview
  const years = Array.from(new Set(overview.map((r) => r.fiscal_year))).sort();
  const overviewWide = years.map((fy) => {
    const row: any = { fiscal_year: fy };
    SOURCE_ORDER.forEach((k) => { row[k] = 0; });
    overview.filter((r) => r.fiscal_year === fy).forEach((r) => { row[r.source_category] = r.amount_nominal; });
    return row;
  });

  // Pivot concentration
  const concBuckets = ['top_10', 'top_25', 'top_100'];
  const concSeries = concBuckets.map((b) => ({
    id: b.replace('_', ' '),
    data: concentration.filter((c) => c.bucket === b).map((c) => ({ x: c.fiscal_year, y: c.share * 100 })),
  }));

  // Pivot agency trends
  const agencyBuckets = Array.from(new Set(agencies.map((a) => a.agency_bucket)));
  const agencySeries = agencyBuckets.map((b) => ({
    id: b,
    data: agencies.filter((a) => a.agency_bucket === b).map((a) => ({ x: a.fiscal_year, y: a.amount_nominal })),
  }));

  return (
    <div className="container-wide py-10 md:py-14 space-y-2">
      <PageHeader eyebrow="National view" title="U.S. university research funding" description="Cross-cutting trends across all ~800 institutions." />

      <section id="overview">
        <SectionDivider eyebrow="National · Overview" title="Total US R&D by source" />
        <ChartFrame title="20-year trend by source" source="HERD Q01 aggregated nationally">
          <StackedBar data={overviewWide} keys={SOURCE_ORDER} xKey="fiscal_year" colors={SOURCE_COLORS} width={1000} height={400} />
        </ChartFrame>
      </section>

      <section id="agencies">
        <SectionDivider eyebrow="National · Agencies" title="Federal funding by agency" />
        <ChartFrame title="20-year trend by agency" source="HERD Q09 aggregated nationally">
          <LineChart series={agencySeries} width={1000} height={340} directLabels />
        </ChartFrame>
      </section>

      <section id="concentration">
        <SectionDivider eyebrow="National · Concentration" title="Top-N share of national R&D" />
        <ChartFrame title="What share do the largest universities command?" dek="% of total US R&D held by the top 10, 25, and 100 institutions over time." source="agg_national_concentration">
          <LineChart series={concSeries} width={1000} height={340} directLabels />
        </ChartFrame>
      </section>

      <section id="geography">
        <SectionDivider eyebrow="National · Geography" title="State-level rollups" />
        <p className="text-text-secondary text-sm">State choropleth and rankings — implemented via existing <code>USStateMap</code>.</p>
        {/* Existing USStateMap can be embedded here with a state-rollup query */}
      </section>

      <section id="trends">
        <SectionDivider eyebrow="National · Trends" title="Multi-metric explorer" />
        <p className="text-text-secondary text-sm">Use the controls to overlay any two national metrics — coming in P5.2.</p>
      </section>

      <section id="disciplines">
        <SectionDivider eyebrow="National · Disciplines" title="STEM vs non-STEM nationally" />
        <p className="text-text-secondary text-sm">Discipline rollup — coming in P5.2.</p>
      </section>

      <section id="pi-distribution">
        <SectionDivider eyebrow="National · PIs" title="PI count + $/PI distribution" />
        <p className="text-text-secondary text-sm">National PI count — coming in P5.2.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/app/national/page.tsx && git commit -m "feat: /national with overview/agencies/concentration sections (P5.1)" && git push
```

---

### Task P5.2: Fill remaining `/national` sections (geography map, trends, disciplines, PI distribution)

- [ ] **Step 1: Embed existing `USStateMap` into `#geography`** — write a small query helper `getStateRollup(fy: number)` that aggregates `agg_uni_total_rd` by state, and pass the result to `USStateMap`. The exact `USStateMap` props are visible in `apps/web/components/charts/USStateMap.tsx` — match its signature.

- [ ] **Step 2: For `#disciplines`** — add a new query helper `getNationalFieldMix()` that aggregates `agg_uni_field_mix` nationally and render a stacked bar of STEM vs non-STEM over time.

- [ ] **Step 3: For `#pi-distribution`** — add `getNationalPiDistribution()` aggregating `agg_uni_pi_distribution` and render a national decile chart.

- [ ] **Step 4: For `#trends`** — add a simple `<select>` letting the user pick between total_rd, federal_share, pi_count and rendering a LineChart of the national rollup.

- [ ] **Step 5: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add -A && git commit -m "feat: /national geography/disciplines/PI/trends sections (P5.2)" && git push
```

---

## Phase P6: `/compare` rebuild

### Task P6.1: Rebuild `/compare/page.tsx` for multi-uni small multiples

```tsx
'use client';
import { useDuckDB } from '@/app/providers';
import { useEffect, useState } from 'react';
import { getUniversityProfile, type UniversityProfile, searchInstitutions } from '@/lib/queries';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { BarChart } from '@/components/charts/BarChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDollars } from '@/lib/format';

const METRICS = [
  { key: 'total_rd', label: 'Total R&D' },
  { key: 'federal_share', label: 'Federal share' },
  { key: 'pi_count', label: '# PIs' },
  { key: 'stem_share', label: 'STEM share' },
] as const;

export default function ComparePage() {
  const { ready } = useDuckDB();
  const [selected, setSelected] = useState<UniversityProfile[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ sk: number; name: string; state: string }>>([]);
  const [metric, setMetric] = useState<typeof METRICS[number]['key']>('total_rd');

  useEffect(() => {
    if (!ready || search.length < 2) { setResults([]); return; }
    searchInstitutions(search).then(setResults);
  }, [ready, search]);

  const add = async (sk: number) => {
    if (selected.find((p) => p.institution_sk === sk)) return;
    if (selected.length >= 5) return;
    const p = await getUniversityProfile(sk);
    setSelected((s) => [...s, p]);
  };

  const remove = (sk: number) => setSelected((s) => s.filter((p) => p.institution_sk !== sk));

  return (
    <div className="container-wide py-10 md:py-14 space-y-6">
      <PageHeader eyebrow="Compare" title="Side-by-side comparison" description="Pick 2–5 universities and compare any metric." />

      <div className="flex flex-wrap items-center gap-2">
        <input className="border border-border rounded px-3 py-1 text-sm bg-surface" placeholder="Add institution…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {results.slice(0, 5).map((r) => (
          <button key={r.sk} onClick={() => { add(r.sk); setSearch(''); }} className="text-xs px-2 py-1 rounded bg-mute-3 hover:bg-accent hover:text-paper">{r.name}</button>
        ))}
        <span className="ml-auto text-xs text-text-tertiary">{selected.length}/5 selected</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {selected.map((p) => (
          <span key={p.institution_sk} className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-accent text-paper">
            {p.name}
            <button onClick={() => remove(p.institution_sk)} aria-label="Remove">×</button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={`text-xs px-3 py-1.5 rounded border ${metric === m.key ? 'bg-accent text-paper border-accent' : 'border-border text-text-secondary'}`}>{m.label}</button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selected.map((p) => {
            const data = p.totalRd.map((r) => ({ label: String(r.fiscal_year), value: r.total_rd_nominal }));
            return (
              <ChartFrame key={p.institution_sk} title={p.name} source="HERD">
                <BarChart data={data} width={360} height={220} />
              </ChartFrame>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/app/compare/page.tsx && git commit -m "feat: rebuild /compare for multi-uni small multiples (P6.1)" && git push
```

---

## Phase P7: New home page

### Task P7.1: Build `UniversitySearchBox`

```tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { searchInstitutions } from '@/lib/queries';
import { useDuckDB } from '@/app/providers';

export function UniversitySearchBox() {
  const { ready } = useDuckDB();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ sk: number; name: string; state: string }>>([]);

  useEffect(() => {
    if (!ready || q.length < 2) { setResults([]); return; }
    searchInstitutions(q).then(setResults);
  }, [ready, q]);

  return (
    <div className="relative max-w-xl">
      <input
        type="search"
        placeholder="Search any of ~800 universities…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-4 py-3 text-base border border-border rounded bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-border rounded shadow-sm divide-y divide-rule">
          {results.map((r) => (
            <li key={r.sk}>
              <Link href={`/universities/${r.sk}`} className="block px-4 py-2 hover:bg-mute-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-text-tertiary">({r.state})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 1: Commit + push**

```bash
git add apps/web/components/editorial/UniversitySearchBox.tsx && git commit -m "feat: UniversitySearchBox (P7.1)" && git push
```

---

### Task P7.2: Rebuild `/page.tsx` (home)

```tsx
'use client';
import { useDuckDB } from '@/app/providers';
import { useEffect, useState } from 'react';
import { getUniversityIndex, getNationalOverview, type UniversityIndexRow } from '@/lib/queries';
import { UniversitySearchBox } from '@/components/editorial/UniversitySearchBox';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { BarChart } from '@/components/charts/BarChart';
import { StackedBar } from '@/components/charts/StackedBar';
import { formatDollars } from '@/lib/format';
import Link from 'next/link';

const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'];
const SOURCE_COLORS = {
  federal: 'hsl(var(--accent))', state: 'hsl(var(--agency-doe))',
  industry: 'hsl(var(--agency-dod))', institutional: 'hsl(var(--agency-nasa))',
  nonprofit: 'hsl(var(--agency-usda))', other: 'hsl(var(--mute-1))',
};

export default function HomePage() {
  const { ready } = useDuckDB();
  const [top10, setTop10] = useState<UniversityIndexRow[]>([]);
  const [overview, setOverview] = useState<any[]>([]);

  useEffect(() => {
    if (!ready) return;
    Promise.all([getUniversityIndex(), getNationalOverview()]).then(([idx, ov]) => {
      setTop10(idx.slice(0, 10));
      setOverview(ov);
    });
  }, [ready]);

  const fy24Total = overview.filter((r) => r.fiscal_year === 2024).reduce((s, r) => s + r.amount_nominal, 0);
  const [universitiesCount, setUniversitiesCount] = [800, (n: number) => n];   // populated below
  const [totalPIs, setTotalPIs] = [250000, (n: number) => n];                   // populated below
  // Add to useEffect: fetch counts via query()
  // const counts = await query<{ unis: number; pis: number }>(`
  //   SELECT (SELECT COUNT(*) FROM read_parquet('${dataUrl('dim_institution.parquet')}')) AS unis,
  //          (SELECT SUM(pi_count) FROM read_parquet('${dataUrl('agg_uni_pi_metrics.parquet')}') WHERE fiscal_year = 2024) AS pis
  // `);
  // setUniversitiesCount(counts[0].unis); setTotalPIs(counts[0].pis);

  const years = Array.from(new Set(overview.map((r) => r.fiscal_year))).sort();
  const wide = years.map((fy) => {
    const row: any = { fiscal_year: fy };
    SOURCE_ORDER.forEach((k) => { row[k] = 0; });
    overview.filter((r) => r.fiscal_year === fy).forEach((r) => { row[r.source_category] = r.amount_nominal; });
    return row;
  });

  return (
    <div className="container-wide py-14 md:py-20 space-y-12">
      <header className="space-y-6">
        <p className="text-[11px] uppercase tracking-wider text-text-tertiary">A data product by Research Data Platform</p>
        <h1 className="text-4xl md:text-5xl font-bold text-text-primary leading-tight">U.S. University Research Funding</h1>
        <p className="text-lg italic text-text-secondary max-w-2xl">Twenty years. Eight hundred institutions. Seven federal agencies. One data lake.</p>
        <UniversitySearchBox />
      </header>

      <KpiStrip cols={3} tiles={[
        { label: 'Total R&D FY24', value: fy24Total > 0 ? formatDollars(fy24Total) : '—' },
        { label: 'Universities tracked', value: universitiesCount.toLocaleString() },
        { label: 'Distinct federal PIs', value: totalPIs.toLocaleString() },
      ]} />

      <div className="grid md:grid-cols-2 gap-8">
        <ChartFrame title="Top 10 universities by FY2024 R&D" dek="Click a row to view that profile." source="HERD totals">
          <ul className="space-y-1 text-sm">
            {top10.map((r, i) => (
              <li key={r.institution_sk}>
                <Link href={`/universities/${r.institution_sk}`} className="flex justify-between border-b border-rule py-1.5 hover:bg-mute-3 px-2">
                  <span><span className="text-text-tertiary mr-2 tnum">{(i + 1).toString().padStart(2, '0')}</span>{r.name}</span>
                  <span className="text-accent tnum">{formatDollars(r.total_rd_fy2024)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </ChartFrame>

        <ChartFrame title="National R&D by source, 20 years" source="HERD Q01">
          <StackedBar data={wide} keys={SOURCE_ORDER} xKey="fiscal_year" colors={SOURCE_COLORS} width={500} height={300} />
        </ChartFrame>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link href="/universities" className="px-4 py-2 rounded bg-accent text-paper hover:bg-accent-strong">Browse all 800 universities →</Link>
        <Link href="/national" className="px-4 py-2 rounded border border-accent text-accent hover:bg-accent hover:text-paper">Explore the national view →</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/app/page.tsx && git commit -m "feat: new home page (P7.2)" && git push
```

---

## Phase P8: Editorial polish

### Task P8.1: Add heuristic annotations to every chart on the profile

For each of `Section2TotalRD`, `Section4Agencies`, `Section5Reconciliation`, `Section6PIs`, `Section8Concentration`:

- [ ] **Step 1: For each section, compute the annotation and render it as a footnote line** (simpler than projecting to SVG coords — and equally editorial). Pattern:

```tsx
import { peakYear, largestYoY } from '@/lib/annotations';
// inside the component, after the chart:
const points = profile.totalRd.map((r) => ({ x: r.fiscal_year, y: r.total_rd_nominal }));
const peak = peakYear(points);
const jump = largestYoY(points);
return (
  <>
    {/* ... chart ... */}
    <p className="mt-2 text-xs text-text-tertiary">
      Peak: FY{peak.x} at {formatDollars(peak.y)}. Biggest year-on-year change: FY{jump.x} ({jump.label}).
    </p>
  </>
);
```

Per-section heuristic assignment:
- §2 Total R&D: `peakYear` + `largestYoY`
- §4 Agencies: largest agency named in a footnote ("NIH was the dominant funder in FY2024 at $X.")
- §5 Reconciliation: largest gap by agency ("HERD reported $X less than Federal Funds for NSF in FY2024.")
- §6 PI metrics: peak PI year ("PI count peaked at N in FYxxxx.")
- §8 Concentration: HHI direction ("HHI rose from X in FY2005 to Y in FY2024 — increasing concentration.")

- [ ] **Step 3: Build + commit**

```bash
pnpm -C apps/web build 2>&1 | tail -5
git add apps/web/components/profile/ && git commit -m "polish: heuristic annotations on profile charts (P8.1)" && git push
```

---

### Task P8.2: Apply per-section color in `SectionDivider`

- [ ] **Step 1: For each `SectionDivider` call**, pick the dominant agency color for that section:
  - §1 Hero — accent (cherry)
  - §2 Total R&D — accent
  - §3 Sources — `hsl(var(--agency-doe))` (gold for variety)
  - §4 Agencies — `hsl(var(--agency-nih))` (navy — the dominant agency for most unis)
  - §5 Reconciliation — `hsl(var(--accent))` red
  - §6 PI metrics — `hsl(var(--agency-nih))`
  - §7 Disciplines — `hsl(var(--agency-dod))`
  - §8 Concentration — `hsl(var(--agency-doe))`
  - §9 State context — `hsl(var(--agency-nasa))`

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/components/profile/ && git commit -m "polish: per-section divider colors (P8.2)" && git push
```

---

### Task P8.3: Refresh `/methodology` with landmines + tagging methodology

```tsx
// Add to apps/web/app/methodology/page.tsx — three new sections:
// 1. "Three data landmines" — explain Vol 70→71, ARDES nonprofit, USAS PIID
// 2. "Subject-area tagging" — show the regex patterns
// 3. "PI deduplication" — explain the dim_pi cross-walk
```

- [ ] **Step 1: Edit the file** with three new `<section>` blocks containing prose + code samples.

- [ ] **Step 2: Commit + push**

```bash
git add apps/web/app/methodology/page.tsx && git commit -m "docs: methodology landmines + tagging + dedup (P8.3)" && git push
```

---

## Phase P9: Deep QA (the 18-dimension suite)

### Task P9.1: Build the main probe `scripts/qa/probe_pages.js`

- [ ] **Step 1: Create**

```javascript
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const STATIC_ROUTES = ['/', '/universities', '/national', '/compare', '/methodology', '/downloads'];
// Discover actual sk values: run `duckdb -c "SELECT institution_sk FROM read_parquet('apps/web/public/data/dim_institution.parquet') ORDER BY institution_sk LIMIT 1 OFFSET <n>"` for n = 0, 100, 300, 500, 700 and paste below.
const SAMPLE_UNIS = [1, 100, 300, 500, 700];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const allFailures = [];
  const outDir = path.join(__dirname, '../../qa-screens');
  fs.mkdirSync(outDir, { recursive: true });

  const routes = [...STATIC_ROUTES, ...SAMPLE_UNIS.map((s) => `/universities/${s}`)];

  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      const failures = [];
      page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && failures.push(`console: ${m.text()}`));
      try {
        await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
        const safeRoute = route.replace(/\//g, '_') || 'root';
        await page.screenshot({ path: path.join(outDir, `${safeRoute}__${vp.name}.png`), fullPage: true });
        // Horizontal scroll detection
        const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (hasOverflow) failures.push(`overflow at ${vp.width}px`);
      } catch (e) {
        failures.push(`load: ${e.message}`);
      }
      if (failures.length) allFailures.push({ route, vp: vp.name, failures });
      await page.close();
    }
  }
  await browser.close();

  const reportPath = path.join(__dirname, '../../qa-probe-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(allFailures, null, 2));
  if (allFailures.length) { console.error(`${allFailures.length} failure groups; see ${reportPath}`); process.exit(1); }
  console.log(`OK: ${routes.length * VIEWPORTS.length} (route × viewport) combinations clean`);
})();
```

- [ ] **Step 2: Commit + push**

```bash
git add scripts/qa/probe_pages.js && git commit -m "qa: page probe with screenshots + overflow detection (P9.1)" && git push
```

---

### Task P9.2: Build the data-accuracy fact file `scripts/qa/facts.json`

- [ ] **Step 1: Create with 30 known-true facts**

```json
[
  { "id": "total_us_rd_fy2024", "description": "Total US university R&D FY2024", "sql": "SELECT SUM(amount_nominal) FROM read_parquet('apps/web/public/data/agg_national_overview.parquet') WHERE fiscal_year = 2024", "expected": 110000000000, "tolerance_pct": 5.0 },
  { "id": "nih_share_federal_fy2024", "description": "NIH share of federal funding FY2024", "sql": "WITH t AS (SELECT agency_bucket, SUM(amount_nominal) AS amt FROM read_parquet('apps/web/public/data/agg_national_agency_trend.parquet') WHERE fiscal_year = 2024 GROUP BY agency_bucket) SELECT amt / (SELECT SUM(amt) FROM t) FROM t WHERE agency_bucket IN ('NIH','HHS')", "expected": 0.50, "tolerance_pct": 10.0 },
  { "id": "johns_hopkins_total_fy2024", "description": "Johns Hopkins FY2024 total R&D > $3B", "sql": "SELECT total_rd_nominal FROM read_parquet('apps/web/public/data/agg_uni_total_rd.parquet') t JOIN read_parquet('apps/web/public/data/dim_institution.parquet') i USING (institution_sk) WHERE i.institution_name LIKE 'Johns Hopkins%' AND fiscal_year = 2024 ORDER BY total_rd_nominal DESC LIMIT 1", "expected": 3500000000, "tolerance_pct": 15.0 }
]
```

Pull 27 more facts from `/Users/Usama/Documents/Claude Projects/Herd Survey/data/processed/master_workbook.xlsx` (sheets 1–10). For each fact, write:
- One per agency (NIH, NSF, DOD, DOE, NASA, USDA) total federal R&D FY2024
- 5 top-uni totals: MIT, Stanford, Harvard, UCLA, Michigan FY2024
- 5 source totals nationally: federal, state, industry, institutional, nonprofit FY2024
- Vol70→Vol71 sanity: NSF Federal Funds FY2014 (Vol 70 only) vs FY2015 (both volumes — should overlap)
- ARDES era check: 0 nonprofit dollars FY2008
- PI count: total distinct NSF PIs FY2024 ≥ 80,000
- HHI sanity: at least one R1 with HHI > 4000 (e.g., heavy NIH skew) and one with HHI < 2500

Use the same SQL/expected/tolerance shape. Aim for 30 total; tolerance 1–15% depending on metric volatility.

- [ ] **Step 2: Commit + push**

```bash
git add scripts/qa/facts.json && git commit -m "qa: 30-fact accuracy reference (P9.2)" && git push
```

---

### Task P9.3: Build `scripts/qa/verify_facts.py`

- [ ] **Step 1: Create**

```python
#!/usr/bin/env python3
"""Verify facts in scripts/qa/facts.json against the actual parquet data."""
import duckdb, json, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
facts = json.loads((REPO / "scripts/qa/facts.json").read_text())

failures = []
con = duckdb.connect()
for f in facts:
    try:
        actual = con.execute(f["sql"]).fetchone()[0]
        expected = f["expected"]
        tol = f.get("tolerance_pct", 1.0) / 100.0
        delta = abs(actual - expected) / max(abs(expected), 1e-9)
        ok = delta <= tol
        status = "✓" if ok else "✗"
        print(f"{status} {f['id']}: actual={actual:,.2f} expected={expected:,.2f} delta={delta*100:.2f}% tol={tol*100:.2f}%")
        if not ok: failures.append(f["id"])
    except Exception as e:
        print(f"✗ {f['id']}: ERROR {e}")
        failures.append(f["id"])

if failures:
    print(f"\n{len(failures)} fact(s) failed: {failures}", file=sys.stderr)
    sys.exit(1)
print(f"\n{len(facts)} facts verified ✓")
```

- [ ] **Step 2: Make executable + run**

```bash
chmod +x scripts/qa/verify_facts.py
python3 scripts/qa/verify_facts.py
```
Expected: prints all facts; exits 0.

- [ ] **Step 3: Commit + push**

```bash
git add scripts/qa/verify_facts.py && git commit -m "qa: fact verifier (P9.3)" && git push
```

---

### Task P9.4: Build link integrity crawler `scripts/qa/check_links.js`

```javascript
const puppeteer = require('puppeteer-core');
const ROUTES = ['/', '/universities', '/national', '/compare', '/methodology', '/downloads', '/universities/1'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const visited = new Set();
  const failures = [];
  for (const r of ROUTES) {
    const page = await browser.newPage();
    try { await page.goto(`http://localhost:3000${r}`, { waitUntil: 'networkidle0' }); }
    catch (e) { failures.push(`${r}: ${e.message}`); continue; }
    const links = await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href')));
    for (const l of links) {
      if (visited.has(l) || !l) continue;
      visited.add(l);
      try {
        const r2 = await page.goto(`http://localhost:3000${l}`, { waitUntil: 'domcontentloaded' });
        if (r2 && r2.status() >= 400) failures.push(`${l}: ${r2.status()}`);
      } catch (e) { failures.push(`${l}: ${e.message}`); }
    }
    await page.close();
  }
  await browser.close();
  if (failures.length) { failures.forEach((f) => console.error(' - ' + f)); process.exit(1); }
  console.log(`OK: ${visited.size} internal links resolve`);
})();
```

- [ ] **Step 1: Commit + push**

```bash
git add scripts/qa/check_links.js && git commit -m "qa: link integrity crawler (P9.4)" && git push
```

---

### Task P9.5: Build Lighthouse runner `scripts/qa/lighthouse.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# Requires: npm install -g lighthouse
ROUTES=("/" "/universities" "/national" "/compare" "/methodology" "/downloads" "/universities/1")
mkdir -p qa-lighthouse
for r in "${ROUTES[@]}"; do
  safe=$(echo "$r" | sed 's|/|_|g'); safe=${safe:-root}
  lighthouse "http://localhost:3000$r" \
    --emulated-form-factor=mobile \
    --throttling-method=simulate \
    --output=json --output=html \
    --output-path="qa-lighthouse/$safe" \
    --chrome-flags="--headless" \
    --quiet
done
echo "Reports in qa-lighthouse/"
```

- [ ] **Step 1: Commit + push**

```bash
chmod +x scripts/qa/lighthouse.sh
git add scripts/qa/lighthouse.sh && git commit -m "qa: lighthouse runner (P9.5)" && git push
```

---

### Task P9.6: Orchestrator `scripts/qa/run_all.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

DATE=$(date +%Y-%m-%d)
REPORT="docs/qa/qa-report-${DATE}.md"
mkdir -p docs/qa

echo "# QA Report — $DATE" > "$REPORT"

echo "" >> "$REPORT"
echo "## 1. Page probe (client errors + overflow + screenshots)" >> "$REPORT"
if node scripts/qa/probe_pages.js > /tmp/qa1.log 2>&1; then
  echo "PASS" >> "$REPORT"
else
  echo "FAIL" >> "$REPORT"
  cat /tmp/qa1.log >> "$REPORT"
fi

echo "" >> "$REPORT"
echo "## 2. Fact verification" >> "$REPORT"
if python3 scripts/qa/verify_facts.py > /tmp/qa2.log 2>&1; then
  echo "PASS" >> "$REPORT"
else
  echo "FAIL" >> "$REPORT"
fi
cat /tmp/qa2.log >> "$REPORT"

echo "" >> "$REPORT"
echo "## 3. Link integrity" >> "$REPORT"
if node scripts/qa/check_links.js > /tmp/qa3.log 2>&1; then
  echo "PASS — $(cat /tmp/qa3.log)" >> "$REPORT"
else
  echo "FAIL" >> "$REPORT"
  cat /tmp/qa3.log >> "$REPORT"
fi

echo "" >> "$REPORT"
echo "Report written to $REPORT"
```

- [ ] **Step 1: Make executable + run**

```bash
chmod +x scripts/qa/run_all.sh
pnpm -C apps/web dev &
sleep 8
./scripts/qa/run_all.sh
kill %1
```

- [ ] **Step 2: Commit report + script**

```bash
git add scripts/qa/run_all.sh docs/qa/ && git commit -m "qa: orchestrator + first QA report (P9.6)" && git push
```

---

### Task P9.7: a11y + colorblind check via axe + CVD simulation

- [ ] **Step 1: Install `@axe-core/puppeteer`**

```bash
pnpm -C apps/web add -D @axe-core/puppeteer
```

- [ ] **Step 2: Add `scripts/qa/axe_audit.js`**

```javascript
const puppeteer = require('puppeteer-core');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const ROUTES = ['/', '/universities', '/national', '/compare', '/methodology'];

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const failures = [];
  for (const r of ROUTES) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:3000${r}`, { waitUntil: 'networkidle0' });
    const results = await new AxePuppeteer(page).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    if (serious.length) failures.push({ route: r, count: serious.length, ids: serious.map((s) => s.id) });
    await page.close();
  }
  await browser.close();
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
  console.log(`OK: 0 serious/critical a11y violations across ${ROUTES.length} routes`);
})();
```

- [ ] **Step 3: Commit + push**

```bash
git add scripts/qa/axe_audit.js apps/web/package.json apps/web/pnpm-lock.yaml && git commit -m "qa: axe-core a11y audit (P9.7)" && git push
```

---

### Task P9.8: Manual dimensions of the QA suite (the 9 that aren't fully automatable)

These complement P9.1–P9.7. Each is a manual check the developer must perform and record the result in `docs/qa/qa-report-YYYY-MM-DD.md`.

- [ ] **Dim 7 — Dark mode parity:** add a query param `?theme=dark` to the dev URL OR toggle the theme manually in browser, re-run the screenshot probe (`node scripts/qa/probe_pages.js` after `document.documentElement.classList.add('dark')`), compare against light-mode screenshots. PASS = no invisible elements, no color-only meaning broken.

- [ ] **Dim 8 — Colorblind safety:** open Chrome DevTools → Rendering → "Emulate vision deficiencies" → cycle through deuteranopia / protanopia / tritanopia / blurred vision on `/universities/[sk]` and `/national#agencies`. PASS = agency-categorical bars distinguishable; reconciliation diverging bars distinguishable.

- [ ] **Dim 9 — Cross-browser:** load `/`, `/universities`, `/universities/1`, `/national`, `/compare` in Chrome, Safari, Firefox (latest stable). PASS = no layout breakage, charts render, interactions work.

- [ ] **Dim 11 — Bundle size:** `du -sh apps/web/out/_next/static/chunks/* | sort -h | tail -10` and `du -sh apps/web/public/data/agg_*.parquet | sort -h | tail -20`. PASS = no individual JS chunk > 250 KB gzipped (check with `du -sh apps/web/.next/static/chunks/`); total parquet < 50 MB.

- [ ] **Dim 12 — Parquet load time on 4G throttle:** DevTools → Network → "Slow 4G" → reload `/universities/1` → time to interactive. PASS = ≤ 4s. Same for `/national` ≤ 5s.

- [ ] **Dim 14 — Tabular-numerals alignment:** open `/universities` table and `/compare` KPI strips, take a screenshot, visually verify decimal points line up vertically. PASS = aligned.

- [ ] **Dim 15 — Annotation correctness:** for 5 random universities pull data via DuckDB CLI and cross-check the auto-generated annotation (peak year, largest YoY) against the actual underlying numbers. PASS = 5/5 correct.

- [ ] **Dim 16 — Edge cases:** load these 5 specific institution profiles:
  1. One with zero federal funding (e.g., search `dim_institution` for an institution where `agg_uni_pi_metrics.pi_count = 0` in FY2024)
  2. One ARDES-only (institution_sk where MAX(fiscal_year) < 2010 in `agg_uni_total_rd`)
  3. One with only 5 years of HERD data
  4. One with total_rd_nominal < $1M
  5. One with total_rd_nominal > $2B
  PASS = all 5 render without crash; ARDES era hatch + landmine footnotes visible where applicable.

- [ ] **Dim 17 — Search & filter:** on `/universities`, run 10 queries (full names, abbreviations like "MIT", partial matches like "Hopkins", misspellings like "Stanfrord"), and 5 filter combos. PASS = search returns expected results within 200ms.

- [ ] **Dim 18 — Methodology ↔ chart consistency:** open `/methodology` in one tab, `/universities/1` in another, verify every chart's source line cites a real source documented in methodology. PASS = 100% consistent.

- [ ] **Final step — Append all manual results to the QA report and commit:**

```bash
# Manually edit docs/qa/qa-report-YYYY-MM-DD.md with PASS/FAIL per dim
git add docs/qa/ && git commit -m "qa: manual QA dimensions appended (P9.8)" && git push
```

---

## Phase P10: Deploy

### Task P10.1: Final build + smoke test

```bash
pnpm -C apps/web build
ls -lh apps/web/out/ | head -20
```
Expected: build succeeds; `out/_redirects` present; bundle sizes reasonable.

- [ ] **Step 1: Commit any final fixes** (no-op if none)

```bash
git add -A && git diff --cached --quiet || git commit -m "build: final polish (P10.1)"
git push
```

- [ ] **Step 2: Trust the GitHub Actions deploy** (Cloudflare auto-deploy from main). Watch:

```bash
gh run watch
```

- [ ] **Step 3: Post-deploy smoke test against the live URL**

```bash
LIVE=https://herd-survey-dashboard.saber-usama.workers.dev
for r in / /universities /universities/1 /national /compare /methodology /downloads; do
  s=$(curl -s -o /dev/null -w "%{http_code}" "$LIVE$r")
  echo "$s $r"
done
```
Expected: all `200`.

- [ ] **Step 4: Final memory snapshot** (optional — just notes for next session)

---

## End of Plan

Total tasks: **~50 atomic tasks across 11 phases**. Estimated 3–6 sessions of agent work depending on the model and how often QA finds regressions.

The companion spec (`docs/superpowers/specs/2026-05-31-research-data-platform-restructure-design.md`) is authoritative for *why* every decision was made. This plan is authoritative for *what* to do.
