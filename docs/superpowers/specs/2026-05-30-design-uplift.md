# Research Data Platform — Design Uplift Spec

**Date**: 2026-05-30
**Status**: For user approval
**Synthesizes**: `research/design-uplift.md`, `research/data-insights.md`, `research/frontend-architecture.md` plus user IA + Map directives.

The goal: take what's already a working data dashboard and elevate it to a **publication-grade analytical platform** — the visual sophistication of Our World in Data, the chart vocabulary of FT/Bloomberg, the narrative voice of NYT Upshot, the analytical depth our data deserves (HBCU share decline, bottom-up coverage collapse, COVID surge structure, DOD basic-research tripling, etc.).

This is **not** a polish pass. It's a from-the-ground-up rework of: typography, palette, chart vocabulary, page IA, page composition, motion. Phase 2 pages are built natively under the new system (no rework). Existing Phase 1 pages get rebuilt.

---

## 1. Executive summary

| Decision | Pick | Why |
|---|---|---|
| **Typography** | Source Serif 4 (hero, body) + Inter (UI) + IBM Plex Mono (numbers, with `tnum`) | Establishes hierarchy of voice (editorial → UI → numeric) the way OWID/FT/NYT do. Geist alone is too uniform. |
| **Palette** | "Editorial Teal" — 7-color categorical (agency-mapped) + sequential teal ramp + diverging PiYG | Single-hue isn't enough; we need ramps for choropleths and diverging scales for above/below baselines. |
| **Workhorse chart lib** | **Visx** (`@visx/*`, tree-shakable) | Best static-export + TS + Tailwind + tree-shaking story. Recharts retired except for sparklines (temporary). |
| **Specialty charts** | **ECharts** (Sankey, sunburst, calendar heatmap, ridgeline) — surgical, dynamic-imported | Best-in-class interactive Sankey; ECharts owns these four chart types. |
| **Exploration / matrices** | **Observable Plot** (scatter matrices, small-multiples) | Grammar-of-graphics; `fx`/`fy` facets are 2 lines per panel. |
| **Animation** | **Framer Motion** (chrome) + `@visx/react-spring` (chart tweens) | Layout-FLIP for page chrome; smooth interpolation for axes/series. |
| **Annotations** | Custom `<Annotation>` primitive (reference lines, ranges, callouts) | Cross-library, reusable, narrative payoff. |
| **IA** | 7 top-level items (down from 12); Map stays standalone with cartography uplift; NIH folded into Agency profile | Logical consistency + professional density. |
| **Narrative** | 3 scrollytelling story pages: "Self-Funding Revolution", "Three Crises", "Geography of Science" | OWID-style narrative arcs anchored in real findings. |

**Bundle target per page**: <250 KB first-load JS (currently /trends is 273 KB; we tighten via dynamic imports per chart).

---

## 2. Revised Information Architecture

### 2.1 New nav (7 top-level items, dropdowns where it helps)

```
Home
Explore        ▼  Institutions · Agencies
Analyze        ▼  Trends · Compare · Correlations · Reconciliation
Map
Federal Flow
Methodology
Downloads
```

**Mental model**:
- **Explore** = find an entity (institution, agency)
- **Analyze** = find a relationship (across time, across entities, across sources)
- **Map** = geographic view (kept top-level per user request, gets cartography uplift)
- **Federal Flow** = unique view (Sankey of where federal R&D goes)
- About = Methodology + Downloads

### 2.2 Per-agency tabs (replaces standalone /nih)

`/agency/[sk]` gets contextual tabs:

| Tab | All agencies | NIH-specific | DOE-specific | NSF-specific |
|---|---|---|---|---|
| Overview | ✓ | | | |
| FY trajectory | ✓ | | | |
| Top recipients | ✓ | | | |
| Activity mix (basic/applied/dev) | ✓ | | | |
| IC breakdown | | ✓ (Sheet 12) | | |
| National Labs concentration | | | ✓ (Sheet 10) | |
| Directorate breakdown | | | | ✓ (if data available) |

This generalizes: each agency surfaces what's distinctive about it without crowding the top nav.

### 2.3 Removed routes

