'use client';

import { type ReactNode, useId, useState } from 'react';

import type { SourceCitation } from '@/lib/sources';

import { SourceLine } from './SourceLine';

export interface ChartMethodology {
  /** Plain-English "what this chart shows" — one sentence, no jargon. */
  what: string;
  /** Plain-English "how it's computed" — names source aggregation + formula. */
  how: string;
  /** Optional caveats / known limitations (one short note). */
  caveats?: string;
}

interface Props {
  eyebrow?: string;
  title: string;
  dek?: string;
  /**
   * Legacy free-text source. Prefer the structured {@link sources} prop, which
   * cites the upstream federal raw dataset (publisher + identifier + subset),
   * not the intermediate parquet. Kept for backward compatibility.
   */
  source?: string;
  /**
   * Structured source citations. Each entry names one upstream federal raw
   * dataset and the specific subset used (table, column, year filter).
   * Rendered as a bulleted block when multiple sources contribute, inline
   * when a single source.
   */
  sources?: SourceCitation[];
  note?: string;
  /**
   * Plain-English description of what the chart shows + how it's computed.
   * Renders behind a (?) icon next to the title. When the icon is clicked,
   * a small inline panel reveals beneath the header.
   */
  methodology?: ChartMethodology;
  children: ReactNode;
}

/**
 * Editorial chart wrapper. The container is a `<figure>` with:
 *   - a hairline top rule for structural rhythm,
 *   - an uppercase tracked eyebrow,
 *   - an oversized confident title (Calibri, tight tracking),
 *   - an italic dek for editorial voice,
 *   - the chart body, and
 *   - a citation footer that links to the upstream federal raw archive.
 *
 * Sections fade in from below on first intersection. The animation is purely
 * CSS-driven (a data-attribute flip on the wrapper) so React reconciliation
 * stays cheap.
 */
export function ChartFrame({ eyebrow, title, dek, source, sources, note, methodology, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasStructured = Array.isArray(sources) && sources.length > 0;
  const hasFooter = hasStructured || Boolean(source) || Boolean(note);

  return (
    <figure className="group/figure border-t border-rule pt-5">
      <header className="space-y-2">
        {eyebrow && <p className="t-eyebrow text-text-tertiary">{eyebrow}</p>}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3
            className="font-sans font-bold tracking-tight text-text-primary"
            style={{ fontSize: '1.375rem', lineHeight: 1.15, letterSpacing: '-0.015em' }}
          >
            {title}
          </h3>
          {methodology && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label="What this chart shows"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rule text-[11px] font-medium text-text-tertiary transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <span aria-hidden>?</span>
            </button>
          )}
        </div>
        {dek && <p className="t-dek max-w-prose">{dek}</p>}
        {methodology && open && (
          <section
            id={panelId}
            aria-label="Chart methodology"
            className="animate-fade-in-up mt-3 rounded-sm border-l-2 border-accent bg-accent/[0.03] px-4 py-3 text-[12px] leading-relaxed text-text-secondary max-w-prose space-y-1.5"
          >
            <p>
              <span className="font-semibold text-text-primary">What it shows:</span> {methodology.what}
            </p>
            <p>
              <span className="font-semibold text-text-primary">How it&rsquo;s computed:</span> {methodology.how}
            </p>
            {methodology.caveats && (
              <p>
                <span className="font-semibold text-text-primary">Caveats:</span> {methodology.caveats}
              </p>
            )}
          </section>
        )}
      </header>
      <div className="mt-5">{children}</div>
      {hasFooter && (
        <figcaption className="mt-4 border-t border-rule/60 pt-3 text-[11px] leading-relaxed text-text-tertiary">
          {hasStructured ? (
            <SourceLine
              sources={sources as SourceCitation[]}
              variant={(sources as SourceCitation[]).length > 1 ? 'block' : 'inline'}
            />
          ) : source ? (
            <span>Source: {source}</span>
          ) : null}
          {note && (
            <span className="mt-1 block">
              <span className="font-medium text-text-secondary">Note:</span> {note}
            </span>
          )}
          <span className="mt-1 block text-text-tertiary">
            Chart: Research Data Platform · Trace every number to its federal raw archive at{' '}
            <a href="/sources" className="underline-offset-2 hover:text-accent hover:underline">
              /sources
            </a>
            .
          </span>
        </figcaption>
      )}
    </figure>
  );
}
