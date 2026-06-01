'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
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
  getNationalTeamSize,
  getNationalTopics,
  getNationalTrends,
  type NationalFieldMixRow,
  type NationalPiDistributionRow,
  type NationalStateRollupRow,
  type NationalTeamSizeRow,
  type NationalTopicRow,
  type NationalTrendRow,
} from '@/lib/queries';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'concentration', label: 'Concentration' },
  { id: 'geography', label: 'Geography' },
  { id: 'trends', label: 'Trends' },
  { id: 'disciplines', label: 'Disciplines' },
  { id: 'topics', label: 'Topics' },
  { id: 'team-size', label: 'Team size' },
  { id: 'pi-distribution', label: 'PI distribution' },
];

const TEAM_BUCKET_ORDER = ['1', '2-5', '6-10', '11-20', '21+'] as const;
type TeamBucket = (typeof TEAM_BUCKET_ORDER)[number];

const TEAM_BUCKET_LABEL: Record<TeamBucket, string> = {
  '1': 'Single PI',
  '2-5': '2-5 PIs',
  '6-10': '6-10 PIs',
  '11-20': '11-20 PIs',
  '21+': '21+ PIs',
};

const TEAM_BUCKET_COLOR: Record<TeamBucket, string> = {
  '1': 'hsl(var(--accent))',
  '2-5': 'hsl(var(--seq-3))',
  '6-10': 'hsl(var(--seq-5))',
  '11-20': 'hsl(var(--agency-doe))',
  '21+': 'hsl(var(--mute-1))',
};

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
  const [teamSize, setTeamSize] = useState<NationalTeamSizeRow[]>([]);
  const [topics, setTopics] = useState<NationalTopicRow[]>([]);
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
      getNationalTeamSize(),
      getNationalTopics(),
    ])
      .then(([o, a, c, s, f, p, t, ts, tp]) => {
        if (cancelled) return;
        setOverview(o as OverviewRow[]);
        setAgencies(a as AgencyRow[]);
        setConcentration(c as ConcentrationRow[]);
        setStateRollup(s);
        setFieldMix(f);
        setPiDist(p);
        setTrends(t);
        setTeamSize(ts);
        setTopics(tp);
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

  /* ─── §8 Topics: latest FY ranking + 20-year share for the top 10 ─── */
  const topicsView = useMemo(() => {
    if (topics.length === 0) {
      return {
        latestFy: null as number | null,
        ranked: [] as Array<{ topic: string; amount: number; share: number }>,
        top10: [] as string[],
        shareTrend: [] as Array<Record<string, number>>,
      };
    }
    const latestFy = topics.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      topics[0].fiscal_year,
    );
    const latest = topics.filter((r) => r.fiscal_year === latestFy);
    const ranked = latest
      .map((r) => ({
        topic: r.topic,
        amount: Number(r.tagged_amount) || 0,
        share: Number(r.share_of_total) || 0,
      }))
      .sort((a, b) => b.amount - a.amount);
    const top10 = ranked.slice(0, 10).map((r) => r.topic);

    // Pivot: wide per-FY rows for the top-10 only, as % share.
    const byFy = new Map<number, Record<string, number>>();
    for (const r of topics) {
      if (!top10.includes(r.topic)) continue;
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.topic] = (Number(r.share_of_total) || 0) * 100;
      byFy.set(r.fiscal_year, row);
    }
    const shareTrend = Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number> = { fiscal_year: fy };
        for (const t of top10) row[t] = v[t] ?? 0;
        return row;
      });
    return { latestFy, ranked, top10, shareTrend };
  }, [topics]);

  /* ─── §9 Team size: pivot to wide per-FY with 5 bucket columns ─── */
  const teamSizeView = useMemo(() => {
    if (teamSize.length === 0) {
      return {
        latestFy: null as number | null,
        latestRows: [] as Array<{ bucket: TeamBucket; amount: number; share: number; grants: number }>,
        trend: [] as Array<Record<string, number>>,
      };
    }
    const latestFy = teamSize.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      teamSize[0].fiscal_year,
    );
    const latest = teamSize.filter((r) => r.fiscal_year === latestFy);
    const latestRows = TEAM_BUCKET_ORDER.map((b) => {
      const row = latest.find((r) => r.team_size_bucket === b);
      return {
        bucket: b,
        amount: Number(row?.total_amount) || 0,
        share: Number(row?.share_of_total) || 0,
        grants: Number(row?.grant_count) || 0,
      };
    });
    const byFy = new Map<number, Record<string, number>>();
    for (const r of teamSize) {
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.team_size_bucket] = Number(r.total_amount) || 0;
      byFy.set(r.fiscal_year, row);
    }
    const trend = Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number> = { fiscal_year: fy };
        for (const b of TEAM_BUCKET_ORDER) row[b] = v[b] ?? 0;
        return row;
      });
    return { latestFy, latestRows, trend };
  }, [teamSize]);

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

      {/* ─── §7 Topics: 30-topic taxonomy ─── */}
      <section
        id="topics"
        aria-labelledby="national-section-topics"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Topics"
          title="What is U.S. research about?"
          dek="A 30-topic taxonomy applied to every NSF award title + abstract and every NIH project title + terms. Topics are NOT mutually exclusive — a grant can match multiple."
          color="hsl(var(--agency-doe))"
        />
        <ChartFrame
          eyebrow={topicsView.latestFy ? `FY${topicsView.latestFy} ranking` : 'Research topics'}
          title="All 30 research topics by federal $"
          dek="Total tagged dollars per topic in the most recent fiscal year. Ranking is by dollar amount; share is of total federal $ that FY (sum can exceed 100% — topics overlap)."
          source="agg_national_topic (regex-matched, non-exclusive)"
          note="Topics use word-boundary regex on title + abstract / project terms. See /methodology for the exact pattern list."
        >
          <ResponsiveSvg height={Math.max(420, topicsView.ranked.length * 22 + 40)}>
            {(w, h) => (
              <TopicBars width={w} height={h} bars={topicsView.ranked} />
            )}
          </ResponsiveSvg>
        </ChartFrame>

        <ChartFrame
          eyebrow="20-year topic share trend"
          title="Top 10 topics: share of national federal $ over time"
          dek="Share of all NSF + NIH federal dollars matching each topic, FY2005 – FY2024. Higher = topic captured a larger slice of the agency portfolio that year."
          source="agg_national_topic"
        >
          <LineChart
            data={topicsView.shareTrend as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={topicsView.top10.map((t, i) => ({
              key: t,
              label: t,
              color: [
                'hsl(var(--accent))',
                'hsl(var(--agency-nih))',
                'hsl(var(--agency-nsf))',
                'hsl(var(--agency-dod))',
                'hsl(var(--agency-doe))',
                'hsl(var(--agency-nasa))',
                'hsl(var(--agency-usda))',
                'hsl(var(--seq-3))',
                'hsl(var(--seq-5))',
                'hsl(var(--mute-1))',
              ][i % 10],
            }))}
            yFormat={(v) => `${v.toFixed(1)}%`}
            height={380}
            directLabels
            showLegend={false}
          />
        </ChartFrame>
      </section>

      {/* ─── §8 Team size ─── */}
      <section
        id="team-size"
        aria-labelledby="national-section-team-size"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · Team size"
          title="How federal funding flows by PI team size"
          dek="Five buckets — single PI, 2-5, 6-10, 11-20, 21+ — by total federal $. Single-PI grants still dominate, but multi-PI teams have grown."
          color="hsl(var(--agency-dod))"
        />
        <ChartFrame
          eyebrow={teamSizeView.latestFy ? `FY${teamSizeView.latestFy} mix` : 'Team size'}
          title="Federal $ by PI team size, latest fiscal year"
          dek="Each bar is one team-size bucket of NSF + NIH grants. Width is the bucket's total federal funding for the year."
          source="agg_national_team_size (NSF n_pi ∪ NIH PI bridge count)"
          note={
            teamSizeView.latestRows.length > 0
              ? `Single-PI grants captured ${formatPercent(teamSizeView.latestRows[0].share)} of federal $ in FY${teamSizeView.latestFy}. Multi-PI teams (2+ PIs) took the rest.`
              : undefined
          }
        >
          <ResponsiveSvg height={280}>
            {(w, h) => (
              <TeamSizeBars width={w} height={h} bars={teamSizeView.latestRows} />
            )}
          </ResponsiveSvg>
        </ChartFrame>

        <ChartFrame
          eyebrow="20-year team-size mix"
          title="Federal $ by team size, FY2005 – FY2024"
          dek="Stacked bar per FY: single-PI grants on the bottom in accent. Larger team buckets stack on top in graduated greys."
          source="agg_national_team_size"
        >
          <ResponsiveSvg height={340}>
            {(w, h) => (
              <StackedBar
                data={teamSizeView.trend}
                keys={[...TEAM_BUCKET_ORDER]}
                xKey="fiscal_year"
                colors={TEAM_BUCKET_COLOR}
                width={w}
                height={h}
                orientation="vertical"
              />
            )}
          </ResponsiveSvg>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
            {TEAM_BUCKET_ORDER.map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: TEAM_BUCKET_COLOR[k] }}
                />
                <span>{TEAM_BUCKET_LABEL[k]}</span>
              </li>
            ))}
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §9 PI distribution ─── */}
      <section
        id="pi-distribution"
        aria-labelledby="national-section-pis"
        className="scroll-mt-24"
      >
        <SectionDivider
          eyebrow="National · PIs"
          title="$/PI distribution"
          dek="National-level decile distribution of $/PI. Decile 1 = lowest-funded PIs, decile 10 = highest-funded. Counts come from the full federal-PI universe (NSF awards ∪ NIH PI bridge)."
          color="hsl(var(--agency-nih))"
        />
        <ChartFrame
          eyebrow={piDistLatest.fy ? `FY${piDistLatest.fy} distribution` : 'PI $ distribution'}
          title="How federal $ spreads across PIs nationally"
          dek="Average dollar amount per PI in each decile of the latest-year roster, averaged across institutions (decile-of-deciles)."
          source="agg_uni_pi_distribution"
          note={
            piDistLatest.rows.length > 0
              ? `Top decile averages ${formatDollars(piDistLatest.rows[piDistLatest.rows.length - 1].avg_amount)} per PI, vs. ${formatDollars(piDistLatest.rows[0].avg_amount)} in the bottom decile.`
              : undefined
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

/* ───────────── Inline visx components (kept local to the file) ──────────── */

function TopicBars({
  bars,
  width,
  height,
}: {
  bars: Array<{ topic: string; amount: number; share: number }>;
  width: number;
  height: number;
}) {
  const margin = { top: 8, right: 90, bottom: 28, left: 220 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const y = scaleBand({
    domain: bars.map((b) => b.topic),
    range: [0, innerH],
    padding: 0.15,
  });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...bars.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });
  return (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.topic) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.topic}>
              <rect x={0} y={by} width={bw} height={bh} fill="hsl(var(--accent))" rx={2} />
              <text
                x={bw + 6}
                y={by + bh / 2}
                dy="0.35em"
                className="fill-text-secondary text-[11px] tnum"
              >
                {formatDollars(b.amount)} · {formatPercent(b.share)}
              </text>
            </g>
          );
        })}
        <AxisBottom
          top={innerH}
          scale={x}
          numTicks={4}
          tickFormat={(v) => formatDollars(Number(v))}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px] tnum',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          tickLabelProps={() => ({
            className: 'fill-text-primary text-[11px]',
            textAnchor: 'end',
            dx: -6,
            dy: 4,
          })}
          hideAxisLine
          hideTicks
        />
      </Group>
    </svg>
  );
}

