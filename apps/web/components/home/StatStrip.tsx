'use client';

import { useDuckDB } from '@/app/providers';
import { KpiTile } from '@/components/ui/KpiTile';
import { dollarUnit, formatCount, formatDollars, formatFyRange } from '@/lib/format';
import {
  type CoverageRow,
  type HeadlineKpis,
  bottomUpCoverageByFy,
  cumulativeFederalRd,
  headlineKpis,
} from '@/lib/queries';
import { useEffect, useState } from 'react';

interface SparkPoint {
  x: number;
  y: number | null;
}

export function StatStrip() {
  const { ready, error } = useDuckDB();
  const [k, setK] = useState<HeadlineKpis | null>(null);
  const [cum, setCum] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    headlineKpis().then(setK).catch(() => setK(null));
    cumulativeFederalRd().then(setCum).catch(() => setCum(null));
    bottomUpCoverageByFy().then(setCoverage).catch(() => setCoverage([]));
  }, [ready]);

  if (error) {
    return <div className="text-negative text-sm">Failed to load data: {error.message}</div>;
  }

  // Build spark traces from coverage data (each FY total HERD federal — proxy 20yr R&D trajectory)
  const federalSpark: SparkPoint[] = coverage.map((r) => ({ x: r.fiscal_year, y: r.herd_federal_total }));
  const coverageSpark: SparkPoint[] = coverage.map((r) => ({
    x: r.fiscal_year,
    y: r.coverage_pct !== null ? r.coverage_pct * 100 : null,
  }));

  // Latest coverage
  const latestCoverage = coverage.length ? coverage[coverage.length - 1] : null;
  const firstCoverage = coverage.length ? coverage[0] : null;
  const coverageDelta =
    latestCoverage && firstCoverage && firstCoverage.coverage_pct
      ? (latestCoverage.coverage_pct - firstCoverage.coverage_pct) * 100
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-rule rounded-md overflow-hidden border border-rule">
      <KpiTile
        eyebrow="FY2024 federal obligations"
        value={k ? formatDollars(k.fy2024_federal, { decimals: k.fy2024_federal >= 100e9 ? 1 : 2 }) : '—'}
        unit={k ? dollarUnit(k.fy2024_federal) : undefined}
        caption="reported by federal agencies"
        sparkline={federalSpark.length ? federalSpark : null}
        sparklineColor="hsl(var(--accent))"
      />
      <KpiTile
        eyebrow="20-year cumulative"
        value={cum ? formatDollars(cum, { decimals: 1 }) : '—'}
        unit={cum ? dollarUnit(cum) : undefined}
        caption={k ? formatFyRange(k.fy_min, k.fy_max) : ''}
        sparkline={federalSpark.length ? federalSpark : null}
        sparklineColor="hsl(var(--cat-3))"
      />
      <KpiTile
        eyebrow="HERD universities tracked"
        value={k ? formatCount(k.n_universities) : '—'}
        caption="distinct institutions in the panel"
      />
      <KpiTile
        eyebrow="Coverage of HERD federal R&D"
        value={
          latestCoverage?.coverage_pct
            ? `${(latestCoverage.coverage_pct * 100).toFixed(0)}%`
            : '—'
        }
        unit="found in bottom-up sources"
        delta={coverageDelta !== null ? `${coverageDelta > 0 ? '+' : ''}${coverageDelta.toFixed(0)} pp vs FY${firstCoverage?.fiscal_year}` : null}
        sparkline={coverageSpark.length ? coverageSpark : null}
        sparklineColor="hsl(var(--negative))"
      />
    </div>
  );
}
