'use client';

import { Sparkline } from '@/components/charts/Sparkline';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface KpiTileProps {
  /** Italic-serif eyebrow above the value. */
  eyebrow: string;
  /** Pre-formatted value (e.g., "$199.5B" or "1,014"). */
  value: ReactNode;
  /** Unit shown below the value (e.g., "billion"). */
  unit?: ReactNode;
  /** Pre-formatted delta string. Positive shows green, negative red. */
  delta?: string | null;
  /**
   * Sparkline data — array of {x, y} or just numbers. Plotted along the
   * bottom of the tile. Omit to hide.
   */
  sparkline?: Array<{ x: number | string; y: number | null }> | null;
  /** Sparkline color. Defaults to --accent. */
  sparklineColor?: string;
  /** Optional one-line caption under the value. */
  caption?: ReactNode;
  /** Visual variant. `bordered` adds a thin border; `flush` (default) is borderless for use in a divider grid. */
  variant?: 'bordered' | 'flush';
  /** Optional class override. */
  className?: string;
}

/**
 * Unified KPI tile primitive (spec section 6.3).
 *
 * Layout: italic-serif eyebrow / mono hero value / unit + delta / optional sparkline.
 * Designed for both standalone use and inside the Home stat strip's divider grid.
 */
export function KpiTile({
  eyebrow,
  value,
  unit,
  delta,
  sparkline,
  sparklineColor = 'hsl(var(--accent))',
  caption,
  variant = 'flush',
  className,
}: KpiTileProps) {
  const deltaTone = !delta
    ? null
    : delta.startsWith('+')
      ? 'text-positive'
      : delta.startsWith('-')
        ? 'text-negative'
        : 'text-text-tertiary';

  return (
    <div
      className={cn(
        'bg-surface-elevated p-6 flex flex-col gap-2',
        variant === 'bordered' && 'border border-border rounded-md',
        className,
      )}
    >
      <div className="font-italic-serif text-[0.8125rem] text-text-secondary leading-tight">
        {eyebrow}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="font-mono text-[2.5rem] md:text-num-hero font-medium tabular-nums tracking-tight text-text-primary leading-none">
          {value}
        </div>
        {unit ? (
          <div className="font-sans text-[0.8125rem] text-text-tertiary">{unit}</div>
        ) : null}
      </div>
      {(delta || caption) && (
        <div className="flex items-center gap-2 text-2xs">
          {delta ? <span className={cn('font-mono tabular-nums font-medium', deltaTone)}>{delta}</span> : null}
          {caption ? <span className="text-text-tertiary">{caption}</span> : null}
        </div>
      )}
      {sparkline && sparkline.length > 1 ? (
        <div className="mt-2">
          <Sparkline data={sparkline} width={160} height={28} color={sparklineColor} />
        </div>
      ) : null}
    </div>
  );
}
