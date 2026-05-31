'use client';

import { useEffect, useMemo, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { LineChart } from '@/components/charts/LineChart';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { StackedBar } from '@/components/charts/StackedBar';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { PageHeader } from '@/components/layout/PageHeader';
import { largestYoY, peakYear } from '@/lib/annotations';
import { formatDollars } from '@/lib/format';
import {
  getNationalAgencyTrend,
  getNationalConcentration,
  getNationalOverview,
} from '@/lib/queries';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'concentration', label: 'Concentration' },
  { id: 'geography', label: 'Geography' },
  { id: 'trends', label: 'Trends' },
  { id: 'disciplines', label: 'Disciplines' },
  { id: 'pi-distribution', label: 'PI distribution' },
];

const SOURCE_ORDER = [
  'federal',
  'state',
  'industry',
  'institutional',
  'nonprofit',
  'other',
] as const;
type SourceKey = (typeof SOURCE_ORDER)[number];

const SOURCE_LABEL: Record<SourceKey, string> = {
  federal: 'Federal',
  state: 'State & local',
  industry: 'Industry',
  institutional: 'Institutional',
  nonprofit: 'Nonprofit',
  other: 'Other',
};

const SOURCE_COLOR: Record<SourceKey, string> = {
  federal: 'hsl(var(--accent))',
  state: 'hsl(var(--seq-5))',
  industry: 'hsl(var(--seq-3))',
  institutional: 'hsl(var(--agency-doe))',
  nonprofit: 'hsl(var(--agency-usda))',
  other: 'hsl(var(--mute-1))',
};

const AGENCY_ORDER = ['NIH', 'NSF', 'DOD', 'DOE', 'NASA', 'USDA', 'Other'] as const;
type AgencyKey = (typeof AGENCY_ORDER)[number];

const AGENCY_COLOR: Record<AgencyKey, string> = {
  NIH: 'hsl(var(--agency-nih))',
  NSF: 'hsl(var(--agency-nsf))',
  DOD: 'hsl(var(--agency-dod))',
  DOE: 'hsl(var(--agency-doe))',
  NASA: 'hsl(var(--agency-nasa))',
  USDA: 'hsl(var(--agency-usda))',
  Other: 'hsl(var(--agency-other))',
};

const CONC_BUCKETS = ['top_10', 'top_25', 'top_100'] as const;
type ConcBucket = (typeof CONC_BUCKETS)[number];

const CONC_LABEL: Record<ConcBucket, string> = {
  top_10: 'Top 10',
  top_25: 'Top 25',
  top_100: 'Top 100',
};

const CONC_COLOR: Record<ConcBucket, string> = {
  top_10: 'hsl(var(--accent))',
  top_25: 'hsl(var(--agency-nih))',
  top_100: 'hsl(var(--mute-1))',
};

type OverviewRow = {
  fiscal_year: number;
  source_category: string;
  amount_nominal: number;
  amount_real: number;
};
type AgencyRow = {
  fiscal_year: number;
  agency_bucket: string;
  amount_nominal: number;
  amount_real: number;
};
type ConcentrationRow = {
  fiscal_year: number;
  bucket: string;
  share: number;
};

