import { KpiStrip } from '@/components/home/KpiStrip';

export default function HomePage() {
  return (
    <div className="container-wide py-12 md:py-20 space-y-12">
      <section className="space-y-4">
        <p className="h-card text-accent">Federal R&amp;D · 2005 – 2024</p>
        <h1 className="h-display max-w-3xl">
          Two decades of federal research funding to U.S. universities, reconciled across seven sources.
        </h1>
        <p className="max-w-2xl text-text-secondary text-lg">
          HERD, USAS, NIH ExPORTER, NSF Awards, SBIR.gov, Federal Funds, BLS CPI — joined on a single canonical
          institution graph and a single agency graph. Everything you see is queryable, exportable, and reproducible.
        </p>
      </section>

      <section>
        <KpiStrip />
      </section>

      <section className="max-w-2xl text-text-secondary">
        <p>
          This is the foundation page. Trends, institution profiles, the federal flow Sankey, cross-source
          reconciliation, and the correlation builder will live above this in the navigation as they ship.
        </p>
      </section>
    </div>
  );
}
