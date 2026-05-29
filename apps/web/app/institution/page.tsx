'use client';

import { useDuckDB } from '@/app/providers';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { InstitutionPicker } from '@/components/filters/InstitutionPicker';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCount, formatPct, formatUsd } from '@/lib/formatters';
import {
  type InstAgencyRow,
  type InstNihIcRow,
  type InstitutionMeta,
  type InstitutionRow,
  institutionAgencyMix,
  institutionMeta,
  institutionNihIcLatest,
  institutionTimeseries,
} from '@/lib/queries';
import { nameFromAbbr } from '@/lib/us-states';
import { useEffect, useState } from 'react';

const AGENCY_KEYS = ['NSF', 'DOD', 'DOE', 'NASA', 'USDA', 'ED', 'EPA', 'HHS', 'DOC', 'Other'] as const;

const NIH_IC_KEYS = ['NCI', 'NIAID', 'NHLBI', 'NIGMS', 'NIA', 'NIDDK', 'NINDS', 'NIMH'] as const;

export default function InstitutionPage() {
  const { ready } = useDuckDB();
  const [sk, setSk] = useState<string | null>(null);

  // Init from ?sk=... URL param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sk');
    if (s) setSk(s);
  }, []);

  // Sync ?sk=... when changed
  function selectSk(s: string) {
    setSk(s);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('sk', s);
      window.history.replaceState({}, '', url.toString());
    }
  }

  function clearSk() {
    setSk(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('sk');
      window.history.replaceState({}, '', url.toString());
    }
  }

  if (!sk) {
    return (
      <div className="container-narrow py-10 md:py-14 space-y-8">
        <PageHeader
          eyebrow="Institutions"
          title="Find an institution"
          description="Search 1,014 HERD-tracked universities. Pick one to open its full federal R&D portrait."
        />
        <InstitutionPicker onSelect={selectSk} />
      </div>
    );
  }

  return <InstitutionProfile sk={sk} onClear={clearSk} ready={ready} />;
}

