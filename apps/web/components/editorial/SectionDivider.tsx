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
      {/* Top accent rule — confident, single-color, tight. */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="block h-[2px] w-10" style={{ background: color }} />
        <span className="t-eyebrow-lg" style={{ color }}>
          {eyebrow}
        </span>
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
