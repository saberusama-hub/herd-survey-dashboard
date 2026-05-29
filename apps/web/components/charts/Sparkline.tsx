'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';

interface Props {
  data: Array<{ x: number | string; y: number | null }>;
  height?: number;
  width?: number;
  color?: string;
}

export function Sparkline({ data, height = 24, width = 80, color = 'hsl(var(--accent))' }: Props) {
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
