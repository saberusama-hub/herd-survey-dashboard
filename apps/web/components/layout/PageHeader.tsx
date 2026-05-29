import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="space-y-3 pb-2">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          {eyebrow && <p className="h-card text-accent">{eyebrow}</p>}
          <h1 className="h-section">{title}</h1>
          {description && <p className="text-text-secondary text-base max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
