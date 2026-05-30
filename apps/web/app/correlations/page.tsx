'use client';

import { useDuckDB } from '@/app/providers';
import { ConnectedScatter, type ScatterPoint } from '@/components/charts/ConnectedScatter';
import { ScatterMatrix } from '@/components/charts/ScatterMatrix';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { formatDollars } from '@/lib/format';
import { query } from '@/lib/duckdb';
import type { Row } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

interface InstitutionMetricRow extends Row {
  institution_sk: string;
  canonical_name: string;
  state_code: string | null;
  herd_federal: number | null;
  nih: number | null;
  nsf: number | null;
  usas_contracts: number | null;
  usas_assistance: number | null;
  bottom_up: number | null;
}

const METRIC_KEYS = ['herd_federal', 'nih', 'nsf', 'usas_contracts', 'usas_assistance', 'bottom_up'] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_LABELS: Record<MetricKey, string> = {
  herd_federal: 'HERD federal R&D',
  nih: 'NIH total cost',
  nsf: 'NSF obligation',
  usas_contracts: 'USAS contracts',
  usas_assistance: 'USAS assistance',
  bottom_up: 'Bottom-up sum',
};

async function loadInstitutionMetrics(fy: number, minHerd = 10_000_000): Promise<InstitutionMetricRow[]> {
  return query<InstitutionMetricRow>(`
    SELECT
      institution_sk,
      canonical_name,
      state_code,
      herd_federal_rd_usd_nominal AS herd_federal,
      nih_total_cost_usd_nominal AS nih,
      nsf_fy_obligation_usd_nominal AS nsf,
      usaspending_contracts_usd_nominal AS usas_contracts,
      usaspending_assistance_usd_nominal AS usas_assistance,
      bottom_up_sum_usd_nominal AS bottom_up
    FROM sheet_07_cross_source_reconciliation
    WHERE fiscal_year = ${fy}
      AND herd_federal_rd_usd_nominal >= ${minHerd}
      AND is_tiny_anchor = false
    ORDER BY herd_federal_rd_usd_nominal DESC
  `);
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? num / denom : NaN;
}

function rank(arr: number[]): number[] {
  const idx = arr.map((v, i) => ({ v, i }));
  idx.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function spearman(xs: number[], ys: number[]): number {
  return pearson(rank(xs), rank(ys));
}

export default function CorrelationsPage() {
  const { ready } = useDuckDB();
  const [fy, setFy] = useState(2024);
  const [xMetric, setXMetric] = useState<MetricKey>('herd_federal');
  const [yMetric, setYMetric] = useState<MetricKey>('nih');
  const [mode, setMode] = useState<'scatter' | 'matrix'>('scatter');
  const [data, setData] = useState<InstitutionMetricRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    loadInstitutionMetrics(fy).then(setData).catch(() => setData([]));
  }, [ready, fy]);

  // Drop rows missing either selected metric
  const valid = useMemo(() => {
    return data.filter((d) => {
      const xv = d[xMetric];
      const yv = d[yMetric];
      return typeof xv === 'number' && typeof yv === 'number' && xv > 0 && yv > 0;
    });
  }, [data, xMetric, yMetric]);

  const xs = valid.map((d) => d[xMetric] as number);
  const ys = valid.map((d) => d[yMetric] as number);
  const r = pearson(xs, ys);
  const rho = spearman(xs, ys);

  const scatterPoints: ScatterPoint[] = valid.map((d) => ({
    x: d[xMetric] as number,
    y: d[yMetric] as number,
    label: d.canonical_name,
  }));

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Correlations"
        title="Pick X, pick Y, see r"
        description="Scatter every institution into the (X metric, Y metric) plane. Reports Pearson r and Spearman ρ for the selected pair. Switch to scatter-matrix mode for an all-pairs view."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <FieldSelect
              label="X axis"
              value={xMetric}
              options={METRIC_KEYS.map((k) => ({ key: k, label: METRIC_LABELS[k] }))}
              onChange={(v) => setXMetric(v as MetricKey)}
            />
            <FieldSelect
              label="Y axis"
              value={yMetric}
              options={METRIC_KEYS.map((k) => ({ key: k, label: METRIC_LABELS[k] }))}
              onChange={(v) => setYMetric(v as MetricKey)}
            />
            <FieldSelect
              label="Fiscal year"
              value={String(fy)}
              options={Array.from({ length: 20 }, (_, i) => 2024 - i).map((y) => ({
                key: String(y),
                label: `FY${y}`,
              }))}
              onChange={(v) => setFy(Number(v))}
            />
            <FieldSelect
              label="Mode"
              value={mode}
              options={[
                { key: 'scatter', label: 'X vs Y scatter' },
                { key: 'matrix', label: 'Scatter matrix' },
              ]}
              onChange={(v) => setMode(v as 'scatter' | 'matrix')}
            />
          </div>
        </CardContent>
      </Card>

      {mode === 'scatter' ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ChartTitle
              eyebrow={`FY${fy} · ${valid.length} institutions`}
              title={`${METRIC_LABELS[yMetric]} vs ${METRIC_LABELS[xMetric]}`}
              subtitle={`Pearson r = ${Number.isFinite(r) ? r.toFixed(3) : '—'}, Spearman ρ = ${Number.isFinite(rho) ? rho.toFixed(3) : '—'}. Both metrics shown in USD nominal.`}
              source="Sheet 07 cross-source reconciliation · institutions with HERD federal ≥ $10M"
            />
            {scatterPoints.length > 0 ? (
              <ConnectedScatter
                points={scatterPoints}
                xLabel={METRIC_LABELS[xMetric]}
                yLabel={METRIC_LABELS[yMetric]}
                xFormat={formatDollars}
                yFormat={formatDollars}
                height={460}
              />
            ) : (
              <div className="h-[460px] animate-pulse bg-border/15 rounded-md" />
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <StatBlock label="Pearson r" value={Number.isFinite(r) ? r.toFixed(3) : '—'} />
              <StatBlock label="Spearman ρ" value={Number.isFinite(rho) ? rho.toFixed(3) : '—'} />
              <StatBlock label="Universities" value={valid.length.toString()} />
              <StatBlock label="Fiscal year" value={`FY${fy}`} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ChartTitle
              eyebrow={`FY${fy} scatter matrix`}
              title="Pairwise correlations across all six metrics"
              subtitle="Each panel is one (column-metric, row-metric) scatter; the diagonal shows each metric against itself. Useful for spotting which metrics co-move and which diverge."
              source="Observable Plot · Sheet 07"
            />
            {valid.length > 0 ? (
              <ScatterMatrix
                data={valid as unknown as Array<Record<string, number | string | null>>}
                numericKeys={[...METRIC_KEYS]}
                labelKey="canonical_name"
                width={720}
                height={720}
              />
            ) : (
              <div className="h-[720px] animate-pulse bg-border/15 rounded-md" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5 min-w-[160px]">
      <div className="h-eyebrow text-text-tertiary">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-rule bg-surface-elevated px-4 py-3">
      <div className="h-eyebrow text-text-tertiary mb-1">{label}</div>
      <div className="font-mono text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}
