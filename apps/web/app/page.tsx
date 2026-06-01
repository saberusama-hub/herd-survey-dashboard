'use client';

import { useDuckDB } from '@/app/providers';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { UniversitySearchBox } from '@/components/editorial/UniversitySearchBox';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { query } from '@/lib/duckdb';
import { formatDollars, formatPercent } from '@/lib/format';
import {
  type UniversityIndexRow,
  getUniversityIndex,
} from '@/lib/queries';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

// ───────── Color tokens used across the home charts ─────────
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

const AGENCY_COLOR: Record<string, string> = {
  HHS: 'hsl(var(--agency-nih))',
  NSF: 'hsl(var(--agency-nsf))',
  DOD: 'hsl(var(--agency-dod))',
  DOE: 'hsl(var(--agency-doe))',
  NASA: 'hsl(var(--agency-nasa))',
  USDA: 'hsl(var(--agency-usda))',
  Other: 'hsl(var(--agency-other))',
};

const AGENCY_LABEL: Record<string, string> = {
  HHS: 'HHS (incl. NIH)',
  NSF: 'NSF',
  DOD: 'DOD',
  DOE: 'DOE',
  NASA: 'NASA',
  USDA: 'USDA',
  Other: 'Other federal',
};

// Single source of truth: query DuckDB-WASM for the headline KPI values.
// All amounts use HERD nominal dollars (the canonical reporting basis).
interface KpiRow {
  total_entities: number;
  herd_universities: number;
  fy24_total: number;
  fy24_federal: number;
  cum20_federal: number;
  fy24: number;
}
interface AgencyKpiRow {
  fy: number;
  agency_bucket: string;
  amount_nominal: number;
  pct_of_federal: number;
}
interface TopicRow {
  fy: number;
  topic: string;
  tagged_amount: number;
}
interface AgencyShareRow {
  fy: number;
  agency_bucket: string;
  amount_nominal: number;
}
interface SourceTotalRow {
  source_category: string;
  total: number;
}
interface StateRow {
  state_code: string;
  total: number;
  n_institutions: number;
}

