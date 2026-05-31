'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { BarChart } from '@/components/charts/BarChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCount, formatDollars, formatPercent } from '@/lib/format';
import {
  type UniversityProfile,
  getUniversityProfile,
  searchInstitutions,
} from '@/lib/queries';
import { Search, X } from 'lucide-react';

const MIN_PICKS = 2;
const MAX_PICKS = 5;

/** Time-series shape consumed by the per-uni mini BarChart. */
type SeriesPoint = { fiscal_year: number; value: number };

type MetricFormat = 'dollars' | 'percent' | 'count';

interface MetricDef {
  key: 'totalRd' | 'federalShare' | 'piCount' | 'stemShare';
  label: string;
  description: string;
  /** Y-axis / tooltip formatter applied to the SeriesPoint.value */
  format: MetricFormat;
  /** Derives a per-FY series from a UniversityProfile. */
  series: (p: UniversityProfile) => SeriesPoint[];
}

const METRICS: MetricDef[] = [
  {
    key: 'totalRd',
    label: 'Total R&D',
    description: 'HERD-reported total R&D expenditure per fiscal year (nominal dollars).',
    format: 'dollars',
    series: (p) =>
      p.totalRd.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: Number(r.total_rd_nominal) || 0,
      })),
  },
  {
    key: 'federalShare',
    label: 'Federal share',
    description: 'Federal funds as a share of total R&D, per fiscal year.',
    format: 'percent',
    series: (p) => {
      const byFy = new Map<number, { fed: number; total: number }>();
      for (const r of p.sources) {
        const acc = byFy.get(r.fiscal_year) ?? { fed: 0, total: 0 };
        const amt = Number(r.amount_nominal) || 0;
        acc.total += amt;
        if (r.source_category === 'federal') acc.fed += amt;
        byFy.set(r.fiscal_year, acc);
      }
      return Array.from(byFy.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([fy, v]) => ({
          fiscal_year: fy,
          value: v.total > 0 ? v.fed / v.total : 0,
        }));
    },
  },
  {
    key: 'piCount',
    label: '# of PIs',
    description: 'Distinct federally-funded PIs counted in the top-20K NIH+NSF grants ledger.',
    format: 'count',
    series: (p) =>
      p.piMetrics.map((r) => ({
        fiscal_year: r.fiscal_year,
        value: Number(r.pi_count) || 0,
      })),
  },
  {
    key: 'stemShare',
    label: 'STEM share',
    description: 'Share of HERD R&D in STEM field categories, per fiscal year.',
    format: 'percent',
    series: (p) => {
      const byFy = new Map<number, { stem: number; total: number }>();
      for (const r of p.fieldMix) {
        const acc = byFy.get(r.fiscal_year) ?? { stem: 0, total: 0 };
        const amt = Number(r.amount_nominal) || 0;
        acc.total += amt;
        if (r.is_stem) acc.stem += amt;
        byFy.set(r.fiscal_year, acc);
      }
      return Array.from(byFy.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([fy, v]) => ({
          fiscal_year: fy,
          value: v.total > 0 ? v.stem / v.total : 0,
        }));
    },
  },
];

const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

function formatMetricValue(v: number | null, format: MetricFormat): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (format === 'dollars') return formatDollars(v);
  if (format === 'percent') return formatPercent(v, { decimals: 1 });
  return formatCount(v);
}

/** Loaded profile entry kept in state. */
interface LoadedUni {
  sk: string;
  profile: UniversityProfile;
}

export default function ComparePage() {
  const { ready, error } = useDuckDB();
  const [picks, setPicks] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, UniversityProfile>>({});
  const [loadingSk, setLoadingSk] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState<MetricDef['key']>('totalRd');

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
        // Drop the failed pick so the user can retry.
        setPicks((prev) => prev.filter((s) => s !== next));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, picks, loaded]);

  // Prune loaded entries no longer in picks (keeps memory bounded).
  useEffect(() => {
    setLoaded((prev) => {
      const picksSet = new Set(picks);
      let changed = false;
      const out: Record<string, UniversityProfile> = {};
      for (const [sk, p] of Object.entries(prev)) {
        if (picksSet.has(sk)) {
          out[sk] = p;
        } else {
          changed = true;
        }
      }
      return changed ? out : prev;
    });
  }, [picks]);

  const addPick = (sk: string) => {
    if (picks.includes(sk) || picks.length >= MAX_PICKS) return;
    setPicks((prev) => [...prev, sk]);
  };

  const removePick = (sk: string) => {
    setPicks((prev) => prev.filter((p) => p !== sk));
  };

  const orderedUnis: LoadedUni[] = useMemo(() => {
    return picks
      .filter((sk) => loaded[sk])
      .map((sk) => ({ sk, profile: loaded[sk] }));
  }, [picks, loaded]);

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
        description={`Pick ${MIN_PICKS}–${MAX_PICKS} universities and a metric. Each university renders as its own small multiple so trajectories line up at a glance.`}
      />

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <MetricPicker
              value={metricKey}
              onChange={setMetricKey}
              description={activeMetric.description}
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

          {!ready && picks.length === 0 && (
            <p className="text-xs text-text-tertiary">Loading data layer…</p>
          )}
        </CardContent>
      </Card>

      {picks.length < MIN_PICKS ? (
        <EmptyState minPicks={MIN_PICKS} currentPicks={picks.length} />
      ) : (
        <SmallMultiples unis={orderedUnis} metric={activeMetric} loadingSk={loadingSk} />
      )}
    </div>
  );
}

