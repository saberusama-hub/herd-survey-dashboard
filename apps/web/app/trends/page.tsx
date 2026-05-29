'use client';

import { useDuckDB } from '@/app/providers';
import { LineChart, type LineSeries } from '@/components/charts/LineChart';
import { colorFor } from '@/components/charts/colors';
import { FYRangeSlider } from '@/components/filters/FYRangeSlider';
import { MetricSelect } from '@/components/filters/MetricSelect';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { formatFy, formatUsd } from '@/lib/formatters';
import {
  METRICS,
  type MetricKey,
  type TopRecipient,
  metricTimeseries,
  topInstitutionsByHerdFederal,
} from '@/lib/queries';
import { useEffect, useMemo, useState } from 'react';

const COHORT_SIZES = [5, 10, 15, 20] as const;

export default function TrendsPage() {
  const { ready } = useDuckDB();
  const [metric, setMetric] = useState<MetricKey>('herd_federal');
  const [cohortSize, setCohortSize] = useState<5 | 10 | 15 | 20>(10);
  const [fyRange, setFyRange] = useState<[number, number]>([2005, 2024]);
  const [topN, setTopN] = useState<TopRecipient[]>([]);
  const [series, setSeries] = useState<Record<number, Record<string, number | null>>>({});

  // Load the top-N cohort whenever cohortSize or FY range changes
  useEffect(() => {
    if (!ready) return;
    topInstitutionsByHerdFederal(cohortSize, fyRange[0], fyRange[1])
      .then(setTopN)
      .catch(() => setTopN([]));
  }, [ready, cohortSize, fyRange]);

  // Load the metric timeseries when topN or metric changes
  useEffect(() => {
    if (!ready || topN.length === 0) return;
    metricTimeseries(
      metric,
      topN.map((t) => t.institution_sk),
      fyRange[0],
      fyRange[1],
    )
      .then((rows) => {
        // pivot to { fy → { instSk → value } }
        const pivoted: Record<number, Record<string, number | null>> = {};
        for (const r of rows) {
          if (!pivoted[r.fiscal_year]) pivoted[r.fiscal_year] = {};
          pivoted[r.fiscal_year][r.institution_sk] = (r.value as number | null) ?? null;
        }
        setSeries(pivoted);
      })
      .catch(() => setSeries({}));
  }, [ready, metric, topN, fyRange]);

  const chartData = useMemo(() => {
    const rows: Array<Record<string, unknown>> = [];
    for (let fy = fyRange[0]; fy <= fyRange[1]; fy++) {
      const row: Record<string, unknown> = { fiscal_year: fy };
      for (const inst of topN) {
        row[inst.institution_sk] = series[fy]?.[inst.institution_sk] ?? null;
      }
      rows.push(row);
    }
    return rows;
  }, [series, topN, fyRange]);

  const lineSeries: LineSeries[] = useMemo(
    () =>
      topN.map((inst, i) => ({
        key: inst.institution_sk,
        label: inst.canonical_name,
        color: colorFor(i),
      })),
    [topN],
  );

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Time series"
        title="Trends Explorer"
        description="Plot any federal research-funding metric across the top-N universities by 20-year HERD federal R&D total. Slice by fiscal-year range. Compare sources. Spot inflection points."
      />

      <div className="flex flex-wrap items-end gap-6 border border-border bg-surface-elevated rounded-md p-4">
        <MetricSelect
          options={METRICS.map((m) => ({ value: m.key, label: m.label, description: m.description }))}
          value={metric}
          onChange={(v) => setMetric(v as MetricKey)}
          label="Metric"
        />
        <div className="space-y-2 min-w-[200px]">
          <div className="text-xs text-text-secondary font-medium">Cohort</div>
          <Select value={String(cohortSize)} onValueChange={(v) => setCohortSize(Number(v) as 5 | 10 | 15 | 20)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COHORT_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n} R1 universities
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FYRangeSlider min={2005} max={2024} value={fyRange} onChange={setFyRange} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {METRICS.find((m) => m.key === metric)?.label} · Top {cohortSize} · FY{fyRange[0]}–FY{fyRange[1]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <SkeletonChart />
          ) : topN.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-text-secondary text-sm">No data.</div>
          ) : (
            <LineChart data={chartData} xKey="fiscal_year" series={lineSeries} height={420} showLegend />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cohort ranking</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left font-medium px-6 py-3 w-12">#</th>
                <th className="text-left font-medium px-6 py-3">Institution</th>
                <th className="text-right font-medium px-6 py-3">Σ HERD federal (range)</th>
                <th className="text-right font-medium px-6 py-3">FY{fyRange[1]} latest</th>
              </tr>
            </thead>
            <tbody>
              {topN.map((inst, i) => {
                const latest = series[fyRange[1]]?.[inst.institution_sk] ?? null;
                return (
                  <tr
                    key={inst.institution_sk}
                    className="border-b border-border/60 last:border-0 hover:bg-accent-muted/20"
                  >
                    <td className="px-6 py-3 text-text-tertiary tabular-nums">{i + 1}</td>
                    <td className="px-6 py-3 font-medium">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                        style={{ background: colorFor(i) }}
                      />
                      {inst.canonical_name}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">{formatUsd(inst.herd_federal_rd_usd_nominal)}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-text-secondary">{formatUsd(latest)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-text-tertiary">
        Sources: Sheet 07 (cross-source reconciliation). All values nominal USD. Cohort selected by 20-year cumulative
        HERD federal R&amp;D within the chosen FY range. Use the metric selector to switch which series you're plotting
        for the same cohort — useful to see how NIH-heavy vs DoD-heavy institutions diverge.
      </p>
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[420px] animate-pulse bg-border/20 rounded-md" aria-label="Loading chart…" />;
}