function TeamSizeBars({
  bars,
  width,
  height,
}: {
  bars: Array<{ bucket: TeamBucket; amount: number; share: number; grants: number }>;
  width: number;
  height: number;
}) {
  const margin = { top: 8, right: 90, bottom: 28, left: 110 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const filtered = bars.filter((b) => b.amount > 0);
  const y = scaleBand({
    domain: filtered.map((b) => b.bucket),
    range: [0, innerH],
    padding: 0.2,
  });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...filtered.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });
  return (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        {filtered.map((b) => {
          const by = y(b.bucket) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.bucket}>
              <rect
                x={0}
                y={by}
                width={bw}
                height={bh}
                fill={TEAM_BUCKET_COLOR[b.bucket]}
                rx={2}
              />
              <text
                x={bw + 6}
                y={by + bh / 2}
                dy="0.35em"
                className="fill-text-secondary text-[11px] tnum"
              >
                {formatDollars(b.amount)} · {formatPercent(b.share)}
              </text>
            </g>
          );
        })}
        <AxisBottom
          top={innerH}
          scale={x}
          numTicks={4}
          tickFormat={(v) => formatDollars(Number(v))}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px] tnum',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          tickFormat={(t: unknown) => TEAM_BUCKET_LABEL[t as TeamBucket]}
          tickLabelProps={() => ({
            className: 'fill-text-primary text-[12px]',
            textAnchor: 'end',
            dx: -6,
            dy: 4,
          })}
          hideAxisLine
          hideTicks
        />
      </Group>
    </svg>
  );
}
