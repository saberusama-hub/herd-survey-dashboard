# Frontend Charting Architecture — Recharts MVP → "Super Professional"

> Research dossier for upgrading the Herd Survey Dashboard (Next.js 14 static export, TypeScript strict, DuckDB-WASM, Tailwind v3, shadcn/ui) from a Recharts-only MVP to a production-grade analytical surface supporting Sankey, treemap, brushable lines, scatter matrices, slope/dumbbell/ridgeline, calendar heatmaps, improved choropleths, animated transitions, and rich annotations.

**TL;DR — the new stack:**
- **Workhorse (everything except specialty diagrams):** Visx (`@visx/*`)
- **Specialty hierarchical / dense interactivity (Sankey, sunburst, ridgeline, calendar):** Apache ECharts via `echarts-for-react`, dynamic-imported and tree-shaken
- **Composable "grammar of graphics" prototyping & small-multiples:** Observable Plot
- **Animation:** Framer Motion (a.k.a. Motion for React) for layout/transition; Visx's built-in `react-spring` for tween-scale
- **Virtualization:** `@tanstack/react-virtual` (TanStack Virtual v3)
- **Recharts:** keep for the 3 chart types you already ship (line/bar/donut on small data) until incrementally retired

---

## 1. Recommended Primary Chart Library — **Visx**

### Why Visx wins for *our* stack

| Constraint | Visx | Observable Plot | Nivo | ECharts |
|---|---|---|---|---|
| `output: 'export'` static SSR | Native (SVG, no `window`) | Native (`Plot.plot()` returns DOM, SSR OK) | OK (SVG variants only) | Works but client-only WebGL paths break SSR |
| TypeScript strict | First-class, exported types per package | Decent (`@types/observablehq__plot`) | Good, but inconsistent across `@nivo/*` | Strong (`echarts` ships its own `.d.ts`) but option-object schema is loose |
| Bundle size (tree-shake) | Best — each chart primitive is its own `@visx/<x>` package, 10-25 KB gz | Single ~95 KB gz dump (no tree-shake) | Per-chart packages, but each pulls react-spring + d3 (40-80 KB gz each) | ~330 KB gz full; ~110 KB gz with builder + per-chart `use(...)` |
| shadcn / Tailwind co-existence | Perfect — Visx is unstyled primitives, your CSS owns it | OK; needs CSS plumbing for fonts | Themed via JS objects, fights Tailwind | Themed via JS objects, fights Tailwind |
| D3-fluency reuse | Uses d3-scale, d3-shape, d3-hierarchy under the hood — direct interop | Wraps d3, less interop | Hides d3 | Hides d3 |
| Custom interactions | Build anything (you wire pointer events) | Limited (`tip`, basic `pointer` mark) | Limited unless you patch | Excellent built-in (zoom, brush, dataZoom) |
| Animation primitives | Returns `<g>` — animate with Framer Motion or react-spring | None | react-spring built-in | Built-in interpolators |

**Visx is the right "workhorse" because:**
1. **Tree-shakable.** You only pay for the marks you use. `@visx/scale` + `@visx/axis` + `@visx/shape` for a line chart is ~30 KB gz. Recharts is ~95 KB gz minimum.
2. **No styling opinions.** Tailwind classes pass through SVG `className`. shadcn tokens (`--background`, `--muted-foreground`) plug straight in.
3. **Static export friendly.** Every package renders SVG on the server with no `window` access required. With `dynamic({ ssr: true })` you get crawlable charts.
4. **TS-strict ready.** Generic `<Bar<Datum>>`, `<LinePath<Datum>>` etc. carry your DuckDB row types end-to-end.
5. **Composable.** When you need something Visx doesn't ship (e.g. dumbbell), you compose `<Line>`, `<Circle>` and `<AxisLeft>` in 40 lines. The d3-hierarchy + react paradigm is the same library — no impedance mismatch.

**The single legitimate weakness:** Visx ships no Sankey *layout solver* (only `@visx/sankey` v3.x which is a thin wrapper around d3-sankey). Sankey rendering is fine, but interactive Sankeys (drag-reorder nodes, hover-trace flow) take real work. For that one chart we delegate to ECharts.

