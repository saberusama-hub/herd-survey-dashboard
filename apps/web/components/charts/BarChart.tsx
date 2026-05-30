'use client';

import { formatFy, formatUsd } from '@/lib/formatters';
import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
}: Props) {
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
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? colorFor(i)}
            stackId={stacked ? 'stack' : undefined}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
