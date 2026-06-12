# Research Data Platform — Progress Log

Comprehensive record of work completed on the Herd Survey research data
platform (Next.js + DuckDB + precomputed parquet/JSON snapshots).

**Live:** US federal R&D funding to universities, FY2005–FY2024.
**Stack:** Next.js 14 (static export), Tailwind v3 + Calibri, duckdb-async
for data prep, Cloudflare Workers for deploy.
**Repo:** github.com/saberusama-hub/herd-survey-dashboard

---

## Recent commits (chronological)

| Date | SHA | Summary |
|------|-----|---------|
| 2026-06-04 | `c4a78ad` | Editorial-minimalism design refresh — typography, motion, hairlines |
| 2026-06-04 | `bf95d80` | A11y: SectionDivider contrast + Skeleton component |
| 2026-06-04 | `d439035` | Drop ChartFrame reveal gate — below-fold charts were invisible |
| 2026-06-04 | `e16db86` | Home page: precomputed snapshot + lazy DuckDB-WASM — TTFD ~26s → instant |
| 2026-06-04 | `54b9eab` | Re-add `'use client'` to home page — ResponsiveSvg uses render-fn children |
| 2026-06-04 | `ce657b3` | Bounded share %s + split count vs $ shares on topics/SBIR, drop downloads |
| 2026-06-04 | `fdd3702` | Click-to-sort headers across every table on the site |
| 2026-06-04 | `9f2aa84` | Year selectors on /universities + /sbir |
| 2026-06-04 | `f60e1a5` | National: page-wide year selector drives every snapshot panel |
| 2026-06-04 | `5c27703` | Per-chart year pickers + render every NIH IC axis label |
| 2026-06-04 | `e4cb938` | **Every page reads a precomputed JSON snapshot, no DuckDB-WASM** |
| 2026-06-04 | `7c26982` | A11y: move `<title>` from `<text>` child to `<g>` child on IC chart |
| 2026-06-05 | `5b9dc89` | Home + profile year pickers, NSF+NIH labels, drop reconciliation/HHI/patents |
| 2026-06-05 | `05bacd4` | **Adaptive long-run CAGR — recover ~30% of blank rows in universities table** |
| 2026-06-05 | `64532ed` | Adaptive 5y CAGR for topics — recover all of FY2006–FY2009 |
| 2026-06-06 | `55d34cc` | **Rebuild `dim_institution_crosswalk` + regen all PI-derived parquets** |
| 2026-06-06 | `2f1cfcc` | NSF obligation-FY accounting + regen topic / specialization |
| 2026-06-10 | `692835c` | **Per-source PI split — apples-to-apples NSF and NIH metrics** |
| 2026-06-10 | `e1fd5e9` | Drop NIH IC + PI decile; add SBIR city-hub map |

Total commits on `main`: 179.

---

## Major work streams

### 1. Performance — precomputed snapshots

Replaced the runtime DuckDB-WASM query model with **pre-baked JSON snapshots
served from `apps/web/public/data/snapshots/`** (brotli-compressed at edge).

| Snapshot | Size | Used by |
|---|---:|---|
| `home-snapshot.json` | 111 KB | Landing page |
| `universities-snapshot.json` | 1,560 KB | `/universities` directory |
| `national-snapshot.json` | 1,960 KB | `/national` editorial page |
| `topics-snapshot.json` | 3,767 KB | `/topics` page |
| `sbir-snapshot.json` | 1,491 KB | `/sbir` page |
| 1,014 × `profiles/INSTxxx.json` | 71 MB | `/universities/[sk]` |

**Result:** TTFD dropped from ~26s (WASM bundle + queries) to instant first
paint across the site. All per-FY filtering happens in-memory client-side.

### 2. Adaptive CAGR — recover blank rows

Previous CAGR formulas required FY2005 and FY(n-5) as fixed anchors. ~30%
of institutions in `/universities` were missing 5y CAGR and ~all long-run
CAGRs for newer entrants.

**Fix:** for each institution, find the earliest reported FY (with
`total_rd > 0`) and use that as the long-run anchor. For trailing CAGR,
walk back up to 5 years from the selected FY until finding a non-null
prior value.

