'use client';

import dynamic from 'next/dynamic';

const EChartsBase = dynamic(() => import('./EChartsBase'), { ssr: false });

export interface RidgelineRow {
  /** Row label (e.g., "FY2020"). */
  label: string;
  /** Density values per x-bin. Length must match `xBins`. */
  values: number[];
}

interface Props {
  /** Bin centers shared across all rows (x-axis). */
  xBins: number[];
  /** Rows, top-to-bottom. */
  rows: RidgelineRow[];
  height?: number;
  /** Maximum density value used to scale ridge height; defaults to data max. */
  globalMax?: number;
  xFormat?: (v: number) => string;
}

/**
 * Ridgeline chart (joyplot) — distribution over time/category.
 * Uses ECharts line area with stacked offset to give the ridgeline effect.
 */
export function Ridgeline({ xBins, rows, height = 360, globalMax, xFormat }: Props) {
  const cap = globalMax ?? Math.max(...rows.flatMap((r) => r.values));
  const rowSpacing = 1.4;

  const series = rows.map((r, i) => {
    const offset = (rows.length - 1 - i) * rowSpacing;
    return {
      type: 'line',
      name: r.label,
      data: r.values.map((v, j) => [xBins[j], offset + (v / cap) * 1.2]),
      smooth: true,
      symbol: 'none',
      areaStyle: { opacity: 0.55, color: 'hsl(var(--accent))' },
      lineStyle: { width: 1, color: 'hsl(var(--accent-strong))' },
      z: rows.length - i,
    };
  });

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 80, right: 16, top: 8, bottom: 32 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      axisLabel: {
        color: 'hsl(var(--text-tertiary))',
        formatter: xFormat ? (v: number) => xFormat(v) : undefined,
        fontFamily: 'var(--font-mono), monospace',
      },
      splitLine: { lineStyle: { color: 'hsl(var(--rule))' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.label).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'hsl(var(--text-secondary))', fontFamily: 'var(--font-mono), monospace' },
    },
    series,
  };

  return <EChartsBase option={option} height={height} />;
}
