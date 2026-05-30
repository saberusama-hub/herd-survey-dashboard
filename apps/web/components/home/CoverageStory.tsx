'use client';

import { useDuckDB } from '@/app/providers';
import { LineChart } from '@/components/charts/LineChart';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { KEY_EVENTS_BANDS } from '@/lib/annotations';
import { formatPct } from '@/lib/format';
import { type CoverageRow, bottomUpCoverageByFy } from '@/lib/queries';
import { useEffect, useState } from 'react';

export function HomeCoverageStory() {
  const { ready } = useDuckDB();
  const [rows, setRows] = useState<CoverageRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    bottomUpCoverageByFy().then(setRows).catch(() => setRows([]));
  }, [ready]);

  const peak = rows.length ? Math.max(...rows.map((r) => r.coverage_pct ?? 0)) : null;
  const peakRow = peak !== null ? rows.find((r) => r.coverage_pct === peak) : null;
  const latest = rows.length ? rows[rows.length - 1] : null;

  return (
    <div className="space-y-5">
      <ChartTitle
        eyebrow="State of the data"
        title="The gap between top-down and bottom-up is widening"
        subtitle="Bottom-up sources (NIH ExPORTER + NSF Awards + USAspending) used to find roughly 80% of what universities reported as federal R&D in HERD. They now find under half."
        source="Sheet 07 cross-source reconciliation · USD nominal"
      />
      <LineChart
        data={rows.map((r) => ({
          fiscal_year: r.fiscal_year,
          coverage_pct: r.coverage_pct !== null ? r.coverage_pct * 100 : null,
        }))}
        xKey="fiscal_year"
        series={[{ key: 'coverage_pct', label: 'BU ÷ HERD', color: 'hsl(var(--negative))' }]}
        height={240}
        yFormat={(v) => `${v.toFixed(0)}%`}
        showLegend={false}
        referenceBands={KEY_EVENTS_BANDS.filter((e) => e.id === 'arra' || e.id === 'covid')}
      />
      {peakRow && latest && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-rule bg-surface-elevated p-3">
            <div className="h-eyebrow text-text-tertiary mb-1">Peak coverage</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-medium tabular-nums">
                {formatPct(peakRow.coverage_pct)}
              </span>
              <span className="text-2xs text-text-tertiary">FY{peakRow.fiscal_year}</span>
            </div>
          </div>
          <div className="rounded border border-rule bg-surface-elevated p-3">
            <div className="h-eyebrow text-text-tertiary mb-1">Latest</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-medium tabular-nums text-negative">
                {formatPct(latest.coverage_pct)}
              </span>
              <span className="text-2xs text-text-tertiary">FY{latest.fiscal_year}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
