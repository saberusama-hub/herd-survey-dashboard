'use client';

import { AXIS_STYLE } from '@/components/charts/colors';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Circle, Line } from '@visx/shape';

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  highlight?: boolean;
}

interface Props {
  points: ScatterPoint[];
  width?: number;
  height?: number;
  xLabel: string;
  yLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  /** Draw the y=x identity reference line. */
  showIdentityLine?: boolean;
}

/**
 * Scatter with optional y=x reference line. Used by /reconciliation
 * (FY20 BU% vs FY24 BU% — below-diagonal points are losing capture).
 */
export function ConnectedScatter({
  points,
  width = 560,
  height = 420,
  xLabel,
  yLabel,
  xFormat = (v) => v.toString(),
  yFormat = (v) => v.toString(),
  showIdentityLine = false,
}: Props) {
  const margin = { top: 16, right: 16, bottom: 44, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xDomain: [number, number] = [Math.min(...xs, 0), Math.max(...xs, 1)];
  const yDomain: [number, number] = [Math.min(...ys, 0), Math.max(...ys, 1)];

  const x = scaleLinear<number>({ domain: xDomain, range: [0, innerWidth], nice: true });
  const y = scaleLinear<number>({ domain: yDomain, range: [innerHeight, 0], nice: true });

  // Identity line: from (max(xMin,yMin)) to (min(xMax,yMax))
  const identStart = Math.max(xDomain[0], yDomain[0]);
  const identEnd = Math.min(xDomain[1], yDomain[1]);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Connected scatter</title>
      <Group left={margin.left} top={margin.top}>
        {showIdentityLine && identEnd > identStart && (
          <Line
            from={{ x: x(identStart), y: y(identStart) }}
            to={{ x: x(identEnd), y: y(identEnd) }}
            stroke="hsl(var(--text-tertiary))"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}
        {points.map((p, i) => (
          <Circle
            // biome-ignore lint/suspicious/noArrayIndexKey: scatter points are positionally meaningful
            key={i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.highlight ? 6 : 4}
            fill={p.highlight ? 'hsl(var(--highlight))' : 'hsl(var(--accent))'}
            fillOpacity={p.highlight ? 0.95 : 0.55}
            stroke={p.highlight ? 'hsl(var(--surface-elevated))' : undefined}
            strokeWidth={p.highlight ? 1.5 : 0}
          >
            {p.label ? <title>{`${p.label}: (${xFormat(p.x)}, ${yFormat(p.y)})`}</title> : null}
          </Circle>
        ))}
        {/* labels for highlighted points */}
        {points
          .filter((p) => p.highlight && p.label)
          .map((p, i) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: small subset; positionally meaningful
              key={`hl-${i}`}
              x={x(p.x) + 8}
              y={y(p.y) + 3}
              fontSize={11}
              fontFamily="var(--font-sans), system-ui"
              fill="hsl(var(--text-primary))"
              fontWeight={500}
            >
              {p.label}
            </text>
          ))}
        <AxisLeft
          scale={y}
          tickFormat={(v) => yFormat(Number(v))}
          numTicks={5}
          stroke="hsl(var(--border))"
          tickStroke="hsl(var(--text-tertiary))"
          tickLabelProps={() => ({
            fill: AXIS_STYLE.stroke,
            fontSize: AXIS_STYLE.fontSize,
            fontFamily: AXIS_STYLE.fontFamily,
            textAnchor: 'end',
            dx: -4,
            dy: 4,
          })}
        />
        <AxisBottom
          top={innerHeight}
          scale={x}
          tickFormat={(v) => xFormat(Number(v))}
          numTicks={5}
          stroke="hsl(var(--border))"
          tickStroke="hsl(var(--text-tertiary))"
          tickLabelProps={() => ({
            fill: AXIS_STYLE.stroke,
            fontSize: AXIS_STYLE.fontSize,
            fontFamily: AXIS_STYLE.fontFamily,
            textAnchor: 'middle',
          })}
        />
        <text
          x={-innerHeight / 2}
          y={-40}
          transform={`rotate(-90)`}
          fontSize={11}
          fontFamily="var(--font-sans), system-ui"
          fill="hsl(var(--text-secondary))"
          textAnchor="middle"
        >
          {yLabel}
        </text>
        <text
          x={innerWidth / 2}
          y={innerHeight + 36}
          fontSize={11}
          fontFamily="var(--font-sans), system-ui"
          fill="hsl(var(--text-secondary))"
          textAnchor="middle"
        >
          {xLabel}
        </text>
      </Group>
    </svg>
  );
}