export default function HomePage() {
  const { ready } = useDuckDB();
  const [top10, setTop10] = useState<UniversityIndexRow[]>([]);
  const [kpis, setKpis] = useState<KpiRow | null>(null);
  const [topAgency, setTopAgency] = useState<AgencyKpiRow | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [agencies, setAgencies] = useState<AgencyShareRow[]>([]);
  const [sourceTotals, setSourceTotals] = useState<SourceTotalRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([
      getUniversityIndex(),
      // KPI strip aggregates. Computes in a single round-trip to keep the
      // initial-paint cost flat (every SELECT subquery is a small scan).
      query<KpiRow>(`
        WITH herd_fys AS (SELECT MAX(fiscal_year) AS fy FROM agg_uni_total_rd)
        SELECT
          (SELECT COUNT(*) FROM dim_institution) AS total_entities,
          (SELECT COUNT(DISTINCT institution_sk) FROM agg_uni_total_rd) AS herd_universities,
          (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE fiscal_year = (SELECT fy FROM herd_fys)) AS fy24_total,
          (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE fiscal_year = (SELECT fy FROM herd_fys) AND source_category = 'federal') AS fy24_federal,
          (SELECT SUM(amount_nominal) FROM agg_national_overview WHERE source_category = 'federal') AS cum20_federal,
          (SELECT fy FROM herd_fys) AS fy24
      `),
      // Largest single federal funder in the latest agency-trend FY (HERD Q09).
      // The Q09 aggregation lags Q01 by ~one year — that's why we compute its
      // own "latest" rather than tying to fy24.
      query<AgencyKpiRow>(`
        WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_agency_trend),
        fed_total AS (
          SELECT SUM(amount_nominal) AS total
          FROM agg_national_agency_trend
          WHERE fiscal_year = (SELECT fy FROM latest)
        )
        SELECT
          (SELECT fy FROM latest) AS fy,
          agency_bucket,
          amount_nominal,
          amount_nominal / (SELECT total FROM fed_total) AS pct_of_federal
        FROM agg_national_agency_trend
        WHERE fiscal_year = (SELECT fy FROM latest)
        ORDER BY amount_nominal DESC
        LIMIT 1
      `),
      // Top 10 topics latest FY.
      query<TopicRow>(`
        WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_topic)
        SELECT (SELECT fy FROM latest) AS fy, topic, tagged_amount
        FROM agg_national_topic
        WHERE fiscal_year = (SELECT fy FROM latest)
        ORDER BY tagged_amount DESC
        LIMIT 10
      `),
      // Agencies latest FY (all 7 buckets).
      query<AgencyShareRow>(`
        WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_national_agency_trend)
        SELECT (SELECT fy FROM latest) AS fy, agency_bucket, amount_nominal
        FROM agg_national_agency_trend
        WHERE fiscal_year = (SELECT fy FROM latest)
        ORDER BY amount_nominal DESC
      `),
      // 20-year cumulative source totals.
      query<SourceTotalRow>(`
        SELECT source_category, SUM(amount_nominal) AS total
        FROM agg_national_overview
        GROUP BY source_category
        ORDER BY total DESC
      `),
      // Top 10 states by federal R&D in the latest HERD FY.
      query<StateRow>(`
        WITH latest AS (SELECT MAX(fiscal_year) AS fy FROM agg_uni_source_split)
        SELECT
          i.state_code,
          SUM(s.amount_nominal) AS total,
          COUNT(DISTINCT s.institution_sk) AS n_institutions
        FROM agg_uni_source_split s
        JOIN dim_institution i USING (institution_sk)
        WHERE s.fiscal_year = (SELECT fy FROM latest)
          AND s.source_category = 'federal'
          AND i.state_code IS NOT NULL
          AND s.amount_nominal IS NOT NULL
        GROUP BY i.state_code
        ORDER BY total DESC
        LIMIT 10
      `),
    ]).then(([idx, kpiRows, agencyRows, topicRows, agencyShares, srcTotals, stateRows]) => {
      if (cancelled) return;
      setTop10(idx.slice(0, 10));
      setKpis(kpiRows[0] ?? null);
      setTopAgency(agencyRows[0] ?? null);
      setTopics(topicRows);
      setAgencies(agencyShares);
      setSourceTotals(srcTotals);
      setStates(stateRows);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // ───────── Derived figures for KPI strip ─────────
  const fy24FederalPct = useMemo(() => {
    if (!kpis || !kpis.fy24_total || !kpis.fy24_federal) return null;
    return kpis.fy24_federal / kpis.fy24_total;
  }, [kpis]);

  const tiles: KpiTile[] = useMemo(
    () => [
      {
        label: 'Tracked entities',
        value: kpis ? kpis.total_entities.toLocaleString('en-US') : '—',
        hint: (
          <span className="text-text-tertiary text-[11px]">
            every uni, FFRDC, hospital, lab, etc. in the federal-grant universe
          </span>
        ),
      },
      {
        label: 'HERD-surveyed universities',
        value: kpis ? kpis.herd_universities.toLocaleString('en-US') : '—',
        hint: (
          <span className="text-text-tertiary text-[11px]">
            the funding-traced subset (every $ flow on this site is for these)
          </span>
        ),
      },
      {
        label: kpis ? `FY${kpis.fy24} total university R&D` : 'Latest total R&D',
        value: kpis ? formatDollars(kpis.fy24_total) : '—',
        hint: (
          <span className="text-text-tertiary text-[11px]">
            HERD Q01, all six funding sources combined
          </span>
        ),
      },
      {
        label: kpis ? `FY${kpis.fy24} federal share` : 'Latest federal share',
        value: kpis ? formatDollars(kpis.fy24_federal) : '—',
        hint: (
          <span className="text-text-tertiary text-[11px]">
            {fy24FederalPct !== null
              ? `${formatPercent(fy24FederalPct)} of the total`
              : 'federal slice of HERD'}
          </span>
        ),
      },
      {
        label: '20-yr cumulative federal R&D',
        value: kpis ? formatDollars(kpis.cum20_federal) : '—',
        hint: (
          <span className="text-text-tertiary text-[11px]">
            FY2005–FY{kpis?.fy24 ?? '—'}, nominal dollars
          </span>
        ),
      },
      {
        label: topAgency ? `Largest funder, FY${topAgency.fy}` : 'Largest funder',
        value: topAgency
          ? `${AGENCY_LABEL[topAgency.agency_bucket] ?? topAgency.agency_bucket}`
          : '—',
        hint: topAgency ? (
          <span className="text-text-tertiary text-[11px]">
            {formatDollars(topAgency.amount_nominal)} ·{' '}
            {formatPercent(topAgency.pct_of_federal)} of federal R&D
          </span>
        ) : undefined,
      },
    ],
    [kpis, fy24FederalPct, topAgency],
  );

  // ───────── Chart-ready slices ─────────
  const topicBars = useMemo(
    () =>
      topics.map((t) => ({
        label: t.topic,
        amount: Number(t.tagged_amount) || 0,
      })),
    [topics],
  );

  const agencyBars = useMemo(() => {
    if (agencies.length === 0) return [];
    const total = agencies.reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    return agencies.map((r) => ({
      label: AGENCY_LABEL[r.agency_bucket] ?? r.agency_bucket,
      bucket: r.agency_bucket,
      amount: Number(r.amount_nominal) || 0,
      share: total > 0 ? Number(r.amount_nominal) / total : 0,
      color: AGENCY_COLOR[r.agency_bucket] ?? 'hsl(var(--agency-other))',
    }));
  }, [agencies]);

  const agencyFy = agencies[0]?.fy ?? null;

  const sourceBars = useMemo(() => {
    if (sourceTotals.length === 0) return [];
    return SOURCE_ORDER.map((k) => {
      const row = sourceTotals.find((r) => r.source_category === k);
      return {
        label: SOURCE_LABEL[k],
        key: k,
        amount: row ? Number(row.total) || 0 : 0,
        color: SOURCE_COLOR[k],
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [sourceTotals]);

  const stateBars = useMemo(
    () =>
      states.map((r) => ({
        label: r.state_code,
        amount: Number(r.total) || 0,
        nInstitutions: Number(r.n_institutions) || 0,
      })),
    [states],
  );

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
        {/* Search box: prominent placement so visitors looking for a specific
            uni see the input immediately, before the KPI strip. */}
        <div className="pt-2">
          <UniversitySearchBox className="w-full md:max-w-xl" />
        </div>
      </header>

      {/* ─── KPI strip: 6 tiles, 3x2 on desktop / 2x3 on tablet / stacked mobile ─── */}
      <section aria-label="Headline figures">
        <KpiStrip tiles={tiles} cols={3} />
      </section>

      {/* ─── Top 10 leaderboard ─── */}
      <section>
        <ChartFrame
          eyebrow="Leaderboard · latest reported FY"
          title="Top 10 universities by total R&D"
          dek="Click a row to view that profile."
          source="HERD totals · USD nominal · agg_uni_total_rd"
          methodology={{
            what:
              'A quick ranking of the ten biggest U.S. research universities by total R&D spending in the most recent reported year.',
            how:
              'For the latest fiscal year in `agg_uni_total_rd` we sort all HERD-tracked universities by `total_rd_nominal` (combined federal + state + industry + institutional + nonprofit + other) and take the top 10.',
            caveats:
              'Total R&D includes every source category — not just federal. Some universities (system aggregates) report only at the parent level; their figure may absorb branch-campus spending.',
          }}
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
      </section>

      {/* ─── Four bottom panels: topics, agencies, sources, states ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <ChartFrame
          eyebrow={topics[0]?.fy ? `FY${topics[0].fy} ranking` : 'Latest FY ranking'}
          title="Top 10 research topics by federal $"
          dek="The biggest concrete research areas across NSF + NIH grants — the topics where most federal money landed."
          source="agg_national_topic"
          methodology={{
            what:
              'A ranking of the ten research topics that attracted the most federal grant dollars in the most recent year — concrete subject areas like Cancer, AI/ML, Climate.',
            how:
              'Every NSF and NIH grant is scanned against a hand-tuned 30-topic regex taxonomy (titles + NSF abstracts + NIH project terms). We sum the tagged dollars per topic for the latest FY and take the top 10.',
            caveats:
              'Topics are NOT mutually exclusive — one grant can match several (e.g., "Cancer" + "AI/ML"). Dollar totals across topics can exceed the federal total because of this overlap.',
          }}
        >
          {topicBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ResponsiveSvg height={Math.max(260, topicBars.length * 24 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={topicBars}
                  color="hsl(var(--accent))"
                  href="/national#topics"
                />
              )}
            </ResponsiveSvg>
          )}
          <p className="mt-3 text-[11px] text-text-tertiary">
            <Link href="/national#topics" className="hover:text-accent">
              See all 30 topics &rarr;
            </Link>
          </p>
        </ChartFrame>

        <ChartFrame
          eyebrow={agencyFy ? `FY${agencyFy} share` : 'Latest FY share'}
          title="Federal funding agencies by share"
          dek="Which federal departments paid the most to U.S. universities in the most recent reported year."
          source="HERD Q09 · agg_national_agency_trend"
          methodology={{
            what:
              'How federal research dollars split across the major funding agencies in the most recent year — HHS (NIH), NSF, DOD, DOE, NASA, USDA, and "Other".',
            how:
              'We take HERD Q09 ("Federal R&D by agency") for the latest reported FY and sum across all universities into the seven canonical buckets. Each bar shows total dollars and share of federal R&D.',
            caveats:
              'HERD Q09 lags Q01 by about one year, so this view may report one year behind the source-of-funds chart on the same page. Sub-agencies (NIH institutes, DOD sub-commands) are rolled to parent.',
          }}
        >
          {agencyBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ResponsiveSvg height={Math.max(220, agencyBars.length * 36 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={agencyBars}
                  href="/national#agencies"
                />
              )}
            </ResponsiveSvg>
          )}
          <p className="mt-3 text-[11px] text-text-tertiary">
            <Link href="/national#agencies" className="hover:text-accent">
              Agency trends over 20 years &rarr;
            </Link>
          </p>
        </ChartFrame>

        <ChartFrame
          eyebrow="FY2005–latest cumulative"
          title="20-year R&D by source"
          dek="How much each funding source has contributed across two decades — the absolute magnitude of federal, institutional, state, industry, nonprofit, and other."
          source="agg_national_overview"
          methodology={{
            what:
              'A horizontal bar showing the total dollars each funding source has put into U.S. university research over the full 20-year window.',
            how:
              'We sum HERD Q01 reported amounts across all institutions and all fiscal years, grouped by source category (federal, state, industry, institutional, nonprofit, other). Bars are sorted by total contribution.',
            caveats:
              'Nominal dollars (not inflation-adjusted). "Nonprofit" is conservative for FY2005–FY2009 because HERD did not collect that category in that window (ARDES non-response).',
          }}
        >
          {sourceBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ResponsiveSvg height={Math.max(220, sourceBars.length * 36 + 40)}>
              {(w, h) => (
                <HorizontalBarChart width={w} height={h} bars={sourceBars} />
              )}
            </ResponsiveSvg>
          )}
        </ChartFrame>

        <ChartFrame
          eyebrow="Latest reported FY"
          title="Top 10 states by federal R&D"
          dek="Where federal research money lands geographically — the ten states that received the largest share in the most recent year."
          source="agg_uni_source_split × dim_institution"
          methodology={{
            what:
              'A ranking of the ten U.S. states whose universities received the most federal research funding in the most recent year.',
            how:
              'For the latest fiscal year we join `agg_uni_source_split` (federal-source rows) to `dim_institution.state_code`, sum federal dollars per state, and take the top 10.',
            caveats:
              'Each university is counted in its headquarters state — branch-campus spending in other states is not reattributed. Hospitals and FFRDCs are excluded (the join is HERD-only).',
          }}
        >
          {stateBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <ResponsiveSvg height={Math.max(260, stateBars.length * 28 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={stateBars}
                  color="hsl(var(--accent))"
                  href="/national#geography"
                />
              )}
            </ResponsiveSvg>
          )}
          <p className="mt-3 text-[11px] text-text-tertiary">
            <Link href="/national#geography" className="hover:text-accent">
              Full state map &rarr;
            </Link>
          </p>
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

/* ───────────── HorizontalBarChart — local visx helper ────────────────────── */

interface HBarRow {
  label: string;
  amount: number;
  color?: string;
  bucket?: string;
  nInstitutions?: number;
}

function HorizontalBarChart({
  bars,
  width,
  height,
  color = 'hsl(var(--accent))',
  href,
}: {
  bars: HBarRow[];
  width: number;
  height: number;
  color?: string;
  /** Optional click-through target — the whole chart becomes a link. */
  href?: string;
}) {
  // Longer state labels are short (2 chars); topic labels can stretch ~30 chars.
  // Pick a left-margin that gives the longest label headroom but doesn't
  // crowd narrow mobile viewports.
  const maxLabelLen = bars.reduce((m, b) => Math.max(m, b.label.length), 0);
  const leftMargin = Math.min(220, Math.max(60, maxLabelLen * 7));
  const margin = { top: 8, right: 80, bottom: 28, left: leftMargin };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const y = scaleBand({
    domain: bars.map((b) => b.label),
    range: [0, innerH],
    padding: 0.25,
  });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...bars.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });

  const svg = (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.label) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.label}>
              <rect
                x={0}
                y={by}
                width={bw}
                height={bh}
                fill={b.color ?? color}
                rx={2}
              />
              <text
                x={bw + 6}
                y={by + bh / 2}
                dy="0.35em"
                className="fill-text-secondary text-[11px] tnum"
              >
                {formatDollars(b.amount)}
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

  if (href) {
    return (
      <Link href={href} aria-label="Open detail view" className="block hover:opacity-90">
        {svg}
      </Link>
    );
  }
  return svg;
}
