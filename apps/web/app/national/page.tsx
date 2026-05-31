'use client';

import { useEffect, useMemo, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { LineChart } from '@/components/charts/LineChart';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { StackedBar } from '@/components/charts/StackedBar';
import { USStateMap } from '@/components/charts/USStateMap';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { PageHeader } from '@/components/layout/PageHeader';
import { largestYoY, peakYear } from '@/lib/annotations';
import { formatCount, formatDollars, formatPercent } from '@/lib/format';
import {
  getNationalAgencyTrend,
  getNationalConcentration,
  getNationalFieldMix,
  getNationalOverview,
  getNationalPiDistribution,
  getNationalStateRollup,
  getNationalTrends,
  type NationalFieldMixRow,
  type NationalPiDistributionRow,
  type NationalStateRollupRow,
  type NationalTrendRow,
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

const TREND_METRICS = [
  { key: 'total_rd_nominal', label: 'Total R&D', kind: 'dollars' as const },
  { key: 'federal_share', label: 'Federal share', kind: 'percent' as const },
  { key: 'pi_count', label: '# PIs', kind: 'count' as const },
] as const;
type TrendMetricKey = (typeof TREND_METRICS)[number]['key'];

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
  const [stateRollup, setStateRollup] = useState<NationalStateRollupRow[]>([]);
  const [fieldMix, setFieldMix] = useState<NationalFieldMixRow[]>([]);
  const [piDist, setPiDist] = useState<NationalPiDistributionRow[]>([]);
  const [trends, setTrends] = useState<NationalTrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // §5 trends explorer: which national metric to plot
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>('total_rd_nominal');

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getNationalOverview(),
      getNationalAgencyTrend(),
      getNationalConcentration(),
      getNationalStateRollup(),
      getNationalFieldMix(),
      getNationalPiDistribution(),
      getNationalTrends(),
    ])
      .then(([o, a, c, s, f, p, t]) => {
        if (cancelled) return;
        setOverview(o as OverviewRow[]);
        setAgencies(a as AgencyRow[]);
        setConcentration(c as ConcentrationRow[]);
        setStateRollup(s);
        setFieldMix(f);
        setPiDist(p);
        setTrends(t);
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

  /* ─── §4 Geography: state -> total $ map, plus top-5 leaderboard ─── */
  const stateValues = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of stateRollup) {
      if (r.state_code) m[r.state_code] = Number(r.total_rd_nominal) || 0;
    }
    return m;
  }, [stateRollup]);

  const stateSummary = useMemo(() => {
    if (stateRollup.length === 0) return null;
    const fy = Number(stateRollup[0].fiscal_year);
    const sorted = [...stateRollup].sort(
      (a, b) => Number(b.total_rd_nominal) - Number(a.total_rd_nominal),
    );
    return {
      fy,
      top5: sorted.slice(0, 5),
      nStates: sorted.length,
      total: sorted.reduce((s, r) => s + (Number(r.total_rd_nominal) || 0), 0),
    };
  }, [stateRollup]);

  /* ─── §5 Trends: pivot national trend rollup, format Y per metric ─── */
  const trendsForChart = useMemo(
    () =>
      trends.map((r) => ({
        fiscal_year: r.fiscal_year,
        total_rd_nominal: Number(r.total_rd_nominal) || 0,
        // federal_share comes back as a 0..1 fraction; render as % (0..100).
        federal_share: (Number(r.federal_share) || 0) * 100,
        pi_count: Number(r.pi_count) || 0,
      })),
    [trends],
  );

  const trendYFormat = useMemo(() => {
    const m = TREND_METRICS.find((x) => x.key === trendMetric);
    if (!m) return (v: number) => String(v);
    if (m.kind === 'dollars') return (v: number) => formatDollars(v);
    if (m.kind === 'percent') return (v: number) => `${v.toFixed(1)}%`;
    return (v: number) => formatCount(v);
  }, [trendMetric]);

  /* ─── §6 Disciplines: pivot national field mix to STEM vs non-STEM stack ─── */
  const stemStackWide = useMemo(() => {
    const byFy = new Map<number, { stem: number; non_stem: number }>();
    for (const r of fieldMix) {
      const cur = byFy.get(r.fiscal_year) ?? { stem: 0, non_stem: 0 };
      const amt = Number(r.amount_nominal) || 0;
      if (r.is_stem) cur.stem += amt;
      else cur.non_stem += amt;
      byFy.set(r.fiscal_year, cur);
    }
    return Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => ({
        fiscal_year: fy,
        stem: byFy.get(fy)?.stem ?? 0,
        non_stem: byFy.get(fy)?.non_stem ?? 0,
      }));
  }, [fieldMix]);

  const stemSummary = useMemo(() => {
    if (stemStackWide.length === 0) return null;
    const last = stemStackWide[stemStackWide.length - 1];
    const total = last.stem + last.non_stem;
    return {
      fy: Number(last.fiscal_year),
      stemShare: total > 0 ? last.stem / total : null,
    };
  }, [stemStackWide]);

  /* ─── §7 PI distribution: latest-FY decile averages ─── */
  const piDistLatest = useMemo(() => {
    if (piDist.length === 0) return { fy: null as number | null, rows: [] as { decile: number; avg_amount: number }[] };
    const latestFy = piDist.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      piDist[0].fiscal_year,
    );
    const rows = piDist
      .filter((r) => r.fiscal_year === latestFy)
      .sort((a, b) => a.decile - b.decile)
      .map((r) => ({ decile: r.decile, avg_amount: Number(r.avg_amount) || 0 }));
    return { fy: latestFy, rows };
  }, [piDist]);

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

      {/* ─── §4 Geography ─── */}
      <section
        id="geography"
        aria-labelledby="national-section-geography"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Geography"
          title="State-level rollups"
          dek="Total HERD R&D by state in the most recent fiscal year. Darker fill = more research $."
          color="hsl(var(--agency-nasa))"
        />
        <ChartFrame
          eyebrow={stateSummary ? `FY${stateSummary.fy} totals` : 'State totals'}
          title="HERD R&D by state"
          dek="Choropleth of the latest available fiscal year. Hover a state for its total; the leaderboard at right shows the top 5."
          source="agg_uni_total_rd × dim_institution"
          note={
            stateSummary
              ? `${stateSummary.nStates} states reported R&D in FY${stateSummary.fy}, totalling ${formatDollars(stateSummary.total)}.`
              : undefined
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="min-h-[360px]">
              <USStateMap values={stateValues} height={400} />
            </div>
            {stateSummary && stateSummary.top5.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-text-tertiary">
                  Top 5 states · FY{stateSummary.fy}
                </p>
                <ol className="space-y-1 text-sm tnum">
                  {stateSummary.top5.map((r, i) => (
                    <li
                      key={r.state_code}
                      className="flex justify-between border-b border-rule/60 py-1.5"
                    >
                      <span>
                        <span className="mr-2 text-text-tertiary">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="font-medium">{r.state_code}</span>
                        <span className="ml-2 text-text-tertiary">
                          {r.n_institutions} {r.n_institutions === 1 ? 'inst.' : 'insts.'}
                        </span>
                      </span>
                      <span className="text-accent">{formatDollars(r.total_rd_nominal)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </ChartFrame>
      </section>

      {/* ─── §5 Trends — multi-metric explorer ─── */}
      <section
        id="trends"
        aria-labelledby="national-section-trends"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Trends"
          title="Multi-metric explorer"
          dek="Switch the national rollup between total R&D, federal share, and distinct PI counts."
          color="hsl(var(--agency-dod))"
        />
        <ChartFrame
          eyebrow="Pick a metric"
          title="National trend, FY2005 – FY2024"
          dek="One line, one national rollup. Use the selector to flip between dollar totals, the federal $ share of all R&D, and the distinct-PI count behind NIH+NSF top grants."
          source="agg_uni_total_rd · agg_uni_source_split · agg_uni_pi_metrics"
        >
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="National metric">
            {TREND_METRICS.map((m) => {
              const active = m.key === trendMetric;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTrendMetric(m.key)}
                  className={
                    'rounded border px-3 py-1.5 text-xs ' +
                    (active
                      ? 'border-accent bg-accent text-paper'
                      : 'border-border text-text-secondary hover:border-accent hover:text-accent')
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <LineChart
            data={trendsForChart as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={[
              {
                key: trendMetric,
                label: TREND_METRICS.find((m) => m.key === trendMetric)?.label ?? trendMetric,
                color: 'hsl(var(--accent))',
              },
            ]}
            yFormat={trendYFormat}
            height={320}
            showLegend={false}
          />
        </ChartFrame>
      </section>

      {/* ─── §6 Disciplines ─── */}
      <section
        id="disciplines"
        aria-labelledby="national-section-disciplines"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Disciplines"
          title="STEM vs non-STEM nationally"
          dek="National rollup of the eight HERD field-of-science categories, collapsed to STEM and non-STEM."
          color="hsl(var(--agency-dod))"
        />
        <ChartFrame
          eyebrow="HERD Q03 field of science"
          title="National STEM vs non-STEM R&D, by fiscal year"
          dek="Each bar is one fiscal year. STEM (S&E) is the accent color; humanities + social sciences sit on top."
          source="HERD Q03 · agg_uni_field_mix"
          note={
            stemSummary && stemSummary.stemShare !== null
              ? `STEM share in FY${stemSummary.fy}: ${formatPercent(stemSummary.stemShare)} of national HERD R&D.`
              : undefined
          }
        >
          <ResponsiveSvg height={340}>
            {(w, h) => (
              <StackedBar
                data={stemStackWide}
                keys={['stem', 'non_stem']}
                xKey="fiscal_year"
                colors={{
                  stem: 'hsl(var(--accent))',
                  non_stem: 'hsl(var(--mute-1))',
                }}
                width={w}
                height={h}
                orientation="vertical"
              />
            )}
          </ResponsiveSvg>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'hsl(var(--accent))' }}
              />
              <span>STEM (S&amp;E)</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'hsl(var(--mute-1))' }}
              />
              <span>Non-STEM</span>
            </li>
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §7 PI distribution ─── */}
      <section
        id="pi-distribution"
        aria-labelledby="national-section-pis"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · PIs"
          title="PI count + $/PI distribution"
          dek="National-level decile distribution of $/PI from the top-20K NIH+NSF grants ledger. Decile 1 = lowest-funded PIs, decile 10 = highest-funded."
          color="hsl(var(--agency-nih))"
        />
        <ChartFrame
          eyebrow={piDistLatest.fy ? `FY${piDistLatest.fy} distribution` : 'PI $ distribution'}
          title="How federal $ spreads across PIs nationally"
          dek="Average dollar amount per PI in each decile of the latest-year roster, averaged across institutions (decile-of-deciles)."
          source="agg_uni_pi_distribution (top-20K NIH+NSF ledger)"
          note={
            piDistLatest.rows.length > 0
              ? `Top decile averages ${formatDollars(piDistLatest.rows[piDistLatest.rows.length - 1].avg_amount)} per PI, vs. ${formatDollars(piDistLatest.rows[0].avg_amount)} in the bottom decile.`
              : 'Coverage floor — full-universe PI distributions are higher because the ledger truncates at the top 20K grants.'
          }
        >
          <ResponsiveSvg height={280}>
            {(w, h) => (
              <DistributionPlot data={piDistLatest.rows} width={w} height={h} />
            )}
          </ResponsiveSvg>
        </ChartFrame>
      </section>
    </div>
  );
}
