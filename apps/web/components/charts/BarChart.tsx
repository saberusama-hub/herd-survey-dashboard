'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  Customized,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Annotation } from '@/components/editorial/Annotation';
import { formatFy, formatUsd } from '@/lib/formatters';

import { AXIS_STYLE, GRID_STYLE, colorFor } from './colors';

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
}

interface Props {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: BarSeries[];
  stacked?: boolean;
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (v: number | string) => string;
  showLegend?: boolean;
  horizontal?: boolean;
  /**
   * Index of the bar to highlight in the accent color. All other bars (within
   * the first series) render in `--mute-1`. Multi-series stacks ignore this
   * prop — use highlightIndex on the LineChart pattern instead.
   */
  highlightIndex?: number;
  /**
   * SVG-coordinate annotations rendered on top of the chart. Coordinates are
   * in the inner plotting area (i.e., relative to the chart's render origin).
   */
  annotations?: Array<{ x: number; y: number; label: string }>;
}

export function BarChart({
  data,
  xKey,
  series,
  stacked = false,
  height = 320,
  yFormat = formatUsd,
  xFormat = (v) => (typeof v === 'number' ? formatFy(v) : String(v)),
  showLegend = true,
  horizontal = false,
  highlightIndex,
  annotations,
}: Props) {
  const useHighlight = highlightIndex != null && series.length === 1;
  const accentColor = 'hsl(var(--accent))';
  const muteColor = 'hsl(var(--mute-1))';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
      >
        <CartesianGrid {...GRID_STYLE} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yFormat} />
            <YAxis
              dataKey={xKey}
              type="category"
              {...AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={140}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              {...AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={xFormat}
            />
            <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yFormat} width={64} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent-soft) / 0.4)' }}
          contentStyle={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(var(--text-secondary))', fontWeight: 500 }}
          formatter={(value: number, name: string) => [yFormat(value), name]}
          labelFormatter={(label) => (typeof label === 'number' ? formatFy(label) : String(label))}
        />
        {showLegend && series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }} />
        )}
        {series.map((s, i) => {
          const baseColor = s.color ?? colorFor(i);
          const bar = (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={baseColor}
              stackId={stacked ? 'stack' : undefined}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              {useHighlight && i === 0
                ? data.map((_, di) => (
                    <Cell
                      key={`cell-${di}`}
                      fill={di === highlightIndex ? accentColor : muteColor}
                    />
                  ))
                : null}
            </Bar>
          );
          return bar;
        })}
        {annotations && annotations.length > 0 && (
          <Customized
            component={() => (
              <g>
                {annotations.map((a, ai) => (
                  <Annotation key={ai} x={a.x} y={a.y} label={a.label} />
                ))}
              </g>
            )}
          />
        )}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
