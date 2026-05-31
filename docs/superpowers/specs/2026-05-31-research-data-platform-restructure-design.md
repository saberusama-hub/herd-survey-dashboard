# Research Data Platform — Structural Restructure & Editorial Redesign

**Date:** 2026-05-31
**Author:** brainstorming session (Usama + Claude)
**Status:** Draft — awaiting user review
**Supersedes:** All prior IA decisions (U-5 mega-nav, /institution+/agency+/correlations design)

---

## 1. Goals & Non-Goals

### Goals
- Restructure the site around a **university-centric story arc**: Total R&D → sources → federal-by-agency → reconciliation → PI metrics → field mix → state peer context.
- Add ~18 comprehensive per-university metrics including PI counts, $/PI, STEM vs non-STEM, subject-area (AI/biomed/materials/climate/quantum), concentration (Gini/HHI), co-PI collaboration, funding volatility, patent intensity, award-size distribution.
- Provide a parallel `/national` page for cross-university views (leaderboards, distributions, time trends).
- Apply **full editorial treatment** to every chart: bespoke annotations, illustrated section dividers, hand-tuned color and callouts.
- Full mobile responsiveness — every page surviving at 375px viewport.

### Non-Goals
- No backend rewrite — DuckDB-WASM in-browser SQL over parquet stays.
- No new data acquisition — work with what's in the data lake today.
- No authentication / personalization.
- No real-time data — annual FY data is fine.
- No custom domain in this cycle.

### Success criteria
- A first-time visitor lands on `/`, can search any of ~800 universities, lands on a profile, and understands their R&D portfolio in 90 seconds of scrolling.
- Every chart passes the "Bloomberg test": looks like it could ship in a Bloomberg / Economist / FT data product.
- All 18 metrics are visible somewhere on the profile page without overwhelming it.
- Site scores ≥ 90 on Lighthouse mobile usability.
- Zero client-side exceptions across all pages (verified via Puppeteer probe).

---

## 2. Information Architecture

### Final route map

| Route | Purpose | Status |
|---|---|---|
| `/` | National snapshot + prominent university search + 3 leaderboards | **Restructured** |
| `/universities` | Sortable table of all ~800 universities (rank, total R&D, federal share, growth, PI count, STEM share) | **New** |
| `/universities/[sk]` | ⭐ THE university profile — long-scroll story arc with 18 metrics across 9 sections | **New (replaces `/institution`)** |
| `/compare` | Side-by-side comparison of 2–5 universities on any metric | **Restructured** |
| `/national` | Cross-university dashboard: total US R&D, agency trends, concentration, discipline mix, distributions | **New (consolidates `/trends` + `/agency` + parts of `/map`)** |
| `/methodology` | Data sources, entity resolution, caveats, the 3 landmines | **Kept (refreshed)** |
| `/downloads` | Parquet manifest + Excel workbook | **Kept** |

### Routes deleted in this cycle

- `/correlations` (user requirement)
- `/nih` (already a redirect to `/agency`)
- `/states` (already a redirect to `/map`)
- `/flow` (Sankey replaced by stacked horizontal bar on `/universities/[sk]` section 4)
- `/reconciliation` (folded into `/universities/[sk]` section 5)
- `/institution` (replaced by `/universities/[sk]`)
- `/agency` (folded into `/national` as a section)
- `/trends` (folded into `/national` as a section)
- `/map` (folded into `/national` as a section)
- `/story/three-crises`, `/story/self-funding`, `/story/geography` (user requirement — delete all scrollytellings)

### Redirects to maintain (so external links don't 404)

| Old URL | New URL |
|---|---|
| `/institution` | `/universities` |
| `/institution?sk=N` | `/universities/[sk]` |
| `/agency` | `/national#agencies` |
| `/trends` | `/national#trends` |
| `/map` | `/national#geography` |
| `/flow` | `/national#agencies` |
| `/correlations` | `/national` (with toast message) |
| `/reconciliation` | `/universities` (with toast message) |
| `/story/*` | `/` |

---

## 3. Page Specs

### 3.1 `/` — Home

