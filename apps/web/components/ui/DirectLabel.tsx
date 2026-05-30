import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

interface LabelProps {
  /** Label text. Truncated with ellipsis if > maxChars. */
  label: string;
  /** Color of the dot + text. */
  color: string;
  /** Max chars before truncation (default 24). */
  maxChars?: number;
  /** Render style. "line" → small color dot prefix; "swatch" → bigger square swatch. */
  variant?: 'line' | 'swatch';
  className?: string;
  style?: CSSProperties;
}

/**
 * Inline series label — the "kill the legend" pattern from spec section 4.3 #1.
 *
 * Place at the end of a line in legend rows or above a chart series.
 * For Recharts <Line> end-of-line labels, use `LineEndLabel` below.
 */
export function DirectLabelChip({ label, color, maxChars = 24, variant = 'line', className, style }: LabelProps) {
  const display = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-2xs', className)}
      style={style}
      title={label}
    >
      <span
        aria-hidden
        className={cn(variant === 'swatch' ? 'h-2.5 w-2.5 rounded-sm' : 'h-1.5 w-1.5 rounded-full')}
        style={{ background: color }}
      />
      <span className="text-text-secondary tabular-nums" style={{ color }}>
        {display}
      </span>
    </span>
  );
}

/* ───────────────── Recharts <LabelList> renderer ───────────────── */

interface LineEndProps {
  x?: number;
  y?: number;
  value?: number | string;
  index?: number;
  label?: string;
  color?: string;
  total?: number; // total points; used to detect "last point"
}

/**
 * Renderer for Recharts <LabelList content={(props) => <LineEndLabel {...} />}/>.
 *
 * Use with content factory in the <Line> like:
 *   <Line ...>
 *     <LabelList
 *       dataKey="institution_name"
 *       position="right"
 *       content={(p) => <LineEndLabel {...p} label={inst.name} color={color} total={n} />}
 *     />
 *   </Line>
 *
 * Only renders when the point is the last point in the series (so the label
 * appears only at the right edge, kills the legend).
 */
export function LineEndLabel({ x, y, index, total, label, color }: LineEndProps) {
  if (
    x === undefined ||
    y === undefined ||
    index === undefined ||
    total === undefined ||
    index !== total - 1
  ) {
    return null;
  }
  if (!label) return null;
  const display = label.length > 22 ? `${label.slice(0, 21)}…` : label;
  return (
    <g transform={`translate(${x + 6}, ${y})`}>
      <circle cx={0} cy={0} r={2} fill={color ?? 'hsl(var(--text-secondary))'} />
      <text
        x={6}
        y={3}
        fontSize={11}
        fontFamily="var(--font-sans), system-ui"
        fill={color ?? 'hsl(var(--text-secondary))'}
        style={{ fontWeight: 500 }}
      >
        {display}
      </text>
    </g>
  );
}
