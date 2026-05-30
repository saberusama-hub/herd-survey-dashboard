import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface Props {
  /** Headline. Plain string or rich React node. */
  title: ReactNode;
  /**
   * "What this shows" sub-label. One short sentence that names the finding.
   * Spec section 4.3 #2 — required for every chart.
   */
  subtitle?: ReactNode;
  /**
   * Provenance line (sources + vintage). Spec section 4.3 #2.
   * Example: "HERD (Sheet 07) · FY2005–FY2024 · USD nominal"
   */
  source?: ReactNode;
  /** Optional eyebrow above the title. */
  eyebrow?: ReactNode;
  /** Optional right-aligned action (filter chip, export button, etc.). */
  actions?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
}

/**
 * Standard chart title block — spec section 4.3 pattern #2.
 *
 * Every chart on the platform must use ChartTitle so all charts share the
 * same hierarchy: eyebrow / title / subtitle / source / actions.
 */
export function ChartTitle({
  eyebrow,
  title,
  subtitle,
  source,
  actions,
  className,
  align = 'left',
}: Props) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-6',
        align === 'center' && 'text-center justify-center',
        className,
      )}
    >
      <div className={cn('min-w-0 space-y-1', align === 'center' && 'mx-auto')}>
        {eyebrow ? <div className="h-eyebrow">{eyebrow}</div> : null}
        <h3 className="font-serif text-[1.25rem] font-semibold tracking-tight text-text-primary leading-tight">
          {title}
        </h3>
        {subtitle ? (
          <p className="t-small font-italic-serif text-text-secondary leading-snug max-w-prose">
            {subtitle}
          </p>
        ) : null}
        {source ? <p className="t-caption mt-1">{source}</p> : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