**Above the fold (no scroll required on desktop and mobile):**
- Editorial hero: H1 "U.S. University Research Funding" + standfirst "Twenty years. Eight hundred institutions. Seven federal agencies. One data lake."
- Prominent university search box (with typeahead from `dim_institution.institution_name`)
- 3 headline KPI tiles: Total FY2024 R&D, # Universities Tracked, # Distinct Federal PIs

**Below the fold (scroll):**
- Featured leaderboard: Top 10 universities by FY2024 total R&D (horizontal bar, clickable rows)
- National R&D trend (small stacked-bar): 20-yr total US R&D by source
- "Browse all 800 universities" CTA → `/universities`
- "Explore the national view" CTA → `/national`

### 3.2 `/universities` — Sortable index

- Full table of all institutions with columns:
  - Rank | Institution | State | FY2024 Total R&D | 20-yr CAGR | Federal share % | # Federal PIs | STEM share %
- Sortable on every column.
- Filter by state, by Carnegie classification (R1/R2/etc.), by min funding threshold.
- Row click → `/universities/[sk]`.

### 3.3 `/universities/[sk]` — ⭐ The university profile

The flagship page. Single long-scroll layout, mobile-first. Each section gets:
- Eyebrow (small, uppercase, muted)
- Title (h2, 24–28px, weight 600)
- Standfirst (1–2 italic sentences, dek style)
- Chart (with custom annotations)
- Data source line (small, muted, at bottom — formatted as `Source: X · Note: Y`)

**9 sections, in order:**

#### Section 1 — Hero KPIs (4 tiles, sticky on desktop)
- Total R&D FY2024
- 20-yr CAGR
- Federal share % (FY2024)
- National rank (out of ~800)

#### Section 2 — Total R&D timeline (Metric 1)
- Vertical bar chart, 20 years, nominal vs FY2024-real toggle
- In-chart annotations: ARRA 2009, sequester 2013, COVID 2020
- Direct-label the final-year bar with the dollar amount

#### Section 3 — R&D by source (Metric 2)
- 100% stacked horizontal bar OR small-multiple bars per source — pick whichever reads cleaner with annotation
- 6 sources: federal, state, industry, institutional, nonprofit, other (HERD Q01)
- ARDES era (FY2005–09) shown with a hatched pattern + footnote: "Nonprofit funding not collected pre-FY2010"
- Final-year breakdown highlighted

#### Section 4 — Federal funding by agency (Metric 3)
- Horizontal bar chart, sorted descending
- 7 agencies: NSF, NIH, DOD, DOE, NASA, USDA, Other (Q09 mapping)
- Fixed agency color lockup (NIH navy, NSF cherry, DOD forest, DOE goldenrod, NASA plum, USDA sienna, Other slate)
- Direct-label every bar with dollar amount
- Hover: shows 20-yr trend mini-sparkline

#### Section 5 — Reconciliation: HERD vs Federal Funds (Metric 4)
- Two-bar grouped chart per agency: HERD-reported (left) vs Federal Funds total (right)
- Difference labeled in the middle: positive = under-reported by HERD, negative = expenditure vs obligation lag
- Footnote prose: "HERD measures expenditures; Federal Funds measures obligations. A 15–25% gap is expected. Larger gaps may indicate sub-agency allocation method (see Methodology)."
- Vol 70→71 taxonomy break flagged on the FY2015–16 boundary

#### Section 6 — PI metrics (Metrics 5–6)
- KPI strip: # Distinct Federal PIs FY2024 | Avg $ per PI | Top 5 PIs by funding (anonymized initials + amount)
- 20-yr line chart: PI count trend
- Side panel: PI distribution (decile bar chart of $/PI)

#### Section 7 — Discipline mix (Metrics 7–9)
- KPI strip: STEM share %, Non-STEM share %, Shannon entropy (diversity index)
- Stacked horizontal bar: 8 HERD field categories
- Below: subject-area bar (AI, biomedical, materials, climate, quantum) — 5 keyword-tagged buckets
- Year-on-year sparklines for each subject

