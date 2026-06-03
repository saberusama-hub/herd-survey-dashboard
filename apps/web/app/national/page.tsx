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
  type GrowthRow,
  type NationalFieldMixRow,
  type NationalNihIcRow,
  type NationalPiDistributionRow,
  type NationalStateRollupRow,
  type NationalTeamSizeRow,
  type NationalTopicRow,
  type NationalTrendRow,
  type StateTopicRow,
  type TopicLeaderRow,
  getNationalAgencyTrend,
  getNationalConcentration,
  getNationalFieldMix,
  getNationalNihICs,
  getNationalOverview,
  getNationalPiDistribution,
  getNationalStateRollup,
  getNationalTeamSize,
  getNationalTopicLeaders,
  getNationalTopics,
  getNationalTrends,
  getStateTopicLeaders,
  getTopClimbers,
  getTopFallers,
} from '@/lib/queries';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'nih-ics', label: 'NIH Institutes' },
  { id: 'concentration', label: 'Concentration' },
  { id: 'geography', label: 'Geography' },
  { id: 'trends', label: 'Trends' },
  { id: 'disciplines', label: 'Disciplines' },
  { id: 'topics', label: 'Topics' },
  { id: 'state-specialization', label: 'State specialization' },
  { id: 'team-size', label: 'Team size' },
  { id: 'pi-distribution', label: 'PI distribution' },
  { id: 'climbers-fallers', label: 'Climbers & fallers' },
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

