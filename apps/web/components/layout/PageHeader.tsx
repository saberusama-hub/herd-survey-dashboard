import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Editorial page header. Hairline accent rule across the top, eyebrow chip,
 * oversized title, italic dek. Used at the top of every full-page route.
 *
 * Drama in the type scale comes from size + tracking, not from font face
 * changes — the Calibri-only constraint is preserved.
 */
export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="space-y-5 border-t border-rule pt-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow && (
            <p className="t-eyebrow text-accent">
              <span
                aria-hidden
                className="mr-2 inline-block h-1.5 w-1.5 -translate-y-[2px] rounded-full bg-accent align-middle"
              />
              {eyebrow}
            </p>
          )}
          <h1
            className="font-sans font-bold tracking-tight text-text-primary"
            style={{
              fontSize: 'clamp(2rem, 2.5vw + 1.25rem, 3.25rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
            }}
          >
            {title}
          </h1>
          {description && <p className="t-dek">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
      </div>
    </header>
  );
}
