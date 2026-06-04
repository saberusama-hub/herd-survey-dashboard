'use client';

/**
 * /compare — Side-by-side university comparison page.
 *
 * Rebuilt in Phase S2 to address user feedback:
 *  1. Search returns one entry per university (dedup via HERD-tracked filter
 *     in lib/queries.ts searchInstitutions).
 *  2. Metrics verified against source parquets; FY2005 PI values masked
 *     (entity-resolution discontinuity flagged in agg_uni_pi_universe.data_quality).
 *  3. Year-range selector (start/end FY) defaulting to last 5 FYs (2020–2024).
 *  4. Table view (rows=FY, cols=university) below the charts with CSV export.
 *  5. 15 metrics exposed — see METRICS[] below for each source aggregation.
 *
 * Every metric records (a) its source parquet, (b) its formula, and (c) any
 * data-quality caveats. Audit by reading the `series:` and `description:`
 * fields together.
 */

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { BarChart } from '@/components/charts/BarChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
import { SourceLine } from '@/components/editorial/SourceLine';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCount, formatDollars, formatFy, formatPercent } from '@/lib/format';
import { type UniversityProfile, getUniversityProfile, searchInstitutions } from '@/lib/queries';
import type { SourceCitation } from '@/lib/sources';
import { Download, Search, X } from 'lucide-react';

const MIN_PICKS = 2;
const MAX_PICKS = 5;
const FY_MIN = 2005;
const FY_MAX = 2024;
const DEFAULT_START = 2020;
const DEFAULT_END = 2024;
const PI_MASK_FYS = new Set<number>([2005]); // entity-resolution break — see S1.5 fix 2

/** Time-series shape consumed by the per-uni mini BarChart + table. */
type SeriesPoint = { fiscal_year: number; value: number | null };

type MetricFormat = 'dollars' | 'percent' | 'count' | 'index';

interface MetricDef {
  key: string;
  label: string;
  description: string;
  /** Y-axis / tooltip formatter applied to the SeriesPoint.value */
  format: MetricFormat;
  /** Source parquet(s) — documented for auditing */
  source: string;
  /** Upstream federal raw sources that ultimately produce this metric. */
  sources: SourceCitation[];
  /** Derives a per-FY series from a UniversityProfile. Returns rows even when
   *  data missing for a year (value=null) so the table view stays rectangular
   *  across the selected range; the chart filters nulls. */
  series: (p: UniversityProfile) => SeriesPoint[];
  /** Whether this metric should mask FY2005 for entity-resolution reasons. */
  maskFy05?: boolean;
}

/**
 * Helper: collapse rows by fiscal_year, summing `amount_nominal` where `pred`
 * is true and total. Returns numerator/denominator for share metrics.
 */
function byFyShareSum<T>(
  rows: ReadonlyArray<T>,
  fyOf: (r: T) => number,
  amtOf: (r: T) => number,
  predicate: (r: T) => boolean,
): Array<{ fy: number; num: number; den: number }> {
  const m = new Map<number, { num: number; den: number }>();
  for (const r of rows) {
    const fy = fyOf(r);
    const amt = amtOf(r) || 0;
    const cur = m.get(fy) ?? { num: 0, den: 0 };
    cur.den += amt;
    if (predicate(r)) cur.num += amt;
    m.set(fy, cur);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([fy, v]) => ({ fy, ...v }));
}

/**
 * Helper: compute HHI (Herfindahl) from row-level shares (sum of squared shares).
 * Returns map FY -> HHI, where HHI ranges 0–10,000 (concentration index).
 */
function hhiByFy<T>(
  rows: ReadonlyArray<T>,
  fyOf: (r: T) => number,
  groupOf: (r: T) => string,
  amtOf: (r: T) => number,
): Map<number, number> {
  const m = new Map<number, Map<string, number>>();
  for (const r of rows) {
    const fy = fyOf(r);
    const amt = amtOf(r) || 0;
    if (amt <= 0) continue;
    const inner = m.get(fy) ?? new Map<string, number>();
    inner.set(groupOf(r), (inner.get(groupOf(r)) ?? 0) + amt);
    m.set(fy, inner);
  }
  const out = new Map<number, number>();
  for (const [fy, groups] of m) {
    const total = Array.from(groups.values()).reduce((s, v) => s + v, 0);
    if (total <= 0) continue;
    let h = 0;
    for (const v of groups.values()) {
      const s = (v / total) * 100; // percent share
      h += s * s;
    }
    out.set(fy, h); // 0–10,000
  }
  return out;
}

