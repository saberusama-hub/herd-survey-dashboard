import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-surface">
      <div className="container-wide py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
        <div className="space-y-2 md:col-span-2">
          <div className="font-medium tracking-tight">Herd Survey</div>
          <p className="text-text-secondary max-w-md">
            20 years of federal R&amp;D funding to U.S. universities — HERD, USAS, NIH, NSF, SBIR, Federal Funds. All
            data open and reproducible.
          </p>
        </div>
        <div className="space-y-2">
          <div className="h-card">Data</div>
          <Link href="/methodology" className="block text-text-secondary hover:text-text-primary">
            Methodology
          </Link>
          <Link href="/downloads" className="block text-text-secondary hover:text-text-primary">
            Downloads
          </Link>
          <a
            href="https://github.com/samsiddy/herd-survey-dashboard"
            className="block text-text-secondary hover:text-text-primary"
          >
            GitHub
          </a>
        </div>
        <div className="space-y-2">
          <div className="h-card">Built by</div>
          <p className="text-text-secondary">Usama Afzal · NYU</p>
        </div>
      </div>
    </footer>
  );
}
