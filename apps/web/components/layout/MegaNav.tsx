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
  { href: '/national', label: 'National' },
  { href: '/topics', label: 'Topics' },
  { href: '/sbir', label: 'SBIR / STTR' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/sources', label: 'Sources' },
  { href: '/downloads', label: 'Downloads' },
];

export function MegaNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/80 backdrop-blur-md">
      <div className="container-wide flex h-16 items-center gap-8">
        <Link href="/" className="group inline-flex items-baseline gap-2 shrink-0 transition-colors hover:text-accent">
          <span
            aria-hidden
            className="block h-2 w-2 -translate-y-px rounded-full bg-accent transition-transform group-hover:scale-110"
          />
          <span className="text-[15px] font-semibold tracking-tight text-text-primary">Research Data Platform</span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
          {NAV_ITEMS.slice(1).map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden lg:inline t-eyebrow text-text-tertiary">FY2005–FY2024</span>
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
        'px-3 py-1.5 rounded-md transition-colors',
        'text-text-secondary hover:text-text-primary hover:bg-accent/5',
      )}
    >
      {children}
    </Link>
  );
}