/**
 * Helper: Shannon entropy in nats from row-level shares.
 */
function shannonByFy<T>(
  rows: ReadonlyArray<T>,
  fyOf: (r: T) => number,
  groupOf: (r: T) => string,
  amtOf: (r: T) => number,
): Map<number, number> {
  const m = new Map<number, Map<string, number>>();
  for (const r of rows) {
    const fy = fyOf(r);
    const amt = amtOf(r) || 0;
    if (amt <= 0) continue;
    const inner = m.get(fy) ?? new Map<string, number>();
    inner.set(groupOf(r), (inner.get(groupOf(r)) ?? 0) + amt);
    m.set(fy, inner);
  }
  const out = new Map<number, number>();
  for (const [fy, groups] of m) {
    const total = Array.from(groups.values()).reduce((s, v) => s + v, 0);
    if (total <= 0) continue;
    let h = 0;
    for (const v of groups.values()) {
      const p = v / total;
      if (p > 0) h -= p * Math.log(p);
    }
    out.set(fy, h);
  }
  return out;
}

/** Convenience: filter sources rows by category. */
const isCat = (c: string) => (r: { source_category: string }) => r.source_category === c;

/* ────────────────────── Metric catalog ────────────────────── */

const METRICS: MetricDef[] = [
  {
    key: 'totalRdNominal',
    label: 'Total R&D ($)',
    description: 'HERD-reported total R&D expenditure per fiscal year, nominal dollars.',
    format: 'dollars',
    source: 'agg_uni_total_rd.total_rd_nominal',
    sources: [
      { id: 'ncses_herd', subset: 'Q01 (Total R&D Expenditures) per institution × FY, nominal dollars, FY2005–FY2024' },
    ],
    series: (p) => p.totalRd.map((r) => ({ fiscal_year: r.fiscal_year, value: Number(r.total_rd_nominal) || 0 })),
  },
  {
    key: 'totalRdReal',
    label: 'Total R&D (FY2024 $)',
    description: 'Total R&D in constant FY2024 dollars (CPI-U deflated).',
    format: 'dollars',
    source: 'agg_uni_total_rd.total_rd_real',
    sources: [
      { id: 'ncses_herd', subset: 'Q01 (Total R&D Expenditures) per institution × FY' },
      { id: 'bls_cpi_u', subset: 'Series CUUR0000SA0 annual averages used to deflate nominal → FY2024 real' },
    ],
    series: (p) => p.totalRd.map((r) => ({ fiscal_year: r.fiscal_year, value: Number(r.total_rd_real) || 0 })),
  },
  {
    key: 'federal',
    label: 'Federal R&D ($)',
    description: 'HERD federal R&D dollars per fiscal year.',
    format: 'dollars',
    source: "agg_uni_source_split where source_category='federal'",
    sources: [{ id: 'ncses_herd', subset: 'Q01 (Sources of Funds) federal-source dollars per institution × FY' }],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('federal'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.num })),
  },
  {
    key: 'state',
    label: 'State R&D ($)',
    description: 'HERD state/local govt R&D dollars per fiscal year.',
    format: 'dollars',
    source: "agg_uni_source_split where source_category='state'",
    sources: [{ id: 'ncses_herd', subset: 'Q01 (Sources of Funds) state/local-source dollars per institution × FY' }],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('state'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.num })),
  },
  {
    key: 'industry',
    label: 'Industry R&D ($)',
    description: 'HERD industry-funded R&D dollars per fiscal year.',
    format: 'dollars',
    source: "agg_uni_source_split where source_category='industry'",
    sources: [{ id: 'ncses_herd', subset: 'Q01 (Sources of Funds) industry-source dollars per institution × FY' }],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('industry'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.num })),
  },
  {
    key: 'institutional',
    label: 'Institutional R&D ($)',
    description: 'HERD institutional (own funds) R&D dollars per fiscal year.',
    format: 'dollars',
    source: "agg_uni_source_split where source_category='institutional'",
    sources: [
      { id: 'ncses_herd', subset: 'Q01 (Sources of Funds) institutional own-funds dollars per institution × FY' },
    ],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('institutional'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.num })),
  },
  {
    key: 'nonprofit',
    label: 'Nonprofit R&D ($)',
    description: 'HERD nonprofit-funded R&D dollars per fiscal year.',
    format: 'dollars',
    source: "agg_uni_source_split where source_category='nonprofit'",
    sources: [{ id: 'ncses_herd', subset: 'Q01 (Sources of Funds) nonprofit-source dollars per institution × FY' }],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('nonprofit'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.num })),
  },
  {
    key: 'federalShare',
    label: 'Federal share (%)',
    description: 'Federal funds as a share of total R&D, per fiscal year.',
    format: 'percent',
    source: 'agg_uni_source_split',
    sources: [
      { id: 'ncses_herd', subset: 'Q01 federal-source dollars ÷ total all-source dollars per institution × FY' },
    ],
    series: (p) =>
      byFyShareSum(
        p.sources,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        isCat('federal'),
      ).map((x) => ({ fiscal_year: x.fy, value: x.den > 0 ? x.num / x.den : 0 })),
  },
  {
    key: 'stemShare',
    label: 'STEM share (%)',
    description: 'Share of HERD R&D in STEM field categories, per fiscal year.',
    format: 'percent',
    source: 'agg_uni_field_mix',
    sources: [{ id: 'ncses_herd', subset: 'Q03 STEM-field dollars ÷ total Q03 dollars per institution × FY' }],
    series: (p) =>
      byFyShareSum(
        p.fieldMix,
        (r) => r.fiscal_year,
        (r) => Number(r.amount_nominal) || 0,
        (r) => Boolean(r.is_stem),
      ).map((x) => ({ fiscal_year: x.fy, value: x.den > 0 ? x.num / x.den : 0 })),
  },
  {
    key: 'piCount',
    label: '# of federal PIs',
    description:
      'Distinct federally-funded PIs (NSF lead + NIH lead+co-PIs) per fiscal year. ' +
      'FY2005 masked due to dim_institution entity-resolution discontinuity. ' +
      'NSF contributes lead PI only (no public co-PI bridge) so this is a floor for NSF.',
    format: 'count',
    source: 'agg_uni_pi_universe.distinct_pi_count',
    sources: [
      { id: 'nsf_awards', subset: 'Lead PI per award for this institution × FY' },
      { id: 'nih_exporter', subset: 'PI bridge file (project × PI) for this institution × FY' },
    ],
    maskFy05: true,
    series: (p) =>
      p.piMetrics.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: PI_MASK_FYS.has(r.fiscal_year) ? null : Number(r.distinct_pi_count) || 0,
      })),
  },
  {
    key: 'amountPerPi',
    label: 'Federal $ per PI',
    description: 'Total NSF + NIH dollars divided by distinct PI count. FY2005 masked.',
    format: 'dollars',
    source: 'agg_uni_pi_universe.amount_per_pi',
    sources: [
      { id: 'nsf_awards', subset: 'NSF $ for this institution × FY ÷ distinct PI count' },
      { id: 'nih_exporter', subset: 'NIH $ for this institution × FY ÷ distinct PI count' },
    ],
    maskFy05: true,
    series: (p) =>
      p.piMetrics.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: PI_MASK_FYS.has(r.fiscal_year) ? null : Number(r.amount_per_pi) || 0,
      })),
  },
  {
    key: 'agencyHHI',
    label: 'Agency HHI',
    description:
      'Herfindahl–Hirschman Index of federal-agency mix (sum of squared % shares, 0–10,000). ' +
      'Higher = more concentrated in one agency.',
    format: 'index',
    source: 'agg_uni_agency_split (computed at query time)',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q09 agency shares for this institution × FY → HHI = Σ(share²) × 10,000',
      },
    ],
    series: (p) => {
      const m = hhiByFy(
        p.agencies,
        (r) => r.fiscal_year,
        (r) => r.agency_bucket,
        (r) => Number(r.amount_nominal) || 0,
      );
      return Array.from(m.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([fy, v]) => ({ fiscal_year: fy, value: v }));
    },
  },
  {
    key: 'fieldShannon',
    label: 'Field-mix entropy',
    description: 'Shannon entropy of HERD field-of-science mix (nats). Higher = more diverse research portfolio.',
    format: 'index',
    source: 'agg_uni_field_mix (computed at query time)',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q03 field-of-science shares for this institution × FY → Shannon entropy in nats',
      },
    ],
    series: (p) => {
      const m = shannonByFy(
        p.fieldMix,
        (r) => r.fiscal_year,
        (r) => r.field_category,
        (r) => Number(r.amount_nominal) || 0,
      );
      return Array.from(m.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([fy, v]) => ({ fiscal_year: fy, value: v }));
    },
  },
  {
    key: 'cov5yr',
    label: '5-yr funding CoV',
    description:
      'Coefficient of variation of total R&D over the trailing 5 years, per agg_uni_concentration. ' +
      'Higher = more volatile funding.',
    format: 'percent',
    source: 'agg_uni_concentration.cov_5yr',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D) trailing-5yr coefficient of variation for this institution',
      },
    ],
    series: (p) =>
      p.concentration.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: r.cov_5yr === null || r.cov_5yr === undefined ? null : Number(r.cov_5yr),
      })),
  },
  {
    key: 'shareOfState',
    label: 'Share of state R&D (%)',
    description: "This university's HERD R&D as a share of the state's total HERD R&D, per fiscal year.",
    format: 'percent',
    source: 'agg_uni_state_context.share_of_state',
    sources: [
      {
        id: 'ncses_herd',
        subset: 'Q01 (Total R&D) for this institution ÷ sum of Q01 across same-state institutions × FY',
      },
      { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
    ],
    series: (p) =>
      p.stateContext.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: r.share_of_state === null || r.share_of_state === undefined ? null : Number(r.share_of_state),
      })),
  },
];

