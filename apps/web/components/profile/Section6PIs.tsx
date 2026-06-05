'use client';

import { useId, useMemo, useState } from 'react';

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

  // Independent year state for the team-size chart so a reader can scrub
  // through fiscal years without re-rendering the other panels.
  const teamSizeYears = useMemo(
    () => Array.from(new Set(teamSize.map((r) => r.fiscal_year))).sort((a, b) => b - a),
    [teamSize],
  );
  const initialTeamFy = teamSizeYears[0] ?? null;
  const [selectedTeamFy, setSelectedTeamFy] = useState<number | null>(initialTeamFy);
  const teamFy = selectedTeamFy ?? initialTeamFy;
  const teamYearPickerId = useId();

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

    // Team-size bars driven by the user-selected fiscal year (falls back to
    // the latest-available FY).
    const effectiveTeamFy = teamFy ?? distLatestFy;
    const teamForFy = teamSize.filter((r) => r.fiscal_year === effectiveTeamFy);
    const teamBars = TEAM_BUCKETS.map((b) => {
      const row = teamForFy.find((r) => r.team_size_bucket === b);
      return {
        label: TEAM_LABEL[b],
        bucket: b,
        amount: Number(row?.total_amount) || 0,
        grants: Number(row?.grant_count) || 0,
      };
    }).filter((r) => r.amount > 0);
    const teamTotal = teamBars.reduce((s, r) => s + r.amount, 0);
    const single = teamBars.find((r) => r.bucket === '1');
    const multi = teamBars.filter((r) => r.bucket !== '1').reduce((s, r) => s + r.amount, 0);
    const multiPiShare = teamTotal > 0 ? multi / teamTotal : null;

    const tiles: KpiTile[] = [
      {
        label: `NSF + NIH PIs · FY${latestPi.fiscal_year}`,
        value: formatCount(Number(latestPi.distinct_pi_count) || 0),
        hint: <span className="text-text-tertiary">unique principal investigators with any NSF or NIH grant</span>,
        sources: [
          { id: 'nsf_awards', subset: 'Lead PI per award for this institution × FY' },
          { id: 'nih_exporter', subset: 'PI bridge file (project × PI) for this institution × FY' },
        ],
      },
      {
        label: `$ per NSF+NIH PI · FY${latestPi.fiscal_year}`,
        value: formatDollars(Number(latestPi.amount_per_pi) || 0, {
          decimals: 2,
        }),
        hint: <span className="text-text-tertiary">total NSF + NIH funding ÷ distinct NSF + NIH PI count</span>,
        sources: [
          { id: 'nsf_awards', subset: 'Total NSF $ for this institution × FY ÷ distinct PI count' },
          { id: 'nih_exporter', subset: 'Total NIH $ for this institution × FY ÷ distinct PI count' },
        ],
      },
      {
        label: `Multi-PI team share · FY${effectiveTeamFy}`,
        value: formatPercent(multiPiShare),
        hint: <span className="text-text-tertiary">share of NSF + NIH $ to grants with 2+ PIs</span>,
        sources: [
          { id: 'nsf_awards', subset: 'n_pi field per award; bucketed' },
          { id: 'nih_exporter', subset: 'PI bridge count per project; bucketed' },
        ],
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
    const peakPiNote =
      peakCount > 0
        ? `PI headcount peaked at ${formatCount(peakCount)} in FY${peakFy}. Counts include co-PIs via the NIH PI bridge plus NSF lead PIs.`
        : null;

    return {
      tiles,
      lineData,
      distLatestFy,
      distRows,
      latestPi,
      effectiveTeamFy,
      teamBars,
      peakPiNote,
      single,
    };
  }, [piMetrics, piDistribution, teamSize, teamFy]);

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

  const { tiles, lineData, distLatestFy, distRows, effectiveTeamFy, teamBars, peakPiNote, single } = view;

  return (
    <section aria-labelledby="profile-section-6">
      <SectionDivider
        eyebrow="Section 6 · Principal investigators"
        title="The PI footprint"
        dek="Distinct researchers (lead + co-PIs) receiving any NSF or NIH funding, plus how those grants split by team size. Scope is NSF + NIH because no other federal agency publishes a machine-readable PI roster."
        color="hsl(var(--agency-nih))"
      />

      <p className="mb-4 text-[11px] italic leading-relaxed text-text-tertiary">
        Data note: principal-investigator counts on this page cover NSF Awards (lead PI) and NIH RePORTER (lead +
        co-PIs) only. Other federal agencies (DOD, DOE, USDA, NASA, and the rest of "Federal Funds") report aggregate
        dollar totals but do not publish PI rosters, so they cannot be included in any per-PI metric.
      </p>

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ChartFrame
          eyebrow="PI count trajectory"
          title="Distinct NSF + NIH PIs per fiscal year"
          dek="Every unique researcher who held an NSF or NIH grant in the year — lead PIs plus co-PIs from multi-PI NIH projects."
          sources={[
            { id: 'nsf_awards', subset: 'Lead PI per award for this institution; distinct PIs counted per FY' },
            {
              id: 'nih_exporter',
              subset: 'PI bridge file (one row per project × PI) for this institution; distinct PIs counted per FY',
            },
          ]}
          methodology={{
            what: 'How many individual researchers at this university held a federal NSF or NIH grant in each year.',
            how: 'For every fiscal year we count distinct PIs that appear in the raw NSF Awards file or the NIH RePORTER PI bridge. The two universes are unioned and deduplicated by name + institution.',
            caveats:
              'FY2005 is masked — upstream entity resolution lumped subunits (e.g., Harvard Medical School) into the parent in FY2005 only, affecting 81 institutions. NSF counts only the lead PI per award (the agency does not ship the full co-PI roster), so true team headcount is slightly higher than shown.',
          }}
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
          eyebrow={`FY${effectiveTeamFy} team size`}
          title="NSF + NIH $ by grant team size"
          dek={
            single
              ? `Single-PI grants drove ${formatDollars(single.amount, { decimals: 1 })}; the rest came from teams of 2+. Use the year picker to scrub across FYs.`
              : 'Distribution of NSF + NIH funding across grant team-size buckets for the selected fiscal year.'
          }
          sources={[
            {
              id: 'nsf_awards',
              subset: `n_pi field per award for this institution, bucketed by team count for FY${effectiveTeamFy}`,
            },
            {
              id: 'nih_exporter',
              subset: `PI bridge COUNT(DISTINCT pi_id) per project for this institution, bucketed for FY${effectiveTeamFy}`,
            },
          ]}
          methodology={{
            what: 'Of every NSF + NIH dollar coming into this university in the selected year, how much went to lone researchers vs. larger collaborative teams.',
            how: 'Each NSF or NIH grant is bucketed by its team size (1, 2-5, 6-10, 11-20, 21+ PIs). Team size comes from the NSF `n_pi` field and the NIH `PI_IDS` array (unnested). We sum the dollar amount of grants in each bucket for the chosen fiscal year.',
            caveats:
              'NSF does not publish the full co-PI roster — each grant is placed in its reported team-size bucket but the individual co-PIs are not counted separately. This nudges the bigger-team buckets slightly conservative.',
          }}
        >
          <div className="-mt-2 mb-3 flex items-center gap-2">
            <label htmlFor={teamYearPickerId} className="text-[11px] uppercase tracking-wider text-text-tertiary">
              Year
            </label>
            <select
              id={teamYearPickerId}
              value={effectiveTeamFy}
              onChange={(e) => setSelectedTeamFy(Number(e.target.value))}
              className="h-7 rounded-md border border-rule bg-surface-elevated px-2 text-xs tnum focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {teamSizeYears.map((y) => (
                <option key={y} value={y}>
                  FY{y}
                </option>
              ))}
            </select>
          </div>
          {teamBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">No team-size data for FY{effectiveTeamFy}.</p>
          ) : (
            <BarChart
              data={teamBars as unknown as Array<Record<string, unknown>>}
              xKey="label"
              series={[{ key: 'amount', label: 'Total NSF + NIH $', color: 'hsl(var(--accent))' }]}
              xFormat={(v) => String(v)}
              yFormat={(v) => formatDollars(v)}
              height={260}
              showLegend={false}
            />
          )}
        </ChartFrame>
      </div>

      <div className="mt-8">
        <ChartFrame
          eyebrow={distLatestFy ? `FY${distLatestFy} distribution` : 'NSF + NIH $ per PI distribution'}
          title="How NSF + NIH $ spreads across PIs"
          dek="Average $ per PI across ten equally-sized funding brackets — bracket 1 = lowest-funded 10% of PIs, bracket 10 = highest-funded 10%."
          sources={[
            {
              id: 'nsf_awards',
              subset: 'NSF lead PI obligations split into ten equal-size brackets per institution × FY',
            },
            {
              id: 'nih_exporter',
              subset: 'NIH PI total_cost split into ten equal-size brackets per institution × FY',
            },
          ]}
          note={
            distRows.length > 0
              ? `The top 10% of NSF + NIH-funded PIs averaged ${formatDollars(
                  distRows[distRows.length - 1]?.avg_amount ?? 0,
                  { decimals: 2 },
                )} per PI.`
              : undefined
          }
          methodology={{
            what: 'Whether NSF + NIH money at this university is spread evenly across researchers, or concentrated in a few big-grant labs.',
            how: 'In the latest reported year we sort every PI by total NSF + NIH dollars received, split the roster into ten equal-size brackets (10% each), and plot the average $/PI in each bracket. Bracket 1 = lowest-funded 10% of PIs; bracket 10 = highest-funded 10%.',
            caveats:
              'A "PI" here means lead or co-PI on any NSF/NIH grant — including small no-cost extensions. PIs working at multiple institutions are counted at each.',
          }}
        >
          <ResponsiveSvg height={240}>
            {(w, h) => <DistributionPlot data={distRows} width={w} height={h} />}
          </ResponsiveSvg>
        </ChartFrame>
      </div>

      {peakPiNote && <p className="mt-3 text-[11px] italic text-text-tertiary">{peakPiNote}</p>}
    </section>
  );
}