- `/nih` placeholder — folded into `/agency/[sk]` for the HHS/NIH entry
- `/institutions` (plural) — redundant with `/institution`

### 2.4 Routes that change role

| Old | New | Why |
|---|---|---|
| `/states` | `/map` | Better noun; consistent with nav label |

### 2.5 New routes added

| Route | Purpose |
|---|---|
| `/story/self-funding` | Scrollytelling: federal share decline, institutional self-funding rise |
| `/story/three-crises` | Scrollytelling: ARRA, sequester, COVID |
| `/story/geography` | Scrollytelling: state-level federal R&D shifts |

These are linked from Home as "Featured stories" cards but are also discoverable from the nav under a future "Stories" item.

---

## 3. Design system

### 3.1 Typography stack

```css
/* All Google Fonts; all self-hosted via @fontsource for offline reliability */
--font-serif: 'Source Serif 4', 'Tiempos Text', Georgia, serif;    /* hero + body editorial */
--font-sans:  'Inter', 'Geist Sans', system-ui, sans-serif;        /* UI chrome */
--font-mono:  'IBM Plex Mono', 'Geist Mono', ui-monospace, mono;   /* numbers (tnum) */
--font-display: 'Source Serif 4', serif;                           /* hero, narrative headers */
```

Type scale (rem-based):
| Token | Size | Line | Family | Weight | Use |
|---|---|---|---|---|---|
| `h-hero` | 3.5rem (56px) | 1.05 | serif | 600 | Home hero, story headers |
| `h-display` | 2.5rem (40px) | 1.1 | serif | 600 | Page H1 |
| `h-section` | 1.5rem (24px) | 1.25 | sans | 500 | Section H2 |
| `h-card` | 0.875rem (14px) | 1 | sans | 500 | Card eyebrows, axis labels |
| `t-body-lg` | 1.125rem (18px) | 1.6 | serif | 400 | Narrative paragraphs |
| `t-body` | 0.9375rem (15px) | 1.5 | sans | 400 | Default body |
| `t-small` | 0.8125rem (13px) | 1.45 | sans | 400 | Footnotes |
| `t-2xs` | 0.6875rem (11px) | 1.3 | sans | 500 | UPPERCASE labels |
| `t-num-hero` | 3rem (48px) | 1 | mono | 500 | KPI tile values |
| `t-num` | 0.9375rem (15px) | 1.4 | mono | 500 | Table cells |

Global: `font-feature-settings: 'tnum', 'ss01', 'cv02', 'cv11';` on body. Tabular figures everywhere by default.

### 3.2 Palette — "Editorial Teal"

```css
:root {
  /* Surface (warm off-white) */
  --surface: 36 30% 98%;            /* #FAFAF7 */
  --surface-elevated: 0 0% 100%;
  --border: 30 8% 89%;              /* #E5E2DD */
  --rule: 30 6% 85%;                /* dividers heavier than borders */

  /* Text */
  --text-primary: 24 12% 8%;        /* #19140F warmer than pure black */
  --text-secondary: 25 7% 33%;
  --text-tertiary: 24 6% 56%;
  --text-quaternary: 24 5% 72%;     /* faint sub-labels */

  /* Accent (deep editorial teal) */
  --accent: 191 88% 28%;            /* #066F8A */
  --accent-soft: 191 50% 92%;       /* #DBEFF4 */
  --accent-strong: 191 95% 22%;     /* hover/active */

  /* Categorical palette (7 colors mapped to agencies) */
  --cat-1: 191 88% 28%;             /* #066F8A — NSF */
  --cat-2: 348 53% 47%;             /* #B5395A — NIH/HHS */
  --cat-3: 214 36% 47%;             /* #4A6FA5 — DOD */
  --cat-4: 28 67% 47%;              /* #C77E2B — DOE */
  --cat-5: 81 39% 41%;              /* #6A8F3F — NASA */
  --cat-6: 268 27% 56%;             /* #8B6BB1 — USDA */
  --cat-7: 213 10% 41%;             /* #5F6770 — Other */

  /* Sequential ramp (single-hue teal, 7 stops, colorblind-safe) */
  --seq-1: 192 56% 96%;
  --seq-2: 192 42% 85%;
  --seq-3: 191 36% 71%;
  --seq-4: 191 41% 55%;
  --seq-5: 191 53% 43%;
  --seq-6: 191 71% 32%;
  --seq-7: 191 90% 22%;

  /* Diverging (PiYG-derived, for above/below baseline) */
  --div-neg-3: 311 38% 28%;
  --div-neg-2: 310 31% 43%;
  --div-neg-1: 322 21% 65%;
  --div-zero:  44 26% 91%;
  --div-pos-1: 88 23% 64%;
  --div-pos-2: 102 32% 38%;
  --div-pos-3: 102 53% 25%;

  /* Semantic */
  --positive: 142 60% 32%;
  --negative: 0 73% 41%;
  --warning: 40 86% 32%;
  --highlight: 354 78% 51%;        /* THE single callout red */
}

.dark {
  --surface: 220 14% 7%;
  --surface-elevated: 220 12% 10%;
  --border: 220 9% 18%;
  --text-primary: 36 30% 96%;
  --text-secondary: 30 5% 70%;
  --accent: 191 67% 53%;
  /* categorical shifts lighter; sequential reverses direction */
}
```

