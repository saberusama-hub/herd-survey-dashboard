'use client';

import { useDuckDB } from '@/app/providers';
import { LineChart, type LineSeries } from '@/components/charts/LineChart';
import { colorFor } from '@/components/charts/colors';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { KEY_EVENTS_BANDS } from '@/lib/annotations';
import { formatDollars } from '@/lib/format';
import {
  type InstitutionListItem,
  type InstitutionRow,
  allInstitutions,
  institutionTimeseries,
} from '@/lib/queries';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const MAX_PICK = 4;

interface Loaded {
  sk: string;
  name: string;
  rows: InstitutionRow[];
}

const METRICS = [
  { key: 'herd_federal_rd_usd_nominal', label: 'HERD federal R&D' },
  { key: 'nih_total_cost_usd_nominal', label: 'NIH total cost' },
  { key: 'nsf_fy_obligation_usd_nominal', label: 'NSF FY obligation' },
  { key: 'usaspending_contracts_usd_nominal', label: 'USAS contracts' },
] as const;

type MetricKeyLocal = (typeof METRICS)[number]['key'];

export default function ComparePage() {
  const { ready } = useDuckDB();
  const [all, setAll] = useState<InstitutionListItem[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Loaded[]>([]);

  useEffect(() => {
    if (!ready) return;
    allInstitutions().then(setAll).catch(() => setAll([]));
  }, [ready]);

  useEffect(() => {
    if (!ready || all.length === 0 || picks.length) return;
    setPicks(all.slice(0, 3).map((i) => i.institution_sk));
  }, [ready, all, picks.length]);

  useEffect(() => {
    if (!ready || picks.length === 0) {
      setLoaded([]);
      return;
    }
    Promise.all(
      picks.map(async (sk) => {
        const meta = all.find((a) => a.institution_sk === sk);
        const rows = await institutionTimeseries(sk).catch(() => [] as InstitutionRow[]);
        return { sk, name: meta?.canonical_name ?? sk, rows };
      }),
    ).then(setLoaded);
  }, [ready, picks, all]);

  const addPick = (sk: string) => {
    if (picks.includes(sk) || picks.length >= MAX_PICK) return;
    setPicks([...picks, sk]);
  };
  const removePick = (sk: string) => {
    setPicks(picks.filter((p) => p !== sk));
  };

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Compare"
        title="Side-by-side institution panel"
        description={`Pick up to ${MAX_PICK} universities. Each metric gets its own panel with a shared x-axis and y-scale across all selected institutions.`}
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="h-section">Cohort</h3>
          <div className="flex flex-wrap gap-2">
            {loaded.map((l, i) => (
              <span
                key={l.sk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-surface-elevated border border-rule"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: colorFor(i) }}
                />
                <span className="font-medium">{l.name}</span>
                <button
                  type="button"
                  onClick={() => removePick(l.sk)}
                  className="ml-1 text-text-tertiary hover:text-negative focus:outline-none focus:text-negative"
                  aria-label={`Remove ${l.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {picks.length === 0 && <span className="t-small text-text-tertiary">No institutions selected.</span>}
          </div>
          {picks.length < MAX_PICK && (
            <PickerInline
              all={all}
              excludeSks={picks}
              onAdd={addPick}
              placeholder={`Add another institution… (${MAX_PICK - picks.length} remaining)`}
            />
          )}
        </CardContent>
      </Card>

      {METRICS.map((m) => (
        <MetricPanel key={m.key} loaded={loaded} metric={m.key} label={m.label} />
      ))}
    </div>
  );
}

function PickerInline({
  all,
  excludeSks,
  onAdd,
  placeholder,
}: {
  all: InstitutionListItem[];
  excludeSks: string[];
  onAdd: (sk: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ex = new Set(excludeSks);
    if (!needle) return all.filter((i) => !ex.has(i.institution_sk)).slice(0, 10);
    return all
      .filter((i) => !ex.has(i.institution_sk))
      .filter(
        (i) =>
          i.canonical_name.toLowerCase().includes(needle) ||
          (i.state_code ?? '').toLowerCase() === needle,
      )
      .slice(0, 10);
  }, [all, q, excludeSks]);

  return (
    <div className="relative max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-3 rounded-md border border-rule bg-surface-elevated text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-auto rounded-md border border-rule bg-surface-elevated shadow-card-hover">
          {filtered.map((inst) => (
            <li key={inst.institution_sk}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd(inst.institution_sk);
                  setQ('');
                }}
                className="w-full px-3 py-2 text-left hover:bg-accent-soft/40 focus:bg-accent-soft/40 focus:outline-none flex items-center justify-between gap-3"
              >
                <span className="truncate text-sm">{inst.canonical_name}</span>
                <span className="text-2xs text-text-tertiary tabular-nums shrink-0">
                  {inst.state_code} · {formatDollars(inst.total_herd_federal_rd_usd_nominal)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricPanel({
  loaded,
  metric,
  label,
}: {
  loaded: Loaded[];
  metric: MetricKeyLocal;
  label: string;
}) {
  const { data, series } = useMemo(() => {
    const allFys = new Set<number>();
    for (const l of loaded) for (const r of l.rows) allFys.add(r.fiscal_year);
    const fys = Array.from(allFys).sort((a, b) => a - b);

    const rows = fys.map((fy) => {
      const row: Record<string, unknown> = { fiscal_year: fy };
      for (const l of loaded) {
        const r = l.rows.find((x) => x.fiscal_year === fy);
        row[l.sk] = r ? (r[metric] as number | null) : null;
      }
      return row;
    });

    const seriesList: LineSeries[] = loaded.map((l, i) => ({
      key: l.sk,
      label: l.name,
      color: colorFor(i),
    }));

    return { data: rows, series: seriesList };
  }, [loaded, metric]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <ChartTitle
          eyebrow="Metric"
          title={label}
          subtitle="Trajectory by institution. Shared y-scale across the cohort makes magnitude differences immediately visible."
          source="Sheet 07 cross-source reconciliation · USD nominal"
        />
        {loaded.length > 0 ? (
          <LineChart
            data={data}
            xKey="fiscal_year"
            series={series}
            height={300}
            directLabels
            showLegend={false}
            referenceBands={KEY_EVENTS_BANDS}
            yFormat={formatDollars}
          />
        ) : (
          <div className="h-[300px] animate-pulse bg-border/15 rounded-md" />
        )}
      </CardContent>
    </Card>
  );
}