#### Section 8 — Concentration & volatility (Metrics 10–11)
- KPI strip: HHI of agency mix | Gini of agency mix | Coefficient of variation (FY-on-FY)
- Time-series of HHI (line)
- Annotation: "An HHI below 1500 is considered diversified"

#### Section 9 — State context & peers (Metrics 12–14)
- Slope chart: this uni's share of state R&D, FY2014 → FY2024
- Bar chart: top 5 peer institutions (same state + ±25% R&D size)
- Patent-to-award ratio: number with sparkline

**Footer of the profile:**
- Source line: "Federal R&D data from NSF Federal Funds (Vol 70 FY2005–FY2023, Vol 71 FY2015–FY2024); NIH RePORTER; USASpending; NSF Awards; institution-reported HERD/ARDES."
- Download CSV button: emits this institution's slice as CSV
- "Compare with another university" CTA → `/compare?ids=<sk>`

### 3.4 `/compare` — Side-by-side

- Pick 2–5 universities (institution picker, multi-select)
- Pick a metric (dropdown — any of the 18 metrics)
- Side-by-side small multiples on desktop (one mini chart per uni in a row), stacked vertically on mobile
- Difference table below

### 3.5 `/national` — Cross-university dashboard

Long-scroll with anchored sections:

| Anchor | Content |
|---|---|
| `#overview` | Total US R&D FY2024, 20-yr trend, source split |
| `#agencies` | Federal funding by agency, 20-yr trend, agency leaderboards |
| `#geography` | State choropleth (existing `USStateMap`, polished) + state-level leaderboards |
| `#disciplines` | STEM vs non-STEM nationally; subject-area trends (AI growth, biomed, etc.) |
| `#concentration` | Top-10 / top-25 / top-100 share of total US R&D over time |
| `#trends` | Multi-metric time-series explorer (kept from old `/trends`, simplified) |
| `#pi-distribution` | National PI count, $/PI distribution across institutions |

### 3.6 `/methodology` — Refreshed
- Add a section per data landmine (Federal Funds Vol 70→71 taxonomy break, ARDES nonprofit non-response, USAspending PIID collision)
- Add subject-area keyword-tagging methodology (what regex catches what)
- Add PI deduplication methodology

### 3.7 `/downloads` — Kept as-is

---

## 4. Visual Design System

### 4.1 Color palette (replaces "Editorial Teal")

**Primary editorial palette** (light mode):
- Ink `#0D1117` (body text)
- Paper `#F7F5EF` (background — warm off-white, like FT)
- Accent `#C8102E` (the "callout color" — cherry red, like Economist)
- Mute-1 `#9CA3AF` (secondary series, axis labels)
- Mute-2 `#D1D5DB` (gridlines)
- Mute-3 `#E5E7EB` (rule lines)

**Dark mode** (no inversion, hand-tuned):
- Ink `#E8EAED`
- Paper `#13161C` (not pure black)
- Surface `#1A1E26`
- Accent `#E03A50` (desaturated 20%)

**Agency-categorical (fixed assignment)**:
- NIH (HHS) `#1F3A68` navy
- NSF `#C8102E` cherry (same as accent — NSF is the "main character")
- DOD `#2D5016` forest
- DOE `#B8860B` goldenrod
- NASA `#6B2E5E` plum
- USDA `#8B5A2B` sienna
- Other `#6B7280` slate

**Sequential ramp (state choropleth)**: single-hue blues, 7 steps, `#EFF6FF` → `#1E3A8A`

**Diverging (for HERD-vs-FederalFunds gap)**: 7-stop pink-to-green via white midpoint

### 4.2 Typography

- Keep **Calibri** (already loaded via `@fontsource/carlito` — per standing user instruction).
- All chart text in sans (Calibri).
- Optional serif for the H1 hero on `/universities/[sk]`: `Source Serif 4` — adds editorial weight.
- Scale: display 40 / h1 32 / h2 24 / dek 18 italic / body 16 (line-height 1.55) / chart-title 17 / axis-label 12 / source 11
- **`font-variant-numeric: tabular-nums lining-nums` mandatory** on every numeric `<text>`, every KPI value, every `<td>`. Add a Tailwind utility `.tnum`.

