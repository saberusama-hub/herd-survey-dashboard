# Herd Survey Dashboard — Visual Design Uplift Research

A reference brief for moving the Herd Survey dashboard from "competent MVP" toward the visual sophistication of Our World in Data (OWID), FT Visual & Data Journalism, NYT Upshot, Bloomberg Graphics, Datawrapper, Observable, and Pew Research.

Current baseline: Tailwind + Geist Sans/Mono, Recharts line/bar/donut, single-teal accent, no annotations, no narrative interweave. Target: a longitudinal R&D dataset (FY2005–FY2024, 7 federal sources) deserves a *publication-grade* visual language, not a "starter dashboard" one.

Every recommendation below is anchored in a real example from one of the reference sites.

---

## 1. Typography refinements beyond Geist alone

**The problem with Geist alone:** Geist Sans is a fine UI font but it is *too uniform* across all weights and styles to do the work that data-journalism typography does — namely, *establish a hierarchy of voice* (editorial hero → editorial body → data label → numeric tabular figure → footnote). Top-tier publications pair a *contrast* face (often a serif or display sans) for editorial voice with a sober text sans for chart UI and a tabular mono for numbers.

**Recommended type system (3 families, 1 fallback):**

| Role                       | Family                                        | Weights / Style       | Size · Leading           | Where used                                                        |
| -------------------------- | --------------------------------------------- | --------------------- | ------------------------ | ----------------------------------------------------------------- |
| Editorial hero & H1        | **Tiempos Headline** or **Source Serif 4**    | 600 (Semibold)        | 44/48 desktop, 32/36 sm  | Page hero ("$92.5B Federal R&D to Universities, FY2024")          |
| Section heading H2/H3      | **GT America** or **Inter** (current Geist OK) | 500 medium            | 24/30 (H2), 18/24 (H3)   | Chart titles, section labels                                      |
| Editorial body             | **Source Serif 4 Text** or **Tiempos Text**   | 400 / 400 italic      | 18/28                    | Narrative paragraphs in /methodology and on hero cards            |
| UI / chart labels          | **Inter** (subbed for Geist Sans)             | 400 / 500             | 13/18 axis, 14/20 legend | Axes, legends, tooltips, filter chips                             |
| Numeric tabular            | **Roboto Mono** or **IBM Plex Mono** with `tnum` feature on | 500 | 14/20 in tables, 28/32 in KPI tiles | KPI cards ("$48.2B"), table cells, tooltips      |
| Footnotes & caption        | Inter                                         | 400                   | 12/16, color #6B7280     | Source attribution, data vintage stamp                            |

