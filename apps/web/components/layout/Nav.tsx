import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/trends', label: 'Trends' },
  { href: '/institution', label: 'Institutions' },
  { href: '/agency', label: 'Agencies' },
  { href: '/states', label: 'Map' },
  { href: '/flow', label: 'Flow' },
  { href: '/reconciliation', label: 'Reconciliation' },
  { href: '/nih', label: 'NIH' },
  { href: '/compare', label: 'Compare' },
  { href: '/correlations', label: 'Correlations' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/downloads', label: 'Downloads' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="container-wide flex h-14 items-center gap-8">
        <Link
          href="/"
          className="font-serif text-[1.0625rem] font-semibold tracking-tight text-text-primary"
        >
          Research Data Platform
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-accent-soft transition-colors',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:inline text-2xs text-text-tertiary uppercase tracking-wide">
            FY2005–FY2024
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
