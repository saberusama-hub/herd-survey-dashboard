'use client';

import { type ReactNode, useId, useState } from 'react';

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
  source?: string;
  note?: string;
  /**
   * Plain-English description of what the chart shows + how it's computed.
   * Renders behind a (?) icon next to the title. When the icon is clicked,
   * a small inline panel reveals beneath the header.
   *
   * S3 layman-description feature.
   */
  methodology?: ChartMethodology;
  children: ReactNode;
}

/**
 * Editorial chart wrapper. Renders a Bloomberg / Economist-style header
 * (eyebrow, title, dek) above the chart and a single-line source / note
 * footer below.
 *
 * Spec section 4.3 pattern #1 — every chart is wrapped in this frame.
 *
 * Phase S3: optional `methodology` prop adds a (?) icon next to the title.
 * Clicking it reveals a plain-language "what this is / how computed / caveats"
 * panel for layperson readers.
 */
export function ChartFrame({ eyebrow, title, dek, source, note, methodology, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <figure className="space-y-3">
      <header className="space-y-1">
        {eyebrow && <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{eyebrow}</p>}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-[17px] font-semibold text-text-primary">{title}</h3>
          {methodology && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label="What this chart shows"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rule text-[11px] font-medium text-text-tertiary hover:bg-mute-3 hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            >
              <span aria-hidden>?</span>
            </button>
          )}
        </div>
        {dek && <p className="text-sm italic text-text-secondary max-w-prose">{dek}</p>}
        {methodology && open && (
          <section
            id={panelId}
            aria-label="Chart methodology"
            className="mt-2 rounded border border-rule bg-mute-3 px-3 py-2 text-[12px] leading-relaxed text-text-secondary max-w-prose space-y-1.5"
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