function InstitutionProfile({ sk, onClear, ready }: { sk: string; onClear: () => void; ready: boolean }) {
  const [meta, setMeta] = useState<InstitutionMeta | null>(null);
  const [timeseries, setTimeseries] = useState<InstitutionRow[]>([]);
  const [agencyMix, setAgencyMix] = useState<InstAgencyRow[]>([]);
  const [nihIc, setNihIc] = useState<InstNihIcRow | null>(null);

  useEffect(() => {
    if (!ready) return;
    institutionMeta(sk)
      .then(setMeta)
      .catch(() => setMeta(null));
    institutionTimeseries(sk)
      .then(setTimeseries)
      .catch(() => setTimeseries([]));
    institutionAgencyMix(sk)
      .then(setAgencyMix)
      .catch(() => setAgencyMix([]));
    institutionNihIcLatest(sk)
      .then(setNihIc)
      .catch(() => setNihIc(null));
  }, [ready, sk]);

  const latestRow = timeseries.length > 0 ? timeseries[timeseries.length - 1] : null;
  const cumulativeHerd = timeseries.reduce((sum, r) => sum + (r.herd_federal_rd_usd_nominal ?? 0), 0);

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow={meta?.sector ?? 'Institution'}
        title={meta?.canonical_name ?? 'Loading…'}
        description={`${meta?.state_code ? `${nameFromAbbr(meta.state_code) ?? meta.state_code}` : ''}${meta?.sector ? ` · ${meta.sector}` : ''}`}
        actions={
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-accent hover:underline focus:outline-none focus:underline"
          >
            ← Back to search
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
        <Tile label="FY2024 HERD federal" value={formatUsd(latestRow?.herd_federal_rd_usd_nominal)} />
        <Tile label="20yr cumulative" value={formatUsd(cumulativeHerd)} />
        <Tile label="FY2024 NIH" value={formatUsd(latestRow?.nih_total_cost_usd_nominal)} />
        <Tile label="FY2024 NSF" value={formatUsd(latestRow?.nsf_fy_obligation_usd_nominal)} />
      </div>

      {meta && timeseries.some((r) => r.is_tiny_anchor) && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <Badge variant="warning">tiny anchor</Badge>{' '}
          <span className="ml-2 text-text-secondary">
            This institution has &lt;$1M cumulative HERD federal R&amp;D. Bottom-up vs HERD gaps may not be meaningful.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top-down vs bottom-up (20-year)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            data={timeseries}
            xKey="fiscal_year"
            series={[
              { key: 'herd_federal_rd_usd_nominal', label: 'HERD federal (top-down)' },
              { key: 'bottom_up_sum_usd_nominal', label: 'Bottom-up sum' },
            ]}
            height={360}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>By source (20-year stacked)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={timeseries}
              xKey="fiscal_year"
              series={[
                { key: 'nih_total_cost_usd_nominal', label: 'NIH' },
                { key: 'nsf_fy_obligation_usd_nominal', label: 'NSF' },
                { key: 'usaspending_contracts_usd_nominal', label: 'USAS contracts' },
                { key: 'usaspending_assistance_usd_nominal', label: 'USAS assistance' },
              ]}
              stacked
              height={360}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By agency (20-year stacked)</CardTitle>
          </CardHeader>
          <CardContent>
            {agencyMix.length === 0 ? (
              <div className="h-[360px] flex items-center justify-center text-text-secondary text-sm">
                No agency-mix data.
              </div>
            ) : (
              <BarChart
                data={agencyMix}
                xKey="fiscal_year"
                series={AGENCY_KEYS.map((k) => ({ key: k, label: k }))}
                stacked
                height={360}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {nihIc && (nihIc.nih_total_usd_nominal ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>NIH IC mix · FY{nihIc.fiscal_year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {NIH_IC_KEYS.map((ic) => {
                const val = (nihIc[`nih_${ic}_usd_nominal` as keyof InstNihIcRow] as number | null) ?? 0;
                const share = nihIc.nih_total_usd_nominal ? val / nihIc.nih_total_usd_nominal : 0;
                if (val === 0) return null;
                return (
                  <div key={ic} className="grid grid-cols-[80px_1fr_100px_60px] items-center gap-3">
                    <div className="font-mono text-xs">{ic}</div>
                    <div className="h-2 bg-border rounded-sm overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(100, share * 100)}%` }} />
                    </div>
                    <div className="tabular-nums text-text-secondary text-right">{formatUsd(val)}</div>
                    <div className="tabular-nums text-text-tertiary text-right">{formatPct(share)}</div>
                  </div>
                );
              })}
              <div className="text-2xs text-text-tertiary pt-2 border-t border-border mt-3">
                NIH total: {formatUsd(nihIc.nih_total_usd_nominal)} across {formatCount(nihIc.n_distinct_projects)}{' '}
                distinct projects.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation table (all FYs)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-right font-medium px-4 py-2">FY</th>
                <th className="text-right font-medium px-4 py-2">HERD fed</th>
                <th className="text-right font-medium px-4 py-2">NIH</th>
                <th className="text-right font-medium px-4 py-2">NSF</th>
                <th className="text-right font-medium px-4 py-2">USAS contracts</th>
                <th className="text-right font-medium px-4 py-2">USAS assistance</th>
                <th className="text-right font-medium px-4 py-2">Bottom-up Σ</th>
                <th className="text-right font-medium px-4 py-2">Δ ($)</th>
                <th className="text-right font-medium px-4 py-2">Δ (%)</th>
              </tr>
            </thead>
            <tbody>
              {timeseries.map((r) => (
                <tr key={r.fiscal_year} className="border-b border-border/60 last:border-0 tabular-nums">
                  <td className="px-4 py-1.5 text-right text-text-secondary">{r.fiscal_year}</td>
                  <td className="px-4 py-1.5 text-right">{formatUsd(r.herd_federal_rd_usd_nominal)}</td>
                  <td className="px-4 py-1.5 text-right text-text-secondary">
                    {formatUsd(r.nih_total_cost_usd_nominal)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-text-secondary">
                    {formatUsd(r.nsf_fy_obligation_usd_nominal)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-text-secondary">
                    {formatUsd(r.usaspending_contracts_usd_nominal)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-text-secondary">
                    {formatUsd(r.usaspending_assistance_usd_nominal)}
                  </td>
                  <td className="px-4 py-1.5 text-right">{formatUsd(r.bottom_up_sum_usd_nominal)}</td>
                  <td className="px-4 py-1.5 text-right text-text-tertiary">{formatUsd(r.delta_usd)}</td>
                  <td className="px-4 py-1.5 text-right text-text-tertiary">
                    {formatPct(r.delta_pct, { source: 'fraction' })}
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-elevated p-5">
      <div className="h-card mb-2">{label}</div>
      <div className="text-2xl font-medium tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