**Hard rules** (enforced by code review):
1. **One callout color per view.** When we highlight a series in `--highlight`, every other series becomes `var(--text-tertiary)`.
2. **Max 5 categorical in a single chart.** Above 5 → small multiples or "top-N + Other".
3. **Sequential for ordered values** (choropleth, magnitude). **Diverging only when there's a meaningful zero** (above/below baseline, gap).

### 3.3 Spacing + radius

Unchanged from current (4px grid, container max 1440px) — these were already good.

Add: `--rule-width: 1px` `--rule-style: solid` token to standardize horizontal rules between sections (used to feel "designed" rather than divided).

### 3.4 Motion principles

| Where | What | Library | Duration | Easing |
|---|---|---|---|---|
| Page transitions (route change) | Fade + 4px translate | Framer Motion | 240ms | `cubic-bezier(.4,0,.2,1)` |
| Filter change → chart update | Axis ticks + bars/lines interpolate | `@visx/react-spring` | 380ms | d3-ease `cubicInOut` |
| Hover on chart series | Highlight + dim others (opacity 1.0 → 0.18) | CSS | 120ms | linear |
| KPI tile mount | Counter up | Framer Motion `useMotionValue` | 700ms | `cubicOut` |
| Tooltip appearance | Fade + 4px translate | Framer Motion | 140ms | linear |
| Annotation reveal on scroll | Fade + draw-on | Framer Motion + scrollama | 600ms | linear |

**No initial animations on first render** (charts appear instantly). Animations only on interactions and updates. Respect `prefers-reduced-motion`.

---

## 4. Chart vocabulary

### 4.1 Library matrix

| Chart | Library | Package(s) | Status |
|---|---|---|---|
| Line (single + multi-series) | Visx | `@visx/scale`, `@visx/shape`, `@visx/axis` | Keep Recharts temporarily on /institution detail tabs |
| Bar (vertical / horizontal) | Visx | `@visx/shape`, `@visx/group` | Same |
| Donut | Visx | `@visx/shape` | Same |
| Stacked area | Visx | `@visx/shape` | new |
| **Brushable+zoomable line** (20-yr) | Visx | `@visx/brush`, `@visx/zoom` | new |
| **Sankey** (Federal R&D flow) | ECharts | `echarts/core` + `SankeyChart` | new (Phase 2) |
| **Sunburst** (hierarchical drilldown) | ECharts | `SunburstChart` | new (Agency tabs) |
| **Treemap** (FY field mix) | Visx hierarchy | `@visx/hierarchy` | new |
| **Slope chart** (FY-to-FY rank changes) | Visx | re-uses shape+axis | new |
| **Dumbbell** (top-down vs bottom-up gap) | Visx | re-uses | new (Reconciliation) |
| **Ridgeline** (distribution over time) | ECharts | `LineChart` + `VisualMap` | new |
| **Streamgraph** (NIH IC over time) | Visx | `@visx/shape` (Area with stack) | new (Agency NIH tab) |
| **Calendar heatmap** | ECharts | `HeatmapChart` + `CalendarComponent` | optional (data refresh activity) |
| **Scatter** (single series) | Visx | `@visx/shape`, `@visx/scale` | new (Correlations) |
| **Scatter matrix** (4-6 metrics) | Observable Plot | `@observablehq/plot` | new (Correlations) |
| **Small multiples (faceted)** | Observable Plot | `@observablehq/plot` | new |
| **Choropleth** (improved) | react-simple-maps + d3-geo | + Albers USA w/ AK/HI insets | uplift existing |
| **Sparkline** (inline 20-yr) | Visx | `@visx/scale` + `@visx/shape` | uplift existing (Recharts → Visx for consistency) |
| **Lollipop / bar-with-dot** | Visx | re-uses | new (Home leaderboards) |
| **Connected scatter** (FY20 BU% vs FY24 BU%) | Visx | re-uses | new (Reconciliation) |

