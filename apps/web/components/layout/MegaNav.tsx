import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/universities', label: 'Universities' },
  { href: '/compare', label: 'Compare' },
  { href: '/national', label: 'National view' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/downloads', label: 'Downloads' },
];

export function MegaNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/85 backdrop-blur">
      <div className="container-wide flex h-14 items-center gap-6">
        <Link
          href="/"
          className="font-serif text-[1.0625rem] font-semibold tracking-tight text-text-primary shrink-0"
        >
          Research Data Platform
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV_ITEMS.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden lg:inline text-2xs text-text-tertiary uppercase tracking-wide">
            FY2005–FY2024
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-2.5 py-1.5 rounded-md transition-colors',
        'text-text-secondary hover:text-text-primary hover:bg-accent-soft/60',
      )}
    >
      {children}
    </Link>
  );
}
