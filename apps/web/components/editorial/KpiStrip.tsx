import type { ReactNode } from 'react';

import type { SourceCitation } from '@/lib/sources';

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
   * compact footer with link to publisher homepage. Every value on the
   * dashboard is traceable to its raw federal archive — this is the
   * tile-level surface for that.
   */
  sources?: SourceCitation[];
}

interface Props {
  tiles: KpiTile[];
  /** Number of columns at the lg breakpoint. Defaults to min(tiles.length, 4). */
  cols?: 2 | 3 | 4;
}

/**
 * Horizontal row of KPI tiles. Spec §4.3 pattern #3 — used as the hero
 * strip on profile / national pages and inside dense dashboards. Values are
 * formatted upstream so this component never decides number style.
 *
 * Each tile can declare its own upstream federal source(s) via the optional
 * `sources` prop. When provided, a compact "Source:" footer renders inside
 * the tile, linking to the publisher's homepage.
 */
export function KpiStrip({ tiles, cols }: Props) {
  const c = cols ?? (Math.min(tiles.length, 4) as 2 | 3 | 4);
  const gridClass = c === 2 ? 'grid-cols-2' : c === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col rounded border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary tnum">{t.value}</p>
          {t.delta && <p className="mt-1 text-xs text-text-secondary tnum">{t.delta}</p>}
          {t.hint && <div className="mt-2">{t.hint}</div>}
          {t.sources && t.sources.length > 0 && (
            <div className="mt-auto pt-2">
              <SourceLine sources={t.sources} variant="compact" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
