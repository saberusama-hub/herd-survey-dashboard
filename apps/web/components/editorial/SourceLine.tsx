import type { SourceCitation } from '@/lib/sources';
import { SOURCES } from '@/lib/sources';

interface Props {
  sources: SourceCitation[];
  /**
   * Layout variant.
   *  - inline: single line, " · " between citations (chart footers).
   *  - block: bulleted list (multi-source charts, dedicated source panels).
   *  - compact: tile footer style (KPI tiles, small surfaces).
   */
  variant?: 'inline' | 'block' | 'compact';
  /** Hide the "Source(s): " label prefix (use when the wrapper provides one). */
  hideLabel?: boolean;
}

/**
 * Renders an array of {@link SourceCitation} entries as a citation footer.
 *
 * Each citation links to the publisher's homepage (or a deeper URL override).
 * The citation includes publisher acronym, dataset name, publication
 * identifier when available, and a subset description (table/column/filter).
 * A reader can Google any chunk of this and land on the raw data.
 */
export function SourceLine({ sources, variant = 'inline', hideLabel }: Props) {
  if (sources.length === 0) return null;

  const renderCite = (c: SourceCitation, i: number) => {
    const s = SOURCES[c.id];
    if (!s) return null;
    const url = c.url ?? s.homeUrl;
    return (
      <span key={`${c.id}-${i}`}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-text-secondary underline-offset-2 hover:text-accent hover:underline"
          title={`Open ${s.shortName} on ${new URL(url).hostname}`}
        >
          {s.shortName}
        </a>
        {s.identifier && <span className="text-text-tertiary"> ({s.identifier})</span>}
        {c.subset && <span className="text-text-tertiary"> — {c.subset}</span>}
      </span>
    );
  };

  // Compact variant: KPI tile footer. Single line, no bullets.
  if (variant === 'compact') {
    return (
      <span className="text-[10px] leading-snug text-text-tertiary">
        {!hideLabel && <span>Source: </span>}
        {sources.map((c, i) => (
          <span key={`${c.id}-${i}`}>
            {i > 0 && ' · '}
            {(() => {
              const s = SOURCES[c.id];
              if (!s) return null;
              return (
                <a
                  href={c.url ?? s.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent hover:underline"
                >
                  {s.shortName}
                </a>
              );
            })()}
          </span>
        ))}
      </span>
    );
  }

  // Block: multi-source bulleted list with subset detail.
  if (variant === 'block' || sources.length > 1) {
    return (
      <span className="block">
        {!hideLabel && (
          <span className="font-medium text-text-secondary">{sources.length > 1 ? 'Sources' : 'Source'}:</span>
        )}
        <ul className="mt-0.5 space-y-0.5">
          {sources.map((c, i) => (
            <li key={`${c.id}-${i}`} className="leading-snug">
              <span aria-hidden className="mr-1 text-text-tertiary">
                •
              </span>
              {renderCite(c, i)}
            </li>
          ))}
        </ul>
      </span>
    );
  }

  // Single source inline.
  return (
    <span>
      {!hideLabel && <span>Source: </span>}
      {renderCite(sources[0], 0)}
    </span>
  );
}
