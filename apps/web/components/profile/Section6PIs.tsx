'use client';

import { useMemo } from 'react';

import { BarChart } from '@/components/charts/BarChart';
import { DistributionPlot } from '@/components/charts/DistributionPlot';
import { LineChart } from '@/components/charts/LineChart';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatCount, formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

const TEAM_BUCKETS = ['1', '2-5', '6-10', '11-20', '21+'] as const;
type TeamBucket = (typeof TEAM_BUCKETS)[number];

const TEAM_LABEL: Record<TeamBucket, string> = {
  '1': 'Single PI',
  '2-5': '2-5 PIs',
  '6-10': '6-10 PIs',
  '11-20': '11-20 PIs',
  '21+': '21+ PIs',
};

/**
 * Section 6 — PI metrics.
 *
 * Phase R: now sourced from the FULL federal-PI universe — every distinct PI
 * (lead + co-PIs) receiving any NSF or NIH grant in the fiscal year. Replaces
 * the old top-20K-grants floor.
 *
 * Layout:
 *  - KpiStrip (3 tiles): distinct PI count, $/PI, share of $ to multi-PI teams.
 *  - LineChart: PI count trajectory over time.
 *  - BarChart: team-size distribution by total $ in the latest FY.
 *  - DistributionPlot: latest-FY decile distribution of $/PI (kept for context).
 */
export function Section6PIs({ profile }: Props) {
  const { piMetrics, piDistribution, teamSize } = profile;

  const view = useMemo(() => {
    if (piMetrics.length === 0) {
      return null;
    }
    const latestPi = piMetrics[piMetrics.length - 1];
    const lineData = piMetrics.map((r) => ({
      fiscal_year: r.fiscal_year,
      pi_count: Number(r.distinct_pi_count) || 0,
    }));
    const distLatestFy = latestPi.fiscal_year;
    const distRows = piDistribution
      .filter((r) => r.fiscal_year === distLatestFy)
      .sort((a, b) => a.decile - b.decile)
      .map((r) => ({ decile: r.decile, avg_amount: Number(r.avg_amount) || 0 }));

    // Latest-FY team-size bars.
    const latestTeamFy = teamSize.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      teamSize[0]?.fiscal_year ?? distLatestFy,
    );
    const latestTeam = teamSize.filter((r) => r.fiscal_year === latestTeamFy);
    const teamBars = TEAM_BUCKETS.map((b) => {
      const row = latestTeam.find((r) => r.team_size_bucket === b);
      return {
        label: TEAM_LABEL[b],
        bucket: b,
        amount: Number(row?.total_amount) || 0,
        grants: Number(row?.grant_count) || 0,
      };
    }).filter((r) => r.amount > 0);
    const teamTotal = teamBars.reduce((s, r) => s + r.amount, 0);
    const single = teamBars.find((r) => r.bucket === '1');
    const multi = teamBars
      .filter((r) => r.bucket !== '1')
      .reduce((s, r) => s + r.amount, 0);
    const multiPiShare = teamTotal > 0 ? multi / teamTotal : null;

    const tiles: KpiTile[] = [
      {
        label: `Distinct federal PIs · FY${latestPi.fiscal_year}`,
        value: formatCount(Number(latestPi.distinct_pi_count) || 0),
        hint: (
          <span className="text-text-tertiary">
            unique PIs (lead + co-PIs) with any NSF or NIH grant
          </span>
        ),
      },
      {
        label: `Federal $ per PI · FY${latestPi.fiscal_year}`,
        value: formatDollars(Number(latestPi.amount_per_pi) || 0, {
          decimals: 2,
        }),
        hint: (
          <span className="text-text-tertiary">
            total NSF+NIH funding ÷ distinct PI count
          </span>
        ),
      },
      {
        label: `Multi-PI team share · FY${latestTeamFy}`,
        value: formatPercent(multiPiShare),
        hint: (
          <span className="text-text-tertiary">
            share of federal $ to grants with 2+ PIs
          </span>
        ),
      },
    ];

    // Peak-PI heuristic footnote.
    let peakFy = lineData[0].fiscal_year;
    let peakCount = lineData[0].pi_count;
    for (const r of lineData) {
      if (r.pi_count > peakCount) {
        peakCount = r.pi_count;
        peakFy = r.fiscal_year;
      }
    }
    const peakPiNote = peakCount > 0
      ? `PI headcount peaked at ${formatCount(peakCount)} in FY${peakFy}. Counts include co-PIs via the NIH PI bridge plus NSF lead PIs.`
      : null;

    return {
      tiles,
      lineData,
      distLatestFy,
      distRows,
      latestPi,
      latestTeamFy,
      teamBars,
      peakPiNote,
      single,
    };
  }, [piMetrics, piDistribution, teamSize]);

  if (!view) {
    return (
      <section aria-labelledby="profile-section-6">
        <SectionDivider
          eyebrow="Section 6 · Principal investigators"
          title="The PI footprint"
          dek="No PI-level federal grant data was found for this institution in the raw NSF + NIH project tables."
          color="hsl(var(--agency-nih))"
        />
      </section>
    );
  }

  const { tiles, lineData, distLatestFy, distRows, latestTeamFy, teamBars, peakPiNote, single } = view;

  return (
    <section aria-labelledby="profile-section-6">
      <SectionDivider
        eyebrow="Section 6 · Principal investigators"
        title="The PI footprint"
        dek="Full federal-PI universe — distinct researchers (lead + co-PIs) receiving any NSF or NIH funding, plus how those grants split by team size."
        color="hsl(var(--agency-nih))"
      />

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ChartFrame
          eyebrow="PI count trajectory"
          title="Distinct federal PIs per fiscal year"
          dek="Every unique person who held a NSF or NIH grant in the year — lead PIs plus co-PIs from multi-PI projects."
          source="agg_uni_pi_universe (raw NSF awards ∪ NIH PI bridge)"
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
          eyebrow={`FY${latestTeamFy} team size`}
          title="Federal $ by grant team size"
          dek={
            single
              ? `Single-PI grants drove ${formatDollars(single.amount, { decimals: 1 })}; the rest came from teams of 2+.`
              : 'Distribution of federal funding across grant team-size buckets.'
          }
          source="agg_uni_team_size (NSF n_pi ∪ NIH PI bridge count)"
        >
          <BarChart
            data={teamBars as unknown as Array<Record<string, unknown>>}
            xKey="label"
            series={[
              { key: 'amount', label: 'Total federal $', color: 'hsl(var(--accent))' },
            ]}
            xFormat={(v) => String(v)}
            yFormat={(v) => formatDollars(v)}
            height={260}
            showLegend={false}
          />
        </ChartFrame>
      </div>

      <div className="mt-8">
        <ChartFrame
          eyebrow={distLatestFy ? `FY${distLatestFy} distribution` : 'PI $ distribution'}
          title="How federal $ spreads across PIs (deciles)"
          dek="Mean dollar amount per PI in each decile of the latest-year roster (1 = lowest-funded, 10 = highest-funded)."
          source="agg_uni_pi_distribution"
          note={
            distRows.length > 0
              ? `Top decile carries ${formatDollars(
                  distRows[distRows.length - 1]?.avg_amount ?? 0,
                  { decimals: 2 },
                )} per PI on average.`
              : undefined
          }
        >
          <ResponsiveSvg height={240}>
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
