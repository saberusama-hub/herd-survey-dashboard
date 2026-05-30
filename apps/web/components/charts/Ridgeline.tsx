'use client';

import { resolveCssVarColor } from '@/components/charts/colors';
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

  const accent = resolveCssVarColor('hsl(var(--accent))');
  const accentStrong = resolveCssVarColor('hsl(var(--accent-strong))');
  const border = resolveCssVarColor('hsl(var(--border))');
  const rule = resolveCssVarColor('hsl(var(--rule))');
  const textTertiary = resolveCssVarColor('hsl(var(--text-tertiary))');
  const textSecondary = resolveCssVarColor('hsl(var(--text-secondary))');

  const series = rows.map((r, i) => {
    const offset = (rows.length - 1 - i) * rowSpacing;
    return {
      type: 'line',
      name: r.label,
      data: r.values.map((v, j) => [xBins[j], offset + (v / cap) * 1.2]),
      smooth: true,
      symbol: 'none',
      areaStyle: { opacity: 0.55, color: accent },
      lineStyle: { width: 1, color: accentStrong },
      z: rows.length - i,
    };
  });

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 80, right: 16, top: 8, bottom: 32 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: border } },
      axisLabel: {
        color: textTertiary,
        formatter: xFormat ? (v: number) => xFormat(v) : undefined,
        fontFamily: 'Calibri, Carlito, monospace',
      },
      splitLine: { lineStyle: { color: rule } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.label).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: textSecondary, fontFamily: 'Calibri, Carlito, monospace' },
    },
    series,
  };

  return <EChartsBase option={option} height={height} />;
}