### Why not the others (as primary):
- **Observable Plot** — gorgeous DX for one-off charts, but: no event API for hover/click in React, no built-in legend interaction, and the "one giant component" model fights React state. Use it for small-multiples and exploratory pages, not the main dashboards.
- **Nivo** — beautiful out of the box, but bundle bloat is real (Sankey alone is ~85 KB gz including duplicated d3 + react-spring), and theme tokens conflict with shadcn variables.
- **ECharts** — best feature density per kilobyte but it's an *imperative* canvas-first system; type-safety on the option object is weaker, and styling lives inside a JS config tree instead of Tailwind classes. We keep it surgically for the 4 specialty chart types where it's truly best-in-class.

---

## 2. Per-Chart-Type Recommendations

| Chart type | Library | Package(s) | Bundle (gz, incremental) | Rationale |
|---|---|---|---|---|
| **Sankey (Federal R&D flow)** | ECharts | `echarts/core` + `SankeyChart` + `TooltipComponent` | ~55 KB gz | Best-in-class interactive Sankey: drag-to-reorder, focus-trace, smooth transitions. Visx version requires hand-rolling drag UX. |
| **Sunburst / Treemap** | ECharts (sunburst) / Visx (treemap) | `SunburstChart` (~25 KB) / `@visx/hierarchy` (~12 KB) | 25 / 12 | ECharts sunburst is great for zoomable drilldowns. Treemap is well-served by `@visx/hierarchy` (d3-hierarchy + react). |
| **Brushable + zoomable line (20-yr series)** | Visx | `@visx/brush` + `@visx/shape` + `@visx/scale` + `@visx/axis` | ~38 KB | Full pointer-event control; integrates with Zustand store for shared FY range. ECharts dataZoom is nicer OOTB but adds 90 KB. |
| **Scatter plot matrix (4-6 metrics)** | Observable Plot | `@observablehq/plot` | ~95 KB (one-time) | Plot's `Plot.plot({ facet, marks: [Plot.dot(...)] })` is two lines per panel. Worth its bundle if used on 2+ pages. Otherwise Visx small-multiples. |
| **Slope chart (FY-to-FY rank)** | Visx | `@visx/shape` + `@visx/axis` (you already paid for these) | 0 (re-uses) | Just `<LinePath>` between two x-positions. Hand-rolled in ~60 lines. |
| **Dumbbell chart** | Visx | `@visx/shape` + `@visx/group` | 0 (re-uses) | `<Line>` + two `<Circle>` per row. No library needed. |
| **Ridgeline plot** | ECharts | `LineChart` + `VisualMapComponent` | 0 if already loaded | ECharts has a clean idiom: small-multiple stacked area with vertical offset; `visualMap` does the color band. Visx works but you write the layout yourself. |
| **Calendar / year heatmap** | ECharts | `CalendarComponent` + `HeatmapChart` | ~25 KB | ECharts owns this category — `series.type: "heatmap"` with `coordinateSystem: "calendar"` does the GitHub-contribution look natively. Visx would be 200+ lines. |
| **Choropleth (improved, AK/HI insets)** | Keep `react-simple-maps` + d3-geo, add insets | (already installed) | 0 | Build insets via custom `d3-geo.geoAlbersUsa()` projection (it includes AK/HI insets) or render two extra `<ComposableMap>` for AK/HI. For county-level, swap to `us-atlas/counties-10m.json` (4.5 MB, lazy-loaded). |
| **Animated transitions on filter** | Framer Motion (layout) + `@visx/react-spring` (`AnimatedAxis`, `AnimatedGrid`, `AnimatedLineSeries` from `@visx/xychart`) | `framer-motion` | ~35 KB gz | Already justified in §3. |
| **Annotations** | Custom `<Annotation>` primitive (see §4) | 0 | 0 | Reusable cross-library. |
| **Small-multiples grid (faceted)** | Observable Plot OR Visx + CSS Grid | — | — | Plot's `fx`/`fy` facets are native. Visx alternative: render N `<svg>` in a CSS-Grid wrapper. |

---

## 3. Animation Library — **Framer Motion** (now branded "Motion for React")

### Verdict

**Use Framer Motion for *layout/page-level* animation. Use `@visx/react-spring` (which wraps react-spring) for *chart-internal* tweens (axis ticks, bar heights, line interpolation). Use CSS-only for hover states and skeletons.**

