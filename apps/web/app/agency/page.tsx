'use client';

import { useDuckDB } from '@/app/providers';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { query, queryOne } from '@/lib/duckdb';
import { formatUsd } from '@/lib/formatters';
import type { Row } from '@/lib/types';
import { useEffect, useState } from 'react';

interface AgencyFyRow extends Row {
  agency_sk: string;
  agency_name: string;
  agency_parent: string | null;
  fiscal_year: number;
  total_obligations_usd_nominal: number | null;
  basic_research_usd_nominal: number | null;
  applied_research_usd_nominal: number | null;
  experimental_development_usd_nominal: number | null;
}

interface AgencyListItem extends Row {
  agency_sk: string;
  agency_name: string;
  total_obligations_usd_nominal: number;
}

export default function AgencyPage() {
  const { ready } = useDuckDB();
  const [sk, setSk] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<AgencyListItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('sk');
      if (s) setSk(s);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    query<AgencyListItem>(`
      SELECT
        agency_sk,
        ANY_VALUE(agency_name) AS agency_name,
        SUM(total_obligations_usd_nominal) AS total_obligations_usd_nominal
      FROM sheet_04_federal_rd_by_agency
      WHERE agency_parent IS NULL OR agency_parent = ''
      GROUP BY agency_sk
      ORDER BY total_obligations_usd_nominal DESC NULLS LAST
    `)
      .then(setAgencies)
      .catch(() => setAgencies([]));
  }, [ready]);

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

  if (sk) return <AgencyDetail sk={sk} onClear={clearSk} ready={ready} />;

  return (
    <div className="container-narrow py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Agencies"
        title="Federal funders"
        description="Top-level federal agencies that obligated R&D funding to U.S. universities, FY2005–FY2024."
      />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left font-medium px-6 py-3">Agency</th>
                <th className="text-right font-medium px-6 py-3">20-year Σ obligations</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.agency_sk} className="border-b border-border/60 last:border-0 hover:bg-accent-muted/20">
                  <td className="px-6 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => selectSk(a.agency_sk)}
                      className="text-left hover:underline hover:text-accent focus:outline-none focus:underline"
                    >
                      {a.agency_name}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{formatUsd(a.total_obligations_usd_nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function AgencyDetail({ sk, onClear, ready }: { sk: string; onClear: () => void; ready: boolean }) {
  const [meta, setMeta] = useState<{ agency_name: string; agency_parent: string | null } | null>(null);
  const [timeseries, setTimeseries] = useState<AgencyFyRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    queryOne<{ agency_name: string; agency_parent: string | null }>(`
      SELECT ANY_VALUE(agency_name) AS agency_name, ANY_VALUE(agency_parent) AS agency_parent
      FROM sheet_04_federal_rd_by_agency
      WHERE agency_sk = '${sk.replace(/'/g, "''")}'
    `)
      .then(setMeta)
      .catch(() => setMeta(null));
    query<AgencyFyRow>(`
      SELECT *
      FROM sheet_04_federal_rd_by_agency
      WHERE agency_sk = '${sk.replace(/'/g, "''")}'
      ORDER BY fiscal_year
    `)
      .then(setTimeseries)
      .catch(() => setTimeseries([]));
  }, [ready, sk]);

  const latest = timeseries[timeseries.length - 1];

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow={meta?.agency_parent ? `Sub-agency of ${meta.agency_parent}` : 'Federal agency'}
        title={meta?.agency_name ?? 'Loading…'}
        actions={
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-accent hover:underline focus:outline-none focus:underline"
          >
            ← All agencies
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border rounded-md overflow-hidden border border-border">
        <Tile label="FY2024 total R&D" value={formatUsd(latest?.total_obligations_usd_nominal)} />
        <Tile
          label="20-year cumulative"
          value={formatUsd(timeseries.reduce((s, r) => s + (r.total_obligations_usd_nominal ?? 0), 0))}
        />
        <Tile label="Years reporting" value={String(timeseries.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Obligations over time</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            data={timeseries}
            xKey="fiscal_year"
            series={[{ key: 'total_obligations_usd_nominal', label: 'Total obligations' }]}
            height={320}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>R&D activity mix</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={timeseries}
            xKey="fiscal_year"
            series={[
              { key: 'basic_research_usd_nominal', label: 'Basic' },
              { key: 'applied_research_usd_nominal', label: 'Applied' },
              { key: 'experimental_development_usd_nominal', label: 'Experimental dev.' },
            ]}
            stacked
            height={320}
          />
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
