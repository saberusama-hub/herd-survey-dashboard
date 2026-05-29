'use client';

import { formatUsd } from '@/lib/formatters';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { colorFor } from './colors';

interface DonutDatum {
  name: string;
  value: number;
}

interface Props {
  data: DonutDatum[];
  height?: number;
  innerRadius?: number;
  showLegend?: boolean;
}

export function DonutChart({ data, height = 280, innerRadius = 60, showLegend = true }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={innerRadius + 40}
          paddingAngle={1}
          stroke="hsl(var(--surface))"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pie slice positions are stable
            <Cell key={i} fill={colorFor(i)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [formatUsd(value), name]}
        />
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--text-secondary))', paddingTop: 12 }}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
