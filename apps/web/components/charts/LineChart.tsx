'use client';

import { formatFy, formatUsd } from '@/lib/formatters';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_STYLE, GRID_STYLE, colorFor } from './colors';

export interface LineSeries {
  key: string;
  label: string;
  color?: string;
}

interface Props {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: LineSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (v: number | string) => string;
  showLegend?: boolean;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 320,
  yFormat = formatUsd,
  xFormat = (v) => (typeof v === 'number' ? formatFy(v) : String(v)),
  showLegend = true,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey={xKey}
          {...AXIS_STYLE}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickFormatter={xFormat}
        />
        <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yFormat} width={64} />
        <Tooltip
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
          <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }} iconType="line" />
        )}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? colorFor(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
