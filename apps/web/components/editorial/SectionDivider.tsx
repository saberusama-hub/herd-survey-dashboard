interface Props {
  /** e.g., "Section 4 · Federal funding" */
  eyebrow: string;
  title: string;
  dek?: string;
  /** CSS color or hex (defaults to accent). */
  color?: string;
}

/**
 * Editorial section divider. Renders a full-width rule, a colored bullet +
 * eyebrow, then a section title and optional dek. Used to break a long-form
 * profile / national page into named sections (spec §4.3 pattern #2).
 */
export function SectionDivider({
  eyebrow,
  title,
  dek,
  color = 'hsl(var(--accent))',
}: Props) {
  return (
    <div className="py-12">
      <div className="h-px w-full" style={{ background: color }} />
      <div className="mt-6 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary">{eyebrow}</span>
      </div>
      <h2 className="mt-2 text-2xl font-bold text-text-primary">{title}</h2>
      {dek && <p className="mt-1 text-sm italic text-text-secondary max-w-prose">{dek}</p>}
    </div>
  );
}
