'use client';

import { useDuckDB } from '@/app/providers';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { UniversitySearchBox } from '@/components/editorial/UniversitySearchBox';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { StackedBar } from '@/components/charts/StackedBar';
import { query } from '@/lib/duckdb';
import { formatDollars } from '@/lib/format';
import {
  type UniversityIndexRow,
  getNationalOverview,
  getUniversityIndex,
} from '@/lib/queries';
import type { Row } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

// Canonical source-category ordering and palette for the national stacked bar.
// federal=accent (hero), then a categorical sweep across agency tokens so each
// source reads distinctly from the others.
const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'] as const;
const SOURCE_COLORS: Record<string, string> = {
  federal: 'hsl(var(--accent))',
  state: 'hsl(var(--agency-doe))',
  industry: 'hsl(var(--agency-dod))',
  institutional: 'hsl(var(--agency-nasa))',
  nonprofit: 'hsl(var(--agency-usda))',
  other: 'hsl(var(--mute-1))',
};

interface MetaRow extends Row {
  unis: number;
  pis: number;
}

interface OverviewRow extends Row {
  fiscal_year: number;
  source_category: string;
  amount_nominal: number;
  amount_real: number;
}

export default function HomePage() {
  const { ready } = useDuckDB();
  const [top10, setTop10] = useState<UniversityIndexRow[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [meta, setMeta] = useState<MetaRow | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([
      getUniversityIndex(),
      getNationalOverview(),
      // Real counts (replacing the plan's hard-coded 800 / 250000 approximations).
      // - unis: total HERD-tracked institutions from dim_institution
      // - pis: total FY2024 distinct-PI count summed across universities from
      //   agg_uni_pi_metrics (sum of per-institution unique-PI counts).
      query<MetaRow>(`
        SELECT
          (SELECT COUNT(*) FROM dim_institution) AS unis,
          (SELECT SUM(pi_count) FROM agg_uni_pi_metrics WHERE fiscal_year = 2024) AS pis
      `),
    ]).then(([idx, ov, metaRows]) => {
      if (cancelled) return;
      setTop10(idx.slice(0, 10));
      setOverview(ov as OverviewRow[]);
      setMeta(metaRows[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // Aggregate FY2024 total across all source categories.
  const fy24Total = useMemo(
    () =>
      overview
        .filter((r) => r.fiscal_year === 2024)
        .reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0),
    [overview],
  );

  // Pivot the long-form national overview into one wide row per fiscal year,
  // with one numeric column per source category — exactly what StackedBar wants.
  const wide = useMemo(() => {
    if (overview.length === 0) return [];
    const years = Array.from(new Set(overview.map((r) => r.fiscal_year))).sort();
    return years.map((fy) => {
      const row: Record<string, number | string> = { fiscal_year: fy };
      for (const k of SOURCE_ORDER) row[k] = 0;
      for (const r of overview) {
        if (r.fiscal_year !== fy) continue;
        const k = SOURCE_ORDER.includes(r.source_category as (typeof SOURCE_ORDER)[number])
          ? r.source_category
          : 'other';
        row[k] = (Number(row[k]) || 0) + (Number(r.amount_nominal) || 0);
      }
      return row;
    });
  }, [overview]);

  return (
    <div className="container-wide pt-12 pb-20 md:pt-20 md:pb-28 space-y-14 md:space-y-20">
      {/* ─── Editorial hero ─── */}
      <header className="space-y-7 max-w-3xl">
        <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
          A data product by Research Data Platform
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-text-primary leading-[1.05] tracking-tight">
          U.S. University Research Funding
        </h1>
        <p className="text-lg md:text-xl italic text-text-secondary max-w-2xl leading-relaxed">
          Twenty years. Eight hundred institutions. Seven federal agencies. One
          data lake — queryable, exportable, reproducible.
        </p>
        <div className="pt-2">
          <UniversitySearchBox className="w-full md:max-w-xl" />
        </div>
      </header>

      {/* ─── KPI strip: 2x2 on mobile, 3-up on desktop ─── */}
      <section>
        <KpiStrip
          cols={3}
          tiles={[
            {
              label: 'Total R&D · FY2024',
              value: fy24Total > 0 ? formatDollars(fy24Total) : '—',
            },
            {
              label: 'Universities tracked',
              value: meta ? meta.unis.toLocaleString('en-US') : '—',
            },
            {
              label: 'Federal PIs · FY2024',
              value: meta ? meta.pis.toLocaleString('en-US') : '—',
            },
          ]}
        />
      </section>

      {/* ─── Top 10 leaderboard + national stacked bar ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <ChartFrame
          eyebrow="Leaderboard · FY2024"
          title="Top 10 universities by total R&D"
          dek="Click a row to view that profile."
          source="HERD totals · USD nominal"
        >
          {top10.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ol className="text-sm">
              {top10.map((r, i) => (
                <li key={r.institution_sk}>
                  <Link
                    href={`/universities/${r.institution_sk}`}
                    className="flex items-center justify-between gap-3 border-b border-rule py-2 px-2 hover:bg-mute-3 focus:bg-mute-3 focus:outline-none transition-colors"
                  >
                    <span className="flex items-baseline gap-3 min-w-0">
                      <span className="text-text-tertiary tnum text-xs w-6 flex-shrink-0">
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <span className="truncate text-text-primary">{r.name}</span>
                      {r.state && (
                        <span className="text-text-tertiary text-xs flex-shrink-0">
                          {r.state}
                        </span>
                      )}
                    </span>
                    <span className="text-accent tnum flex-shrink-0">
                      {formatDollars(r.total_rd_fy2024)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </ChartFrame>

        <ChartFrame
          eyebrow="National · FY2005–FY2024"
          title="U.S. university R&D by source, 20 years"
          dek="Federal funding leads every year; state, industry, and institutional sources fill the rest."
          source="HERD Question 1 · USD nominal"
        >
          {wide.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ResponsiveSvg height={320}>
              {(w, h) => (
                <StackedBar
                  data={wide}
                  keys={[...SOURCE_ORDER]}
                  xKey="fiscal_year"
                  colors={SOURCE_COLORS}
                  width={w}
                  height={h}
                />
              )}
            </ResponsiveSvg>
          )}
          {/* Inline legend — six small swatches so the stack is decipherable. */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
            {SOURCE_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: SOURCE_COLORS[k] }}
                />
                <span className="capitalize">{k}</span>
              </li>
            ))}
          </ul>
        </ChartFrame>
      </section>

      {/* ─── CTAs ─── */}
      <section className="flex flex-wrap gap-4">
        <Link
          href="/universities"
          className="px-5 py-2.5 rounded bg-accent text-paper hover:bg-accent-strong transition-colors text-sm font-medium"
        >
          Browse all universities &rarr;
        </Link>
        <Link
          href="/national"
          className="px-5 py-2.5 rounded border border-accent text-accent hover:bg-accent hover:text-paper transition-colors text-sm font-medium"
        >
          Explore the national view &rarr;
        </Link>
      </section>
    </div>
  );
}
