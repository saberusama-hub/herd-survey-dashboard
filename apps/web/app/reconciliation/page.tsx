'use client';

import { useDuckDB } from '@/app/providers';
import { ConnectedScatter, type ScatterPoint } from '@/components/charts/ConnectedScatter';
import { Dumbbell, type DumbbellRow, gapConnectorColor } from '@/components/charts/Dumbbell';
import { LineChart } from '@/components/charts/LineChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { KEY_EVENTS_BANDS } from '@/lib/annotations';
import { formatPct } from '@/lib/format';
import {
  type BridgeRow,
  type BuCoveragePair,
  type CoverageRow,
  type ReconcileGap,
  bottomUpCoverageByFy,
  bottomUpCoveragePair,
  federalUniversityBridge,
  reconciliationGap,
} from '@/lib/queries';
import { useEffect, useMemo, useState } from 'react';

const FY_OPTIONS = [2024, 2023, 2022, 2021, 2020] as const;

export default function ReconciliationPage() {
  const { ready } = useDuckDB();
  const [fy, setFy] = useState<2020 | 2021 | 2022 | 2023 | 2024>(2024);
  const [bridge, setBridge] = useState<BridgeRow[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [gap, setGap] = useState<ReconcileGap[]>([]);
  const [pair, setPair] = useState<BuCoveragePair[]>([]);
  const [sortKey, setSortKey] = useState<'herd' | 'abs_gap_pct'>('herd');

  useEffect(() => {
    if (!ready) return;
    federalUniversityBridge().then(setBridge).catch(() => setBridge([]));
    bottomUpCoverageByFy().then(setCoverage).catch(() => setCoverage([]));
    bottomUpCoveragePair(2020, 2024).then(setPair).catch(() => setPair([]));
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    reconciliationGap(fy, 30).then(setGap).catch(() => setGap([]));
  }, [ready, fy]);

  const bridgeChartData = bridge.map((r) => ({
    fiscal_year: r.fiscal_year,
    herd: r.herd_reported_universities_expenditures_usd,
    ff_explicit: r.ff_explicit_universities_obligations_usd,
    ff_estimate: r.ff_universities_estimate_with_allocation_usd,
  }));

  const coverageChartData = coverage.map((r) => ({
    fiscal_year: r.fiscal_year,
    coverage_pct: r.coverage_pct !== null ? r.coverage_pct * 100 : null,
  }));
  const peak = coverage.length ? Math.max(...coverage.map((r) => r.coverage_pct ?? 0)) : 0;
  const peakRow = coverage.find((r) => r.coverage_pct === peak);
  const latestCoverage = coverage.length ? coverage[coverage.length - 1] : null;

  const dumbbellRows: DumbbellRow[] = useMemo(() => {
    const rows = gap.map((g) => ({
      label: g.canonical_name,
      sublabel: g.state_code ?? undefined,
      left: g.bu,
      right: g.herd,
    }));
    if (sortKey === 'abs_gap_pct') {
      return [...rows].sort((a, b) => {
        const ag = Math.abs(a.right - a.left) / Math.max(a.right, 1);
        const bg = Math.abs(b.right - b.left) / Math.max(b.right, 1);
        return bg - ag;
      });
    }
    return rows;
  }, [gap, sortKey]);
  const absGapMax = useMemo(
    () => Math.max(...gap.map((g) => Math.abs(g.gap_usd ?? 0)), 1),
    [gap],
  );

  const annotatedNames = new Set([
    'Massachusetts Institute of Technology',
    'Johns Hopkins University',
    'Georgia Institute of Technology',
  ]);
  const scatterPoints: ScatterPoint[] = pair
    .filter((p) => Number.isFinite(p.bu_pct_fy_a) && Number.isFinite(p.bu_pct_fy_b))
    .map((p) => ({
      x: p.bu_pct_fy_a * 100,
      y: p.bu_pct_fy_b * 100,
      label: p.canonical_name,
      highlight: annotatedNames.has(p.canonical_name),
    }));

  return (
    <div className="container-wide py-10 md:py-14 space-y-10">
      <PageHeader
        eyebrow="Top-down vs bottom-up"
        title="Cross-source reconciliation"
        description="Why federal R&D numbers diverge across sources, and what the gaps mean. The most analytically important page on this platform."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow="National view"
            title="HERD, FF explicit, FF estimate — together"
            subtitle="What HERD reports universities spent vs. what Federal Funds attributes to universities, with and without inferred allocation."
            source="Sheet 11 federal-university bridge · USD nominal"
          />
          <LineChart
            data={bridgeChartData}
            xKey="fiscal_year"
            series={[
              { key: 'herd', label: 'HERD reported (universities)', color: 'hsl(var(--cat-1))' },
              { key: 'ff_estimate', label: 'FF + allocation estimate', color: 'hsl(var(--cat-4))' },
              { key: 'ff_explicit', label: 'FF explicit (universities only)', color: 'hsl(var(--cat-2))' },
            ]}
            height={320}
            directLabels
            showLegend={false}
            referenceBands={KEY_EVENTS_BANDS}
          />
          <p className="t-small text-text-secondary leading-relaxed max-w-prose">
            The wider the wedge between the orange and red lines, the more of the federal R&amp;D pie that universities
            self-report in HERD but that Federal Funds doesn&apos;t explicitly attribute to higher-education performers.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow="The state of bottom-up data"
            title="Bottom-up coverage of HERD federal R&D is collapsing"
            subtitle="Bottom-up sources (NIH ExPORTER + NSF Awards + USAspending) used to capture roughly 80% of what universities report to HERD. They now capture under half."
            source="Sheet 07 cross-source reconciliation · USD nominal"
          />
          <LineChart
            data={coverageChartData}
            xKey="fiscal_year"
            series={[{ key: 'coverage_pct', label: 'BU ÷ HERD', color: 'hsl(var(--negative))' }]}
            height={280}
            yFormat={(v) => `${v.toFixed(0)}%`}
            showLegend={false}
            referenceBands={KEY_EVENTS_BANDS.filter((e) => e.id !== 'chips')}
          />
          {peakRow && latestCoverage && (
            <div className="flex flex-wrap gap-3">
              <Stat
                label="Peak coverage"
                value={formatPct(peakRow.coverage_pct)}
                sub={`FY${peakRow.fiscal_year}`}
                tone="positive"
              />
              <Stat
                label="Latest"
                value={formatPct(latestCoverage.coverage_pct)}
                sub={`FY${latestCoverage.fiscal_year}`}
                tone="negative"
              />
              <Stat
                label="Change"
                value={formatPct((latestCoverage.coverage_pct ?? 0) - (peakRow.coverage_pct ?? 0), { signed: true })}
                sub="percentage points"
                tone="negative"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow="Per-institution view"
            title="HERD vs bottom-up by institution"
            subtitle="Each row is one university. Teal dot = HERD-reported federal R&D. Rose dot = sum of NIH + NSF + USAS. The connector colors flag widening gaps."
            source={`Sheet 07 · FY${fy} · top 30 by HERD federal R&D`}
            actions={
              <div className="flex items-center gap-2">
                <Select
                  value={String(fy)}
                  onValueChange={(v) => setFy(Number(v) as 2020 | 2021 | 2022 | 2023 | 2024)}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FY_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        FY{y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as 'herd' | 'abs_gap_pct')}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="herd">Sort by HERD $</SelectItem>
                    <SelectItem value="abs_gap_pct">Sort by gap %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
          {dumbbellRows.length > 0 ? (
            <Dumbbell
              rows={dumbbellRows}
              leftColor="hsl(var(--cat-2))"
              rightColor="hsl(var(--cat-1))"
              connectorColor={gapConnectorColor(absGapMax)}
              leftLabel="Bottom-up"
              rightLabel="HERD federal"
              rowHeight={22}
              labelWidth={260}
            />
          ) : (
            <div className="h-[420px] animate-pulse bg-border/20 rounded-md" />
          )}
          <div className="flex flex-wrap gap-4 text-2xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--cat-1))' }} /> HERD federal R&amp;D
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--cat-2))' }} /> Bottom-up sum
              (NIH+NSF+USAS)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-4" style={{ background: 'hsl(var(--highlight))' }} /> Connector tone: gray →
              warning → callout as gap grows
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow="Where each institution moved"
            title="FY20 vs FY24 coverage by institution"
            subtitle="Each dot is one institution. Below the dashed y=x line means bottom-up sources captured less of HERD federal R&D in FY24 than in FY20."
            source="Sheet 07 · institutions with FY24 HERD federal R&D ≥ $50M"
          />
          {scatterPoints.length > 0 ? (
            <ConnectedScatter
              points={scatterPoints}
              xLabel="FY2020 BU coverage of HERD federal (%)"
              yLabel="FY2024 BU coverage of HERD federal (%)"
              xFormat={(v) => `${v.toFixed(0)}%`}
              yFormat={(v) => `${v.toFixed(0)}%`}
              showIdentityLine
              height={460}
            />
          ) : (
            <div className="h-[460px] animate-pulse bg-border/20 rounded-md" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow="Caveats"
            title="What the numbers cannot tell you"
            subtitle="These are the structural reasons HERD and bottom-up sources disagree."
          />
          <ul className="space-y-3 t-body max-w-prose">
            <li>
              <strong className="font-serif italic text-text-primary">Tiny anchors.</strong>{' '}
              Institutions with very small HERD federal totals are dropped from the per-institution gap view to
              suppress spurious &quot;infinite&quot; percentage gaps.
            </li>
            <li>
              <strong className="font-serif italic text-text-primary">FFRDC blind spot.</strong>{' '}
              Federally-funded R&amp;D centers (DOE labs, JPL) are not always attributable to an academic host even
              when a university manages them. Bottom-up sources see these contracts; HERD does not.
            </li>
            <li>
              <strong className="font-serif italic text-text-primary">USAspending pre-2008 sparseness.</strong>{' '}
              USAS coverage of federal contracts was incomplete before FY2008. Bottom-up coverage in early years
              overstates the &quot;missing&quot; share of HERD federal R&amp;D.
            </li>
            <li>
              <strong className="font-serif italic text-text-primary">FY15 / FY16 Federal Funds gap.</strong>{' '}
              Two cycles of the NCSES Federal Funds Survey were skipped. FF-explicit and FF-with-allocation lines
              are interpolated for those years.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-text-primary';
  return (
    <div className="rounded border border-rule bg-surface-elevated px-4 py-3 min-w-[140px]">
      <div className="h-eyebrow text-text-tertiary mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-xl font-medium tabular-nums ${toneClass}`}>{value}</span>
        {sub ? <span className="text-2xs text-text-tertiary">{sub}</span> : null}
      </div>
    </div>
  );
}
