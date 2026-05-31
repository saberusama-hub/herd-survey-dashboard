import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  dek?: string;
  source?: string;
  note?: string;
  children: ReactNode;
}

/**
 * Editorial chart wrapper. Renders a Bloomberg / Economist-style header
 * (eyebrow, title, dek) above the chart and a single-line source / note
 * footer below.
 *
 * Spec section 4.3 pattern #1 — every chart is wrapped in this frame.
 */
export function ChartFrame({ eyebrow, title, dek, source, note, children }: Props) {
  return (
    <figure className="space-y-3">
      <header className="space-y-1">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{eyebrow}</p>
        )}
        <h3 className="text-[17px] font-semibold text-text-primary">{title}</h3>
        {dek && <p className="text-sm italic text-text-secondary max-w-prose">{dek}</p>}
      </header>
      <div>{children}</div>
      {(source || note) && (
        <figcaption className="border-t border-rule pt-2 text-[11px] text-text-tertiary">
          {source && <span>Source: {source}</span>}
          {source && note && <span> · </span>}
          {note && <span>Note: {note}</span>}
          <span> · Chart: Research Data Platform</span>
        </figcaption>
      )}
    </figure>
  );
}
