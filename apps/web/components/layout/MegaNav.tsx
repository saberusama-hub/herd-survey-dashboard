import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface SimpleLink {
  href: string;
  label: string;
}
interface DropdownItem {
  href: string;
  label: string;
  description: string;
}
interface DropdownGroup {
  label: string;
  items: DropdownItem[];
}

const PRIMARY: SimpleLink[] = [{ href: '/', label: 'Home' }];

const DROPDOWNS: DropdownGroup[] = [
  {
    label: 'Explore',
    items: [
      {
        href: '/institution',
        label: 'Institutions',
        description: 'Per-university portraits: funding mix, sources, NIH IC, PIs.',
      },
      {
        href: '/agency',
        label: 'Agencies',
        description: 'NSF, NIH, DOD, DOE and others. Recipients, activity mix, IC/lab tabs.',
      },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { href: '/trends', label: 'Trends', description: 'Plot any metric across the top cohort over 20 years.' },
      { href: '/compare', label: 'Compare', description: 'Side-by-side multi-institution small multiples.' },
      {
        href: '/correlations',
        label: 'Correlations',
        description: 'Scatter explorer with regression, residuals, scatter matrix.',
      },
      {
        href: '/reconciliation',
        label: 'Reconciliation',
        description: 'Top-down (HERD) vs bottom-up (NIH/NSF/USAS) — and why the gap is widening.',
      },
    ],
  },
];

const TAIL: SimpleLink[] = [
  { href: '/map', label: 'Map' },
  { href: '/flow', label: 'Federal Flow' },
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
          {PRIMARY.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}

          {DROPDOWNS.map((g) => (
            <NavDropdown key={g.label} group={g} />
          ))}

          {TAIL.map((l) => (
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

/**
 * Pure CSS dropdown — uses focus-within + hover so no JS state.
 * Renders as a server component so the static export prerender stays simple.
 */
function NavDropdown({ group }: { group: DropdownGroup }) {
  return (
    <div className="relative group">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'text-text-secondary hover:text-text-primary hover:bg-accent-soft/60',
        )}
      >
        <span>{group.label}</span>
        <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
      </button>
      <div
        className={cn(
          'absolute left-0 top-full pt-2 w-[360px]',
          'opacity-0 pointer-events-none transition-opacity duration-150',
          'group-hover:opacity-100 group-hover:pointer-events-auto',
          'group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
        )}
      >
        <ul className="rounded-md border border-rule bg-surface-elevated p-2 shadow-card-hover space-y-1">
          {group.items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="block rounded p-2.5 transition-colors hover:bg-accent-soft/50"
              >
                <div className="font-medium text-text-primary text-sm">{it.label}</div>
                <div className="t-caption mt-0.5">{it.description}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
