'use client';

import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { UniversitySearchBox } from '@/components/editorial/UniversitySearchBox';
import { formatDollars, formatPercent } from '@/lib/format';
import snapshot from '@/public/data/home-snapshot.json' assert { type: 'json' };
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

// ───────── Color tokens used across the home charts ─────────
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

// Spelled-out full names for the KPI hint + source notes. Short acronyms in
// the headline, full department names in the secondary text so a reader who
// doesn't know "HHS" still understands what they're looking at.
const AGENCY_FULL_NAME: Record<string, string> = {
  HHS: 'U.S. Department of Health & Human Services (includes the NIH)',
  NSF: 'National Science Foundation',
  DOD: 'U.S. Department of Defense',
  DOE: 'U.S. Department of Energy',
  NASA: 'National Aeronautics & Space Administration',
  USDA: 'U.S. Department of Agriculture',
  Other: 'Other federal agencies (combined)',
};

/**
 * Homepage is rendered from a precomputed snapshot at apps/web/public/data/
 * home-snapshot.json. The snapshot is built by scripts/precompute_home_snapshot.js
 * whenever the parquet bundle changes, then committed alongside the parquets so
 * the page imports it at compile time and renders instantly without ever
 * initialising DuckDB-WASM.
 *
 * Before this refactor the homepage ran 7 queries through DuckDB-WASM on
 * mount, gating data behind a ~26s cold-start path (CDN WASM download + 41
 * sequential parquet view registrations + 7 await query() calls). After,
 * first paint is the static render itself.
 */

