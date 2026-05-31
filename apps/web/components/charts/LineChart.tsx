'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Annotation } from '@/components/editorial/Annotation';
import { type TimelineEvent, colorForTone } from '@/lib/annotations';
import { formatFy, formatUsd } from '@/lib/formatters';

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
  /** Show Recharts legend at the top. Default true for multi-series. */
  showLegend?: boolean;
  /**
   * Render a colored-dot chip row above the chart instead of (or in addition to)
   * the Recharts legend. This is the OWID/Datawrapper-style "kill the legend"
   * pattern — replaces the previous in-chart end-of-line labels (which could
   * crash on null values and overlapped when series were close together).
   */
  directLabels?: boolean;
  /** Reference bands (ARRA, COVID, etc.) overlaid as ReferenceArea. */
  referenceBands?: TimelineEvent[];
  /** Reference lines (single-FY events). */
  referenceLines?: { x: number; label: string; tone?: TimelineEvent['tone'] }[];
  /** Right margin override. */
  rightMargin?: number;
  /** Index of highlighted series; non-highlighted go to text-tertiary. */
  highlightIndex?: number | null;
  /**
   * SVG-coordinate editorial annotations rendered on top of the chart. The
   * (x, y) values are in the inner plot area (i.e., the same space the line
   * paths are drawn in). Use the heuristic helpers in `lib/annotations.ts`
   * to compute coordinates from a SeriesPoint[].
   */
  annotations?: Array<{ x: number; y: number; label: string }>;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 320,
  yFormat = formatUsd,
  xFormat = (v) => (typeof v === 'number' ? formatFy(v) : String(v)),
  showLegend = true,
  directLabels = false,
  referenceBands,
  referenceLines,
  rightMargin,
  highlightIndex = null,
  annotations,
}: Props) {
  const computedRightMargin = rightMargin ?? 16;
  const hasMultiSeries = series.length > 1;
  const renderChips = directLabels && hasMultiSeries;

  return (
    <div className="space-y-3">
      {renderChips && <SeriesChipRow series={series} highlightIndex={highlightIndex} />}
      <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 8, right: computedRightMargin, bottom: 8, left: 8 }}>
          <CartesianGrid {...GRID_STYLE} />

          {/* Reference bands first so series draw on top */}
          {referenceBands?.map((evt) => {
            const c = colorForTone(evt.tone);
            return (
              <ReferenceArea
                key={evt.id}
                x1={evt.from}
                x2={evt.to}
                fill={c.fill}
                stroke={c.stroke}
                strokeOpacity={0.3}
                strokeDasharray="2 3"
                label={{
                  value: evt.label,
                  position: 'insideTopLeft',
                  offset: 6,
                  fill: 'hsl(var(--text-tertiary))',
                  fontSize: 10,
                  fontFamily: 'var(--font-sans), system-ui',
                }}
              />
            );
          })}

          {referenceLines?.map((rl) => {
            const c = colorForTone(rl.tone ?? 'neutral');
            return (
              <ReferenceLine
                key={`${rl.x}-${rl.label}`}
                x={rl.x}
                stroke={c.stroke}
                strokeDasharray="3 3"
                label={{
                  value: rl.label,
                  position: 'top',
                  fill: 'hsl(var(--text-tertiary))',
                  fontSize: 10,
                  fontFamily: 'var(--font-sans), system-ui',
                }}
              />
            );
          })}

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
          {showLegend && !directLabels && hasMultiSeries && (
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }} iconType="line" />
          )}
          {series.map((s, i) => {
            const baseColor = s.color ?? colorFor(i);
            const stroke =
              highlightIndex === null
                ? baseColor
                : i === highlightIndex
                  ? 'hsl(var(--highlight))'
                  : 'hsl(var(--text-tertiary))';
            const opacity = highlightIndex === null || i === highlightIndex ? 1 : 0.6;
            const strokeWidth = highlightIndex !== null && i === highlightIndex ? 2.5 : 2;
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth={strokeWidth}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
      {annotations && annotations.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          <svg className="h-full w-full" role="presentation">
            {annotations.map((a, ai) => (
              <Annotation key={ai} x={a.x} y={a.y} label={a.label} />
            ))}
          </svg>
        </div>
      )}
      </div>
    </div>
  );
}

function SeriesChipRow({
  series,
  highlightIndex,
}: {
  series: LineSeries[];
  highlightIndex: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs">
      {series.map((s, i) => {
        const color = s.color ?? colorFor(i);
        const dim = highlightIndex !== null && i !== highlightIndex;
        return (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5"
            style={{ opacity: dim ? 0.55 : 1 }}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: dim ? 'hsl(var(--text-tertiary))' : color }}
            />
            <span style={{ color: dim ? 'hsl(var(--text-tertiary))' : color, fontWeight: 500 }}>
              {s.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
