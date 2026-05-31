'use client';

import { AXIS_STYLE } from '@/components/charts/colors';
import { formatDollars } from '@/lib/format';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar, Circle, Line } from '@visx/shape';

export interface DumbbellRow {
  label: string;
  /** Left/right anchor values. Negative gap = left < right; positive = left > right. */
  left: number;
  right: number;
  /** Optional sub-label (e.g., state). */
  sublabel?: string;
}

interface Props {
  rows: DumbbellRow[];
  /** Color for the "left" dot. */
  leftColor?: string;
  /** Color for the "right" dot. */
  rightColor?: string;
  /** Connector tone helper: "neutral" (default), "diverging" (highlight wide gaps), or fn(row) → string. */
  connectorColor?: string | ((row: DumbbellRow) => string);
  rowHeight?: number;
  width?: number;
  labelWidth?: number;
  xFormat?: (v: number) => string;
  /** Left/right legend labels (used in tooltips and the legend block). */
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * Horizontal dumbbell chart — one row per entity, two anchor points connected
 * by a line. Used by /reconciliation per spec 5.7 (HERD vs bottom-up gap).
 *
 * Renders as a static SVG sized to its container; uses Visx for scales and
 * shape primitives.
 */
export function Dumbbell({
  rows,
  leftColor = 'hsl(var(--cat-2))',
  rightColor = 'hsl(var(--cat-1))',
  connectorColor = 'hsl(var(--text-tertiary))',
  rowHeight = 22,
  width = 700,
  labelWidth = 220,
  xFormat = (v) => formatDollars(v),
  leftLabel = 'Left',
  rightLabel = 'Right',
}: Props) {
  if (rows.length === 0) return null;

  const marginRight = 32;
  const chartLeft = labelWidth;
  const innerWidth = width - chartLeft - marginRight;
  const height = rowHeight * rows.length + 36;

  const xMax = Math.max(...rows.flatMap((r) => [r.left, r.right]), 1);
  const xMin = Math.min(...rows.flatMap((r) => [r.left, r.right]), 0);

  const x = scaleLinear<number>({
    domain: [xMin, xMax],
    range: [0, innerWidth],
    nice: true,
  });

  const y = scaleBand<string>({
    domain: rows.map((r) => r.label),
    range: [0, rowHeight * rows.length],
    paddingInner: 0.4,
  });

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Dumbbell chart comparing start and end values per row"
    >
      <title>Dumbbell chart</title>
      <Group top={4} left={0}>
        {/* row labels */}
        {rows.map((r) => {
          const cy = (y(r.label) ?? 0) + y.bandwidth() / 2;
          return (
            <text
              key={`label-${r.label}`}
              x={chartLeft - 12}
              y={cy + 4}
              textAnchor="end"
              fontSize={11}
              fontFamily="var(--font-sans), system-ui"
              fill="hsl(var(--text-primary))"
            >
              {r.label}
              {r.sublabel ? (
                <tspan fill="hsl(var(--text-tertiary))" fontSize={10}>{` · ${r.sublabel}`}</tspan>
              ) : null}
            </text>
          );
        })}
        {/* connectors */}
        {rows.map((r) => {
          const cy = (y(r.label) ?? 0) + y.bandwidth() / 2;
          const c = typeof connectorColor === 'function' ? connectorColor(r) : connectorColor;
          return (
            <Line
              key={`conn-${r.label}`}
              from={{ x: chartLeft + x(r.left), y: cy }}
              to={{ x: chartLeft + x(r.right), y: cy }}
              stroke={c}
              strokeWidth={2}
              strokeLinecap="round"
              strokeOpacity={0.7}
            />
          );
        })}
        {/* left dots */}
        {rows.map((r) => {
          const cy = (y(r.label) ?? 0) + y.bandwidth() / 2;
          return (
            <Circle
              key={`left-${r.label}`}
              cx={chartLeft + x(r.left)}
              cy={cy}
              r={4}
              fill={leftColor}
            >
              <title>{`${r.label} — ${leftLabel}: ${xFormat(r.left)}`}</title>
            </Circle>
          );
        })}
        {/* right dots */}
        {rows.map((r) => {
          const cy = (y(r.label) ?? 0) + y.bandwidth() / 2;
          return (
            <Circle
              key={`right-${r.label}`}
              cx={chartLeft + x(r.right)}
              cy={cy}
              r={4}
              fill={rightColor}
            >
              <title>{`${r.label} — ${rightLabel}: ${xFormat(r.right)}`}</title>
            </Circle>
          );
        })}
        {/* x-axis */}
        <Group left={chartLeft} top={rowHeight * rows.length + 4}>
          <AxisBottom
            scale={x}
            numTicks={5}
            tickFormat={(v) => xFormat(Number(v))}
            stroke="hsl(var(--border))"
            tickStroke="hsl(var(--text-tertiary))"
            tickLabelProps={() => ({
              fill: AXIS_STYLE.stroke,
              fontSize: AXIS_STYLE.fontSize,
              fontFamily: AXIS_STYLE.fontFamily,
              textAnchor: 'middle',
            })}
          />
        </Group>
      </Group>
    </svg>
  );
}

/** Helper to compute connector color from gap magnitude. */
export function gapConnectorColor(absMax: number): (row: DumbbellRow) => string {
  return (row) => {
    const gap = Math.abs(row.left - row.right);
    if (absMax <= 0) return 'hsl(var(--text-tertiary))';
    const t = Math.min(1, gap / absMax);
    if (t < 0.33) return 'hsl(var(--text-tertiary))';
    if (t < 0.66) return 'hsl(var(--warning))';
    return 'hsl(var(--highlight))';
  };
}