/* ────────────────────── Metric picker ────────────────────── */

function MetricPicker({
  value,
  onChange,
  description,
}: {
  value: MetricDef['key'];
  onChange: (v: MetricDef['key']) => void;
  description: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wider text-text-tertiary"
      >
        Metric
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as MetricDef['key'])}
        className="h-9 rounded-md border border-rule bg-surface-elevated px-3 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {METRICS.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] italic text-text-tertiary max-w-md">{description}</p>
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
  const placeholder = remaining > 0
    ? `Search universities… (${remaining} slot${remaining === 1 ? '' : 's'} remaining)`
    : `${MAX_PICKS} universities selected — remove one to add another`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 min-h-[34px]">
        {picks.length === 0 && (
          <span className="text-xs text-text-tertiary">No universities selected yet.</span>
        )}
        {picks.map((sk) => {
          const name = loaded[sk]?.name ?? (sk === loadingSk ? 'Loading…' : sk);
          return (
            <span
              key={sk}
              className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface-elevated px-3 py-1.5 text-sm"
            >
              <span className="font-medium tnum">{name}</span>
              {loaded[sk]?.state && (
                <span className="text-[11px] text-text-tertiary tnum">
                  {loaded[sk].state}
                </span>
              )}
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
        <SearchTypeahead
          excludeSks={picks}
          onPick={onAdd}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}

      {loadError && (
        <p className="text-xs text-negative">Couldn't load that university: {loadError}</p>
      )}
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

  // Debounced search — only kick off after the user stops typing 150ms.
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

  // Outside click closes the dropdown.
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
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border border-rule bg-surface-elevated shadow-md divide-y divide-rule"
        >
          {filtered.map((r) => (
            <li key={r.sk} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown (not click) so focus loss doesn't cancel the add
                  e.preventDefault();
                  onPick(r.sk);
                  setQ('');
                  setResults([]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent-soft/40 focus:bg-accent-soft/40 focus:outline-none"
              >
                <span className="truncate font-medium">{r.name}</span>
                {r.state && (
                  <span className="text-[11px] text-text-tertiary tnum">{r.state}</span>
                )}
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
        Add {need === 1 ? 'one more university' : `at least ${need} more universities`} to start
        comparing.
      </p>
      <p className="mt-2 text-[11px] text-text-tertiary">
        Don&rsquo;t know where to start? Try a marquee R1 like Johns Hopkins, Michigan, or MIT —
        or jump to the{' '}
        <Link href="/universities" className="underline hover:text-text-secondary">
          full directory
        </Link>
        .
      </p>
    </div>
  );
}

/* ────────────────────── Small multiples grid ────────────────────── */

function SmallMultiples({
  unis,
  metric,
  loadingSk,
}: {
  unis: LoadedUni[];
  metric: MetricDef;
  loadingSk: string | null;
}) {
  // Compute the shared Y-domain across every selected uni so panels are
  // directly comparable. Each uni's max defines the local label / footnote.
  const seriesPerUni = useMemo(
    () => unis.map((u) => ({ sk: u.sk, name: u.profile.name, state: u.profile.state, points: metric.series(u.profile) })),
    [unis, metric],
  );

  const sharedMax = useMemo(() => {
    let m = 0;
    for (const u of seriesPerUni) for (const p of u.points) if (p.value > m) m = p.value;
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
        const data = u.points.map((p) => ({ fiscal_year: p.fiscal_year, value: p.value }));
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
                    : 'No data reported'
                }
                source={`${metric.label} · per-FY series`}
                note={
                  peak && data.length > 1
                    ? `Peak FY${peak.fy} · ${formatMetricValue(peak.v, metric.format)}`
                    : undefined
                }
              >
                {data.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-rule text-xs text-text-tertiary">
                    No {metric.label.toLowerCase()} data reported.
                  </div>
                ) : (
                  <BarChart
                    data={data as unknown as Array<Record<string, unknown>>}
                    xKey="fiscal_year"
                    series={[{ key: 'value', label: metric.label }]}
                    height={220}
                    showLegend={false}
                    yFormat={yFormat}
                    // Use the same domain top across all panels so heights are
                    // directly comparable. Recharts respects this on the YAxis
                    // through the chart's "domain" prop, but we don't expose it
                    // here — instead we lean on the shared yFormat and the
                    // per-uni "latest" / "peak" labels for context.
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
      {/* Avoid orphan-grid notice when sharedMax is 0 across all unis */}
      {sharedMax === 0 && unis.length > 0 && (
        <p className="col-span-full text-[11px] italic text-text-tertiary">
          No data reported across the selected cohort for this metric.
        </p>
      )}
    </section>
  );
}
