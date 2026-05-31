'use client';

import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Circle, Line } from '@visx/shape';

export interface SlopeRow {
  label: string;
  left: number;
  right: number;
  highlight?: boolean;
}

interface Props {
  rows: SlopeRow[];
  leftLabel: string;
  rightLabel: string;
  width?: number;
  height?: number;
  format?: (v: number) => string;
}

/**
 * Slope chart (Tufte) — shows rank/value change between two columns.
 * Each row becomes a labeled line connecting (leftX, leftValue) → (rightX, rightValue).
 */
export function SlopeChart({
  rows,
  leftLabel,
  rightLabel,
  width = 480,
  height = 360,
  format = (v) => v.toString(),
}: Props) {
  if (rows.length === 0) return null;

  const margin = { top: 28, right: 100, bottom: 24, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allValues = rows.flatMap((r) => [r.left, r.right]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  const y = scaleLinear<number>({ domain: [min, max], range: [innerHeight, 0], nice: true });

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Slope chart connecting left and right values per row"
    >
      <title>Slope chart</title>
      <Group left={margin.left} top={margin.top}>
        {/* column headers */}
        <text
          x={0}
          y={-10}
          fontSize={12}
          fontFamily="var(--font-sans), system-ui"
          fill="hsl(var(--text-secondary))"
          textAnchor="middle"
          fontWeight={500}
        >
          {leftLabel}
        </text>
        <text
          x={innerWidth}
          y={-10}
          fontSize={12}
          fontFamily="var(--font-sans), system-ui"
          fill="hsl(var(--text-secondary))"
          textAnchor="middle"
          fontWeight={500}
        >
          {rightLabel}
        </text>

        {rows.map((r) => {
          const yl = y(r.left);
          const yr = y(r.right);
          const stroke = r.highlight ? 'hsl(var(--highlight))' : 'hsl(var(--text-tertiary))';
          const strokeWidth = r.highlight ? 2 : 1;
          const opacity = r.highlight ? 1 : 0.45;
          return (
            <Group key={r.label}>
              <Line
                from={{ x: 0, y: yl }}
                to={{ x: innerWidth, y: yr }}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
              />
              <Circle cx={0} cy={yl} r={3} fill={stroke} fillOpacity={opacity} />
              <Circle cx={innerWidth} cy={yr} r={3} fill={stroke} fillOpacity={opacity} />
              {/* left label */}
              <text
                x={-12}
                y={yl + 3}
                fontSize={11}
                fontFamily="var(--font-sans), system-ui"
                fill={r.highlight ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))'}
                textAnchor="end"
                fontWeight={r.highlight ? 500 : 400}
              >
                {r.label}
              </text>
              {/* right value */}
              <text
                x={innerWidth + 12}
                y={yr + 3}
                fontSize={11}
                fontFamily="var(--font-mono), monospace"
                fill={r.highlight ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))'}
                fontWeight={r.highlight ? 500 : 400}
              >
                {format(r.right)}
              </text>
            </Group>
          );
        })}
      </Group>
    </svg>
  );
}