### Justification
| Concern | Framer Motion | React Spring | CSS-only |
|---|---|---|---|
| Bundle (gz) | ~35 KB | ~25 KB | 0 |
| API ergonomics | `motion.div animate={{ x: 100 }}` — declarative, prop-based | `useSpring({ x: 100 })` — hook-based, imperative | `transition:` + class swap |
| Layout animations (FLIP) | Built-in via `layout` prop | Manual | Painful |
| Chart numeric tweens | OK but no value-interpolation hooks like `useTransform` were designed for SVG `<path d=...>`, you can but it's awkward | Best — `useSpring` with `interpolate` for `path` `d` attributes | Impossible |
| Gesture support | Best (drag, pan, hover, focus) | None | Minimal |
| SSR safety | Yes (static export OK) | Yes | Yes |
| Reduced-motion | Built-in `useReducedMotion()` | `useReducedMotion()` | Manual `prefers-reduced-motion` |

**Framer Motion wins for the dashboard chrome** — card enter/exit, filter pill animation, tab transitions, modal sheets — because of the `layout` prop and gesture system. **React Spring (via `@visx/react-spring`)** wins inside charts because Visx already supports it as a first-class option and you get smoothly animated axes/lines for free.

### Code sketch: filter-change animation on a card

```tsx
// apps/web/components/charts/AnimatedChartCard.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

export function AnimatedChartCard({
  filterKey,         // bump to retrigger
  children,
}: {
  filterKey: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={filterKey}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      layout
      className="rounded-xl border bg-card p-4 shadow-sm"
    >
      {children}
    </motion.div>
  );
}
```

