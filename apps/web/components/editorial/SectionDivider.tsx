interface Props {
  /** e.g., "Section 4 · Federal funding" */
  eyebrow: string;
  title: string;
  dek?: string;
  /** CSS color or hex (defaults to accent). */
  color?: string;
}

/**
 * Editorial section divider — accent rule on top, oversized eyebrow chip,
 * confident title, optional italic dek. Used to break long-form profile /
 * national pages into named sections.
 */
export function SectionDivider({ eyebrow, title, dek, color = 'hsl(var(--accent))' }: Props) {
  return (
    <div className="mt-16 mb-8 first:mt-0">
      {/* Accent strip carries the color signal. Text stays muted so contrast is
       * always WCAG-AA against the paper background (agency colors like
       * goldenrod/plum/forest fail on text at 12px even when they pass on
       * chart fills). */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="block h-[2px] w-10" style={{ background: color }} />
        <span className="t-eyebrow-lg">{eyebrow}</span>
      </div>
      <h2
        className="mt-4 font-sans font-bold tracking-tight text-text-primary"
        style={{
          fontSize: 'clamp(1.625rem, 1.5vw + 1rem, 2.25rem)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {dek && <p className="t-dek mt-2">{dek}</p>}
    </div>
  );
}
