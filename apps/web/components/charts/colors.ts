/** Categorical chart palette resolved from CSS vars (works in light + dark). */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
];

export function colorFor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Recharts axis/grid styling tuned to our design tokens. */
export const AXIS_STYLE = {
  stroke: 'hsl(var(--text-tertiary))',
  fontSize: 11,
  fontFamily: 'var(--font-geist-mono), monospace',
};

export const GRID_STYLE = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '0',
  vertical: false,
};
