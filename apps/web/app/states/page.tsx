'use client';

import { useDuckDB } from '@/app/providers';
import { USStateMap } from '@/components/charts/USStateMap';
import { MetricSelect } from '@/components/filters/MetricSelect';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { formatCount, formatUsd } from '@/lib/formatters';
import {
  type InstitutionTotal,
  METRICS,
  type MetricKey,
  type StateRollup,
  stateRollup,
  topInstitutionsInState,
} from '@/lib/queries';
import { nameFromAbbr } from '@/lib/us-states';
import { useEffect, useMemo, useState } from 'react';

const YEARS = Array.from({ length: 20 }, (_, i) => 2005 + i);

export default function StatesPage() {
  const { ready } = useDuckDB();
  const [metric, setMetric] = useState<MetricKey>('herd_federal');
  const [fy, setFy] = useState(2024);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [rollup, setRollup] = useState<StateRollup[]>([]);
  const [stateInstitutions, setStateInstitutions] = useState<InstitutionTotal[]>([]);

  useEffect(() => {
    if (!ready) return;
    stateRollup(metric, fy)
      .then(setRollup)
      .catch(() => setRollup([]));
  }, [ready, metric, fy]);

  useEffect(() => {
    if (!ready || !selectedState) {
      setStateInstitutions([]);
      return;
    }
    topInstitutionsInState(selectedState, metric, fy)
      .then(setStateInstitutions)
      .catch(() => setStateInstitutions([]));
  }, [ready, selectedState, metric, fy]);

  const valuesMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rollup) m[r.state_code] = r.total;
    return m;
  }, [rollup]);

  const selectedRollup = selectedState ? rollup.find((r) => r.state_code === selectedState) : null;

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Geography"
        title="Federal R&D by State"
        description="Choropleth of state-level federal research funding for any year and any metric. Click a state for a ranked list of the universities driving the total."
      />

      <div className="flex flex-wrap items-end gap-6 border border-border bg-surface-elevated rounded-md p-4">
        <MetricSelect
          options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
          value={metric}
          onChange={(v) => setMetric(v as MetricKey)}
          label="Metric"
        />
        <div className="space-y-2 min-w-[160px]">
          <div className="text-xs text-text-secondary font-medium">Fiscal Year</div>
          <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.slice()
                .reverse()
                .map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    FY{y}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              FY{fy} · {METRICS.find((m) => m.key === metric)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <USStateMap values={valuesMap} selected={selectedState} onSelect={setSelectedState} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedState ? `${nameFromAbbr(selectedState) ?? selectedState}` : 'State details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedState && selectedRollup ? (
              <>
                <div>
                  <div className="h-card mb-1">FY{fy} Total</div>
                  <div className="text-2xl font-medium tabular-nums">{formatUsd(selectedRollup.total)}</div>
                </div>
                <div>
                  <div className="h-card mb-1">Institutions</div>
                  <div className="text-2xl font-medium tabular-nums">{formatCount(selectedRollup.n_institutions)}</div>
                </div>
                <div>
                  <div className="h-card mb-2">Top universities in {selectedState}</div>
                  <ul className="space-y-1.5 text-sm">
                    {stateInstitutions.slice(0, 12).map((inst) => (
                      <li key={inst.institution_sk} className="flex items-center justify-between gap-3">
                        <span className="truncate">{inst.canonical_name}</span>
                        <span className="text-text-secondary tabular-nums">{formatUsd(inst.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-text-secondary text-sm">Click a state on the map to see its top universities.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All states · ranked</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left font-medium px-6 py-3 w-12">#</th>
                <th className="text-left font-medium px-6 py-3">State</th>
                <th className="text-right font-medium px-6 py-3">FY{fy} total</th>
                <th className="text-right font-medium px-6 py-3"># institutions</th>
              </tr>
            </thead>
            <tbody>
              {rollup.map((r, i) => (
                <tr
                  key={r.state_code}
                  className="border-b border-border/60 last:border-0 hover:bg-accent-muted/20 cursor-pointer focus-within:bg-accent-muted/30"
                >
                  <td className="px-6 py-2 text-text-tertiary tabular-nums">{i + 1}</td>
                  <td className="px-6 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setSelectedState(r.state_code)}
                      className="text-left hover:underline focus:outline-none focus:underline"
                    >
                      {r.state_code} <span className="text-text-tertiary">· {nameFromAbbr(r.state_code) ?? ''}</span>
                    </button>
                  </td>
                  <td className="px-6 py-2 text-right tabular-nums">{formatUsd(r.total)}</td>
                  <td className="px-6 py-2 text-right tabular-nums text-text-secondary">
                    {formatCount(r.n_institutions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