### 4.3 Chart vocabulary

| Chart type | When to use | When NOT |
|---|---|---|
| Horizontal bar | Top-N rankings (≤15 items) | If items have natural time order |
| Vertical bar | Time series ≤15 periods | If >15 periods or comparing >1 series |
| Line | Time series >15 periods OR 2–4 comparison series | Single-series short windows |
| Stacked bar | Composition over time (sources, agencies, fields) | When you need precise % values per slice |
| Slope | Two-point change (e.g., 2014 vs 2024 state share) | More than 2 points |
| Sparkline | KPI accompaniment, not standalone | Standalone "main" chart |
| Choropleth | State-level geo | Inst-level geo (use dots) |

**Banned chart types in this redesign:** pie, donut, sunburst, treemap, sankey, ridgeline, scatter-matrix, streamgraph.

### 4.4 The "one accent, gray rest" rule

Every chart has at most **one** colored series — the "callout" the chart is telling a story about. Everything else is `--mute-1` gray. Implementation: every chart component gets a `highlight` prop. When set, only that series gets `--accent`; others get `--mute-1`.

### 4.5 Annotation system

- Direct-label end-of-line for line charts (no side legend)
- In-chart annotations as small `<text>` with leader lines for inflection points (ARRA, sequester, COVID)
- Source line at bottom: `Source: {primary} · Note: {caveat} · Chart: Research Data Platform`
- Chart title block: eyebrow → title → standfirst (dek) → chart → annotations → source

### 4.6 Editorial treatment per chart (full polish)

Every chart on `/universities/[sk]` and `/national` gets:
- Hand-written standfirst (1–2 italic sentences explaining what the chart shows)
- At least 1 in-chart annotation (the most interesting fact about THIS data, generated by a per-section heuristic — e.g., the largest YoY jump, the peak year, the inflection point)
- Custom source line citing the specific source table