export default function HomePage() {
  const kpis = snapshot.kpis;
  const topAgency = snapshot.top_agency;
  const top10 = snapshot.top10_universities;

  // Available fiscal years (ascending). Per-chart pickers default to latest.
  const years = snapshot.available_years;
  const latestYear = years[years.length - 1];

  // Independent year state per chart — change one without touching the others.
  const [topicsFy, setTopicsFy] = useState<number>(latestYear);
  const [agenciesFy, setAgenciesFy] = useState<number>(latestYear);
  const [sourcesFy, setSourcesFy] = useState<number>(latestYear);
  const [statesFy, setStatesFy] = useState<number>(latestYear);

  // ───────── Derived figures for KPI strip ─────────
  const fy24FederalPct = kpis?.fy24_total && kpis?.fy24_federal ? kpis.fy24_federal / kpis.fy24_total : null;

  const tiles: KpiTile[] = [
    {
      label: 'Tracked entities',
      value: kpis ? kpis.total_entities.toLocaleString('en-US') : '—',
      hint: (
        <span className="text-text-tertiary text-[11px]">
          every uni, FFRDC, hospital, lab, etc. in the federal-grant universe
        </span>
      ),
      sources: [
        { id: 'ipeds', subset: 'HD directory file, latest available year' },
        { id: 'usaspending', subset: 'Recipient UEI universe joined to IPEDS' },
      ],
    },
    {
      label: 'HERD-surveyed universities',
      value: kpis ? kpis.herd_universities.toLocaleString('en-US') : '—',
      hint: (
        <span className="text-text-tertiary text-[11px]">
          the funding-traced subset (every $ flow on this site is for these)
        </span>
      ),
      sources: [{ id: 'ncses_herd', subset: 'Reporting universe, FY2005–FY2024' }],
    },
    {
      label: kpis ? `FY${kpis.fy24} total university R&D` : 'Latest total R&D',
      value: kpis ? formatDollars(kpis.fy24_total) : '—',
      hint: <span className="text-text-tertiary text-[11px]">HERD Q01, all six funding sources combined</span>,
      sources: [{ id: 'ncses_herd', subset: 'Q01 Total R&D summed across all institutions (latest FY)' }],
    },
    {
      label: kpis ? `FY${kpis.fy24} federal share` : 'Latest federal share',
      value: kpis ? formatDollars(kpis.fy24_federal) : '—',
      hint: (
        <span className="text-text-tertiary text-[11px]">
          {fy24FederalPct !== null ? `${formatPercent(fy24FederalPct)} of the total` : 'federal slice of HERD'}
        </span>
      ),
      sources: [{ id: 'ncses_herd', subset: 'Q01 federal-source dollars summed across all institutions (latest FY)' }],
    },
    {
      label: '20-yr cumulative federal R&D',
      value: kpis ? formatDollars(kpis.cum20_federal) : '—',
      hint: <span className="text-text-tertiary text-[11px]">FY2005–FY{kpis?.fy24 ?? '—'}, nominal dollars</span>,
      sources: [{ id: 'ncses_herd', subset: 'Q01 federal-source dollars summed across all institutions × FY' }],
    },
    {
      label: topAgency ? `Largest funder, FY${topAgency.fy}` : 'Largest funder',
      value: topAgency ? `${AGENCY_LABEL[topAgency.agency_bucket] ?? topAgency.agency_bucket}` : '—',
      hint: topAgency ? (
        <span className="text-text-tertiary text-[11px]">
          {AGENCY_FULL_NAME[topAgency.agency_bucket] ?? topAgency.agency_bucket} ·{' '}
          {formatDollars(topAgency.amount_nominal)} · {formatPercent(topAgency.pct_of_federal)} of federal R&D
        </span>
      ) : undefined,
      sources: [
        {
          id: 'ncses_herd',
          subset: `Q09 Federal R&D by Agency, largest bucket in latest FY. HHS = ${AGENCY_FULL_NAME.HHS}.`,
        },
      ],
    },
  ];

  // ───────── Chart-ready slices, derived from per-FY state ─────────
  // Each picker drives one useMemo; year-change re-pivots in <1ms over the
  // entire 20-year snapshot (a few hundred rows per section).

  const topicBars = useMemo(
    () =>
      snapshot.topics_by_fy
        .filter((r) => r.fy === topicsFy)
        .slice(0, 10)
        .map((t) => ({ label: t.topic, amount: Number(t.tagged_amount) || 0 })),
    [topicsFy],
  );

  const agencyBars = useMemo(() => {
    const rows = snapshot.agencies_by_fy.filter((r) => r.fy === agenciesFy);
    const total = rows.reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    return rows.map((r) => ({
      label: AGENCY_LABEL[r.agency_bucket] ?? r.agency_bucket,
      bucket: r.agency_bucket,
      amount: Number(r.amount_nominal) || 0,
      share: total > 0 ? Number(r.amount_nominal) / total : 0,
      color: AGENCY_COLOR[r.agency_bucket] ?? 'hsl(var(--agency-other))',
    }));
  }, [agenciesFy]);

  const sourceBars = useMemo(() => {
    const rows = snapshot.sources_by_fy.filter((r) => r.fy === sourcesFy);
    return SOURCE_ORDER.map((k) => {
      const row = rows.find((r) => r.source_category === k);
      return {
        label: SOURCE_LABEL[k],
        key: k,
        amount: row ? Number(row.total) || 0 : 0,
        color: SOURCE_COLOR[k],
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [sourcesFy]);

  const stateBars = useMemo(
    () =>
      snapshot.states_by_fy
        .filter((r) => r.fy === statesFy)
        .slice(0, 10)
        .map((r) => ({
          label: r.state_code,
          amount: Number(r.total) || 0,
          nInstitutions: Number(r.n_institutions) || 0,
        })),
    [statesFy],
  );

  return (
    <div className="container-wide pt-12 pb-20 md:pt-20 md:pb-28 space-y-16 md:space-y-24">
      {/* ─── Editorial hero ─── */}
      <header className="accent-wash -mx-6 -mt-12 px-6 pb-12 pt-12 sm:-mx-8 sm:px-8 md:-mt-20 md:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
          <div className="space-y-6">
            <p className="t-eyebrow text-accent">
              <span
                aria-hidden
                className="mr-2 inline-block h-1.5 w-1.5 -translate-y-[2px] rounded-full bg-accent align-middle"
              />
              A data product by Research Data Platform
            </p>
            <h1 className="t-display-xl max-w-[14ch]">
              U.S. University
              <br />
              Research Funding.
            </h1>
            <p className="t-dek">
              Twenty years. Eight hundred institutions. Seven federal agencies. One data lake — queryable, exportable,
              reproducible.
            </p>
            <div className="pt-3">
              <UniversitySearchBox className="w-full md:max-w-xl" />
            </div>
          </div>

          {/* Marquee figure — the headline FY24 total floating beside the title. */}
          <div className="hidden lg:block">
            <div className="border-l border-rule pl-8">
              <p className="t-eyebrow text-text-tertiary">
                {kpis ? `Latest reported FY${kpis.fy24}` : 'Latest reported FY'}
              </p>
              <p className="t-num-display mt-3">{kpis ? formatDollars(kpis.fy24_total) : '—'}</p>
              <p className="mt-3 max-w-xs text-[13px] leading-snug text-text-secondary">
                Total HERD-reported research and development spending across every U.S. doctorate-granting university —
                federal, state, industry, and own funds combined.
              </p>
              {kpis && (
                <p className="mt-3 text-[11px] uppercase tracking-wider text-text-tertiary tabular-nums">
                  {formatDollars(kpis.fy24_federal)}
                  <span className="ml-1.5 normal-case tracking-normal text-text-tertiary">
                    from federal sources
                    {fy24FederalPct !== null && <span className="ml-1.5">· {formatPercent(fy24FederalPct)} share</span>}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── KPI strip: 6 tiles ─── */}
      <section aria-label="Headline figures">
        <KpiStrip tiles={tiles} cols={3} />
      </section>

      {/* ─── Top 10 leaderboard ─── */}
      <section>
        <ChartFrame
          eyebrow="Leaderboard · latest reported FY"
          title="Top 10 universities by total R&D"
          dek="Click a row to view that profile."
          sources={[
            {
              id: 'ncses_herd',
              subset: 'Q01 (Total R&D Expenditures) per institution, latest reported FY, ranked top 10',
            },
          ]}
          methodology={{
            what: 'A quick ranking of the ten biggest U.S. research universities by total R&D spending in the most recent reported year.',
            how: 'For the latest fiscal year in `agg_uni_total_rd` we sort all HERD-tracked universities by `total_rd_nominal` (combined federal + state + industry + institutional + nonprofit + other) and take the top 10.',
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
                      {r.state && <span className="text-text-tertiary text-xs flex-shrink-0">{r.state}</span>}
                    </span>
                    <span className="text-accent tnum flex-shrink-0">{formatDollars(r.total_rd_fy2024)}</span>
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
          eyebrow={`FY${topicsFy} ranking`}
          title="Top 10 research topics by federal $"
          dek="The biggest concrete research areas across NSF + NIH grants in the chosen fiscal year — change the year to re-rank."
          sources={[
            {
              id: 'nsf_awards',
              subset: `Award titles + abstracts regex-matched against 30-topic taxonomy, $ summed per topic for FY${topicsFy}`,
            },
            {
              id: 'nih_exporter',
              subset: `Project titles + terms regex-matched against 30-topic taxonomy, $ summed per topic for FY${topicsFy}`,
            },
          ]}
          methodology={{
            what: 'A ranking of the ten research topics that attracted the most federal grant dollars in the selected year — concrete subject areas like Cancer, AI/ML, Climate.',
            how: 'Every NSF and NIH grant is scanned against a hand-tuned 30-topic regex taxonomy (titles + NSF abstracts + NIH project terms). We sum the tagged dollars per topic for the chosen FY and take the top 10.',
            caveats:
              'Topics are NOT mutually exclusive — one grant can match several (e.g., "Cancer" + "AI/ML"). Dollar totals across topics can exceed the federal total because of this overlap.',
          }}
        >
          <ChartYearPicker value={topicsFy} onChange={setTopicsFy} years={years} />
          {topicBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">No topic data for FY{topicsFy}.</p>
          ) : (
            <ResponsiveSvg height={Math.max(260, topicBars.length * 24 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={topicBars}
                  color="hsl(var(--accent))"
                  href="/national#topics"
                  ariaLabel="Top research topics by federal funding"
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
          eyebrow={`FY${agenciesFy} share`}
          title="Federal funding agencies by share"
          dek={`Which federal departments paid the most to U.S. universities in FY${agenciesFy}. HHS = ${AGENCY_FULL_NAME.HHS}.`}
          sources={[
            {
              id: 'ncses_herd',
              subset: `Q09 (Federal R&D by Agency) summed across HERD-tracked institutions for FY${agenciesFy} × agency bucket`,
            },
          ]}
          methodology={{
            what: 'How federal research dollars split across the major funding agencies in the selected year — HHS (NIH), NSF, DOD, DOE, NASA, USDA, and "Other".',
            how: 'We take HERD Q09 ("Federal R&D by agency") for the chosen FY and sum across all universities into the seven canonical buckets. Each bar shows total dollars and share of federal R&D.',
            caveats:
              'HERD Q09 lags Q01 by about one year, so a recent-year view may report one year behind the source-of-funds chart on the same page. Sub-agencies (NIH institutes, DOD sub-commands) are rolled to parent.',
          }}
        >
          <ChartYearPicker value={agenciesFy} onChange={setAgenciesFy} years={years} />
          {agencyBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">No agency data for FY{agenciesFy}.</p>
          ) : (
            <ResponsiveSvg height={Math.max(220, agencyBars.length * 36 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={agencyBars}
                  href="/national#agencies"
                  ariaLabel="Largest federal funding agencies"
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
          eyebrow={`FY${sourcesFy} source mix`}
          title="R&D by funding source"
          dek="How that year's R&D dollars split across federal, state, industry, institutional, nonprofit, and other sources."
          sources={[
            {
              id: 'ncses_herd',
              subset: `Q01 (Sources of Funds) summed across all HERD-tracked institutions for FY${sourcesFy}`,
            },
          ]}
          methodology={{
            what: 'A horizontal bar showing how many dollars each funding source contributed to U.S. university research in the selected year.',
            how: 'We sum HERD Q01 reported amounts across all HERD-tracked institutions for the chosen FY, grouped by source category (federal, state, industry, institutional, nonprofit, other). Bars are sorted by total contribution.',
            caveats:
              'Nominal dollars (not inflation-adjusted). "Nonprofit" is conservative for FY2005–FY2009 because HERD did not collect that category in that window (ARDES non-response).',
          }}
        >
          <ChartYearPicker value={sourcesFy} onChange={setSourcesFy} years={years} />
          {sourceBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">No source data for FY{sourcesFy}.</p>
          ) : (
            <ResponsiveSvg height={Math.max(220, sourceBars.length * 36 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={sourceBars}
                  ariaLabel="University R&D by funding source"
                />
              )}
            </ResponsiveSvg>
          )}
        </ChartFrame>

        <ChartFrame
          eyebrow={`FY${statesFy} ranking`}
          title="Top 10 states by federal R&D"
          dek="Where federal research money landed geographically in the selected fiscal year."
          sources={[
            {
              id: 'ncses_herd',
              subset: `Q01 federal-source dollars per institution for FY${statesFy}`,
            },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) for each institution_sk' },
          ]}
          methodology={{
            what: 'A ranking of the ten U.S. states whose universities received the most federal research funding in the selected year.',
            how: 'For the chosen fiscal year we join `agg_uni_source_split` (federal-source rows) to `dim_institution.state_code`, sum federal dollars per state, and take the top 10.',
            caveats:
              'Each university is counted in its headquarters state — branch-campus spending in other states is not reattributed. Hospitals and FFRDCs are excluded (the join is HERD-only).',
          }}
        >
          <ChartYearPicker value={statesFy} onChange={setStatesFy} years={years} />
          {stateBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">No state data for FY{statesFy}.</p>
          ) : (
            <ResponsiveSvg height={Math.max(260, stateBars.length * 28 + 40)}>
              {(w, h) => (
                <HorizontalBarChart
                  width={w}
                  height={h}
                  bars={stateBars}
                  color="hsl(var(--accent))"
                  href="/national#geography"
                  ariaLabel="Top states by federal research funding"
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
      <section className="border-t border-rule pt-12">
        <p className="t-eyebrow text-text-tertiary mb-5">Where to next</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CtaCard href="/universities" eyebrow="Browse" title="All 1,014 universities" />
          <CtaCard href="/national" eyebrow="Aggregate" title="National view" />
          <CtaCard href="/topics" eyebrow="Taxonomy" title="30 research topics" />
          <CtaCard href="/sbir" eyebrow="Small business" title="SBIR / STTR awards" />
          <CtaCard href="/compare" eyebrow="Side-by-side" title="Compare institutions" />
          <CtaCard href="/sources" eyebrow="Provenance" title="Federal raw sources" />
        </div>
      </section>
    </div>
  );
}

/* ───────────── CtaCard — refined CTA used in the homepage footer ─────────── */

function CtaCard({ href, eyebrow, title }: { href: string; eyebrow: string; title: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 border-t border-rule pt-4 pr-2 transition-colors hover:border-accent"
    >
      <p className="t-eyebrow text-text-tertiary transition-colors group-hover:text-accent">{eyebrow}</p>
      <p className="text-[17px] font-semibold tracking-tight text-text-primary transition-colors group-hover:text-accent">
        {title}{' '}
        <span aria-hidden className="ml-0.5 inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
    </Link>
  );
}

/* ───────────── ChartYearPicker — compact per-chart FY selector ───────────── */

function ChartYearPicker({
  value,
  onChange,
  years,
}: {
  value: number;
  onChange: (next: number) => void;
  years: readonly number[];
}) {
  const id = useId();
  return (
    <div className="-mt-2 mb-3 flex items-center gap-2">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider text-text-tertiary">
        Year
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 rounded-md border border-rule bg-surface-elevated px-2 text-xs tnum focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {[...years]
          .sort((a, b) => b - a)
          .map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
      </select>
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
  ariaLabel,
}: {
  bars: HBarRow[];
  width: number;
  height: number;
  color?: string;
  /** Optional click-through target — the whole chart becomes a link. */
  href?: string;
  ariaLabel?: string;
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
    <svg width={width} height={height} role="img" aria-label={ariaLabel ?? 'Horizontal bar chart'}>
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.label) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.label}>
              <rect x={0} y={by} width={bw} height={bh} fill={b.color ?? color} rx={2} />
              <text x={bw + 6} y={by + bh / 2} dy="0.35em" className="fill-text-secondary text-[11px] tnum">
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
