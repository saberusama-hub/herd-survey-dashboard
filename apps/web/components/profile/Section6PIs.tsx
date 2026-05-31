'use client';

import { useMemo } from 'react';

import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { LineChart } from '@/components/charts/LineChart';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatCount, formatDollars } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/**
 * Section 6 — PI metrics.
 *
 * NB: PI counts here are *coverage floors*: they're derived from the top-20K
 * NIH+NSF grants ledger materialized in sheet_05, not the full universe. The
 * actual distinct-PI count is higher, so we surface the floor + footnote.
 *
 * Layout:
 *  - KpiStrip (3 tiles): latest distinct PI count, average $/PI, total federal $ behind the count.
 *  - LineChart: PI count trajectory over time.
 *  - DistributionPlot: latest-FY decile distribution of $/PI.
 */
export function Section6PIs({ profile }: Props) {
  const { piMetrics, piDistribution } = profile;

  const { tiles, lineData, distLatestFy, distRows, latestPi, peakPiNote } = useMemo(() => {
    if (piMetrics.length === 0) {
      return {
        tiles: [],
        lineData: [],
        distLatestFy: null,
        distRows: [],
        latestPi: null,
        peakPiNote: null as string | null,
      };
    }
    const latestPi = piMetrics[piMetrics.length - 1];
    const lineData = piMetrics.map((r) => ({
      fiscal_year: r.fiscal_year,
      pi_count: Number(r.pi_count) || 0,
    }));
    const distLatestFy = latestPi.fiscal_year;
    const distRows = piDistribution
      .filter((r) => r.fiscal_year === distLatestFy)
      .sort((a, b) => a.decile - b.decile)
      .map((r) => ({ decile: r.decile, avg_amount: Number(r.avg_amount) || 0 }));

    const tiles: KpiTile[] = [
      {
        label: `Distinct federal PIs · FY${latestPi.fiscal_year}`,
        value: formatCount(Number(latestPi.pi_count) || 0),
        hint: (
          <span className="text-text-tertiary">
            coverage floor — see footnote
          </span>
        ),
      },
      {
        label: `Avg $ per PI · FY${latestPi.fiscal_year}`,
        value: formatDollars(latestPi.amount_per_pi, { decimals: 2 }),
        hint: (
          <span className="text-text-tertiary">across all tracked grants</span>
        ),
      },
      {
        label: `Federal $ behind PIs · FY${latestPi.fiscal_year}`,
        value: formatDollars(latestPi.federal_amount, { decimals: 2 }),
        hint: (
          <span className="text-text-tertiary">
            NIH RePORTER + NSF Awards (top-20K)
          </span>
        ),
      },
    ];
    // Peak PI year footnote.
    let peakFy = lineData[0].fiscal_year;
    let peakCount = lineData[0].pi_count;
    for (const r of lineData) {
      if (r.pi_count > peakCount) {
        peakCount = r.pi_count;
        peakFy = r.fiscal_year;
      }
    }
    const peakPiNote = peakCount > 0
      ? `PI count peaked at ${formatCount(peakCount)} in FY${peakFy}. Numbers reflect the top-20K NIH+NSF grants floor — the true distinct-PI count is higher.`
      : null;

    return { tiles, lineData, distLatestFy, distRows, latestPi, peakPiNote };
  }, [piMetrics, piDistribution]);

  if (piMetrics.length === 0) {
    return (
      <section aria-labelledby="profile-section-6">
        <SectionDivider
          eyebrow="Section 6 · Principal investigators"
          title="The PI footprint"
          dek="No PI-level grant data was found for this institution in the top-20K NIH/NSF ledger."
          color="hsl(var(--agency-nih))"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-section-6">
      <SectionDivider
        eyebrow="Section 6 · Principal investigators"
        title="The PI footprint"
        dek="Based on top-20K NIH + NSF grants — actual full-universe PI counts are higher. The chart shows how many distinct PIs the institution carried, year over year."
        color="hsl(var(--agency-nih))"
      />

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ChartFrame
          eyebrow="PI count trajectory"
          title="Distinct federal PIs per fiscal year"
          dek="One line per institution: how many uniquely-identified PIs led active NIH+NSF awards in each FY."
          source="agg_uni_pi_metrics (top-20K NIH+NSF ledger)"
          note="Coverage floor — full-universe PI counts are higher because the ledger truncates at the top 20K grants."
        >
          <LineChart
            data={lineData as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={[{ key: 'pi_count', label: 'PIs' }]}
            yFormat={(v) => formatCount(v)}
            height={260}
            showLegend={false}
          />
        </ChartFrame>

        <ChartFrame
          eyebrow={distLatestFy ? `FY${distLatestFy} distribution` : 'PI $ distribution'}
          title="How federal $ spreads across PIs"
          dek="Mean dollar amount per PI in each decile of the latest-year roster (1 = lowest-funded, 10 = highest-funded)."
          source="agg_uni_pi_distribution"
          note={
            latestPi
              ? `Top decile carries ${formatDollars(
                  distRows[distRows.length - 1]?.avg_amount ?? 0,
                  { decimals: 2 },
                )} per PI on average.`
              : undefined
          }
        >
          <ResponsiveSvg height={260}>
            {(w, h) => <DistributionPlot data={distRows} width={w} height={h} />}
          </ResponsiveSvg>
        </ChartFrame>
      </div>

      {peakPiNote && (
        <p className="mt-3 text-[11px] italic text-text-tertiary">{peakPiNote}</p>
      )}
    </section>
  );
}