**Why a serif on a "modern" dashboard:** OWID uses **Lato** for chart labels but reserves a heavier sans for chart titles (chart-title role is bolder than body, ~16/22 with weight 700). FT Visual & Data Journalism uses **Financier** (their proprietary display serif) for editorial titles and **Metric** for chart UI. NYT Upshot interactives use **Cheltenham** (NYT's serif) for the byline-y hero and **Franklin** for chart UI. The serif/sans pairing is what makes these feel like *journalism* and not like *Stripe dashboard chrome*.

**Concrete first-step swaps:**

1. Drop in **Source Serif 4** (free, Google Fonts) as `--font-serif` and use it for `h1` on hero, /methodology body, and KPI card sub-labels ("FY2024 Total" in serif italic above the big number). Tiempos Text is the paid upgrade.
2. Keep Geist Sans for nav/UI chrome but apply `font-variant-numeric: tabular-nums` site-wide on `.font-mono` and any element containing currency.
3. Use **IBM Plex Mono** (free) instead of Geist Mono for numbers — Plex Mono has clearer digit shapes (especially `1`, `7`, `9`) at small sizes.
4. Cap chart-title weight at 600 — never 700+ on chart titles. Datawrapper's text guide explicitly says: "*Use only two levels of hierarchy that are clearly different from each other — like a 12px gray and a 14px black. Then emphasize within the annotations using boldness.*" Two levels, not five.
5. Use real italic (not oblique) for asides like "*estimated*" in chart sub-labels. Source Serif 4 has a beautiful true italic.

**Numbers deserve their own discipline.** Bloomberg Graphics and FT both render numerals with OpenType `tnum` (tabular figures), `lnum` (lining), and frequently use **stacked fractions** for currency-with-unit ("$48.2 **B**" with the "B" 60% size in superscript). For the Herd Survey, every dollar figure across the site should have one canonical formatter: `$1.23B`, `$487M`, `$92,500` — never mixing styles in the same view. Use `Intl.NumberFormat` with `notation: "compact"` for charts, full `notation: "standard"` for tables.

---

## 2. Color palette refinements

The current single-teal accent isn't *wrong* — Datawrapper's color guide (Lisa Charlotte Muth) is unequivocal that **single-hue is the safest categorical default** — but it's *under-specified*: there's no documented sequential ramp for choropleths, no diverging ramp for "above/below FY2014 baseline", no semantic categorical scale for the seven federal agencies (NSF, NIH, DOD, DOE, NASA, USDA, DOEd), and no dark-mode pair.

Datawrapper's guide recommends ColorBrewer 2.0 and CartoColor as the canonical starting points (Cynthia Brewer's work is the de facto standard in academic and journalism cartography). Pew Research uses a custom 6-color categorical wheel (warm-leaning) that maps to their report-section taxonomy.

**Candidate palette A — "Editorial Teal" (recommended primary; extends current accent):**

```
Primary categorical (7 colors, agency-friendly, ColorBrewer "Set2"-derived):
  #066F8A  Deep teal      (anchor, NSF / current accent)
  #B5395A  Crimson         (NIH)
  #4A6FA5  Slate blue      (DOD)
  #C77E2B  Burnt amber     (DOE)
  #6A8F3F  Olive green     (NASA)
  #8B6BB1  Dusty violet    (USDA)
  #5F6770  Graphite        (DOEd / "Other")

Sequential ramp (single-hue teal, 7 stops for choropleths):
  #F0F7F9  #C8E1E8  #95C5D2  #5FA5BB  #3A85A0  #1F6783  #074C66

Diverging ramp (above/below baseline, 9 stops, PiYG-like):
  #6B2C61 #8C4C82 #B17AA3 #D3AEC4 #EEEBE3 #C3D7B7 #8FB677 #5C8B47 #2E5F1F

Reference highlight (callouts, single):
  #DC2626  (used sparingly — only "look-here" annotations)
```

**Candidate palette B — "FT Cool" (cool-cast, more editorial):**

```
#0F5257 #166985 #2E84B5 #56A0CC #8AB8DA #B7CDE0  (sequential blue)
#D1495B #EDAE49 #F6E3A4 → #A7C957 #6BAA75 #386641 (diverging red-to-green)
Background tint: #FFF1E6 (FT pink-cream)
Body text: #262A33
```

**Candidate palette C — "OWID Earth" (warm, sober, very Tufte-ian):**

```
#D63A28 #E7B45D #5F9E8F #2C6E91 #6C4B73 #999999  (categorical 6)
Sequential: #FFF7F0 → #FBC79A → #E78A4E → #B43E20 → #6A1D0E
Background: #FAF7F2 (OWID's slightly warm off-white)
```

**Candidate palette D — "Bloomberg Terminal" (dark-mode first, cool):**

```
Background: #15191E    Surface: #1E2530    Border: #2A3340
Categorical: #4EA8DE #E2725B #F2B441 #B57BD9 #4DCBA8 #E55E8E #7A8FA6
Accent: #00C2FF        Warning: #FFB000     Negative: #FF4D5E
Sequential: #1B2735 → #2D4A6B → #4880B0 → #6FB6E8 → #B5DCF7
```

**Rules of thumb the references all follow:**

