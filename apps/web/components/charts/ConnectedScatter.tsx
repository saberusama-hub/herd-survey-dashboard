'use client';

import { AXIS_STYLE } from '@/components/charts/colors';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleLinear, scaleLog } from '@visx/scale';
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
  /** Use log10 scale on the x-axis (great for dollar metrics). */
  xLog?: boolean;
  /** Use log10 scale on the y-axis. */
  yLog?: boolean;
}

/** Pad a domain by 5% on each side; for log scale, pad multiplicatively. */
function paddedDomain(min: number, max: number, log: boolean): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (log) {
    const lo = Math.max(min, 1); // log scale cannot include 0/negative
    const hi = Math.max(max, lo * 10);
    return [lo / 1.4, hi * 1.4];
  }
  if (min === max) return [min - 1, max + 1];
  const span = max - min;
  return [min - span * 0.06, max + span * 0.06];
}

/**
 * Scatter with optional y=x reference line. Used by /reconciliation
 * (FY20 BU% vs FY24 BU%) and /correlations.
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
  xLog = false,
  yLog = false,
}: Props) {
  const margin = { top: 16, right: 20, bottom: 48, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Filter to renderable points (no NaN, no log-incompatible values)
  const valid = points.filter((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    if (xLog && p.x <= 0) return false;
    if (yLog && p.y <= 0) return false;
    return true;
  });

  if (valid.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-text-tertiary text-sm rounded-md border border-rule bg-surface-elevated"
      >
        No data points to plot.
      </div>
    );
  }

  const xs = valid.map((p) => p.x);
  const ys = valid.map((p) => p.y);
  const xDomain = paddedDomain(Math.min(...xs), Math.max(...xs), xLog);
  const yDomain = paddedDomain(Math.min(...ys), Math.max(...ys), yLog);

  const x = xLog
    ? scaleLog<number>({ domain: xDomain, range: [0, innerWidth], base: 10 })
    : scaleLinear<number>({ domain: xDomain, range: [0, innerWidth], nice: true });
  const y = yLog
    ? scaleLog<number>({ domain: yDomain, range: [innerHeight, 0], base: 10 })
    : scaleLinear<number>({ domain: yDomain, range: [innerHeight, 0], nice: true });

  // Identity line endpoints: intersection of x and y domains
  const identStart = Math.max(xDomain[0], yDomain[0]);
  const identEnd = Math.min(xDomain[1], yDomain[1]);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>{`${yLabel} vs ${xLabel}`}</title>
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
        {valid.map((p, i) => (
          <Circle
            // biome-ignore lint/suspicious/noArrayIndexKey: scatter points are positionally meaningful
            key={i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.highlight ? 6 : 3.5}
            fill={p.highlight ? 'hsl(var(--highlight))' : 'hsl(var(--accent))'}
            fillOpacity={p.highlight ? 0.95 : 0.5}
            stroke={p.highlight ? 'hsl(var(--surface-elevated))' : undefined}
            strokeWidth={p.highlight ? 1.5 : 0}
          >
            {p.label ? <title>{`${p.label}: (${xFormat(p.x)}, ${yFormat(p.y)})`}</title> : null}
          </Circle>
        ))}
        {/* Annotated labels for highlighted points */}
        {valid
          .filter((p) => p.highlight && p.label)
          .map((p, i) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: small subset; positionally meaningful
              key={`hl-${i}`}
              x={x(p.x) + 9}
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
          numTicks={6}
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
          numTicks={6}
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
          y={-48}
          transform={'rotate(-90)'}
          fontSize={11}
          fontFamily="var(--font-sans), system-ui"
          fill="hsl(var(--text-secondary))"
          textAnchor="middle"
        >
          {yLabel}
        </text>
        <text
          x={innerWidth / 2}
          y={innerHeight + 40}
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
