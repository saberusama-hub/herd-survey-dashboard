'use client';

import * as Plot from '@observablehq/plot';
import { useEffect, useRef } from 'react';

interface ScatterMatrixProps {
  /** Rows: one object per entity. */
  data: Array<Record<string, number | string | null>>;
  /** Numeric columns to facet on. Produces n × n grid of pairwise scatters. */
  numericKeys: string[];
  /** Optional categorical column for coloring. */
  colorKey?: string;
  /** Optional label key (for tooltips). */
  labelKey?: string;
  /** Inches/px for the whole matrix. */
  width?: number;
  height?: number;
}

/**
 * Observable Plot scatter matrix. Each pair of `numericKeys` produces one
 * scatter panel. Used by /correlations "scatter matrix mode".
 */
export function ScatterMatrix({
  data,
  numericKeys,
  colorKey,
  labelKey,
  width = 700,
  height = 700,
}: ScatterMatrixProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.innerHTML = '';

    if (data.length === 0 || numericKeys.length < 2) {
      el.innerHTML =
        '<div style="padding: 1rem; color: hsl(var(--text-tertiary)); font-size: 12px;">Need ≥ 2 metrics + ≥ 1 row.</div>';
      return;
    }

    // Build long-format records for facet x/y
    const pairs: Array<{ x: number; y: number; fx: string; fy: string; color?: string; label?: string }> = [];
    for (const row of data) {
      for (const fx of numericKeys) {
        for (const fy of numericKeys) {
          const xv = row[fx];
          const yv = row[fy];
          if (typeof xv === 'number' && typeof yv === 'number') {
            pairs.push({
              x: xv,
              y: yv,
              fx,
              fy,
              color: colorKey ? String(row[colorKey] ?? '') : undefined,
              label: labelKey ? String(row[labelKey] ?? '') : undefined,
            });
          }
        }
      }
    }

    const plot = Plot.plot({
      width,
      height,
      marginLeft: 60,
      marginBottom: 40,
      fx: { label: null, padding: 0.06 },
      fy: { label: null, padding: 0.06 },
      x: { grid: true, ticks: 3, label: null },
      y: { grid: true, ticks: 3, label: null },
      color: colorKey
        ? {
            type: 'categorical',
            scheme: 'Tableau10',
          }
        : undefined,
      style: {
        background: 'transparent',
        fontFamily: 'var(--font-sans), system-ui',
        color: 'hsl(var(--text-secondary))',
      },
      marks: [
        Plot.dot(pairs, {
          x: 'x',
          y: 'y',
          fx: 'fx',
          fy: 'fy',
          fill: colorKey ? 'color' : 'hsl(var(--accent))',
          fillOpacity: 0.6,
          r: 2.5,
          title: labelKey ? 'label' : undefined,
        }),
        Plot.axisX({ fontSize: 9 }),
        Plot.axisY({ fontSize: 9 }),
      ],
    });

    el.appendChild(plot);
    return () => {
      plot.remove();
    };
  }, [data, numericKeys, colorKey, labelKey, width, height]);

  return <div ref={ref} />;
}