- **One callout color, never two.** When you highlight "FY2024 surge" with red, every other series goes gray (#D1D5DB). Datawrapper calls this the "gray everything else" technique and the May 26, 2026 Dispatch features 4 charts using it.
- **Saturation parity.** From the Beautiful Colors guide: *"Try to desaturate bright colors. Put more saturation in dark colors."* Don't mix a 90%-sat orange with a 40%-sat blue — they fight.
- **Keep 5 categorical max in a single view.** Above 5, switch to small multiples or a "top-N + Other" treatment.
- **Verify against colorblind simulation.** Datawrapper bakes Coblis and Sim Daltonism checks into their tool. We should ship a `npm run check:colors` that runs a Color Oracle equivalent.

---

## 3. Ten+ chart types to add beyond line / bar / donut

Each is mapped to a Herd Survey use case + a real example URL.

**1. Sankey diagram**
*What:* Flows between categories with width = magnitude.
*When:* Federal agency → field of science → institution → state. Showing how $48B from NIH flows through ~3,000 universities into the 5 major FOS buckets.
*Reference:* `https://observablehq.com/@d3/sankey` (Mike Bostock canonical) + Datawrapper's flow-chart-types guide explicitly recommends Sankey for "showing how things move through a system."
*Library:* `@nivo/sankey` or `d3-sankey` + a custom React wrapper. Not in Recharts.

**2. Treemap**
*What:* Nested rectangles, area proportional to value.
*When:* /agency page: NSF total broken down by directorate, then by program. Better than nested donuts when you need both *share* and *hierarchy*.
*Reference:* `https://observablehq.com/@d3/treemap` (Bostock). Datawrapper's "Parts of a whole" section, item 23.
*Library:* `@nivo/treemap` (good defaults) or `d3-hierarchy` + custom SVG.

**3. Ridgeline / joyplot**
*What:* Stacked density curves, one per category.
*When:* Distribution of award sizes per agency, FY by FY. NIH skews to many small R01s; DOE has fewer-but-larger awards. A ridgeline of `log(award_amount)` per agency makes the *shape difference* immediately legible.
*Reference:* `https://observablehq.com/@d3/ridgeline-plot`.
*Library:* `d3-shape` + `d3-contour` or Plot's `Plot.areaY({y: density})`.

**4. Slope chart**
*What:* Two-point line chart — just FY2005 vs FY2024, no points in between, labels at each end.
*When:* "Which 10 institutions gained the most rank in 20 years." Datawrapper guide: *"a line chart where everything between the first and last date has been erased."* Perfect for the /institution page rank-change story.
*Reference:* `https://observablehq.com/@d3/slope-chart`.
*Library:* Pure SVG, ~50 lines.

**5. Dumbbell plot (paired-point / arrow plot)**
*What:* Two dots per row connected by a line — showing change.
*When:* "FY2005 vs FY2024 federal R&D, top 50 universities." More compact than a grouped bar; easier to scan than a slope chart for many categories.
*Reference:* Datawrapper Academy on arrow plots: `https://academy.datawrapper.de/article/123-how-to-create-an-arrow-plot` (the canonical "compact change" chart).

**6. Scatter matrix (small-multiples scatterplot)**
*What:* Grid of scatterplots, one per pair of variables.
*When:* /methodology page: showing the correlation grid between HERD reported $, federal obligations, SBIR awards, FastLane awards across institutions. Useful for the *bridge reconciliation* story.
*Reference:* Observable Plot: `https://observablehq.com/plot/marks/dot` (with `Plot.facet`).

**7. Calendar heatmap**
*What:* 7×52 grid per year, cell color = value.
*When:* If we ever surface monthly award counts (NSF Awards has obligation dates) — show the *cadence* of federal R&D obligations (Sept-end surge is a real artifact).
*Reference:* `https://observablehq.com/@d3/calendar-view` (the canonical contributions-graph layout, Bostock).

**8. Beeswarm plot**
*What:* Dots packed on a single axis, no overlap, jittered.
*When:* "Award size distribution within NIH, FY2024" — every R01 is a dot, sized by dollars, packed along the dollar-amount axis. Beats a histogram when you want to see *individual outliers*.
*Reference:* `https://observablehq.com/@d3/beeswarm`.
*Library:* `d3-force` simulation or Plot's `dodgeX`.

**9. Streamgraph**
*What:* Stacked area chart with a centered (not zero) baseline, smooth curves.
*When:* "20-year agency share over time" — when the visual goal is *flow and rhythm*, not precise readout. (Use stacked bar for precise readout, streamgraph for emotional impact on the hero.)
*Reference:* `https://observablehq.com/@d3/streamgraph`.
*Caveat:* OWID and FT both *avoid* streamgraphs for serious analytics because they distort relative comparison. Use only on hero/promo, not on /trends primary.

**10. Sunburst**
*What:* Radial treemap — concentric rings, each ring = a level of hierarchy.
*When:* /agency hierarchy: Agency → Sub-agency → IC/Directorate. Less work for many rings than nested donuts.
*Reference:* `https://observablehq.com/@d3/sunburst`.

**11. Marimekko (variwide column chart)**
*What:* Bar chart where both *width* and *height* encode data.
*When:* "States ranked by R&D received, with bar width = number of institutions." OWID's life-expectancy Marimekko: `https://ourworldindata.org/grapher/life-expectancy-marimekko`.

**12. Connected scatterplot**
*What:* Scatterplot with points connected in time order; arrow on the last point.
*When:* "Institution X over 20 years: federal R&D vs federal share of total R&D." Shows trajectory in a 2D plane.
*Reference:* Driven by the Hannah Ritchie / OWID style guide; example: OWID life-expectancy-vs-gdp-per-capita scatter (`https://ourworldindata.org/grapher/life-expectancy-vs-gdp-per-capita`).

**13. Lollipop chart**
*What:* Bar chart, but the bar is a thin line and the value is a dot at the top.
*When:* Drop-in replacement for thin bar charts when bar count > 20 — looks less heavy.
*Reference:* Datawrapper chart-types guide item 12.

**14. Slope-and-bar combo (Pew / FT pattern)**
*What:* Slope chart on the left, paired with a small column-of-numbers on the right.
*When:* Top-10 institution rank changes — slope chart shows *direction*, the right column shows *the actual dollar amount*.
*Reference:* Pew's report layouts consistently pair chart + side-table. Pew Research Center home page is full of these "two-thirds chart, one-third number" compositions.

---

## 4. Annotation patterns

OWID, FT, NYT Upshot and Datawrapper all annotate *aggressively*. A chart without annotations on these sites is rare. Datawrapper's "text in data visualizations" guide is the most concrete tutorial available; key patterns:

**(a) Direct labeling — kill the legend.** From the guide: *"remove the color key and directly label your categories."* For the Herd Survey, every multi-line trend chart should label lines *at the right end*, not via a legend strip. This is OWID's default behavior in Grapher.

**(b) Reference lines (horizontal & vertical).**
- Horizontal: "FY2014 baseline" dashed line at $42B, labeled at the right edge with a faint background pill.
- Vertical: "ARRA stimulus, FY2009–2011" — a tinted vertical band, not a line, with a label at the top.
- Implementation: in Recharts use `<ReferenceLine>` and `<ReferenceArea>`; for a custom build, just an extra `<line>` at `y={yScale(value)}` with `stroke-dasharray="4 2"` and a `<text>` at the right edge.

**(c) Callouts with leader lines.** A textbox with a thin curve pointing to a specific data point. NYT Upshot uses these heavily ("Test scores fell here, during the pandemic"). Implementation: SVG `<path>` with quadratic Bezier from text-anchor to point, 1.5px stroke, color matched to the highlighted series.

**(d) Tinted backgrounds for ranges.** Recessions, administrations, fiscal-stimulus windows. Use a rectangle at ~8% opacity of a neutral hue (#9CA3AF at 0.08 alpha) — never tinted with a meaningful palette color.

**(e) "What you should know about this indicator" cards.** OWID's Grapher has a dedicated panel below every chart: short bullets explaining the data definition, methodology caveat, and source. For Herd Survey this would mean each chart card has a `<details>` toggle: "About this chart — Federal obligations are first-year only and exclude pass-through subawards. Source: NSF NCSES survey, vintage 2024-12."

**(f) Text outlines on overlay labels.** From the Datawrapper text guide: *"If your text sits on other elements — even just a subtle gridline — consider using a text outline."* In SVG: `paint-order: stroke; stroke: white; stroke-width: 3px; stroke-linejoin: round;`. Essential for map labels and for direct-labels that cross gridlines.

**(g) The "gray-out + one-highlight" pattern.** When telling a story, render all series gray (#D1D5DB) and *one* in the brand red (#DC2626). This is the single most powerful annotation pattern in the Datawrapper Dispatch — appears in most weekly editions.

---

## 5. Motion and transition principles

Most academic dashboards over-animate (cute on first load, irritating on the tenth). The top references restrain motion heavily.

**Rules:**
1. **Never animate the initial render.** The first paint of a chart should be static. Animations on first load delay information delivery and create a "loading" feel. (OWID's Grapher renders charts statically; only interactions animate.)
2. **Animate transitions between *states*, not appearances.** When the user toggles a filter or switches metrics, the bars/lines morph; when the chart first appears, it just appears.
3. **Stagger only for narrative reveal** — and even then, only on scroll-driven storytelling, never on dashboard tabs.

**Easing curves (from d3-ease, the de facto standard):**

| Use case                              | d3-ease name        | CSS equivalent                              | Duration |
| ------------------------------------- | ------------------- | ------------------------------------------- | -------- |
| Data update (filter changed)          | `easeCubicInOut`    | `cubic-bezier(0.65, 0, 0.35, 1)`            | 400–600ms |
| Hover state on chart element          | `easeQuadOut`       | `cubic-bezier(0.5, 1, 0.89, 1)`             | 120–180ms |
| Tooltip in / out                      | `easeCubicOut`      | `cubic-bezier(0.33, 1, 0.68, 1)`            | 150ms in, 80ms out |
| Page transition (route change)        | `easeCubicInOut`    | same as above                               | 250ms    |
| Scroll-triggered reveal               | `easeQuadInOut`     | `cubic-bezier(0.45, 0, 0.55, 1)`            | 300ms    |
| "Spring" / playful (avoid in data viz) | `easeBackOut`      | n/a — don't use on numerical data           | n/a      |

**Never use `easeBounce` or `easeElastic` on data charts.** They imply imprecision. Reserve for marketing flourishes only.

**Concrete library choices:**
- `framer-motion` (now Motion) for component-level transitions and layout animations — handles `LayoutGroup` for things like "filter pill morphs into chart highlight".
- `d3-transition` for chart-internal interpolation (path-tweens for line charts, arc-tweens for donuts).
- `react-spring` is also reasonable but overlaps with framer-motion; pick one.

**Reduced-motion compliance:** Honor `prefers-reduced-motion: reduce`. In framer-motion: `useReducedMotion()` returns a boolean; collapse all durations to 0 when true. This is non-negotiable for an academic-research audience that includes a11y-conscious users.

---

## 6. Layout patterns

**(a) Dashboard grid (current /, /agency, /institution).**
Reference: Datawrapper showcase pages and Pew's "Topics" hub. Pattern:
- 12-column CSS grid (`grid-cols-12 gap-6`).
- "Feature" tile = `col-span-8` (chart + headline + 2-bullet takeaway).
- 4× "supporting" tiles in `col-span-3` (KPI numbers + sparkline).
- Below: full-width chart at `col-span-12` with deep detail.

**(b) Narrative scrollytelling (target for /methodology + /trends hero).**
Reference: NYT Upshot "How Bad Are President Trump's Approval Ratings?", and OWID's article-format pages like "Life expectancy" (`https://ourworldindata.org/life-expectancy`).
Pattern: a *sticky chart* on the right (50vh), text steps on the left. Each text step triggers a chart-state change (filter, highlight, zoom). Library: `scrollama` (cheap and ubiquitous) for the trigger, framer-motion for the chart state morphs.

**(c) "Feature + supporting" composition (Pew + Bloomberg).**
A hero chart with 60% of the visual weight, then 3–4 supporting micro-charts in a row below. The supporting charts are *all the same shape* (e.g., all small line charts, 200×80, identical scales) — this is *small multiples* and it scales perception linearly.

**(d) Sidebar metadata.**
OWID's chart pages have a right-rail "Reuse this work" + "Sources" + "Download" stack. For Herd Survey, every chart should expose: download CSV, download PNG, copy permalink, view methodology, view source provenance (we already have provenance data — *surface it visually*).

**(e) Section ribbons.**
Pew uses a thin colored ribbon (4px) at the top of each section, color-coded to the section taxonomy (Politics = navy, Religion = green, etc.). For Herd Survey: agency-section ribbons in the agency categorical palette — NSF page gets a teal ribbon, NIH gets crimson.

---

## 7. Density principles — insight per square inch

**Small multiples (Tufte's gift).** Whenever you'd put 7 series on one chart, instead make 7 small charts in a 3×3 grid, sharing one y-axis at the left. Example: instead of one trend line with 7 agencies, 7 mini-trends sized 220×120 each. Tufte's principle is that *the eye compares shapes faster than colors*, and a 3×3 of identical-axis sparklines is the fastest "which one is rising fastest" interface possible. OWID's "small multiples" treatment is built into Grapher (you can flip any chart to "grouped by entity").

**Sparkline columns in tables.** Every institution row in /institution gets a 60×16 sparkline of "FY2005→FY2024 federal funding" as a column. Pew puts these in their topline polling tables; Bloomberg and FT both use them in markets tables. Implementation: a `<svg>` with a single `<path>` and no axes, embedded inline with `vertical-align: middle`.

**Micro-vis in KPI tiles.** Each big-number tile gets a tiny sparkline beneath the number. The number is the *headline*; the sparkline is the *trajectory*. ~80px wide, ~24px tall, no axis, single color.

**"What this means" sub-labels.** Under every chart title: a 14px gray sub-label describing the *finding* in plain English ("Federal R&D fell 4% in real terms from FY2011 to FY2014, then recovered to surpass the FY2011 peak in FY2018"). This is the OWID house style — every chart has a one-sentence editorial summary above it.

**Use whitespace as a unit.** A `gap-6` (24px) between cards on a Herd Survey dashboard is too tight; bump to `gap-8` (32px) or `gap-10` (40px). The references all use generous gutters. Whitespace is the second-most-important design element after data ink (Tufte again).

**Avoid 3D, gradients-as-data, and shadows-on-data-elements.** Drop shadows on chart cards are fine (`shadow-sm`). Drop shadows on individual bars are forbidden — they distort perceived height.

---

## 8. Empty states and loading states

**Loading skeletons (not spinners).** When a chart is loading, render its *shape* in light gray (`#E5E7EB`): the axes, a faint placeholder of the gridlines, and 4–6 light-gray rectangles where bars will be. Animate a subtle shimmer (linear-gradient sliding left-to-right, 1.2s `easeInOut`, infinite). Reference: Datawrapper's chart-embed iframes do this — never a spinner. Library: `react-content-loader` or a hand-rolled SVG skeleton.

**Empty states with a real message.** "No NSF awards found for the selected filters" — explain *why* (the institution had no awards in this period, or this combination of filters has no data), and offer *one* clear action ("Clear filters" button). Pew's interactive tools always provide this; NYT Upshot's calculators do too.

**Progressive disclosure.** If a chart needs heavy data, load the *summary view* first (annual totals) and lazy-load the *detail* (monthly breakdowns) only when the user expands. Datawrapper embeds work this way under the hood.

**Error states.** Distinct from empty: "Couldn't load FY2024 data — likely a temporary CDN issue. Retry." with a retry button. Use a neutral icon (not red, not skull-and-crossbones) and a calm tone.

---

## 9. Dark mode considerations

Bloomberg Graphics defaults to dark; FT and NYT default to light. OWID supports both via CSS variables. For the Herd Survey we should aim for *both modes with chart palette adjustments*, not just a global background flip.

**Color shifts that have to happen in dark mode:**

| Element                    | Light                 | Dark                          |
| -------------------------- | --------------------- | ----------------------------- |
| Background                 | `#FFFFFF`             | `#15191E`                     |
| Surface (card)             | `#FAFAFA`             | `#1E2530`                     |
| Border                     | `#E5E7EB`             | `#2A3340`                     |
| Body text                  | `#262A33`             | `#E1E5EB`                     |
| Muted text                 | `#6B7280`             | `#8B95A1`                     |
| Categorical primary (teal) | `#066F8A`             | `#3B9FBE` (lighter, less sat) |
| Categorical accent (red)   | `#DC2626`             | `#FF6B7A`                     |
| Sequential ramp            | starts `#F0F7F9`      | starts `#1F3A47`              |
| Diverging midpoint         | `#EEEBE3`             | `#3A3F47`                     |
| Reference-line             | `#9CA3AF`             | `#6B7280`                     |
| Annotation highlight box   | `#FFF7ED`             | `#3A2A0E`                     |

**Key rules:**
- **Saturation drops in dark mode** by roughly 15–25% on the same hue. A 90%-sat teal that pops on white becomes a glaring stripe on near-black; dial it back.
- **Categorical colors get *lighter* in dark mode** (the inverse of light mode). Bright pastels on dark > deep saturated on dark.
- **Gridlines invert.** Light mode has `#F3F4F6` gridlines; dark mode has `#2A3340`.
- **Don't invert chart annotations.** A red callout stays red — but use the dark-mode red (#FF6B7A), not the light-mode red.

**Storage strategy:** define the entire palette as CSS variables (`--color-cat-1` etc.), set them in `:root[data-theme=light]` and `:root[data-theme=dark]`. Charts read CSS variables, so a theme toggle is one DOM attribute change. Tailwind 4's `@theme` directive handles this cleanly.

---

## 10. The five patterns to copy first — maximum impact, minimum effort

Ranked by impact-per-hour-of-work:

**1. Direct labeling + "gray everything else" highlight (4 hours work).**
On every multi-line trend chart, kill the color-key legend, label series at the right end with the series color, and add a one-line callout to highlight *the story line*. This single change is the largest visual-sophistication jump available — it's the difference between "dashboard" and "data journalism." Datawrapper's chart-types guide explicitly calls this out as the most underused pattern.

**2. Per-chart "What this shows" sub-label + source caption (2 hours).**
Under every chart title, a 14px gray sub-label ("Federal obligations fell 4% in real terms from FY2011 to FY2014, then recovered…"). Under every chart, a 12px footer with `Source: NSF NCSES | Vintage: 2024-12 | Methodology: /methodology#federal-funds`. OWID does this on every Grapher chart and it's the single biggest *trust* signal a dashboard can emit.

**3. Numeric typography discipline — Plex Mono + tabular figures + one canonical formatter (3 hours).**
Swap Geist Mono for IBM Plex Mono, add `font-variant-numeric: tabular-nums` globally to anything numeric, and write one `formatDollars(n, mode)` utility used everywhere. Add an `Intl.NumberFormat`-based formatter that produces `$48.2B`, `$487M`, `$92.5K`, `$12,500` from the same input depending on context. This is the difference between feeling like a CSV viewer and feeling like a publication.

**4. Annotated reference lines on /trends (4 hours).**
Add a horizontal dashed line at "FY2014 trough" with a small right-edge label, and a tinted vertical band over the ARRA stimulus years (FY2009–FY2011). Two `<ReferenceLine>` and one `<ReferenceArea>` per chart. Zero new dependencies. The narrative payoff is enormous — the chart suddenly has a *story* without a single word of body text.

**5. Sparkline columns in /institution table (5 hours).**
Replace one of the table's numeric columns with a 80×24 inline sparkline of "FY2005→FY2024 federal funding" per institution. Use the same gray + one-highlight pattern: line is gray by default, turns red on row hover. Pew, Bloomberg, and FT all use sparkline columns in their data tables; it transforms a table from "spreadsheet" to "scannable insight grid."

**Honorable mentions (do after the top 5):**
- A serif headline face (Source Serif 4) on H1 + KPI sub-labels.
- Sankey diagram on the /agency landing — agency → institution → state flow.
- Dark mode with palette swap (a week's work, but high perceived sophistication).
- Scrollytelling treatment on /methodology — sticky chart, step-driven highlights.

---

## Appendix — Library and tooling recommendations

**Charts:** keep Recharts for the standard line/bar/donut (it's fine), but **add Visx** (`@visx/*`) for the advanced charts. Visx is the d3-as-React-primitives library that NYT and Airbnb use internally; it composes cleanly with Recharts. For sankey/treemap specifically, `@nivo/sankey` and `@nivo/treemap` ship beautiful defaults.

**Observable Plot** (`@observablehq/plot`) is the third option — much terser API than d3, very strong defaults, MIT-licensed. Worth evaluating for prototyping.

**Type loading:** load Source Serif 4 + IBM Plex Mono via `next/font/google` (zero CLS, self-hosted automatically). Add `font-display: swap` fallback.

**Color tooling:**
- ColorBrewer 2.0 (`colorbrewer2.org`) for sequential and diverging ramps.
- CartoColor (`carto.com/carto-colors`) for categorical palettes.
- Viz Palette (`projects.susielu.com/viz-palette`) to stress-test against tiny lines and large areas.
- Color Oracle (desktop) and Sim Daltonism (macOS) for live colorblind simulation.

**Annotation library:** `d3-annotation` (Susie Lu's) is the canonical library — handles callouts with leader lines, tinted boxes, and threshold lines. Composes with Visx easily.

**Scrollytelling:** `scrollama` (Russell Goldenberg, ex-Pudding) is the most popular and the lightest. Use for /methodology + any future "data essay" pages.

**A11y:** every chart needs a `<title>` + `<desc>` in the SVG, plus a `<figcaption>` below explaining the chart in prose. NSF NCSES (the source we're remixing) does keyboard-navigation on their charts and it's worth matching. Use the `role="img"` + `aria-labelledby` pattern.

**Source files referenced in this brief:**
- OWID: `https://ourworldindata.org` and `https://ourworldindata.org/grapher/life-expectancy`
- NYT Upshot: `https://www.nytimes.com/section/upshot` and `https://www.nytimes.com/spotlight/graphics`
- FT Visual Journalism: `https://ig.ft.com` (redirects to multimedia)
- Pew: `https://www.pewresearch.org`
- Datawrapper Color Guide: `https://blog.datawrapper.de/colorguide/`
- Datawrapper Beautiful Colors: `https://blog.datawrapper.de/beautifulcolors/`
- Datawrapper Text in Vis: `https://blog.datawrapper.de/text-in-data-visualizations/`
- Datawrapper Chart Types Guide: `https://blog.datawrapper.de/chart-types-guide/`
- Datawrapper May 26 Dispatch (most recent): `https://blog.datawrapper.de/data-vis-dispatch-may-26-2026/`
- Observable D3 Gallery: `https://observablehq.com/@d3/gallery`
- d3-ease (motion): `https://github.com/d3/d3-ease`
- Specific chart components: `@d3/sankey`, `@d3/treemap`, `@d3/ridgeline-plot`, `@d3/slope-chart`, `@d3/beeswarm`, `@d3/calendar-view`, `@d3/streamgraph`, `@d3/sunburst` (all on `observablehq.com/@d3/<name>`)