### 4.2 Custom primitives to build

All cross-library, render-prop based, taking the chart's scale + dimensions from context:

```
<Annotation type="reference-line" axis="x|y" value={N} label="ARRA" />
<Annotation type="reference-band" axis="x|y" from={N1} to={N2} label="COVID" />
<Annotation type="callout" anchor={[x,y]} dx={dx} dy={dy} label="..." />
<Annotation type="arrow" from={[x1,y1]} to={[x2,y2]} />

<DirectLabel series={[...]} placement="right|inside" />   /* kills legends; labels at line end */
<ChartTitle title="..." subtitle="What this shows: ..." source="..." />
<HighlightSeries id={seriesId} dimOthers />              /* gray-everything-else */
<SparklineColumn data={...} highlight={highlightFY} />   /* for tables */
<KpiTile label value delta sparkline />                  /* unified KPI primitive */
```

### 4.3 Five visual patterns we'll copy first (highest impact-per-hour)

1. **Direct labeling + gray-everything-else** — applied to all multi-series line charts. Implementation: `<DirectLabel>` at line ends; non-highlighted series in `--text-tertiary`. Datawrapper's signature pattern.
2. **"What this shows" sub-label + source caption** — `<ChartTitle>` requires `subtitle` (plain-English finding) and `source` (provenance + vintage). Every chart in the dashboard. OWID's trust signal.
3. **Tabular-figure numeric discipline** — global `font-variant-numeric: tabular-nums`, single `formatDollars()` utility (`$48.2B`, `$487M`, `$92.5K`), serif italic for sub-labels above KPI tile numbers.
4. **Annotated reference lines + bands on /trends and Home** — ARRA stimulus (FY09 band), sequester (FY13-15), COVID (FY20-22 band), CHIPS+IRA (FY23+). Two `<ReferenceLine>` + one `<ReferenceArea>` per timeline chart.
5. **Sparkline columns in /institution table** — 80×24 inline trend per institution row, highlighted FY in `--highlight`. Transforms tables from "spreadsheet" to "scannable insight grid" (Pew / FT / Bloomberg pattern).

---

## 5. Page-by-page redesign

### 5.1 Home — narrative-led hero

**Structure** (top to bottom):
1. **Hero**: Serif headline (~56px) — *"Twenty years of federal research funding to U.S. universities."* — sub: *"$1.2T cumulative · 1,014 universities · 32 agencies · 12 data sources."*
2. **Stat strip**: 4 KPI tiles with Source Serif eyebrows + IBM Plex Mono numbers + sparkline at base.
3. **Featured stories carousel**: 3 cards linking to scrollytelling pages (self-funding revolution / three crises / geography).
4. **Top 15 leaderboard table** with sparkline column (FY05–FY24), highlighted FY24, ranked by FY24 federal R&D. Sortable by metric.
5. **Agency mix donut** (FY24) — DOD/HHS/DOE/NASA/NSF/USDA/Other. Click slice → goes to `/agency/[sk]`.
6. **"Where the money goes" mini Sankey** (3-level federal → top-3 agencies → performer type). Click → full `/flow` page.
7. **"State of the data" panel** — single chart of bottom-up coverage falling from 80% → 49%. The data-insights agent's most important finding. Single sentence below: *"Standard federal grant databases (NIH ExPORTER, NSF Awards, USAspending) increasingly miss what universities report as federal R&D — see Methodology."*

