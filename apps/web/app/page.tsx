import { HomeAgencyMix } from '@/components/home/AgencyMix';
import { HomeCoverageStory } from '@/components/home/CoverageStory';
import { HomeLeaderboard } from '@/components/home/Leaderboard';
import { StoriesCarousel } from '@/components/home/StoriesCarousel';
import { StatStrip } from '@/components/home/StatStrip';

export default function HomePage() {
  return (
    <div className="container-wide pt-12 pb-20 md:pt-20 md:pb-28 space-y-16 md:space-y-20">
      {/* ─── Hero ─── */}
      <section className="space-y-5 max-w-4xl">
        <p className="h-eyebrow text-accent">Federal R&amp;D · 2005 – 2024</p>
        <h1 className="h-hero">
          Twenty years of federal research funding to U.S. universities.
        </h1>
        <p className="t-body-lg text-text-secondary max-w-2xl">
          One reconciled view across HERD, USAspending, NIH ExPORTER, NSF Awards, SBIR.gov,
          Federal Funds, and BLS CPI. Every figure is queryable, exportable, and reproducible —
          and the gaps between sources are not hidden.
        </p>
      </section>

      {/* ─── Stat strip ─── */}
      <section>
        <StatStrip />
      </section>

      {/* ─── Featured stories ─── */}
      <section className="space-y-6">
        <header className="space-y-1">
          <p className="h-eyebrow text-text-tertiary">Stories</p>
          <h2 className="h-display">Three narrative arcs in the data.</h2>
        </header>
        <StoriesCarousel />
      </section>

      {/* ─── Leaderboard ─── */}
      <section>
        <HomeLeaderboard />
      </section>

      {/* ─── Agency mix + Coverage story ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <HomeAgencyMix />
        <HomeCoverageStory />
      </section>
    </div>
  );
}
