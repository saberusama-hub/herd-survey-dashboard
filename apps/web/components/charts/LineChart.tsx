'use client';

import { LineEndLabel } from '@/components/ui/DirectLabel';
import { type TimelineEvent, colorForTone } from '@/lib/annotations';
import { formatFy, formatUsd } from '@/lib/formatters';
import {
  CartesianGrid,
  LabelList,
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
  /** Use end-of-line direct labels instead of a legend (spec section 4.3 #1). */
  directLabels?: boolean;
  /** Reference bands (ARRA, COVID, etc.) overlaid as ReferenceArea. */
  referenceBands?: TimelineEvent[];
  /** Reference lines (single-FY events). */
  referenceLines?: { x: number; label: string; tone?: TimelineEvent['tone'] }[];
  /** Right margin (auto-bumped when directLabels is on). */
  rightMargin?: number;
  /** Index of highlighted series; non-highlighted go to text-tertiary. */
  highlightIndex?: number | null;
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
}: Props) {
  const computedRightMargin = rightMargin ?? (directLabels ? 120 : 16);

  return (
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
        {showLegend && !directLabels && series.length > 1 && (
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
            >
              {directLabels && (
                <LabelList
                  dataKey={s.key}
                  content={(props) => (
                    <LineEndLabel
                      {...(props as Record<string, unknown>)}
                      label={s.label}
                      color={stroke}
                      total={data.length}
                    />
                  )}
                />
              )}
            </Line>
          );
        })}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