### 5.2 Trends — the analyst playground

Current is good but gets:
- **Brushable lower axis** (mini-chart) for FY range selection
- **Reference lines + bands** for ARRA, sequester, COVID, CHIPS+IRA pre-loaded
- **Real vs nominal toggle** with CPI source citation
- **Indexed-to-FY mode** ("All series = 100 at FY[X]")
- **Direct labeling** at right edge; legend removed
- **"Surprise me" button** — randomizes (metric × cohort × FY range) to suggest interesting views; powered by data-insights findings
- **Export** PNG/SVG/CSV/permalink

### 5.3 Institution profile — entity portrait

- **Hero**: institution name in serif, with state + Carnegie + FY24 federal R&D as eyebrow line
- **Sticky filter bar** with FY range + nominal/real toggle
- **Tabs**: Overview · Funding mix · Reconciliation · NIH (if applicable) · PIs · Geography of co-PIs (Phase 3)
- **Overview tab**: top-down vs bottom-up line, two stacked bars (by source × by agency), sparkline column showing 20-year trajectory per source
- **Funding mix tab**: sunburst with drill-down (Source → Agency → IC)
- **Reconciliation tab**: dumbbell showing HERD vs BU per FY, with delta annotation; "What this means" sub-label citing the BU-collapse story
- **NIH tab** (if institution has NIH funding): IC streamgraph + IC concentration metric vs peers
- **PIs tab**: PI table with cross-agency portfolio sparkline per PI

### 5.4 Agency profile — funder portrait

- **Hero**: agency name in serif, FY24 obligations + parent agency
- **Tabs** (contextual based on agency):
  - Overview: FY trajectory + activity mix
  - Top recipients: ranked table with sparkline column
  - Geography: choropleth of state-level allocations
  - Performer types: how much goes to universities vs FFRDCs vs industry vs federal labs
  - **IC breakdown** (HHS only — replaces standalone /nih)
  - **National Labs concentration** (DOE only)
- **Inline narrative** — when agency has dramatic story, surface it: "DOD basic research has tripled since FY05, reaching $4.69B in FY24" with a mini-chart and link to Trends.

### 5.5 Map — Geography uplift

- **Albers USA projection** with built-in AK/HI insets (not separate `<ComposableMap>`)
- **Year slider** below map (animates choropleth)
- **Metric selector**: federal R&D, NIH only, NSF only, DOD only, bottom-up vs HERD gap
- **Click state**:
  - Side panel slides in with: total + n_institutions + ranked top-15 institutions (sparkline column) + agency mix donut
  - Map dims non-selected states
- **"Compare two states" toggle** — pick two; side panel shows diff
- **County-level** (Phase 3, opt-in via toggle) — uses `us-atlas/counties-10m.json` lazy-loaded
- **Embedded story callout**: "Maryland tripled its federal R&D" with mini-chart, links to scrollytelling page.

### 5.6 Federal Flow — Sankey (Phase 2)

- **ECharts Sankey**: Federal total → Agency → Performer category (universities / FFRDC / industry / federal labs / nonprofits / state-local)
- **Year slider**
- **Hover trace**: pointing at a node highlights its full flow path (in + out)
- **Drag to reorder nodes** (ECharts builtin)
- **Real vs nominal toggle**
- **Synthetic remainder** rows visible but muted; caption explains the data fog
- **Sub-Sankey on click**: clicking the "Universities" performer expands to show top-15 institution beneficiaries with their inflow lines

### 5.7 Reconciliation — top-down vs bottom-up (Phase 2)

The most analytically important page — answers "why don't the numbers match?":

- **National view**: line chart with three lines: HERD reported · FF explicit · FF with allocation (Sheet 11). Diverging area shading where they part ways
- **Per-institution view**: dumbbell chart, one row per institution (top-50 by HERD), red dot = HERD, blue dot = BU, line connecting; sortable by absolute gap. Highlight rows where gap > 50%
- **The "BU collapse" story (key finding from data agent)**: separate line chart showing national BU/HERD coverage from 80% → 49% with vertical inflection annotations
- **Connected scatter**: FY20 BU% on x-axis, FY24 BU% on y-axis, each dot = institution; diagonal y=x line. Below-diagonal dots are losing capture. Annotated dots for Georgia Tech, MIT, JHU.
- **The caveat panel**: tiny-anchor flag, FFRDC blind spot, USAS pre-2008 sparseness — explained directly on this page (not just in /methodology)

