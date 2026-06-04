'use client';

import type { ReactNode } from 'react';

import type { SourceCitation } from '@/lib/sources';
import { useInView } from '@/lib/use-in-view';

import { SourceLine } from './SourceLine';

export interface KpiTile {
  label: string;
  /** Pre-formatted value (e.g., '$1.2B'). */
  value: string;
  /** Pre-formatted delta (e.g., '+12% YoY'). */
  delta?: string;
  /** Optional accessory under the value/delta — sparkline, note, etc. */
  hint?: ReactNode;
  /**
   * Upstream federal source(s) that produced this tile's value. Rendered as a
   * compact footer with link to publisher homepage.
   */
  sources?: SourceCitation[];
}

interface Props {
  tiles: KpiTile[];
  /** Number of columns at the lg breakpoint. Defaults to min(tiles.length, 4). */
  cols?: 2 | 3 | 4;
}

/**
 * Borderless KPI strip: each tile is a hairline-topped cell with a confident
 * tabular number, an uppercase eyebrow label, and an optional hint + source
 * footer. The hairline shifts to accent on hover for a quiet lift.
 *
 * Spec §4.3 pattern #3 — values are formatted upstream; this component
 * never decides number style.
 */
export function KpiStrip({ tiles, cols }: Props) {
  const c = cols ?? (Math.min(tiles.length, 4) as 2 | 3 | 4);
  const gridClass = c === 2 ? 'grid-cols-2' : c === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
  const { ref, inView } = useInView();

  return (
    <div ref={ref} className={`grid ${gridClass} gap-x-6 gap-y-8 sm:gap-x-10`}>
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className="reveal flex flex-col"
          data-state={inView ? 'visible' : undefined}
          style={inView ? { transitionDelay: `${i * 60}ms` } : undefined}
        >
          <div className="surface-tile group">
            <p className="t-eyebrow mb-3 transition-colors group-hover:text-accent">{t.label}</p>
            <p className="t-num-tile">{t.value}</p>
            {t.delta && <p className="mt-1.5 text-[12px] text-text-secondary tabular-nums">{t.delta}</p>}
            {t.hint && <div className="mt-2.5 text-[12px] leading-snug text-text-secondary">{t.hint}</div>}
          </div>
          {t.sources && t.sources.length > 0 && (
            <div className="mt-3 pt-2">
              <SourceLine sources={t.sources} variant="compact" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