const SOURCE_ORDER = ['federal', 'state', 'industry', 'institutional', 'nonprofit', 'other'] as const;
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
  const [nihIcs, setNihIcs] = useState<NationalNihIcRow[]>([]);
  const [topicLeaders, setTopicLeaders] = useState<TopicLeaderRow[]>([]);
  const [stateTopics, setStateTopics] = useState<StateTopicRow[]>([]);
  const [climbers, setClimbers] = useState<GrowthRow[]>([]);
  const [fallers, setFallers] = useState<GrowthRow[]>([]);
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
      getNationalNihICs(),
      getNationalTopicLeaders(5),
      getStateTopicLeaders(10),
      getTopClimbers('5yr', 10),
      getTopFallers('5yr', 10),
    ])
      .then(([o, a, c, s, f, p, t, ts, tp, ic, tl, st, cl, fa]) => {
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
        setNihIcs(ic);
        setTopicLeaders(tl);
        setStateTopics(st);
        setClimbers(cl);
        setFallers(fa);
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
    const sorted = [...stateRollup].sort((a, b) => Number(b.total_rd_nominal) - Number(a.total_rd_nominal));
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
    const latestFy = piDist.reduce((m, r) => (r.fiscal_year > m ? r.fiscal_year : m), piDist[0].fiscal_year);
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
    const latestFy = topics.reduce((m, r) => (r.fiscal_year > m ? r.fiscal_year : m), topics[0].fiscal_year);
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
    const latestFy = teamSize.reduce((m, r) => (r.fiscal_year > m ? r.fiscal_year : m), teamSize[0].fiscal_year);
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

  /* ─── §S5.1 NIH IC view: latest-FY 27-IC ranking + top-5 20yr trends ─── */
  const nihIcView = useMemo(() => {
    if (nihIcs.length === 0) {
      return {
        latestFy: null as number | null,
        ranked: [] as Array<{ ic_code: string; ic_full_name: string; amount: number; pct: number }>,
        top5: [] as string[],
        trend: [] as Array<Record<string, number>>,
      };
    }
    const latestFy = nihIcs.reduce((m, r) => (r.fiscal_year > m ? r.fiscal_year : m), nihIcs[0].fiscal_year);
    const ranked = nihIcs
      .filter((r) => r.fiscal_year === latestFy)
      .map((r) => ({
        ic_code: r.ic_code,
        ic_full_name: r.ic_full_name || r.ic_code,
        amount: Number(r.amount_nominal) || 0,
        pct: Number(r.pct_of_nih) || 0,
      }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const top5 = ranked.slice(0, 5).map((r) => r.ic_full_name);
    // 20-year share trend per top-5 IC.
    const byFy = new Map<number, Record<string, number>>();
    for (const r of nihIcs) {
      const fullName = r.ic_full_name || r.ic_code;
      if (!top5.includes(fullName)) continue;
      const row = byFy.get(r.fiscal_year) ?? {};
      row[fullName] = (Number(r.pct_of_nih) || 0) * 100;
      byFy.set(r.fiscal_year, row);
    }
    const trend = Array.from(byFy.keys())
      .sort((a, b) => a - b)
      .map((fy) => {
        const v = byFy.get(fy) ?? {};
        const row: Record<string, number> = { fiscal_year: fy };
        for (const t of top5) row[t] = v[t] ?? 0;
        return row;
      });
    return { latestFy, ranked, top5, trend };
  }, [nihIcs]);

  /* ─── §S5.2 Topic leaders: group {topic: [leader rows]} ─── */
  const topicLeadersByTopic = useMemo(() => {
    const m = new Map<string, TopicLeaderRow[]>();
    for (const r of topicLeaders) {
      const arr = m.get(r.topic) ?? [];
      arr.push(r);
      m.set(r.topic, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.topic_rank_national - b.topic_rank_national);
    }
    return m;
  }, [topicLeaders]);

  /* ─── §S5.3 State specialization: group {topic: [state rows]} ─── */
  const stateTopicsByTopic = useMemo(() => {
    const m = new Map<string, StateTopicRow[]>();
    for (const r of stateTopics) {
      const arr = m.get(r.topic) ?? [];
      arr.push(r);
      m.set(r.topic, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(b.state_topic_amount) - Number(a.state_topic_amount));
    }
    return m;
  }, [stateTopics]);

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
          <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap text-text-secondary hover:text-accent">
            {s.label}
          </a>
        ))}
      </nav>

      {loading && <p className="text-sm text-text-tertiary">Loading national rollups…</p>}
      {error && <p className="text-sm text-accent">Error loading data: {error}</p>}

      {/* ─── §1 Overview ─── */}
      <section id="overview" aria-labelledby="national-section-overview" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q01 (Sources of Funds) summed across all HERD-tracked institutions per FY × source category, FY2005–FY2024',
            },
          ]}
          note={
            overviewSummary
              ? `Peak FY${overviewSummary.peak.x} at ${formatDollars(overviewSummary.peak.y)}. Biggest year-on-year change: FY${overviewSummary.jump.x} (${overviewSummary.jump.label}).`
              : undefined
          }
          methodology={{
            what: 'Twenty years of total U.S. university research spending, sliced into who paid for it: federal, state, industry, the schools themselves, nonprofits, and other.',
            how: 'We sum HERD Q01 "Source of Funds" across every HERD-tracked university for each fiscal year and source category. Each stacked bar therefore equals the nationwide R&D total for that year.',
            caveats:
              'Pre-FY2010 "nonprofit" bars are conservative — HERD did not collect that category in the ARDES non-response window (FY2005–FY2009).',
          }}
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
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_COLOR[k] }} />
                <span>{SOURCE_LABEL[k]}</span>
              </li>
            ))}
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §2 Agencies ─── */}
      <section id="agencies" aria-labelledby="national-section-agencies" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q09 (Federal R&D by Agency) summed across all HERD-tracked institutions per FY × agency bucket, FY2005–FY2024',
            },
          ]}
          note={
            agencyLeader
              ? `${agencyLeader.key} was the dominant funder in FY${agencyLeader.fy} at ${formatDollars(agencyLeader.amount)}.`
              : undefined
          }
          methodology={{
            what: 'How much each federal agency (NIH, NSF, DOD, DOE, NASA, USDA, other) paid U.S. universities for research each year over the last 20 years.',
            how: 'For every year we sum HERD Q09 ("Federal R&D by agency") across all HERD-tracked universities, grouped into the seven canonical agency buckets. One line per agency.',
            caveats:
              'HERD Q09 rolls sub-agencies into their parent department. HHS = NIH + other; Defense = ARO + ONR + AFOSR + DARPA + sub-commands. For sub-agency detail, see the Reconciliation page.',
          }}
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

      {/* ─── §S5.1 NIH Institutes drill-down ─── */}
      <section id="nih-ics" aria-labelledby="national-section-nih-ics" className="scroll-mt-24">
        <SectionDivider
          eyebrow="National · NIH Institutes"
          title="Inside the HHS bar: 27 NIH Institutes & Centers"
          dek="HHS dollars routed through NIH split across the administering Institute. NCI, NIAID, NHLBI lead by funding volume in most years."
          color="hsl(var(--agency-nih))"
        />
        <ChartFrame
          eyebrow={nihIcView.latestFy ? `FY${nihIcView.latestFy} ranking` : 'NIH ICs'}
          title="National NIH funding by Institute / Center"
          dek="Sorted by total NIH funding in the latest reported fiscal year. % is share of national NIH total that year (sums to 100%)."
          sources={[
            {
              id: 'nih_exporter',
              subset:
                'Project total_cost grouped by ADMIN_IC (27 NIH Institutes/Centers + legacy codes), summed across all U.S. universities for the latest FY',
            },
          ]}
          methodology={{
            what: 'Which NIH Institute or Center actually wrote the checks — Cancer (NCI), Allergy/Infectious (NIAID), Heart/Lung/Blood (NHLBI), General Medical (NIGMS), and so on.',
            how: 'We aggregate fact_nih_project.total_cost_nominal by administering IC (admin_ic_code). Each project is counted once at its administering IC; the 27 standard ICs plus a few legacy/special codes are included.',
            caveats:
              'admin_ic_code represents the IC that manages the project. For multi-IC awards, contributing ICs may not be reflected. Total_cost includes both direct + indirect.',
          }}
        >
          <ResponsiveSvg height={Math.max(420, nihIcView.ranked.length * 20 + 40)}>
            {(w, h) => <IcBars width={w} height={h} bars={nihIcView.ranked} />}
          </ResponsiveSvg>
        </ChartFrame>

        {nihIcView.top5.length > 0 && (
          <ChartFrame
            eyebrow="20-year IC share trend"
            title="Top 5 NIH Institutes: share of national NIH $ over time"
            dek="One line per top-5 IC, plotted as % of national NIH $ each FY."
            sources={[
              {
                id: 'nih_exporter',
                subset: 'Project total_cost by ADMIN_IC per FY; share = IC dollars ÷ national NIH total that FY',
              },
            ]}
            methodology={{
              what: 'Whether the dominant NIH Institutes have held steady or shifted relative to each other over 20 years.',
              how: 'For each FY we compute IC share = IC dollars ÷ total NIH dollars that year. One line per IC, using the top-5 latest-FY ranking by dollar amount.',
              caveats:
                'Membership of "top 5" is fixed to the latest-FY ranking, so earlier years may show some non-top-5 ICs missing from this view.',
            }}
          >
            <LineChart
              data={nihIcView.trend as unknown as Array<Record<string, unknown>>}
              xKey="fiscal_year"
              series={nihIcView.top5.map((t, i) => ({
                key: t,
                label: t,
                color: [
                  'hsl(var(--accent))',
                  'hsl(var(--agency-nih))',
                  'hsl(var(--agency-nsf))',
                  'hsl(var(--agency-dod))',
                  'hsl(var(--agency-doe))',
                ][i % 5],
              }))}
              yFormat={(v) => `${v.toFixed(1)}%`}
              height={340}
              directLabels
              showLegend={false}
            />
          </ChartFrame>
        )}
      </section>

      {/* ─── §3 Concentration ─── */}
      <section id="concentration" aria-labelledby="national-section-concentration" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q01 (Total R&D) ranked per FY; cohort shares = top-N institution sum ÷ national total, FY2005–FY2024',
            },
          ]}
          note={
            concSummary
              ? `Top-10 share: ${concSummary.top10First.toFixed(1)}% in FY${concSummary.firstFy} → ${concSummary.top10Last.toFixed(1)}% in FY${concSummary.lastFy}. Top-100 in FY${concSummary.lastFy}: ${concSummary.top100Last.toFixed(1)}%.`
              : undefined
          }
          methodology={{
            what: 'Whether a small group of elite universities dominates U.S. research spending, or whether the money is spread broadly — and how that balance has shifted over 20 years.',
            how: 'For each fiscal year we rank all HERD-tracked universities by total R&D, then compute the % of the national total taken by the top 10, top 25, and top 100. Three lines, one per cohort.',
            caveats:
              'Cohort membership can change year over year — "top 10" in FY2005 is not necessarily the same set as in FY2024.',
          }}
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
      <section id="geography" aria-labelledby="national-section-geography" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset: 'Q01 (Total R&D) per institution × FY, summed by headquarters state, latest reported FY',
            },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
          ]}
          note={
            stateSummary
              ? `${stateSummary.nStates} states reported R&D in FY${stateSummary.fy}, totalling ${formatDollars(stateSummary.total)}.`
              : undefined
          }
          methodology={{
            what: 'Where the U.S. university research money is geographically — which states host the biggest research economies.',
            how: 'For the latest reported fiscal year we sum total HERD R&D across all HERD-tracked universities in each state (joining `agg_uni_total_rd` to `dim_institution.state_code`). Darker fill = higher total.',
            caveats:
              'Counts a university’s spending in its headquarters state, even if research is performed at branch campuses elsewhere.',
          }}
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
                    <li key={r.state_code} className="flex justify-between border-b border-rule/60 py-1.5">
                      <span>
                        <span className="mr-2 text-text-tertiary">{String(i + 1).padStart(2, '0')}</span>
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
      <section id="trends" aria-labelledby="national-section-trends" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q01 Total R&D and Q01 federal-source dollars per institution × FY (drive Total R&D and Federal share metrics)',
            },
            {
              id: 'nsf_awards',
              subset: 'Lead PI per award; counted toward national distinct-PI count (drives # PIs metric)',
            },
            {
              id: 'nih_exporter',
              subset: 'PI bridge file (project × PI); counted toward national distinct-PI count (drives # PIs metric)',
            },
          ]}
          methodology={{
            what: 'Three different ways to slice the 20-year national story — total dollars, federal dependence, and how many researchers were on the federal payroll each year.',
            how: 'Total R&D = sum of `agg_uni_total_rd.total_rd_nominal` across all universities per FY. Federal share = federal-source dollars ÷ all-source dollars per FY. # PIs = sum of distinct-PI counts across institutions per FY (from `agg_uni_pi_universe`).',
            caveats:
              'FY2005 PI count is masked (entity-resolution discontinuity affecting 81 institutions). Federal share denominator includes non-federal HERD sources (state, industry, institutional, nonprofit, other).',
          }}
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
                  className={`rounded border px-3 py-1.5 text-xs ${
                    active
                      ? 'border-accent bg-accent text-paper'
                      : 'border-border text-text-secondary hover:border-accent hover:text-accent'
                  }`}
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
      <section id="disciplines" aria-labelledby="national-section-disciplines" className="scroll-mt-24">
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
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q03 (R&D by Field of Science) per institution × FY × field; STEM vs non-STEM split via the HERD field-classification flag, FY2005–FY2024',
            },
          ]}
          note={
            stemSummary && stemSummary.stemShare !== null
              ? `STEM share in FY${stemSummary.fy}: ${formatPercent(stemSummary.stemShare)} of national HERD R&D.`
              : undefined
          }
          methodology={{
            what: 'How much of U.S. university research goes to science, technology, engineering, and math (STEM) versus humanities and social sciences.',
            how: 'For each fiscal year we sum HERD Q03 R&D across all universities, then split by the `is_stem` flag attached to each of the eight HERD field-of-science categories. Stacked bar: STEM on bottom (accent), non-STEM on top (gray).',
            caveats:
              'The "STEM" flag follows HERD’s field classification — fields like "Psychology" land in non-STEM here even though they are STEM under other taxonomies.',
          }}
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
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--accent))' }} />
              <span>STEM (S&amp;E)</span>
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--mute-1))' }} />
              <span>Non-STEM</span>
            </li>
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §7 Topics: 30-topic taxonomy ─── */}
      <section id="topics" aria-labelledby="national-section-topics" className="scroll-mt-24">
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
          sources={[
            {
              id: 'nsf_awards',
              subset:
                'Award title + abstract text regex-matched against the 30-topic taxonomy; $ summed per topic for latest FY',
            },
            {
              id: 'nih_exporter',
              subset:
                'Project title + structured terms regex-matched against the 30-topic taxonomy; $ summed per topic for latest FY',
            },
          ]}
          note="Topics use word-boundary regex on title + abstract / project terms. See /methodology for the exact pattern list."
          methodology={{
            what: 'A nationwide ranking of 30 concrete research topics — Cancer, AI/ML, Climate, Quantum, etc. — sorted by how many federal dollars matched each topic in the most recent year.',
            how: 'Each NSF and NIH grant is scanned for keyword matches against a hand-tuned 30-topic regex taxonomy (titles + NSF abstracts + NIH project terms). We sum the tagged dollars per topic nationally for the latest FY.',
            caveats:
              'Topics are NOT mutually exclusive — one grant can match multiple topics (e.g., "Cancer" and "AI/ML"). Patterns were tightened in May 2026 to reduce false positives. Shares can sum above 100% by design.',
          }}
        >
          <ResponsiveSvg height={Math.max(420, topicsView.ranked.length * 22 + 40)}>
            {(w, h) => <TopicBars width={w} height={h} bars={topicsView.ranked} />}
          </ResponsiveSvg>
        </ChartFrame>

        <ChartFrame
          eyebrow="20-year topic share trend"
          title="Top 10 topics: share of national federal $ over time"
          dek="Share of all NSF + NIH federal dollars matching each topic, FY2005 – FY2024. Higher = topic captured a larger slice of the agency portfolio that year."
          sources={[
            {
              id: 'nsf_awards',
              subset: 'Tagged award $ summed per topic per FY; share = topic $ ÷ total federal $ that FY',
            },
            {
              id: 'nih_exporter',
              subset: 'Tagged project $ summed per topic per FY; share = topic $ ÷ total federal $ that FY',
            },
          ]}
          methodology={{
            what: 'Whether the 10 most-funded research topics have grown or shrunk relative to the rest of the federal research portfolio over 20 years.',
            how: 'For each FY we compute each topic’s share = topic dollars ÷ total federal $ that year. One line per topic, using the top-10 latest-FY ranking.',
            caveats:
              'Topic overlap means shares are not exclusive (a grant can match several topics). A rising line reflects either growing absolute funding or shrinking competition from other topics — read alongside the ranking above.',
          }}
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

        {topicLeaders.length > 0 && topicsView.top10.length > 0 && (
          <ChartFrame
            eyebrow="Top universities per topic"
            title="The top 5 universities funded for each top-10 topic"
            dek="For each of the 10 most-funded topics, the universities that received the largest tagged federal $ in the latest fiscal year."
            sources={[
              { id: 'nsf_awards', subset: 'Tagged award $ per institution × topic, ranked within topic for latest FY' },
              {
                id: 'nih_exporter',
                subset: 'Tagged project $ per institution × topic, ranked within topic for latest FY',
              },
              {
                id: 'ncses_herd',
                subset: 'Q01 Total R&D as the size denominator for the share-of-share normalization',
              },
            ]}
            methodology={{
              what: 'Where the biggest research-topic dollars actually land — for AI/ML, Cancer, Quantum, etc., which 5 universities are at the top.',
              how: "For the latest reported FY we rank universities by tagged federal $ within each topic (topic_rank_national), then list the top 5. Click a name to open that uni's profile.",
              caveats:
                'Ranking uses the same regex-tagged grant text as the topics chart above. Topic overlap rules apply (a grant can match multiple topics).',
            }}
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              {topicsView.top10.map((topic) => {
                const leaders = topicLeadersByTopic.get(topic) ?? [];
                if (leaders.length === 0) return null;
                return (
                  <div key={topic}>
                    <p className="mb-1.5 text-[11px] uppercase tracking-wider text-text-tertiary">{topic}</p>
                    <ol className="space-y-1 text-[12px]">
                      {leaders.slice(0, 5).map((u) => (
                        <li
                          key={u.institution_sk}
                          className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1"
                        >
                          <span className="min-w-0 truncate">
                            <span className="mr-2 text-text-tertiary tnum">#{u.topic_rank_national}</span>
                            <a href={`/universities/${u.institution_sk}`} className="text-accent hover:underline">
                              {u.canonical_name ?? u.institution_sk}
                            </a>
                            {u.state_code && <span className="ml-1 text-text-tertiary">· {u.state_code}</span>}
                          </span>
                          <span className="shrink-0 text-text-secondary tnum">
                            {formatDollars(Number(u.uni_topic_amount) || 0)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </ChartFrame>
        )}
      </section>

      {/* ─── §S5.3 State topic specialization ─── */}
      <section id="state-specialization" aria-labelledby="national-section-state-spec" className="scroll-mt-24">
        <SectionDivider
          eyebrow="National · State specialization"
          title="Which states lead each research topic"
          dek="Small-multiples view: for each of the top 6 topics by national $, the 5 states that captured the largest share in the latest fiscal year."
          color="hsl(var(--agency-nasa))"
        />
        <ChartFrame
          eyebrow={nihIcView.latestFy ? `FY${nihIcView.latestFy} state ranking` : 'State topic leaders'}
          title="Top 5 states per research topic"
          dek="Each panel shows one topic; bars are the top 5 states by tagged federal $ that year, with each state's share of the national topic total."
          sources={[
            {
              id: 'nsf_awards',
              subset: 'Tagged award $ joined to institution_sk → state_code, summed per state × topic × FY',
            },
            {
              id: 'nih_exporter',
              subset: 'Tagged project $ joined to institution_sk → state_code, summed per state × topic × FY',
            },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
          ]}
          methodology={{
            what: 'For each major research topic, the U.S. states whose universities won the largest slice — a geographic read on where the AI dollars, the cancer dollars, the climate dollars actually went.',
            how: "agg_state_topic rolls each university's tagged topic dollars up to its headquarters state, then ranks states by total per (topic, FY). state_topic_share = state total ÷ national topic total.",
            caveats:
              "A university's state is its headquarters state in dim_institution. Multi-campus systems may understate states with prominent branch campuses.",
          }}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(topicsView.top10.slice(0, 6) as string[]).map((topic) => {
              const states = (stateTopicsByTopic.get(topic) ?? []).slice(0, 5);
              if (states.length === 0) return null;
              const maxAmt = Math.max(...states.map((s) => Number(s.state_topic_amount) || 0));
              return (
                <div key={topic} className="rounded border border-rule p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-text-tertiary">{topic}</p>
                  <ul className="space-y-1">
                    {states.map((s) => {
                      const amt = Number(s.state_topic_amount) || 0;
                      const share = Number(s.state_topic_share) || 0;
                      const w = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
                      return (
                        <li key={s.state_code} className="text-[12px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium tnum">{s.state_code}</span>
                            <span className="text-text-tertiary tnum">{formatPercent(share)}</span>
                          </div>
                          <div
                            className="mt-0.5 h-1.5 rounded"
                            style={{
                              width: `${w}%`,
                              background: 'hsl(var(--accent))',
                              minWidth: 4,
                            }}
                            aria-label={`${s.state_code} ${formatDollars(amt)} (${formatPercent(share)})`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </ChartFrame>
      </section>

      {/* ─── §8 Team size ─── */}
      <section id="team-size" aria-labelledby="national-section-team-size" className="scroll-mt-24">
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
          sources={[
            { id: 'nsf_awards', subset: 'Lead PI + n_pi field per award; bucketed by team count for the latest FY' },
            {
              id: 'nih_exporter',
              subset: 'PI bridge file COUNT(DISTINCT pi_id) per project; bucketed by team count for the latest FY',
            },
          ]}
          note={
            teamSizeView.latestRows.length > 0
              ? `Single-PI grants captured ${formatPercent(teamSizeView.latestRows[0].share)} of federal $ in FY${teamSizeView.latestFy}. Multi-PI teams (2+ PIs) took the rest.`
              : undefined
          }
          methodology={{
            what: 'Nationally, how much research money is going to lone-investigator grants versus larger collaborative teams in the most recent year.',
            how: 'Each NSF + NIH grant is bucketed by team size (1, 2-5, 6-10, 11-20, 21+ PIs) using the NSF `n_pi` field and the NIH `PI_IDS` array. We sum federal dollars per bucket for the latest fiscal year.',
            caveats:
              'NSF does not publish the full co-PI roster, so grants are placed in their reported team-size bucket but co-PIs are not counted individually — slightly conservative on the larger buckets.',
          }}
        >
          <ResponsiveSvg height={280}>
            {(w, h) => <TeamSizeBars width={w} height={h} bars={teamSizeView.latestRows} />}
          </ResponsiveSvg>
        </ChartFrame>

        <ChartFrame
          eyebrow="20-year team-size mix"
          title="Federal $ by team size, FY2005 – FY2024"
          dek="Stacked bar per FY: single-PI grants on the bottom in accent. Larger team buckets stack on top in graduated greys."
          sources={[
            { id: 'nsf_awards', subset: 'Lead PI + n_pi field per award; bucketed by team count, FY2005–FY2024' },
            {
              id: 'nih_exporter',
              subset: 'PI bridge file COUNT(DISTINCT pi_id) per project; bucketed by team count, FY2005–FY2024',
            },
          ]}
          methodology={{
            what: 'Whether U.S. research has shifted from solo PIs toward larger team grants over 20 years.',
            how: 'For each FY we sum federal $ in the five team-size buckets and stack them. The accent slice at the bottom is single-PI; bigger teams stack progressively above.',
            caveats:
              'Team-size bucketing depends on what each agency publishes (NSF `n_pi`, NIH `PI_IDS`). NSF co-PI counts are reported, but individual co-PIs are not enumerated, so multi-PI team counts are conservative.',
          }}
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
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_BUCKET_COLOR[k] }} />
                <span>{TEAM_BUCKET_LABEL[k]}</span>
              </li>
            ))}
          </ul>
        </ChartFrame>
      </section>

      {/* ─── §9 PI distribution ─── */}
      <section id="pi-distribution" aria-labelledby="national-section-pis" className="scroll-mt-24">
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
          sources={[
            { id: 'nsf_awards', subset: 'Lead PI obligations bucketed into deciles per institution, latest FY' },
            { id: 'nih_exporter', subset: 'PI total_cost bucketed into deciles per institution, latest FY' },
          ]}
          note={
            piDistLatest.rows.length > 0
              ? `Top decile averages ${formatDollars(piDistLatest.rows[piDistLatest.rows.length - 1].avg_amount)} per PI, vs. ${formatDollars(piDistLatest.rows[0].avg_amount)} in the bottom decile.`
              : undefined
          }
          methodology={{
            what: 'Whether federal research funding is shared evenly across PIs nationwide, or concentrated in a small slice of top-funded researchers.',
            how: 'At each university we sort PIs into ten equal $/PI buckets (deciles). We then average each decile across institutions — a "decile of deciles." Decile 1 = lowest-funded 10%, decile 10 = highest-funded.',
            caveats:
              'Averaging deciles across institutions is a coarse but defensible national lens. PIs holding grants at multiple universities are counted once per institution.',
          }}
        >
          <ResponsiveSvg height={280}>
            {(w, h) => <DistributionPlot data={piDistLatest.rows} width={w} height={h} />}
          </ResponsiveSvg>
        </ChartFrame>
      </section>

      {/* ─── §S5.4 5-yr climbers & fallers ─── */}
      <section id="climbers-fallers" aria-labelledby="national-section-climbers" className="scroll-mt-24">
        <SectionDivider
          eyebrow="National · Growth"
          title="5-year climbers & fallers"
          dek="The 10 fastest-growing and the 10 fastest-declining universities by 5-year compound annual growth rate, FY2019 → FY2024."
          color="hsl(var(--agency-doe))"
        />
        <ChartFrame
          eyebrow="FY2019 → FY2024 CAGR"
          title="Who grew, who shrank?"
          dek="One panel of climbers (top 10 by 5-yr CAGR), one of fallers (bottom 10). Restricted to universities with FY2024 HERD R&D ≥ $5M to avoid tiny-base noise."
          sources={[
            {
              id: 'ncses_herd',
              subset:
                'Q01 (Total R&D) per institution at FY2019 and FY2024; CAGR = (FY24/FY19)^(1/5) − 1, restricted to FY24 ≥ $5M cohort',
            },
          ]}
          methodology={{
            what: 'Which universities have been on the steepest 5-year upward or downward trajectory, in HERD-reported total R&D.',
            how: 'CAGR_5yr = (FY24 total / FY19 total)^(1/5) − 1. Universities are restricted to those with FY24 total R&D ≥ $5M (avoids divide-by-tiny CAGRs). Climbers are sorted descending; fallers ascending.',
            caveats:
              'Nominal dollars (no CPI deflation) — real-dollar CAGRs would be ~2.5–3% lower per year over the 2019-24 window. Rank-change columns use HERD-reported FY19 ranks among the same $5M cohort.',
          }}
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <GrowthLeaderboard title="Top 10 climbers (5-yr CAGR)" rows={climbers} dir="climber" />
            <GrowthLeaderboard title="Bottom 10 fallers (5-yr CAGR)" rows={fallers} dir="faller" />
          </div>
        </ChartFrame>
      </section>
    </div>
  );
}

/* ───────────── Inline visx components (kept local to the file) ──────────── */

function IcBars({
  bars,
  width,
  height,
}: {
  bars: Array<{ ic_code: string; ic_full_name: string; amount: number; pct: number }>;
  width: number;
  height: number;
}) {
  const margin = { top: 8, right: 100, bottom: 28, left: 240 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const labels = bars.map((b) => b.ic_full_name);
  const y = scaleBand({ domain: labels, range: [0, innerH], padding: 0.15 });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...bars.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });
  return (
    <svg width={width} height={height} role="img" aria-label="National NIH funding by Institute or Center">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.ic_full_name) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.ic_code}>
              <rect x={0} y={by} width={bw} height={bh} fill="hsl(var(--agency-nih))" rx={2} />
              <text x={bw + 6} y={by + bh / 2} dy="0.35em" className="fill-text-secondary text-[11px] tnum">
                {formatDollars(b.amount)} · {formatPercent(b.pct)}
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

function GrowthLeaderboard({
  title,
  rows,
  dir,
}: {
  title: string;
  rows: GrowthRow[];
  dir: 'climber' | 'faller';
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[12px] uppercase tracking-wider text-text-tertiary">{title}</p>
        <p className="text-[11px] text-text-tertiary">No rows.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-[12px] uppercase tracking-wider text-text-tertiary">{title}</p>
      <ol className="divide-y divide-rule/40 text-[12px]">
        {rows.map((r, i) => {
          const cagr = Number(r.cagr_5yr) || 0;
          const rankDelta = r.rank_change_5yr;
          const rankSign = rankDelta && rankDelta > 0 ? '↑' : rankDelta && rankDelta < 0 ? '↓' : '·';
          const cagrColor = dir === 'climber' ? 'text-positive' : 'text-negative';
          return (
            <li key={r.institution_sk} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-text-tertiary tnum">{String(i + 1).padStart(2, '0')}</span>
                <a href={`/universities/${r.institution_sk}`} className="text-accent hover:underline">
                  {r.canonical_name ?? r.institution_sk}
                </a>
                {r.state_code && <span className="ml-1 text-text-tertiary">· {r.state_code}</span>}
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tnum">
                <span className={cagrColor}>
                  {cagr >= 0 ? '+' : ''}
                  {(cagr * 100).toFixed(1)}%
                </span>
                {rankDelta !== null && rankDelta !== undefined && (
                  <span className="text-text-tertiary">
                    {rankSign}
                    {Math.abs(rankDelta)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] italic text-text-tertiary">
        CAGR = (FY24 / FY19)^(1/5) − 1. Rank Δ = FY19 rank − FY24 rank within the $5M+ cohort.
      </p>
    </div>
  );
}

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
    <svg width={width} height={height} role="img" aria-label="Top research topics by national federal funding">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.topic) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.topic}>
              <rect x={0} y={by} width={bw} height={bh} fill="hsl(var(--accent))" rx={2} />
              <text x={bw + 6} y={by + bh / 2} dy="0.35em" className="fill-text-secondary text-[11px] tnum">
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
    <svg width={width} height={height} role="img" aria-label="Distribution of universities by team-size bucket">
      <Group left={margin.left} top={margin.top}>
        {filtered.map((b) => {
          const by = y(b.bucket) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.bucket}>
              <rect x={0} y={by} width={bw} height={bh} fill={TEAM_BUCKET_COLOR[b.bucket]} rx={2} />
              <text x={bw + 6} y={by + bh / 2} dy="0.35em" className="fill-text-secondary text-[11px] tnum">
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