**Section dividers spec (between Profile §1–§9, between /national anchors):**
- 80px tall block
- Thin top rule (1px, color = the dominant agency color of the *next* section, e.g., NIH navy if next section is "PI metrics")
- Eyebrow tag (uppercase, 11px, muted) — "Section 4 · Federal Funding"
- Section title (h2, 24px, bold) on a single line
- One-line italic dek below the title (14px, muted)
- Optional: a single SVG glyph (12px circle in the section's color) before the eyebrow tag — sufficient "illustrated" treatment without bespoke per-section art

Implementation: one `<SectionDivider eyebrow title dek color glyph />` component. No per-section custom artwork required — the consistent template IS the editorial treatment.

### 4.7 Layout & spacing

- Container max-width: 1200px
- Card padding: 24px
- Section gap on profile page: 80px
- Block-internal gap: 16px
- Paragraph max width: 640px (66ch)
- No box-shadows on data cards — use 1px borders
- Border-radius max 6px

---

## 5. Mobile Strategy

### Breakpoint plan
- `< 640px` (sm-): single column, horizontal bars only, top-10 max
- `640–1024px` (md): single column, larger charts, top-20
- `> 1024px` (lg+): multi-column where applicable, full charts

### Chart adaptation rules
| Chart | Desktop | Mobile (<768px) |
|---|---|---|
| Vertical bar (time series) | Up to 20 bars | Rotate to horizontal, top-15 only |
| Horizontal bar (rankings) | Top-25 | Top-10 |
| Line chart | All series direct-labeled | Top 3 series, rest hidden, "Show all" CTA |
| Choropleth | Full map | Full map (already responsive) + state list below |
| KPI strips | 4-up | 2x2 grid |
| Compare grid | Row of N | Stacked vertically |

### Touch targets
- All interactive SVG elements get 44px invisible hit-rect overlay
- Buttons / nav items minimum 44px tall

---

## 6. Data Layer

### 6.1 New pre-aggregated parquet files

To keep DuckDB-WASM queries fast in-browser, pre-aggregate these and ship as parquet:

| File | Grain | Rows (est) | Used by |
|---|---|---|---|
| `agg_uni_total_rd.parquet` | inst × fy | ~16K | Profile §2, /universities table |
| `agg_uni_source_split.parquet` | inst × fy × source | ~100K | Profile §3 |
| `agg_uni_agency_split.parquet` | inst × fy × agency | ~140K | Profile §4, §5 |
| `agg_uni_federal_funds.parquet` | inst × fy × agency | ~100K | Profile §5 (Federal Funds side) |
| `agg_uni_pi_metrics.parquet` | inst × fy | ~16K | Profile §6 |
| `agg_uni_pi_distribution.parquet` | inst × fy × decile | ~160K | Profile §6 side panel |
| `agg_uni_field_mix.parquet` | inst × fy × field | ~130K | Profile §7 |
| `agg_uni_subject_tag.parquet` | inst × fy × subject_tag | ~80K | Profile §7 (AI/biomed/materials/climate/quantum) |
| `agg_uni_concentration.parquet` | inst × fy | ~16K | Profile §8 (HHI, Gini, CoV) |
| `agg_uni_state_context.parquet` | inst × fy | ~16K | Profile §9 |
| `agg_uni_peers.parquet` | inst × peer_inst | ~5K | Profile §9 |
| `agg_uni_patents.parquet` | inst × fy | ~16K | Profile §9 |
| `agg_national_overview.parquet` | fy × source | ~120 | /national #overview |
| `agg_national_agency_trend.parquet` | fy × agency | ~140 | /national #agencies |
| `agg_national_concentration.parquet` | fy × top_n_bucket | ~60 | /national #concentration |

Generate these via DuckDB scripts in `scripts/aggregations/` and commit alongside the parquet files in `apps/web/public/data/`.

### 6.2 Query helper changes

- `apps/web/lib/queries.ts` gets new helpers: `getUniversityProfile(sk)`, `getNationalOverview()`, `searchInstitutions(q)`, `getUniversityList(filters)`.
- Existing helpers used by deleted pages get deleted.

### 6.3 Subject-area keyword tagging

Defined in `scripts/aggregations/tag_subjects.py`:

```python
SUBJECT_PATTERNS = {
  "AI": r"\b(artificial intelligence|machine learning|deep learning|neural network|transformer|LLM|computer vision|NLP)\b",
  "biomedical": r"\b(biomedical|biomedicine|therapeutic|clinical trial|disease|cancer|immunology)\b",
  "materials": r"\b(materials science|nanomaterial|polymer|composite|alloy|semiconductor)\b",
  "climate": r"\b(climate change|carbon|greenhouse|sustainability|renewable|emission)\b",
  "quantum": r"\b(quantum computing|quantum information|qubit|quantum cryptography)\b",
}
```

Applied at aggregation time (not at query time — DuckDB-WASM regex is slow).

---

## 7. Data Quality Safeguards (the 3 Landmines)

### Landmine 1: Federal Funds Vol 70→71 taxonomy break (FY2015–16)
- In all charts spanning FY15–16, draw a thin vertical rule on that boundary
- Footnote: "NSF Federal Funds reclassified ~48 fields between Vol 70 and Vol 71; small year-on-year jumps in FY2015–16 may reflect this."
- Reconciliation chart (Profile §5) shows the boundary explicitly

### Landmine 2: ARDES nonprofit non-response (FY2005–09)
- All charts including pre-FY2010 data render the ARDES era with hatched pattern
- Footnote: "ARDES (FY2005–09) did not collect Nonprofit funding. Pre-FY2010 'nonprofit' bars are zero, not missing."

### Landmine 3: USASpending PIID collision
- All aggregation scripts use `contract_award_unique_key` (not `award_id_piid` alone)
- Documented in `/methodology`

---

## 8. Metrics Catalog (the comprehensive 18)

| # | Metric | Section | Source | Formula |
|---|---|---|---|---|
| 1 | Total R&D | Profile §2 | `fact_herd_expenditures` Q01 totals | Σ amount_usd_nominal by inst × fy |
| 2 | R&D by source | Profile §3 | `fact_herd_expenditures` Q01 by source | Σ amount by inst × fy × source |
| 3 | Federal R&D by agency | Profile §4 | `fact_herd_expenditures` Q09 | Σ amount by inst × fy × agency |
| 4 | Reconciliation gap | Profile §5 | Q09 vs `fact_federal_funds` | HERD agency − FF agency |
| 5 | Distinct federal PIs | Profile §6 | NSF awards + NIH RePORTER | COUNT(DISTINCT pi_sk) by inst × fy |
| 6 | Avg $ per PI | Profile §6 | Same as #5 + #4 | Σ federal $ ÷ #PIs |
| 7 | STEM share % | Profile §7 | HERD field × `dim_field.is_se` | Σ STEM ÷ Σ total |
| 8 | Top 5 disciplines | Profile §7 | HERD field | top-5 by Σ amount |
| 9 | Subject-area share (AI/biomed/materials/climate/quantum) | Profile §7 | NSF + NIH title keyword tags | Σ amount tagged ÷ Σ federal |
| 10 | HHI (agency mix) | Profile §8 | Q09 agency shares | Σ(share²) × 10000 |
| 11 | Funding volatility (CoV) | Profile §8 | FY-on-FY total | StdDev ÷ Mean |
| 12 | Share of state R&D | Profile §9 | Q01 total by state | inst total ÷ state total |
| 13 | Top 5 peer institutions | Profile §9 | dim_institution + Q01 totals | same state + ±25% R&D size |
| 14 | Patent-to-award ratio | Profile §9 | USPTO patents linked / award counts | patents ÷ awards |
| 15 | Co-PI collaboration density | Profile §6 sidebar | `fact_nih_project_pi_bridge` | Avg # co-PIs per project |
| 16 | Shannon entropy (field diversity) | Profile §7 strip | 8 HERD fields | −Σ pᵢ × log(pᵢ) |
| 17 | Award-size distribution (deciles) | Profile §6 sidebar | NSF + NIH per-award | P10..P90 of award amounts |
| 18 | 20-yr CAGR | Profile §1 (hero KPI) | Q01 totals | (V₂₄/V₀₅)^(1/19) − 1 |

---

## 9. Component Changes

### Delete (10 files)
- `apps/web/components/charts/DonutChart.tsx`
- `apps/web/components/charts/Ridgeline.tsx`
- `apps/web/components/charts/ScatterMatrix.tsx`
- `apps/web/components/charts/Streamgraph.tsx`
- `apps/web/components/charts/Sunburst.tsx`
- `apps/web/components/charts/Treemap.tsx`
- `apps/web/components/charts/EChartsBase.tsx`
- `apps/web/components/charts/Sankey.tsx`
- `apps/web/components/charts/ConnectedScatter.tsx` (only used by /correlations)

### Keep (refreshed)
- `apps/web/components/charts/BarChart.tsx` — add `orientation`, `highlight`, `annotations` props
- `apps/web/components/charts/LineChart.tsx` — add direct-labeling, annotation system
- `apps/web/components/charts/USStateMap.tsx` — polished cartography
- `apps/web/components/charts/Dumbbell.tsx` — used in §5 reconciliation
- `apps/web/components/charts/Sparkline.tsx` — used in §6, §9
- `apps/web/components/charts/BrushableLine.tsx` — used in /national #trends
- `apps/web/components/charts/LazyChart.tsx` — performance wrapper

### New components
- `apps/web/components/charts/StackedBar.tsx` — for source/agency/field composition (horizontal + vertical variants)
- `apps/web/components/charts/GroupedBar.tsx` — for §5 reconciliation (two-bar groups per agency)
- `apps/web/components/charts/DistributionPlot.tsx` — for §6 decile sidebar (10 vertical bars)
- `apps/web/components/charts/SlopeChart.tsx` — refresh existing for §9 (currently exists but unused per audit)
- `apps/web/components/editorial/ChartFrame.tsx` — wraps every chart with eyebrow/title/dek/source line
- `apps/web/components/editorial/SectionDivider.tsx` — see "Section dividers spec" below
- `apps/web/components/editorial/Annotation.tsx` — leader-line + label primitive
- `apps/web/components/editorial/KpiStrip.tsx` — generic 2x2 or 4-up
- `apps/web/components/editorial/UniversitySearchBox.tsx`
- `apps/web/components/editorial/UniversityTable.tsx` — for /universities

### Layout primitives (kept, lightly tweaked)
- `PageHeader`, `Card`, `MegaNav` — update nav items to match new IA

---

## 10. Out of Scope

- Backend API (everything stays in-browser DuckDB-WASM)
- New data acquisition
- Personalization / login
- Real-time data
- Custom domain
- I18n
- Any new scrollytelling (existing 3 are being deleted)

---

## 11. Implementation Phases

Plan-writer will break these into atomic tasks. Roughly:

1. **Foundation (P0)**: Delete dead pages/components, set up new IA scaffolding, redirects
2. **Data layer (P1)**: All 15 pre-aggregation parquet files, query helpers
3. **Design system (P2)**: New palette, typography tokens, `ChartFrame`, `Annotation`, `SectionDivider`, `KpiStrip`, mobile bar-rotation primitive
4. **University profile (P3)**: Build `/universities/[sk]` section-by-section (9 sections)
5. **Universities index (P4)**: Build `/universities` sortable table
6. **National page (P5)**: Build `/national` with 7 anchored sections
7. **Compare page (P6)**: Rebuild `/compare` for multi-uni small multiples
8. **Home (P7)**: New landing page
9. **Editorial polish (P8)**: Per-chart annotations via heuristics, section dividers, source lines
10. **Deep QA (P9)**: Multi-dimension automated + manual QA — see §13
11. **Deploy (P10)**: Final build, deploy, post-deploy smoke test

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Pre-aggregation parquet files balloon bundle size | Target <50MB total; tier-load via separate parquet per page |
| PI deduplication false positives across NSF+NIH | Use existing `dim_pi.resolution_confidence` flag; show low-confidence with a footnote |
| Subject keyword tagging has false positives | Document patterns in /methodology; allow user feedback channel |
| Long-scroll profile feels overwhelming | Sticky section anchor nav on desktop; collapse minor sections on mobile |
| Editorial polish (annotations) is enormous scope | Annotations are generated by per-section heuristics (largest YoY, peak year, inflection) — not hand-written per chart. Dividers reuse one component (see §4.6). |

---

## 13. Deep QA Plan (Phase P9)

QA is its own phase, not a checklist hidden inside other phases. Every dimension below has automated checks where possible + a manual spot-check protocol. Each dimension must reach **PASS** before deploy.

### 13.1 Dimensions

| # | Dimension | Method | Pass criteria |
|---|---|---|---|
| 1 | **Client-side exceptions** | Puppeteer-core headless probe (`scripts/qa/probe_pages.js`) loads every route + 5 representative `/universities/[sk]` + `/compare?ids=...`; captures `page.on('pageerror')` and console errors | 0 uncaught exceptions, 0 console errors of severity ≥ warn |
| 2 | **Text overlap / clipping** | Puppeteer screenshot every page at 375 / 768 / 1280 / 1920px, plus a DOM check via `getBoundingClientRect()` for: chart axis labels, legend items, section titles, source lines | 0 overlapping text rectangles; 0 truncated text (`scrollWidth > clientWidth`) on non-scroll containers |
| 3 | **Data accuracy spot-checks** | A 30-item fact table in `scripts/qa/facts.json` containing known-true values (e.g., "Johns Hopkins FY2024 total R&D = $X.XB", "NIH share of federal in FY2024 ≈ Y%", "Total US R&D FY2024 = $Z"). Automated SQL query against the parquet files verifies each fact within tolerance | 100% facts match within ±0.5% tolerance |
| 4 | **Mobile responsiveness** | Puppeteer screenshot at 375px on every page; visual diff against a baseline; DOM checks for horizontal-scroll detection | No horizontal scroll except where intended; every chart legible; every interactive element ≥ 44px touch target |
| 5 | **Accessibility (a11y)** | `axe-core` Puppeteer plugin runs on every page | 0 violations of severity "serious" or "critical"; ≤ 5 "moderate"; documented exemptions for known issues |
| 6 | **Color contrast** | `axe-core` color-contrast rule + manual check on Calibri at the smallest size (11px source line) | WCAG AA: 4.5:1 for body, 3:1 for large text. Source line passes 3:1. |
| 7 | **Dark mode parity** | Same Puppeteer suite re-run with `prefers-color-scheme: dark`; visual diff per page | No invisible elements (background-on-background); no color-only meaning broken |
| 8 | **Colorblind safety** | Apply CVD simulation (deuteranopia, protanopia, tritanopia) via Puppeteer CSS filter; manual review of agency-categorical chart and reconciliation diverging chart | Agency-categorical and diverging palettes remain distinguishable in all 3 CVD modes |
| 9 | **Cross-browser** | Manual: load top 5 pages in Chrome, Safari, Firefox at latest stable + Safari iOS simulator | No layout breakage; charts render; interactions work |
| 10 | **Performance — Lighthouse mobile** | Lighthouse CI in `scripts/qa/lighthouse.sh` against staging deploy | Performance ≥ 80, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90 |
| 11 | **Performance — bundle size** | `next build` output + check `apps/web/.next/static/` totals | First-load JS ≤ 250 KB gzipped per route; total parquet ≤ 50 MB |
| 12 | **Performance — parquet load time** | Puppeteer measures time-to-interactive on a 4G throttled connection | Profile page interactive in ≤ 4s; national page in ≤ 5s |
| 13 | **Link integrity** | Crawler script (`scripts/qa/check_links.js`) walks every internal link from every page | 0 broken internal links; redirects from old URLs return 200 |
| 14 | **Tabular numerals alignment** | Visual diff: for any column of ≥ 3 numeric values, verify pixel-aligned decimal points via screenshot OCR or DOM check | All KPI strips, leaderboard tables, deciles have aligned digits |
| 15 | **Annotation correctness** | Manual review: every auto-generated annotation (peak year, largest YoY, inflection) is sampled on 5 random universities + national page; verify the annotation actually points to the right data point | 100% annotations factually correct |
| 16 | **Edge case coverage** | Test these specific institutions: (a) one with no federal funding, (b) one ARDES-only (pre-FY2010), (c) one with only 5 years of HERD data, (d) one with very small R&D (<$1M), (e) one with very large R&D (>$2B) | All 5 render without errors; landmines flagged correctly |
| 17 | **Search & filter** | Manual: 10 search queries on `/universities` (full names, abbreviations, partial matches, misspellings); 5 filter combinations on universities table | Search returns expected results; filters compose correctly |
| 18 | **Methodology↔chart consistency** | Manual: every claim in `/methodology` is verifiable against the actual charts; every chart's source line points to a real source table | 100% consistent |

### 13.2 Tooling to add for QA

- `scripts/qa/probe_pages.js` — Puppeteer page probe (extend the `/tmp/probe_all.js` pattern from prior QA)
- `scripts/qa/screenshots.js` — Puppeteer screenshot at 4 breakpoints + dark mode
- `scripts/qa/facts.json` + `scripts/qa/verify_facts.py` — DuckDB-based fact verification
- `scripts/qa/check_links.js` — link crawler
- `scripts/qa/lighthouse.sh` — Lighthouse CI runner
- `scripts/qa/run_all.sh` — orchestrator that runs every check, emits a single `qa-report.md`

### 13.3 QA report

- The orchestrator emits `docs/qa/qa-report-YYYY-MM-DD.md` with PASS/FAIL per dimension + screenshots + diffs
- The report is committed to the repo for traceability
- Deploy (P10) is gated on a green report

### 13.4 Recurrence

After initial QA pass, the suite re-runs on:
- Every PR that touches `apps/web/`
- Every commit to `main` (via GitHub Actions)
- A weekly cron (catches data staleness, browser regressions)

---

## End of Spec

Once approved, the next step is invoking `superpowers:writing-plans` to produce a bite-sized, executable implementation plan saved to `docs/superpowers/plans/2026-05-31-restructure-plan.md`.