### 5.8 Compare — multi-institution side-by-side (Phase 2)

- **Picker**: select up to 4 institutions (typeahead chips)
- **Small-multiples grid** of 4 KPI cards × N institutions (federal total, NIH, NSF, USAS contracts) + sparklines
- **Synchronized line charts**: 4 stacked panels with shared x-axis, one panel per institution, same y-scale
- **Side-by-side donuts**: agency mix per institution at FY24
- **Reconciliation gap comparison**: dumbbell with one row per selected institution

### 5.9 Correlations — research playground (Phase 2)

- **Two metric pickers** + cohort filter
- **Scatter** (Observable Plot) with regression line, Pearson r, Spearman ρ
- **Per-institution residual table** with sparkline columns
- **"Surprise me" panel** — pre-computed correlations from the data-insights agent's 5 unexplored joins: NIH IC concentration vs NIH dollars, contract:assistance ratio, etc.
- **Scatter matrix mode** (Plot facets): pick 4 metrics, see all 6 pairwise scatters at once

### 5.10 Scrollytelling stories (NEW)

Three story pages, each ~1500 words narrative + 6 chart waypoints, scroll-anchored via `scrollama` (~6 KB):

- **`/story/self-funding`**: federal-share decline, institutional self-funding rise; HBCU sector contrast; field-level federal share erosion.
- **`/story/three-crises`**: ARRA → sequester → COVID → CHIPS+IRA; annotated full timeline; per-agency consequences.
- **`/story/geography`**: state-level rebalancing; Maryland/Georgia/NC ascendance; RTI as case study.

Each story = its own page; chart waypoints are 100vh sections with sticky charts that update as text scrolls (OWID + NYT pattern).

### 5.11 Methodology

- Remains long-form but gets typography uplift (Source Serif body) + per-source detail expansion
- New **"Data quirks gallery"** section showing the FY15/FY16 flow-data gap, FFRDC blind spot, USAS pre-2008 with mini-charts illustrating each

### 5.12 Downloads

- Gets sparkline columns showing each file's row-count trajectory across data refreshes (future)
- Manifest viewer with column-level schema browser

---

## 6. Component additions

### 6.1 New `lib/`
- `lib/format.ts` — single canonical `formatDollars(n, opts)` + `formatPct` + `formatFY` + `formatDelta` (extends existing `formatters.ts`)
- `lib/scales.ts` — shared d3-scale builders that map our palette to scale ranges
- `lib/annotations.ts` — registry of pre-defined timeline annotations (ARRA, sequester, COVID, CHIPS+IRA)
- `lib/stories.ts` — narrative arc data (titles, chart waypoints, copy)

### 6.2 New `components/charts/`
- `Sankey.tsx` (ECharts wrapper, dynamic import)
- `Sunburst.tsx` (ECharts wrapper)
- `Streamgraph.tsx` (Visx)
- `BrushableLine.tsx` (Visx + @visx/brush)
- `Dumbbell.tsx` (Visx)
- `SlopeChart.tsx` (Visx)
- `ScatterMatrix.tsx` (Observable Plot)
- `Ridgeline.tsx` (ECharts)
- `Treemap.tsx` (@visx/hierarchy)
- `ConnectedScatter.tsx` (Visx)

### 6.3 New `components/ui/`
- `Annotation.tsx` (the cross-library primitive)
- `ChartTitle.tsx` (title + "what this shows" + source)
- `DirectLabel.tsx` (label-at-line-end)
- `KpiTile.tsx` (unified)
- `Sparkline.tsx` (uplifted; Visx)
- `StoryWaypoint.tsx` (scrollytelling primitive)
- `Tabs.tsx` (already exists; gets variants for `pills` vs `underline`)

### 6.4 New `components/layout/`
- `MegaNav.tsx` (dropdowns for Explore + Analyze)
- `StorySection.tsx` (the sticky-chart scrollytelling pattern)