**Per-cell tooltip** shows the actual window used (e.g. "3-year window:
FY2021 → FY2024") so the reader can audit.

### 3. Institution crosswalk rebuild — `dim_institution_crosswalk.parquet`

The previous crosswalk was self-identity only (`institution_sk` mapped to
itself). NSF and NIH records using different `institution_sk` for the
same physical university went unattributed.

**Fix in `scripts/rebuild_pi_aggs.js`:** rebuild the crosswalk by joining
HERD `dim_institution` to `dim_institution_aliases` (103,644 aliases),
weighted so canonical-name matches are preferred over alias-string
matches. Freshness tiebreak: prefer SKs with `max_fy >= 2020` over
legacy SKs.

**Recovery on major universities:**

| Uni | PIs (before) | PIs (after) |
|---|---:|---:|
| Johns Hopkins | <50 | 1,242 |
| University of Washington Seattle | 0 | 963 |
| Columbia | <100 | 1,353 |

### 4. NSF time attribution — per-FY obligation accounting

NSF awards span multiple years. The old aggregation credited the full
multi-year award amount to the start year (`awd_eff_date`) and only
counted the PI in that start year.

**Fix:** join `fact_nsf_award_fy_obligation` (435K rows of per-FY
obligations) to `fact_nsf_award` so each FY's PI count and $ reflect
actual annual obligations. A PI on a 5-year award now counts in all 5
years.

### 5. Per-source PI methodology — apples-to-apples NSF and NIH

**Problem:** The "PI universe" combined NSF lead-PIs and all NIH PIs
into a single deduped count, and divided total NSF+NIH $ by it. That
mixed methodology made `$/PI` ratios misleading — NSF only records the
lead PI per award (~39% of NSF awards have co-PIs we don't capture),
while NIH publishes every named PI via the bridge file.

**Fix in `agg_uni_pi_universe.parquet`:**

| Field | Meaning |
|---|---|
| `nsf_lead_pi_count` | `COUNT(DISTINCT pi_sk)` from NSF (lead only) |
| `nih_pi_count` | `COUNT(DISTINCT pi_sk)` from NIH (lead + co-PIs) |
| `federal_amount_nsf_attributed` | NSF $ only from awards with `pi_sk` |
| `federal_amount_nih_attributed` | NIH $ only from projects with bridge row |
| `nsf_amount_per_lead_pi` | scope-matched: attributed NSF $ ÷ NSF lead PIs |
| `nih_amount_per_pi` | scope-matched: attributed NIH $ ÷ NIH PIs |
| `nsf_est_researchers_n_pi` | sum of NSF `n_pi` (tooltip diagnostic) |
| `distinct_pi_count` + `amount_per_pi` | back-compat combined view |

`pi_sk` is shared across NSF and NIH (2,045 overlap), so UNION dedup
correctly removes cross-source duplicates.

**~58% of NSF $ and ~10% of NIH $ have no PI attribution** in the raw
sources. The total-dollar columns include this; the per-PI ratios
exclude it (scope-matched).

**Stanford FY2024 sanity-check:**
- NSF: 37 lead PIs · $1,216k per lead PI (was inflated to $1,779k
  when total NSF was divided by lead count)
- NIH: 837 PIs · $699k per PI
- Combined (de-emphasized): 871 PIs · $784k per PI

### 6. UI restructure — surface the per-source PI split

- **Compare tab**: 6 new metrics (NSF $, NSF PIs, NSF $/PI, NIH $,
  NIH PIs, NIH $/PI). Combined view kept but tagged "mixed methodology"
- **Universities tab**: 6 new sortable columns. Default sort still
  Total R&D
- **Profile §6**: two-column tile grid (NSF | NIH) collapsing to
  stacked on mobile. Trajectory line chart shows NSF leads vs NIH PIs
  as two lines. NSF tile tooltip surfaces the `n_pi`-based co-PI
  estimate
- **National §7**: # NSF lead PIs and # NIH PIs added as separate
  trend metrics

### 7. National page cleanup

**Removed:** §S5.1 NIH Institutes & Centers (ranking bars + top-5 share
over time), §9 $/PI decile distribution (decile-of-deciles chart).

`national-snapshot.json` shrunk from 2,115 KB to 1,960 KB.

### 8. SBIR/STTR — city hub map

**Removed:** the entire demographic set-asides section (woman-owned,
HUBZone, socially/economically disadvantaged cards).

**Replaced:** flat firm-state choropleth with a hub-density overlay.

- State $ choropleth retained as light background context
- Red dots at the actual hub cities — area ∝ SBIR/STTR $
- Top-10 cities labelled inline (Cambridge, San Diego, Austin,
  Huntsville, Boulder, Ann Arbor, Andover, Durham, Torrance, Rockville)
- Hover tooltip per dot: city, state, awards, $, top topic, top agency
- New "Top 15 hubs" table below the map shows per-city ranking with
  the dominant topic per city for the selected FY

**Data layer (new):**

| File | What it is |
|---|---|
| `scripts/build_sbir_hubs.js` | Aggregates `fact_sbir.parquet` to (firm_city × firm_state × fiscal_year) with awards, $, top topic via 30-topic regex on `award_title`, top agency |
| `apps/web/public/data/agg_sbir_hubs.parquet` | 200 cities × 20 FYs = 3,993 rows; covers ~95% of all SBIR/STTR activity by $ |
| `apps/web/public/data/sbir_city_coords.json` | Static `[lat, lon]` lookup for the 200 hub cities (geocoded once) |
| `precompute_sbir_snapshot.js` | Joins hubs to coords and ships them inline as `hub_facts` in the SBIR snapshot |

**Top FY2024 hubs visible on the new map:**

San Diego CA · $2.2B · Cambridge MA · $1.2B · Torrance CA · $1.2B ·
Huntsville AL · $1.2B · Austin TX · $1.1B · Rockville MD · $940M ·
Boulder CO · $824M · Ann Arbor MI · $816M

---

## Sources

Every number on the platform comes from raw federal source files in
`data/processed/`:

- `fact_nsf_award.parquet` — NSF Awards archive
- `fact_nsf_award_fy_obligation.parquet` — per-FY NSF obligations (435K rows)
- `fact_nih_project.parquet` — NIH ExPORTER projects
- `fact_nih_project_pi_bridge.parquet` — NIH ExPORTER PI bridge
- `fact_sbir.parquet` — SBIR/STTR Awards (219K rows, 1983-2026)
- `dim_institution.parquet` + `dim_institution_aliases.parquet` — entity-resolved
- `agg_uni_total_rd.parquet` — HERD survey CSV → uni × year sum (thin transform)

**Not used anywhere on the live site:** the Phase E `master_workbook.xlsx`
rollup, or any of the `sheet_*.parquet` master-Excel-derived files (other
than `sheet_06_sbir_sttr.parquet`, which is the SBIR base table the
existing SBIR page already used before the hub layer was added).

---

## Documentation

- `docs/methodology/pi_reconciliation_fy2024.md` — auto-generated by
  `scripts/verify_pi_reconciliation.js`. Top-25 university reconciliation
  table for FY2024 and FY2020 with pi_sk overlap stats and unattributed-$
  percentages. Regen on every rebuild of `agg_uni_pi_universe.parquet`.
- `docs/deployment.md` — deploy docs
- `docs/PROGRESS.md` — this file

---

## Verification scripts

- `scripts/verify_pi_reconciliation.js` — regenerable top-25
  reconciliation for FY2024 and FY2020, plus pi_sk overlap stats and
  unattributed-$ percentages

---

## Key rebuild scripts

- `scripts/rebuild_pi_aggs.js` — end-to-end rebuild of crosswalk +
  PI universe + PI distribution + team size + NIH IC + topics +
  specialization. Run after federal data refresh.
- `scripts/build_sbir_hubs.js` — rebuild SBIR city-level hubs
- `scripts/precompute_*.js` — snapshot regenerators (one per page)

To re-run everything end-to-end after a new federal data drop:

```bash
# 1. Rebuild aggregations from raw lake
DASH_DIR="$(pwd)/apps/web/public/data" \
NODE_PATH=/private/tmp/herd_node/node_modules \
node scripts/rebuild_pi_aggs.js

# 2. Rebuild SBIR hubs
node scripts/build_sbir_hubs.js

# 3. Regenerate all snapshots
node scripts/precompute_universities_snapshot.js
node scripts/precompute_national_snapshot.js
node scripts/precompute_topics_snapshot.js
node scripts/precompute_home_snapshot.js
node scripts/precompute_sbir_snapshot.js
node scripts/precompute_profile_snapshots.js

# 4. Verify
node scripts/verify_pi_reconciliation.js

# 5. Typecheck + lint
cd apps/web && npm run typecheck && npm run lint
```

---

## Open / known issues

1. **~10 HERD parent-rollup entities still show 0 PIs** — e.g.
   "University of Maryland" (parent SK summing Baltimore + College
   Park + Baltimore County). Separate parent-child rollup issue, not
   a crosswalk issue. Tracked as a follow-up.
2. NSF co-PI roster is not publicly published; estimate via `n_pi` is
   exposed as a tooltip diagnostic only (not deduped across awards).
3. FY2005 PI counts are masked across the site due to an upstream
   entity-resolution discontinuity affecting 81 institutions.

---

_Last updated: 2026-06-12_