export default function NationalPage() {
  const { ready } = useDuckDB();
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [concentration, setConcentration] = useState<ConcentrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getNationalOverview(),
      getNationalAgencyTrend(),
      getNationalConcentration(),
    ])
      .then(([o, a, c]) => {
        if (cancelled) return;
        setOverview(o as OverviewRow[]);
        setAgencies(a as AgencyRow[]);
        setConcentration(c as ConcentrationRow[]);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /* ─── Overview pivot: rows of {fiscal_year, federal, state, ...} ─── */
  const overviewWide = useMemo(() => {
    const byFy = new Map<number, Record<string, number>>();
    for (const r of overview) {
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.source_category] = Number(r.amount_nominal) || 0;
      byFy.set(r.fiscal_year, row);
    }
    return Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number | string> = { fiscal_year: fy };
        for (const k of SOURCE_ORDER) row[k] = v[k] ?? 0;
        return row;
      });
  }, [overview]);

  /* ─── Overview totals + heuristic annotations ─── */
  const overviewSummary = useMemo(() => {
    if (overviewWide.length === 0) return null;
    const points = overviewWide.map((r) => {
      const total = SOURCE_ORDER.reduce((s, k) => s + (Number(r[k]) || 0), 0);
      return { x: Number(r.fiscal_year), y: total };
    });
    return { peak: peakYear(points), jump: largestYoY(points) };
  }, [overviewWide]);

  /* ─── Agency pivot: rows of {fiscal_year, NIH, NSF, ...} ─── */
  const agencyWide = useMemo(() => {
    const byFy = new Map<number, Record<string, number>>();
    for (const r of agencies) {
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.agency_bucket] = Number(r.amount_nominal) || 0;
      byFy.set(r.fiscal_year, row);
    }
    return Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number> = { fiscal_year: fy };
        for (const k of AGENCY_ORDER) row[k] = v[k] ?? 0;
        return row;
      });
  }, [agencies]);

  const agencySeries = useMemo(() => {
    const seen = new Set(agencies.map((a) => a.agency_bucket));
    return AGENCY_ORDER.filter((k) => seen.has(k)).map((k) => ({
      key: k,
      label: k,
      color: AGENCY_COLOR[k],
    }));
  }, [agencies]);

  /* ─── Agency leader in latest FY ─── */
  const agencyLeader = useMemo(() => {
    if (agencyWide.length === 0) return null;
    const latest = agencyWide[agencyWide.length - 1];
    let topKey: AgencyKey = 'NIH';
    let topAmt = 0;
    for (const k of AGENCY_ORDER) {
      const v = Number(latest[k]) || 0;
      if (v > topAmt) {
        topAmt = v;
        topKey = k;
      }
    }
    return { fy: Number(latest.fiscal_year), key: topKey, amount: topAmt };
  }, [agencyWide]);

  /* ─── Concentration pivot — share is 0..1, render as 0..100% ─── */
  const concentrationWide = useMemo(() => {
    const byFy = new Map<number, Record<string, number>>();
    for (const r of concentration) {
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.bucket] = Number(r.share) * 100;
      byFy.set(r.fiscal_year, row);
    }
    return Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number> = { fiscal_year: fy };
        for (const b of CONC_BUCKETS) row[b] = v[b] ?? 0;
        return row;
      });
  }, [concentration]);

  const concSeries = useMemo(
    () =>
      CONC_BUCKETS.map((b) => ({
        key: b,
        label: CONC_LABEL[b],
        color: CONC_COLOR[b],
      })),
    [],
  );

  const concSummary = useMemo(() => {
    if (concentrationWide.length === 0) return null;
    const first = concentrationWide[0];
    const last = concentrationWide[concentrationWide.length - 1];
    return {
      firstFy: Number(first.fiscal_year),
      lastFy: Number(last.fiscal_year),
      top10First: Number(first.top_10),
      top10Last: Number(last.top_10),
      top100Last: Number(last.top_100),
    };
  }, [concentrationWide]);

  return (
    <div className="container-wide pt-10 pb-24 md:pt-14 md:pb-32 space-y-6">
      <PageHeader
        eyebrow="National view"
        title="U.S. university research funding"
        description="Cross-cutting trends across all ~800 institutions in the HERD universe, FY2005 – FY2024."
      />

      {/* Anchored section nav */}
      <nav
        aria-label="National sections"
        className="sticky top-0 z-10 -mx-2 flex gap-4 overflow-x-auto border-b border-rule bg-paper/95 px-2 py-3 text-[12px] backdrop-blur"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="whitespace-nowrap text-text-secondary hover:text-accent"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {loading && (
        <p className="text-sm text-text-tertiary">Loading national rollups…</p>
      )}
      {error && (
        <p className="text-sm text-accent">Error loading data: {error}</p>
      )}

      {/* ─── §1 Overview ─── */}
      <section
        id="overview"
        aria-labelledby="national-section-overview"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Overview"
          title="Total U.S. R&D by source"
          dek="Twenty years of nationwide HERD R&D, stacked by the six reporting source categories. Federal funding is the editorial through-line."
          color="hsl(var(--accent))"
        />
        <ChartFrame
          eyebrow="HERD Q01 sources of funds"
          title="National R&D by source, FY2005–FY2024"
          dek="Each bar is one fiscal year's total HERD-reported R&D summed across every institution, stacked by source."
          source="HERD Q01 · agg_national_overview"
          note={
            overviewSummary
              ? `Peak FY${overviewSummary.peak.x} at ${formatDollars(overviewSummary.peak.y)}. Biggest year-on-year change: FY${overviewSummary.jump.x} (${overviewSummary.jump.label}).`
              : undefined
          }
        >
          <ResponsiveSvg height={400}>
            {(w, h) => (
              <StackedBar
                data={overviewWide}
                keys={[...SOURCE_ORDER]}
                xKey="fiscal_year"
                colors={SOURCE_COLOR}
                width={w}
                height={h}
                orientation="vertical"
              />
            )}
          </ResponsiveSvg>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
            {SOURCE_ORDER.map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SOURCE_COLOR[k] }}
                />
                <span>{SOURCE_LABEL[k]}</span>
              </li>
            ))}
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §2 Agencies ─── */}
      <section
        id="agencies"
        aria-labelledby="national-section-agencies"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Agencies"
          title="Federal funding by agency"
          dek="HERD Q09 — institution-reported federal R&D by funding agency, rolled up nationally."
          color="hsl(var(--agency-nih))"
        />
        <ChartFrame
          eyebrow="20-year trend"
          title="National federal R&D by agency"
          dek="Each line is one federal agency. Colors match the spec's fixed agency palette."
          source="HERD Q09 · agg_national_agency_trend"
          note={
            agencyLeader
              ? `${agencyLeader.key} was the dominant funder in FY${agencyLeader.fy} at ${formatDollars(agencyLeader.amount)}.`
              : undefined
          }
        >
          <LineChart
            data={agencyWide as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={agencySeries}
            height={360}
            directLabels
            showLegend={false}
          />
        </ChartFrame>
      </section>

      {/* ─── §3 Concentration ─── */}
      <section
        id="concentration"
        aria-labelledby="national-section-concentration"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Concentration"
          title="Top-N share of national R&D"
          dek="What share of nationwide R&D do the largest universities command? The top-10 line is the editorial focus."
          color="hsl(var(--agency-doe))"
        />
        <ChartFrame
          eyebrow="Editorial line: concentration over time"
          title="Share of total U.S. R&D held by the top 10, 25, and 100 institutions"
          dek="% of national HERD R&D each cohort accounted for in each FY."
          source="agg_national_concentration"
          note={
            concSummary
              ? `Top-10 share: ${concSummary.top10First.toFixed(1)}% in FY${concSummary.firstFy} → ${concSummary.top10Last.toFixed(1)}% in FY${concSummary.lastFy}. Top-100 in FY${concSummary.lastFy}: ${concSummary.top100Last.toFixed(1)}%.`
              : undefined
          }
        >
          <LineChart
            data={concentrationWide as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={concSeries}
            yFormat={(v) => `${v.toFixed(0)}%`}
            height={340}
            directLabels
            showLegend={false}
          />
        </ChartFrame>
      </section>

      {/* ─── §4 Geography (filled in P5.2) ─── */}
      <section
        id="geography"
        aria-labelledby="national-section-geography"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Geography"
          title="State-level rollups"
          dek="Choropleth of latest-FY total R&D by state — coming in P5.2."
          color="hsl(var(--agency-nasa))"
        />
        <p className="text-text-secondary text-sm">
          State choropleth and rankings &mdash; implemented via existing
          <code className="px-1">USStateMap</code> in P5.2.
        </p>
      </section>

      {/* ─── §5 Trends (filled in P5.2) ─── */}
      <section
        id="trends"
        aria-labelledby="national-section-trends"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Trends"
          title="Multi-metric explorer"
          dek="Switch the national rollup between total R&D, federal share, and PI counts."
          color="hsl(var(--agency-dod))"
        />
        <p className="text-text-secondary text-sm">
          Use the controls to overlay any two national metrics &mdash; coming in P5.2.
        </p>
      </section>

      {/* ─── §6 Disciplines (filled in P5.2) ─── */}
      <section
        id="disciplines"
        aria-labelledby="national-section-disciplines"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Disciplines"
          title="STEM vs non-STEM nationally"
          dek="National rollup of the eight HERD field-of-science categories."
          color="hsl(var(--agency-dod))"
        />
        <p className="text-text-secondary text-sm">
          Discipline rollup &mdash; coming in P5.2.
        </p>
      </section>

      {/* ─── §7 PI distribution (filled in P5.2) ─── */}
      <section
        id="pi-distribution"
        aria-labelledby="national-section-pis"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · PIs"
          title="PI count + $/PI distribution"
          dek="Nationwide distinct-PI count over time, plus the national $/PI decile distribution."
          color="hsl(var(--agency-nih))"
        />
        <p className="text-text-secondary text-sm">
          National PI count &mdash; coming in P5.2.
        </p>
      </section>
    </div>
  );
}