---

## 7. Bundle + perf

- **`LazyChart` wrapper**: every chart is wrapped in a Suspense + IntersectionObserver so off-screen charts don't load
- **Dynamic imports**: ECharts loaded only on pages that need it (`apps/web/components/charts/Sankey.tsx` uses `dynamic(() => import('./SankeyImpl'), { ssr: false })`)
- **Per-page bundle budget**: <250 KB first-load gz
- **`@next/bundle-analyzer`** enabled in CI; budget enforced
- **DuckDB-side aggregation**: for >10k row charts (Sheet 6 SBIR), pre-aggregate in DuckDB before sending to chart layer

---

## 8. Migration plan (10 phases)

Each phase is independently shippable. We can pause between any two.

| Phase | Scope | Estimated effort |
|---|---|---|
| **U-1** | Add fonts (Source Serif + Inter + IBM Plex Mono), update tokens, apply globally | 1.5 hr |
| **U-2** | Add new palette tokens; rebuild existing chart colors | 1 hr |
| **U-3** | Build `<Annotation>`, `<ChartTitle>`, `<DirectLabel>` primitives; retrofit /trends | 3 hr |
| **U-4** | Build `<KpiTile>` v2; redesign Home stat strip | 2 hr |
| **U-5** | Build new IA (mega nav, route renames /states → /map, fold /nih) | 2 hr |
| **U-6** | Build Visx primitives (BrushableLine, Sunburst, Treemap, Dumbbell, Slope, Streamgraph) | 4 hr |
| **U-7** | Build Reconciliation page (Phase 2) using new primitives | 3 hr |
| **U-8** | Build Federal Flow Sankey + Compare + Correlations pages (Phase 2) | 5 hr |
| **U-9** | Build scrollytelling stories (3 pages) | 6 hr |
| **U-10** | Map cartography uplift + Polish + a11y pass + Lighthouse ≥ 90 | 3 hr |

Total: ~30 hours of focused work. Can be split into multiple deploys.

---

## 9. Definition of done

- [ ] All pages use Source Serif + Inter + IBM Plex Mono
- [ ] All numbers render with `tnum` tabular figures
- [ ] One canonical `formatDollars()` utility used everywhere
- [ ] Every chart has `<ChartTitle>` with subtitle + source caption
- [ ] Multi-series line charts use direct labeling, no legends
- [ ] Reference lines/bands present on every long-FY chart (ARRA, COVID, etc.)
- [ ] Sparkline column in institution table
- [ ] Top-15 leaderboard on Home with sparklines
- [ ] Map has AK/HI insets + year slider + state drilldown panel
- [ ] Reconciliation page surfaces the BU-collapse finding prominently
- [ ] Federal Flow Sankey functional and interactive
- [ ] All 3 scrollytelling story pages live
- [ ] Bundle budget <250 KB first-load JS per page
- [ ] Lighthouse perf ≥ 90 on every page
- [ ] All charts a11y-tabled (visual + screen reader access)

---

## 10. Open questions for user

1. **Custom domain?** Currently the site is at `herd-survey-dashboard.saber-usama.workers.dev/`. Want me to register `<something>.org` or similar at Cloudflare (~$9/yr) and point to the Worker? Better URL for the rebrand.
2. **Three scrollytelling stories — yes or just one?** They're high-value but expensive. I can do all three, or start with one ("Three Crises in 20 Years" is most universally interesting) and add others later.
3. **Dark mode — ship now or defer?** Dark mode tokens are in the spec; implementation is ~2 hours. Want it in U-1 or pushed to a later phase?
4. **Story-only landing** (i.e., make `/` itself a scrolly hero with the most striking finding) vs **current Home with carousel of stories**? OWID does both. Carousel is safer.
5. **Permission to install ~5 new npm packages?** (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/brush`, `@visx/hierarchy`, `@visx/group`, `echarts`, `echarts-for-react`, `@observablehq/plot`, `framer-motion`, `scrollama`, `@fontsource/source-serif-4`, `@fontsource/inter`, `@fontsource/ibm-plex-mono`)

---

**End of spec.** Awaiting your approval. Once approved I execute Phase U-1 → U-10 sequentially with commits per phase.