And inside a Visx chart, animated y-axis using react-spring (via Visx's xychart):

```tsx
import { AnimatedAxis, AnimatedGrid, AnimatedLineSeries, XYChart, Tooltip }
  from "@visx/xychart";

<XYChart xScale={{ type: "time" }} yScale={{ type: "linear" }} height={320}>
  <AnimatedGrid columns={false} numTicks={6} />
  <AnimatedAxis orientation="bottom" />
  <AnimatedAxis orientation="left" />
  <AnimatedLineSeries dataKey="federal" data={rows}
    xAccessor={d => d.fy_date} yAccessor={d => d.amount} />
  <Tooltip snapTooltipToDatumX snapTooltipToDatumY showVerticalCrosshair />
</XYChart>
```

---

## 4. Annotation System — A Cross-Library `<Annotation>` Primitive

Goal: one component you can drop on top of *any* chart (Visx, ECharts, Plot) that takes data-space coordinates and renders text/line/arrow/band callouts. The trick is to standardize on a **render-prop providing the chart's scales**.

```tsx
// apps/web/components/charts/Annotation.tsx
"use client";
import { type ReactNode } from "react";

export type DataPoint = { x: number | Date; y: number };
export type Bounds   = { left: number; top: number; width: number; height: number };
export type ScaleFn  = (v: number | Date) => number;

export interface AnnotationContext {
  xScale: ScaleFn;
  yScale: ScaleFn;
  bounds: Bounds;
}

export interface AnnotationProps {
  ctx: AnnotationContext;
  kind: "point" | "line-h" | "line-v" | "band-x" | "band-y" | "callout";
  at?: DataPoint;           // for point/callout
  from?: DataPoint;         // for band
  to?: DataPoint;
  value?: number | Date;    // for line-h/line-v
  label?: string;
  sublabel?: string;
  dx?: number; dy?: number; // text offset
  color?: string;           // tailwind token, e.g. "var(--primary)"
  arrow?: boolean;
}

export function Annotation(p: AnnotationProps): ReactNode {
  const { ctx, kind, label, color = "currentColor" } = p;
  switch (kind) {
    case "line-h": {
      const y = ctx.yScale(p.value as number);
      return (
        <g>
          <line x1={ctx.bounds.left} x2={ctx.bounds.left + ctx.bounds.width}
                y1={y} y2={y}
                stroke={color} strokeDasharray="3 3" strokeWidth={1}
                className="opacity-70" />
          {label && <text x={ctx.bounds.left + ctx.bounds.width - 4}
                          y={y - 4} textAnchor="end"
                          className="fill-muted-foreground text-[11px]">{label}</text>}
        </g>
      );
    }
    case "band-x": {
      const x1 = ctx.xScale(p.from!.x), x2 = ctx.xScale(p.to!.x);
      return (
        <g>
          <rect x={Math.min(x1, x2)} y={ctx.bounds.top}
                width={Math.abs(x2 - x1)} height={ctx.bounds.height}
                fill={color} opacity={0.08} />
          {label && <text x={(x1 + x2) / 2} y={ctx.bounds.top + 12}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[11px]">{label}</text>}
        </g>
      );
    }
    case "callout": {
      const cx = ctx.xScale(p.at!.x), cy = ctx.yScale(p.at!.y);
      const tx = cx + (p.dx ?? 24), ty = cy + (p.dy ?? -16);
      return (
        <g>
          <circle cx={cx} cy={cy} r={4} fill={color} />
          {p.arrow && (
            <line x1={cx} y1={cy} x2={tx} y2={ty}
                  stroke={color} strokeWidth={1} markerEnd="url(#arrow)" />
          )}
          <text x={tx + 4} y={ty}
                className="fill-foreground text-[12px] font-medium">{label}</text>
          {p.sublabel && (
            <text x={tx + 4} y={ty + 14}
                  className="fill-muted-foreground text-[10px]">{p.sublabel}</text>
          )}
        </g>
      );
    }
    // ...line-v, band-y, point omitted for brevity
    default: return null;
  }
}

// Define the arrow marker once in the chart's <defs>:
export const ArrowMarkerDefs = () => (
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
    </marker>
  </defs>
);
```

**Usage in a Visx chart:**
```tsx
<svg>
  <ArrowMarkerDefs />
  {/* ... your visx marks ... */}
  <Annotation ctx={{ xScale, yScale, bounds }} kind="line-h"
              value={300_000} label="NIH cap" color="var(--primary)" />
  <Annotation ctx={{ xScale, yScale, bounds }} kind="band-x"
              from={{ x: new Date("2020-03-01"), y: 0 }}
              to={{ x: new Date("2022-12-31"), y: 0 }}
              label="COVID emergency funding" color="var(--destructive)" />
  <Annotation ctx={{ xScale, yScale, bounds }} kind="callout" arrow
              at={{ x: new Date("2022-10-01"), y: 12_400_000 }}
              dx={28} dy={-30}
              label="CHIPS Act surge" sublabel="+38% YoY" />
</svg>
```

**Usage with ECharts:** ECharts has its own `markLine` / `markArea` / `graphic`, so use those natively. The primitive above is for the Visx side of the codebase — that's where we'll have the most charts.

---

## 5. Layout System — **CSS Grid** with `[grid-template-areas]`, NOT react-grid-layout

| Option | Verdict |
|---|---|
| **react-grid-layout** | No. Drag-and-drop dashboards have a real cost (~50 KB gz, heavy DOM, hard to SSR). Save it for "user-customizable dashboards" v2. |
| **Masonry (`react-masonry-css`)** | No. Masonry packs vertically and reflows on resize — bad for analytical dashboards where users compare two charts side-by-side. |
| **CSS Grid + `grid-template-areas`** | **Yes.** Static export friendly, zero JS, Tailwind classes do it inline, responsive via container queries. |

```tsx
// apps/web/components/dashboard/DashboardGrid.tsx
export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        grid gap-4
        grid-cols-12 auto-rows-[minmax(180px,auto)]
        @container/dash
      "
      style={{
        gridTemplateAreas: `
          "kpi kpi kpi kpi  kpi kpi  trend trend trend trend trend trend"
          "map map map map  map map  trend trend trend trend trend trend"
          "map map map map  map map  bar   bar   bar   bar   bar   bar"
          "tbl tbl tbl tbl  tbl tbl  tbl   tbl   tbl   tbl   tbl   tbl"
        `,
      }}
    >
      {children}
    </div>
  );
}

// And children carry style={{ gridArea: 'trend' }}.
```

For responsive collapse, swap `grid-template-areas` in a `@media` block or use `@container` queries (Tailwind v3.4 supports `@container` with the official plugin).

---

## 6. Performance Strategy — Many Charts, One Page, Next.js Static Export

### Recipe (in priority order)

1. **Code-split every chart with `dynamic()`.** Each chart is its own bundle.
   ```tsx
   const ChartSankeyFederalRD = dynamic(
     () => import("@/components/charts/SankeyFederalRD"),
     { ssr: false, loading: () => <ChartSkeleton h={420} /> }
   );
   ```
   For static export, `ssr: false` is fine for client-only viz that depend on DuckDB. For SEO-critical above-the-fold charts (KPI cards, hero line), keep `ssr: true` and render to SVG server-side via Visx (no `window` needed).

2. **Intersection Observer + lazy mount.** Don't run the DuckDB query for a chart that's off-screen.
   ```tsx
   // apps/web/components/charts/LazyChart.tsx
   "use client";
   import { useEffect, useRef, useState, type ReactNode } from "react";

   export function LazyChart({
     children, rootMargin = "200px", placeholder,
   }: { children: ReactNode; rootMargin?: string; placeholder?: ReactNode }) {
     const ref = useRef<HTMLDivElement>(null);
     const [visible, setVisible] = useState(false);
     useEffect(() => {
       const el = ref.current; if (!el) return;
       const io = new IntersectionObserver(
         ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
         { rootMargin }
       );
       io.observe(el); return () => io.disconnect();
     }, [rootMargin]);
     return <div ref={ref} className="min-h-[180px]">{visible ? children : placeholder}</div>;
   }
   ```
   Wrap each chart cell:
   ```tsx
   <LazyChart placeholder={<ChartSkeleton h={320} />}>
     <ChartBrushableLine />
   </LazyChart>
   ```

3. **DuckDB query memoization.** Cache by query string + filter hash in a Zustand store keyed `[queryHash, fyRange, agencyFilter]`. DuckDB-WASM Arrow results are immutable — re-use them across React renders.

4. **TanStack Virtual** for any table or list with >100 rows.
   ```tsx
   const rowV = useVirtualizer({
     count: rows.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 36,
     overscan: 6,
   });
   ```
   For the institution-detail page where you may render 4,000 university rows, this is non-negotiable.

5. **Sample-down for previews.** For a 125k-row scatter (`sheet_06`), don't render 125k SVG circles. Use `SELECT … USING SAMPLE 5000 ROWS` for the preview, and switch to a 2D-binned density (Plot's `Plot.density()` or ECharts' `heatmap`) for the full view. SVG breaks at ~10k nodes; canvas at ~250k.

6. **Move heavy aggregations into DuckDB.** Instead of `data.filter(...).reduce(...)` in JS, write the SQL:
   ```ts
   const r = await conn.query(`
     SELECT fy, SUM(amount) AS total
     FROM fact_federal_funds
     WHERE agency = '${agency}'
     GROUP BY fy ORDER BY fy
   `);
   ```
   Arrow → typed array → straight into Visx scales. No intermediate object allocation.

7. **`next.config.mjs` modularizeImports** for ECharts to enforce per-component imports if you ever import from `echarts` root:
   ```js
   modularizeImports: {
     "echarts": { transform: "echarts/charts/{{member}}" },
   }
   ```
   But the recommended pattern is to always import explicitly:
   ```ts
   import * as echarts from "echarts/core";
   import { SankeyChart } from "echarts/charts";
   import { TooltipComponent } from "echarts/components";
   import { SVGRenderer } from "echarts/renderers";
   echarts.use([SankeyChart, TooltipComponent, SVGRenderer]);
   ```
   **Use the SVG renderer, not canvas**, so static-export crawlers see the marks and you don't ship a canvas polyfill.

8. **Bundle audit ritual.** Add `@next/bundle-analyzer`, target <250 KB gz first-load on any chart page. Re-run on each new chart import.

---

## 7. Code Sketches — Top 3 New Chart Types

### 7.1 Sankey (Federal R&D Flow) — ECharts

```tsx
// apps/web/components/charts/SankeyFederalRD.tsx
"use client";
import { useMemo, useRef } from "react";
import { useQuery } from "@/lib/duckdb/useQuery";
import * as echarts from "echarts/core";
import { SankeyChart } from "echarts/charts";
import { TooltipComponent, TitleComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react/lib/core";

echarts.use([SankeyChart, TooltipComponent, TitleComponent, SVGRenderer]);

type FlowRow = { source: string; target: string; value: number };

export function SankeyFederalRD({ fy }: { fy: number }) {
  const { data, status } = useQuery<FlowRow>(
    `
    -- 3-level flow: Department -> Agency -> Mechanism
    WITH dept_agency AS (
      SELECT department AS source, agency AS target, SUM(amount) AS value
      FROM fact_federal_funds
      WHERE fy = ${fy} AND department <> agency
      GROUP BY 1, 2
    ),
    agency_mech AS (
      SELECT agency AS source, mechanism AS target, SUM(amount) AS value
      FROM fact_federal_funds
      WHERE fy = ${fy} AND mechanism IS NOT NULL
      GROUP BY 1, 2
    )
    SELECT * FROM dept_agency
    UNION ALL
    SELECT * FROM agency_mech
    `,
    [fy]
  );

  const option = useMemo(() => {
    if (!data) return null;
    const nodes = Array.from(
      new Set(data.flatMap(d => [d.source, d.target]))
    ).map(name => ({ name }));
    return {
      tooltip: { trigger: "item", triggerOn: "mousemove",
        valueFormatter: (v: number) => `$${(v / 1e9).toFixed(2)}B` },
      series: [{
        type: "sankey",
        data: nodes,
        links: data,
        emphasis: { focus: "adjacency" },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.5 },
        label: { color: "var(--foreground)", fontFamily: "Geist" },
        nodeAlign: "left",
        nodeGap: 12,
        draggable: true,
      }],
    };
  }, [data]);

  if (status === "loading") return <ChartSkeleton h={520} />;
  if (!option) return null;

  return (
    <div className="rounded-xl border bg-card p-2">
      <ReactECharts echarts={echarts} option={option}
        style={{ height: 520, width: "100%" }}
        opts={{ renderer: "svg" }} />
    </div>
  );
}
```

### 7.2 Brushable + Zoomable Line Chart — Visx

```tsx
// apps/web/components/charts/BrushableLine.tsx
"use client";
import { useMemo, useState } from "react";
import { scaleTime, scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath, AreaClosed } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Brush } from "@visx/brush";
import type { Bounds as BrushBounds } from "@visx/brush/lib/types";
import { extent, max } from "d3-array";
import { useQuery } from "@/lib/duckdb/useQuery";

type Row = { fy_date: Date; amount: number };

export function BrushableLine({ metric }: { metric: string }) {
  const { data } = useQuery<Row>(
    `SELECT make_date(fy, 10, 1) AS fy_date, SUM(amount) AS amount
     FROM fact_federal_funds
     WHERE metric = '${metric}'
     GROUP BY fy ORDER BY fy`,
    [metric],
    { rowMap: r => ({ fy_date: new Date(r.fy_date), amount: Number(r.amount) }) }
  );

  const [domain, setDomain] = useState<[Date, Date] | null>(null);
  const W = 820, H = 320, BRUSH_H = 60, M = { t: 16, r: 16, b: 28, l: 56 };
  const mainH = H - BRUSH_H - 24;

  const rows = data ?? [];
  const xFull = useMemo(() => scaleTime({
    domain: extent(rows, r => r.fy_date) as [Date, Date],
    range: [M.l, W - M.r],
  }), [rows]);
  const xMain = useMemo(() => scaleTime({
    domain: domain ?? (extent(rows, r => r.fy_date) as [Date, Date]),
    range: [M.l, W - M.r],
  }), [rows, domain]);
  const y = useMemo(() => scaleLinear({
    domain: [0, (max(rows, r => r.amount) ?? 0) * 1.05],
    range: [mainH - M.t, M.t],
  }), [rows, mainH]);

  return (
    <svg width={W} height={H} className="text-foreground">
      <Group>
        <AxisLeft scale={y} left={M.l} numTicks={5}
                  tickFormat={v => `$${(Number(v) / 1e9).toFixed(0)}B`}
                  stroke="currentColor" tickStroke="currentColor"
                  tickLabelProps={() => ({ fill: "currentColor", fontSize: 11 })} />
        <AxisBottom scale={xMain} top={mainH - M.t} stroke="currentColor"
                    tickStroke="currentColor"
                    tickLabelProps={() => ({ fill: "currentColor", fontSize: 11 })} />
        <LinePath data={rows} x={d => xMain(d.fy_date)} y={d => y(d.amount)}
                  stroke="var(--primary)" strokeWidth={2}
                  defined={d => d.fy_date >= xMain.domain()[0]
                             && d.fy_date <= xMain.domain()[1]} />
      </Group>
      <Group top={mainH + 16}>
        <LinePath data={rows} x={d => xFull(d.fy_date)}
                  y={d => scaleLinear({ domain: y.domain(),
                                         range: [BRUSH_H - 4, 4] })(d.amount)}
                  stroke="var(--muted-foreground)" strokeWidth={1} />
        <Brush xScale={xFull} yScale={scaleLinear({ domain: [0, 1],
                                                     range: [BRUSH_H, 0] })}
               width={W - M.l - M.r} height={BRUSH_H} margin={{ left: M.l }}
               onChange={(b: BrushBounds | null) => {
                 if (!b) { setDomain(null); return; }
                 setDomain([b.x0 as Date, b.x1 as Date]);
               }}
               selectedBoxStyle={{ fill: "var(--primary)", fillOpacity: 0.12,
                                    stroke: "var(--primary)" }} />
      </Group>
    </svg>
  );
}
```

### 7.3 Scatter Plot Matrix (SPLOM) — Observable Plot

```tsx
// apps/web/components/charts/ScatterMatrix.tsx
"use client";
import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";
import { useQuery } from "@/lib/duckdb/useQuery";

const METRICS = ["herd_total", "doctorates", "postdocs", "faculty"] as const;
type Metric = typeof METRICS[number];
type Row = Record<Metric, number> & { institution: string; carnegie: string };

export function ScatterMatrix() {
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery<Row>(`
    SELECT institution, carnegie,
           herd_total, doctorates, postdocs, faculty
    FROM fact_institution_year
    WHERE fy = (SELECT MAX(fy) FROM fact_institution_year)
      AND herd_total IS NOT NULL
  `);

  useEffect(() => {
    if (!ref.current || !data) return;
    // long-form for facet pairs
    const long = data.flatMap(r =>
      METRICS.flatMap(mx =>
        METRICS.map(my => ({ ...r, mx, my, vx: r[mx], vy: r[my] }))
      )
    );
    const chart = Plot.plot({
      width: 720, height: 720,
      marginLeft: 56, marginBottom: 40,
      grid: true, inset: 6,
      style: { background: "transparent",
               color: "var(--foreground)", fontFamily: "Geist" },
      fx: { domain: METRICS, label: null, axis: "top" },
      fy: { domain: METRICS, label: null },
      x:  { type: "log", label: null },
      y:  { type: "log", label: null },
      color: { legend: true, scheme: "tableau10" },
      marks: [
        Plot.frame({ stroke: "var(--border)" }),
        Plot.dot(long.filter(d => d.mx !== d.my), {
          fx: "mx", fy: "my", x: "vx", y: "vy",
          fill: "carnegie", r: 2.2, opacity: 0.7,
          tip: true, title: d => `${d.institution}\n${d.mx}: ${d.vx}\n${d.my}: ${d.vy}`,
        }),
        Plot.text(long.filter(d => d.mx === d.my), {
          fx: "mx", fy: "my", frameAnchor: "middle",
          text: d => d.mx, fontSize: 13, fontWeight: 600,
        }),
      ],
    });
    ref.current.replaceChildren(chart);
    return () => chart.remove();
  }, [data]);

  return <div ref={ref} className="rounded-xl border bg-card p-2" />;
}
```

---

## 8. Migration Path — Incremental Recharts Retirement

### Inventory (current Recharts usage assumed)
- KPI line spark, monthly bar comparisons, agency donut.

### Phase plan (one PR per row, each shippable):

| Order | Page / Component | Action | Why first/last |
|---|---|---|---|
| 1 | Repo plumbing | Add `@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`, `@visx/brush`, `@visx/xychart`, `@visx/hierarchy`, `@visx/react-spring`, `framer-motion`, `@tanstack/react-virtual`. Add `echarts/core` + `echarts-for-react` + per-chart imports. Add `@observablehq/plot`. Add bundle-analyzer. | Dependencies and analyzer first; gate every later PR on no bundle regression. |
| 2 | `<LazyChart>` + `<ChartSkeleton>` + `<AnimatedChartCard>` + `<Annotation>` primitives | Land cross-cutting infrastructure. | Everything else depends on these. |
| 3 | Federal R&D Flow page | New page; ECharts Sankey. | Highest-impact new chart — gives stakeholders something to react to. |
| 4 | "Trends" page | Replace Recharts `<LineChart>` with Visx `BrushableLine`. Add Annotation usage (COVID band, CHIPS callout). | Single biggest UX uplift; FY-range selection becomes the global filter source-of-truth in Zustand. |
| 5 | Institution detail | Replace Recharts donut with Visx Pie/Arc; add Slope chart (FY-to-FY rank) and Dumbbell. | Slope/dumbbell are pure Visx primitives; no new deps. |
| 6 | Hierarchy explorer | New page: ECharts Sunburst + Visx Treemap toggle. | Showcase composition. |
| 7 | Correlation explorer | New page: Observable Plot SPLOM + Ridgeline (ECharts). | Pays back the Plot bundle by using it twice. |
| 8 | Calendar heatmap on Awards page | ECharts calendar. | Self-contained. |
| 9 | Improved choropleth | Replace `react-simple-maps` direct usage with a `<UsaMap insets>` wrapper using `d3-geo.geoAlbersUsa()` + Annotation. | Polishes existing chart. |
| 10 | Recharts removal | Delete `recharts` from package.json once no `import` remains. Reduce first-load. | Cleanup. |

### What to keep Recharts for (during migration only)
- Inline KPI sparklines if they ship before phase 4. They're 30-line components and not worth a rewrite until the dependency is being removed wholesale in phase 10.
- Once `recharts` is the only dep with no callsites, delete it.

### Gates
- After each phase, run: `pnpm build && pnpm dlx @next/bundle-analyzer`. Reject any PR that grows first-load JS on a page by >15 KB gz without a documented reason.
- Maintain a CHARTS.md mapping `page → chart components → libraries` so the team always knows what's where.

---

## 9. TypeScript Ergonomics — Library Rankings

| Library | Type quality | Notes |
|---|---|---|
| **Visx** | A+ | Generic primitives carry your row type. `LinePath<Datum>` with `accessor: (d: Datum) => number` keeps everything strict. Each package ships its own `.d.ts`. |
| **TanStack Virtual** | A | `useVirtualizer<HTMLDivElement>()` is fully typed. |
| **D3 (modular)** | A- | Each `d3-*` package has `@types/d3-*`. Generics work but are sometimes verbose. |
| **ECharts** | B+ | `EChartsOption` type exists but is wide; complex options often resolve to `any`. Tip: define a `const option = { … } satisfies EChartsOption` to get errors without losing inference. |
| **Observable Plot** | B | Has bundled types but `Plot.plot({ marks: [...] })` resolves to `(SVGSVGElement | HTMLElement) & Plot.Plot`, and mark options are loose. |
| **Nivo** | B | Per-package types exist but vary in quality. `@nivo/sankey` and `@nivo/heatmap` are well-typed; older charts less so. |
| **Recharts** | C | Generic `Tooltip` content props are mostly `any`. Often need `as` casts. |
| **Framer Motion** | A | Excellent — `motion.div`'s `animate` prop accepts the right CSS subset with type inference. |
| **React Spring** | A- | Strong inference on `useSpring`, weaker on `useTransition` chains. |

**Recommendation for our codebase:**
- Make a thin `lib/duckdb/useQuery.ts` typed hook that returns `{ data: T[] | undefined; status; error }` — the same `T` flows into all chart components.
- Co-locate per-chart row types next to the SQL: `type Row = { fy: number; amount: number }` is the contract between query and view.
- For ECharts, write **typed factories** like `makeSankeyOption(rows: FlowRow[]): EChartsOption` rather than inlining option objects in JSX — easier to test and type-check.

---

## Decision Summary (canonical list of picks)

| Concern | Pick |
|---|---|
| Primary chart library | **Visx** |
| Sankey | **ECharts** (`SankeyChart`, SVG renderer) |
| Sunburst | **ECharts** (`SunburstChart`) |
| Treemap | **Visx** (`@visx/hierarchy`) |
| Brushable line | **Visx** (`@visx/brush` + `xychart`) |
| Scatter matrix | **Observable Plot** (with `fx`/`fy` facets) |
| Slope / Dumbbell | **Visx** (composed primitives) |
| Ridgeline | **ECharts** (`LineChart` + `visualMap`) |
| Calendar heatmap | **ECharts** (`calendar` coord + `heatmap`) |
| Choropleth | **react-simple-maps + d3-geo** (keep, add Albers USA insets) |
| Animation (chrome) | **Framer Motion** |
| Animation (chart-internal) | **`@visx/react-spring`** (which is react-spring) |
| Hover/CSS transitions | CSS-only |
| Layout | **CSS Grid + grid-template-areas** |
| Virtualization | **`@tanstack/react-virtual`** |
| Lazy loading | **IntersectionObserver + `dynamic()`** |
| Bundle policy | Per-chart code-split, per-page <250 KB gz first-load |

The dashboard's analytical voice should be: **dense, fast, statically rendered when possible, and animated only when motion communicates change**. The stack above is the smallest combination of tools that lets us hit every chart type in the brief without inflating the bundle beyond what static export can comfortably serve from a CDN.