const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

function formatMetricValue(v: number | null, format: MetricFormat): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (format === 'dollars') return formatDollars(v);
  if (format === 'percent') return formatPercent(v, { decimals: 1 });
  if (format === 'index') return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return formatCount(v);
}

/** Loaded profile entry kept in state. */
interface LoadedUni {
  sk: string;
  profile: UniversityProfile;
}

/* ────────────────────── Component ────────────────────── */

export default function ComparePage() {
  const { ready, error } = useDuckDB();
  const [picks, setPicks] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, UniversityProfile>>({});
  const [loadingSk, setLoadingSk] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState<string>('totalRdNominal');
  const [startFy, setStartFy] = useState<number>(DEFAULT_START);
  const [endFy, setEndFy] = useState<number>(DEFAULT_END);

  // Fetch UniversityProfile each time picks grows by one. Cleanup unused entries.
  useEffect(() => {
    if (!ready) return;
    const next = picks.find((sk) => !loaded[sk]);
    if (!next) return;
    let cancelled = false;
    setLoadingSk(next);
    setLoadError(null);
    getUniversityProfile(next)
      .then((p) => {
        if (cancelled) return;
        setLoaded((prev) => ({ ...prev, [next]: p }));
        setLoadingSk((cur) => (cur === next ? null : cur));
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoadingSk((cur) => (cur === next ? null : cur));
        setPicks((prev) => prev.filter((s) => s !== next));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, picks, loaded]);

  // Prune loaded entries no longer in picks.
  useEffect(() => {
    setLoaded((prev) => {
      const picksSet = new Set(picks);
      let changed = false;
      const out: Record<string, UniversityProfile> = {};
      for (const [sk, p] of Object.entries(prev)) {
        if (picksSet.has(sk)) out[sk] = p;
        else changed = true;
      }
      return changed ? out : prev;
    });
  }, [picks]);

  const addPick = (sk: string) => {
    if (picks.includes(sk) || picks.length >= MAX_PICKS) return;
    setPicks((prev) => [...prev, sk]);
  };
  const removePick = (sk: string) => setPicks((prev) => prev.filter((p) => p !== sk));

  const orderedUnis: LoadedUni[] = useMemo(
    () => picks.filter((sk) => loaded[sk]).map((sk) => ({ sk, profile: loaded[sk] })),
    [picks, loaded],
  );

  const activeMetric = METRIC_BY_KEY.get(metricKey) ?? METRICS[0];

  if (error) {
    return (
      <div className="container-wide py-10">
        <PageHeader eyebrow="Compare" title="Side-by-side university comparison" />
        <div className="mt-6 rounded border border-rule bg-surface p-6 text-sm text-text-secondary">
          Failed to initialize the data layer: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Compare"
        title="Side-by-side university comparison"
        description={`Pick ${MIN_PICKS}–${MAX_PICKS} HERD-tracked universities, a metric, and a year range. Charts + a tabular view below.`}
      />

      <Card>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MetricPicker value={metricKey} onChange={setMetricKey} />
            <YearRangePicker
              startFy={startFy}
              endFy={endFy}
              onChange={(s, e) => {
                setStartFy(s);
                setEndFy(e);
              }}
            />
          </div>

          <CohortPicker
            picks={picks}
            loaded={loaded}
            onAdd={addPick}
            onRemove={removePick}
            disabled={!ready}
            loadingSk={loadingSk}
            loadError={loadError}
          />

          {!ready && picks.length === 0 && <p className="text-xs text-text-tertiary">Loading data layer…</p>}
        </CardContent>
      </Card>

      {picks.length < MIN_PICKS ? (
        <EmptyState minPicks={MIN_PICKS} currentPicks={picks.length} />
      ) : (
        <>
          <SmallMultiples
            unis={orderedUnis}
            metric={activeMetric}
            loadingSk={loadingSk}
            startFy={startFy}
            endFy={endFy}
          />
          <CompareTable unis={orderedUnis} metric={activeMetric} startFy={startFy} endFy={endFy} />
        </>
      )}
    </div>
  );
}

/* ────────────────────── Metric picker ────────────────────── */

function MetricPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const description = METRIC_BY_KEY.get(value)?.description ?? '';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider text-text-tertiary">
        Metric
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-rule bg-surface-elevated px-3 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <optgroup label="Funding totals (HERD)">
          {METRICS.filter((m) =>
            ['totalRdNominal', 'totalRdReal', 'federal', 'state', 'industry', 'institutional', 'nonprofit'].includes(
              m.key,
            ),
          ).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Shares & composition">
          {METRICS.filter((m) => ['federalShare', 'stemShare', 'shareOfState'].includes(m.key)).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="People & PIs (NSF + NIH)">
          {METRICS.filter((m) => ['piCount', 'amountPerPi'].includes(m.key)).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Concentration & diversity">
          {METRICS.filter((m) => ['agencyHHI', 'fieldShannon', 'cov5yr'].includes(m.key)).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </optgroup>
      </select>
      <p className="text-[11px] italic text-text-tertiary max-w-md">{description}</p>
    </div>
  );
}

/* ────────────────────── Year range picker ────────────────────── */

function YearRangePicker({
  startFy,
  endFy,
  onChange,
}: {
  startFy: number;
  endFy: number;
  onChange: (start: number, end: number) => void;
}) {
  const startId = useId();
  const endId = useId();
  const years = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MIN + i);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-wider text-text-tertiary">Year range</span>
      <div className="flex items-center gap-2">
        <label htmlFor={startId} className="sr-only">
          Start fiscal year
        </label>
        <select
          id={startId}
          value={startFy}
          onChange={(e) => {
            const s = Number(e.target.value);
            onChange(s, Math.max(s, endFy));
          }}
          className="h-9 flex-1 rounded-md border border-rule bg-surface-elevated px-3 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-tertiary">to</span>
        <label htmlFor={endId} className="sr-only">
          End fiscal year
        </label>
        <select
          id={endId}
          value={endFy}
          onChange={(e) => {
            const ev = Number(e.target.value);
            onChange(Math.min(startFy, ev), ev);
          }}
          className="h-9 flex-1 rounded-md border border-rule bg-surface-elevated px-3 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] italic text-text-tertiary">
        Default is the last 5 FYs (FY2020–FY2024). HERD coverage starts FY2005.
      </p>
    </div>
  );
}

/* ────────────────────── Cohort picker (search + pills) ────────────────────── */

function CohortPicker({
  picks,
  loaded,
  onAdd,
  onRemove,
  disabled,
  loadingSk,
  loadError,
}: {
  picks: string[];
  loaded: Record<string, UniversityProfile>;
  onAdd: (sk: string) => void;
  onRemove: (sk: string) => void;
  disabled: boolean;
  loadingSk: string | null;
  loadError: string | null;
}) {
  const remaining = MAX_PICKS - picks.length;
  const placeholder =
    remaining > 0
      ? `Search universities… (${remaining} slot${remaining === 1 ? '' : 's'} remaining)`
      : `${MAX_PICKS} universities selected — remove one to add another`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 min-h-[34px]">
        {picks.length === 0 && <span className="text-xs text-text-tertiary">No universities selected yet.</span>}
        {picks.map((sk) => {
          const name = loaded[sk]?.name ?? (sk === loadingSk ? 'Loading…' : sk);
          return (
            <span
              key={sk}
              className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface-elevated px-3 py-1.5 text-sm"
            >
              <span className="font-medium tnum">{name}</span>
              {loaded[sk]?.state && <span className="text-[11px] text-text-tertiary tnum">{loaded[sk].state}</span>}
              <button
                type="button"
                onClick={() => onRemove(sk)}
                className="rounded p-0.5 text-text-tertiary hover:text-negative focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </div>

      {picks.length < MAX_PICKS && (
        <SearchTypeahead excludeSks={picks} onPick={onAdd} disabled={disabled} placeholder={placeholder} />
      )}

      {loadError && <p className="text-xs text-negative">Couldn&apos;t load that university: {loadError}</p>}
    </div>
  );
}

function SearchTypeahead({
  excludeSks,
  onPick,
  disabled,
  placeholder,
}: {
  excludeSks: string[];
  onPick: (sk: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const { ready } = useDuckDB();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ sk: string; name: string; state: string | null }>>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!ready) {
      setResults([]);
      return;
    }
    const needle = q.trim();
    if (needle.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      searchInstitutions(needle)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [ready, q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const ex = new Set(excludeSks);
    return results.filter((r) => !ex.has(r.sk));
  }, [results, excludeSks]);

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={wrapRef} className="relative max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-label="Search universities to add"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={showDropdown}
        className="h-10 w-full rounded-md border border-rule bg-surface-elevated pl-10 pr-3 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      {showDropdown && (
        <ul
          id={listboxId}
          className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border border-rule bg-surface-elevated shadow-md divide-y divide-rule"
        >
          {filtered.map((r) => (
            <li key={r.sk} aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(r.sk);
                  setQ('');
                  setResults([]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent-soft/40 focus:bg-accent-soft/40 focus:outline-none"
              >
                <span className="truncate font-medium">{r.name}</span>
                {r.state && <span className="text-[11px] text-text-tertiary tnum">{r.state}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && ready && q.trim().length >= 2 && filtered.length === 0 && (
        <p className="absolute z-20 left-0 right-0 mt-1 rounded-md border border-rule bg-surface-elevated px-3 py-2 text-xs text-text-tertiary">
          No matches for &ldquo;{q}&rdquo;.
        </p>
      )}
    </div>
  );
}

/* ────────────────────── Empty state ────────────────────── */

function EmptyState({ minPicks, currentPicks }: { minPicks: number; currentPicks: number }) {
  const need = Math.max(0, minPicks - currentPicks);
  return (
    <div className="rounded-md border border-dashed border-rule bg-surface p-10 text-center">
      <p className="text-sm text-text-secondary">
        Add {need === 1 ? 'one more university' : `at least ${need} more universities`} to start comparing.
      </p>
      <p className="mt-2 text-[11px] text-text-tertiary">
        Don&rsquo;t know where to start? Try a marquee R1 like Johns Hopkins, Michigan, or MIT — or jump to the{' '}
        <Link href="/universities" className="underline hover:text-text-secondary">
          full directory
        </Link>
        .
      </p>
    </div>
  );
}

/* ────────────────────── Small multiples grid ────────────────────── */

function clipToRange(points: SeriesPoint[], start: number, end: number): SeriesPoint[] {
  return points.filter((p) => p.fiscal_year >= start && p.fiscal_year <= end);
}

function SmallMultiples({
  unis,
  metric,
  loadingSk,
  startFy,
  endFy,
}: {
  unis: LoadedUni[];
  metric: MetricDef;
  loadingSk: string | null;
  startFy: number;
  endFy: number;
}) {
  const seriesPerUni = useMemo(
    () =>
      unis.map((u) => ({
        sk: u.sk,
        name: u.profile.name,
        state: u.profile.state,
        points: clipToRange(metric.series(u.profile), startFy, endFy),
      })),
    [unis, metric, startFy, endFy],
  );

  const sharedMax = useMemo(() => {
    let m = 0;
    for (const u of seriesPerUni)
      for (const p of u.points) {
        if (p.value !== null && p.value > m) m = p.value;
      }
    return m;
  }, [seriesPerUni]);

  const yFormat = (v: number) => formatMetricValue(v, metric.format);

  const colCount =
    unis.length === 1
      ? 'sm:grid-cols-1'
      : unis.length === 2
        ? 'sm:grid-cols-2'
        : unis.length === 3
          ? 'sm:grid-cols-2 lg:grid-cols-3'
          : unis.length === 4
            ? 'sm:grid-cols-2'
            : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className={`grid grid-cols-1 ${colCount} gap-4 md:gap-6`} aria-label="Comparison panels">
      {seriesPerUni.map((u) => {
        const data = u.points
          .filter((p) => p.value !== null)
          .map((p) => ({ fiscal_year: p.fiscal_year, value: p.value as number }));
        const latest = data.length > 0 ? data[data.length - 1] : null;
        const peak = data.reduce<{ fy: number; v: number } | null>((acc, p) => {
          if (!acc || p.value > acc.v) return { fy: p.fiscal_year, v: p.value };
          return acc;
        }, null);

        return (
          <Card key={u.sk}>
            <CardContent className="space-y-3">
              <ChartFrame
                eyebrow={u.state ?? undefined}
                title={u.name}
                dek={
                  latest
                    ? `FY${latest.fiscal_year}: ${formatMetricValue(latest.value, metric.format)}`
                    : 'No data in range'
                }
                sources={metric.sources}
                note={
                  peak && data.length > 1
                    ? `Peak FY${peak.fy} · ${formatMetricValue(peak.v, metric.format)}`
                    : undefined
                }
                methodology={{
                  what: `One bar per fiscal year showing this university’s ${metric.label.toLowerCase()} over the selected window — easy to eyeball next to the other universities you picked.`,
                  how: `${metric.label} is pulled from this university’s profile bundle and filtered to FY${startFy}–FY${endFy}. The y-axis is shared across all small-multiple panels so bar heights are directly comparable across institutions.`,
                  caveats:
                    'A missing year means the institution did not report (or did not exist in the source dataset) for that fiscal year — not zero.',
                }}
              >
                {data.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-rule text-xs text-text-tertiary">
                    No {metric.label.toLowerCase()} data in this range.
                  </div>
                ) : (
                  <BarChart
                    data={data as unknown as Array<Record<string, unknown>>}
                    xKey="fiscal_year"
                    series={[{ key: 'value', label: metric.label }]}
                    height={220}
                    showLegend={false}
                    yFormat={yFormat}
                  />
                )}
              </ChartFrame>
            </CardContent>
          </Card>
        );
      })}
      {loadingSk && (
        <Card>
          <CardContent>
            <div className="flex h-[260px] animate-pulse items-center justify-center rounded-md bg-border/15 text-xs text-text-tertiary">
              Loading…
            </div>
          </CardContent>
        </Card>
      )}
      {sharedMax === 0 && unis.length > 0 && (
        <p className="col-span-full text-[11px] italic text-text-tertiary">
          No data reported across the selected cohort for this metric in this range.
        </p>
      )}
    </section>
  );
}

/* ────────────────────── Table view + CSV export ────────────────────── */

function CompareTable({
  unis,
  metric,
  startFy,
  endFy,
}: {
  unis: LoadedUni[];
  metric: MetricDef;
  startFy: number;
  endFy: number;
}) {
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = startFy; y <= endFy; y++) out.push(y);
    return out;
  }, [startFy, endFy]);

  // Build a uni → (fy → value|null) lookup.
  const lookup = useMemo(() => {
    const m = new Map<string, Map<number, number | null>>();
    for (const u of unis) {
      const pts = metric.series(u.profile);
      const inner = new Map<number, number | null>();
      for (const p of pts) inner.set(p.fiscal_year, p.value);
      m.set(u.sk, inner);
    }
    return m;
  }, [unis, metric]);

  const csvHref = useMemo(() => {
    const head = ['fiscal_year', ...unis.map((u) => `${u.profile.name} (${u.profile.state ?? ''})`)];
    const rows: string[] = [head.map(csvCell).join(',')];
    for (const y of years) {
      const cells = [
        String(y),
        ...unis.map((u) => {
          const v = lookup.get(u.sk)?.get(y);
          if (v === null || v === undefined || Number.isNaN(v)) return '';
          // CSV: numeric raw value (no formatting) so downstream tools can parse.
          return String(v);
        }),
      ];
      rows.push(cells.map(csvCell).join(','));
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [years, unis, lookup]);

  const csvName = `compare_${metric.key}_FY${startFy}-FY${endFy}.csv`;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="h-section">Table view</h2>
            <div className="text-[11px] italic text-text-tertiary">
              <p>Rows = fiscal year, columns = university. Same metric as charts above.</p>
              <div className="mt-1 not-italic">
                <SourceLine sources={metric.sources} variant={metric.sources.length > 1 ? 'block' : 'inline'} />
              </div>
            </div>
          </div>
          <a
            href={csvHref}
            download={csvName}
            className="inline-flex h-9 items-center gap-2 self-start rounded-md border border-rule bg-surface-elevated px-3 text-sm hover:bg-accent-soft/40 focus:outline-none focus:ring-2 focus:ring-ring md:self-auto"
          >
            <Download className="h-3.5 w-3.5" /> Download CSV
          </a>
        </div>
        <CompareGrid years={years} unis={unis} lookup={lookup} metric={metric} />
      </CardContent>
    </Card>
  );
}

function CompareGrid({
  years,
  unis,
  lookup,
  metric,
}: {
  years: number[];
  unis: LoadedUni[];
  lookup: Map<string, Map<number, number | null>>;
  metric: MetricDef;
}) {
  // Flatten the (year × uni) grid into wide rows so useTableSort can compare
  // by any single column (FY or any university's value for that FY).
  const rows = years.map((y) => {
    const row: Record<string, number | null> = { fiscal_year: y };
    for (const u of unis) {
      const v = lookup.get(u.sk)?.get(y);
      row[`uni_${u.sk}`] = v === undefined || v === null ? null : v;
    }
    return row;
  });
  const accessors: Record<string, (r: (typeof rows)[number]) => number | null> = {
    fiscal_year: (r) => r.fiscal_year,
  };
  const defaultDir: Record<string, 'asc' | 'desc'> = { fiscal_year: 'desc' };
  for (const u of unis) {
    accessors[`uni_${u.sk}`] = (r) => r[`uni_${u.sk}`];
    defaultDir[`uni_${u.sk}`] = 'desc';
  }
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'fiscal_year', dir: 'desc' },
    accessors,
    defaultDir,
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-rule">
          <tr>
            <SortableTh
              sortKey="fiscal_year"
              sort={sort}
              onSort={requestSort}
              className="py-2 pr-3 text-[11px] uppercase tracking-wider"
            >
              Fiscal year
            </SortableTh>
            {unis.map((u) => (
              <SortableTh
                key={u.sk}
                sortKey={`uni_${u.sk}`}
                sort={sort}
                onSort={requestSort}
                align="right"
                className="py-2 px-3 text-[11px] uppercase tracking-wider"
                title={u.profile.name}
              >
                <span className="block truncate normal-case font-medium">{u.profile.name}</span>
                {u.profile.state && (
                  <span className="block text-[10px] font-normal normal-case text-text-tertiary tnum">
                    {u.profile.state}
                  </span>
                )}
              </SortableTh>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {sorted.map((r) => {
            const y = r.fiscal_year as number;
            const masked = metric.maskFy05 && PI_MASK_FYS.has(y);
            return (
              <tr key={y}>
                <td className="py-2 pr-3 tnum text-text-secondary">{formatFy(y)}</td>
                {unis.map((u) => {
                  const v = r[`uni_${u.sk}`];
                  return (
                    <td key={u.sk} className="py-2 px-3 text-right tnum">
                      {masked ? (
                        <span
                          className="text-text-tertiary italic"
                          title="FY2005 masked: dim_institution entity-resolution discontinuity"
                        >
                          masked
                        </span>
                      ) : (
                        formatMetricValue(v === undefined || v === null ? null : v, metric.format)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Escape a CSV cell — quote if it contains comma, quote, or newline. */
function csvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
