'use client';

import { useDuckDB } from '@/app/providers';
import { USStateMap } from '@/components/charts/USStateMap';
import { MetricSelect } from '@/components/filters/MetricSelect';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { Slider } from '@/components/ui/Slider';
import { formatCount, formatDollars } from '@/lib/format';
import {
  type InstitutionTotal,
  METRICS,
  type MetricKey,
  type StateRollup,
  stateRollup,
  topInstitutionsInState,
} from '@/lib/queries';
import { nameFromAbbr } from '@/lib/us-states';
import { Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const FY_MIN = 2005;
const FY_MAX = 2024;

export default function MapPage() {
  const { ready } = useDuckDB();
  const [metric, setMetric] = useState<MetricKey>('herd_federal');
  const [fy, setFy] = useState(2024);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [rollup, setRollup] = useState<StateRollup[]>([]);
  const [stateInstitutions, setStateInstitutions] = useState<InstitutionTotal[]>([]);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

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

  // Animation playback — advances FY every ~900ms until reaching FY_MAX
  useEffect(() => {
    if (!playing) {
      if (playRef.current) {
        window.clearInterval(playRef.current);
        playRef.current = null;
      }
      return;
    }
    playRef.current = window.setInterval(() => {
      setFy((current) => {
        if (current >= FY_MAX) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);
    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
    };
  }, [playing]);

  const valuesMap: Record<string, number> = {};
  for (const r of rollup) valuesMap[r.state_code] = r.total;
  const selectedRollup = selectedState ? rollup.find((r) => r.state_code === selectedState) : null;
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? '';

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Geography"
        title="Federal R&D by State"
        description="Choropleth of state-level federal research funding for any year and any metric. Click a state for a ranked list of the universities driving the total."
      />

      {/* ── Story callout ── */}
      <div className="rounded-lg border border-rule bg-accent-soft/30 p-4 flex flex-wrap items-center gap-4">
        <span className="h-eyebrow text-accent">Story 3</span>
        <div className="flex-1 min-w-[200px]">
          <p className="t-body">
            <strong className="font-serif italic text-text-primary">The geography of American science.</strong>{' '}
            Federal research dollars moved on the map over 20 years. Maryland tripled. South Atlantic surged.
          </p>
        </div>
        <Link
          href="/story/geography"
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-surface-elevated hover:bg-accent-strong transition-colors"
        >
          Read the scrolly →
        </Link>
      </div>

      {/* ── Controls ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border border-rule bg-surface-elevated rounded-md p-4">
        <MetricSelect
          options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
          value={metric}
          onChange={(v) => setMetric(v as MetricKey)}
          label="Metric"
        />
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="font-medium">Fiscal year</span>
            <span className="tabular-nums font-mono">FY{fy}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (fy >= FY_MAX) setFy(FY_MIN);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? 'Pause animation' : 'Play animation through fiscal years'}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-rule text-text-secondary hover:bg-accent-soft hover:text-accent"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <Slider
              min={FY_MIN}
              max={FY_MAX}
              step={1}
              value={[fy]}
              onValueChange={(v) => setFy(v[0])}
              aria-label="Fiscal year"
            />
          </div>
          <div className="flex justify-between text-2xs text-text-tertiary">
            <span>FY{FY_MIN}</span>
            <span>FY{FY_MAX}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-4">
            <ChartTitle
              eyebrow={`FY${fy}`}
              title={metricLabel}
              subtitle="State totals shaded by quintile of the chosen metric. Click a state for its top universities and FY composition."
              source="Sheet 07 · USD nominal"
            />
            <USStateMap values={valuesMap} selected={selectedState} onSelect={setSelectedState} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <ChartTitle
              eyebrow="Selection"
              title={selectedState ? nameFromAbbr(selectedState) ?? selectedState : 'State details'}
              source={selectedState ? `FY${fy} · ${metricLabel}` : 'Click a state on the map'}
            />
            {selectedState && selectedRollup ? (
              <div className="space-y-4">
                <div>
                  <div className="h-eyebrow text-text-tertiary mb-1">FY{fy} total</div>
                  <div className="font-mono text-2xl font-medium tabular-nums">
                    {formatDollars(selectedRollup.total)}
                  </div>
                </div>
                <div>
                  <div className="h-eyebrow text-text-tertiary mb-1">Institutions</div>
                  <div className="font-mono text-2xl font-medium tabular-nums">
                    {formatCount(selectedRollup.n_institutions)}
                  </div>
                </div>
                <div>
                  <div className="h-eyebrow text-text-tertiary mb-2">Top universities in {selectedState}</div>
                  <ul className="space-y-1.5 text-sm">
                    {stateInstitutions.slice(0, 12).map((inst) => (
                      <li key={inst.institution_sk} className="flex items-center justify-between gap-3">
                        <span className="truncate">{inst.canonical_name}</span>
                        <span className="font-mono text-text-secondary tabular-nums">
                          {formatDollars(inst.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-text-secondary text-sm">Click a state on the map to see its top universities.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-rule px-6 py-4">
            <ChartTitle eyebrow="All states" title="Ranked by FY total" source={`FY${fy} · ${metricLabel}`} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-text-secondary">
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
                  className="border-b border-rule/60 last:border-0 hover:bg-accent-soft/40"
                >
                  <td className="px-6 py-2 text-text-tertiary tabular-nums font-mono text-xs">{i + 1}</td>
                  <td className="px-6 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setSelectedState(r.state_code)}
                      className="text-left hover:underline focus:outline-none focus:underline"
                    >
                      {r.state_code} <span className="text-text-tertiary">· {nameFromAbbr(r.state_code) ?? ''}</span>
                    </button>
                  </td>
                  <td className="px-6 py-2 text-right font-mono tabular-nums">{formatDollars(r.total)}</td>
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
