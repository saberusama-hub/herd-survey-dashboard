'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useMemo } from 'react';

import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

const AGENCY_ORDER = ['HHS', 'NSF', 'DOD', 'DOE', 'NASA', 'USDA', 'Other'] as const;
type AgencyKey = (typeof AGENCY_ORDER)[number];

// Spec §4.1 fixed agency lockup. HHS contains NIH in HERD Q09 reporting.
const AGENCY_COLOR: Record<AgencyKey, string> = {
  HHS: 'hsl(var(--agency-nih))',
  NSF: 'hsl(var(--agency-nsf))',
  DOD: 'hsl(var(--agency-dod))',
  DOE: 'hsl(var(--agency-doe))',
  NASA: 'hsl(var(--agency-nasa))',
  USDA: 'hsl(var(--agency-usda))',
  Other: 'hsl(var(--agency-other))',
};

const AGENCY_LABEL: Record<AgencyKey, string> = {
  HHS: 'HHS (incl. NIH)',
  NSF: 'NSF',
  DOD: 'DOD',
  DOE: 'DOE',
  NASA: 'NASA',
  USDA: 'USDA',
  Other: 'Other federal',
};

/**
 * Section 4 — Federal funding by agency, latest reported FY. Horizontal bars
 * sorted descending with fixed agency colors. Each row also gets a 20-year
 * sparkline of that agency's funding trajectory.
 */
export function Section4Agencies({ profile }: Props) {
  const { latestFy, bars, sparkData, dominantNote } = useMemo(() => {
    if (profile.agencies.length === 0) {
      return {
        latestFy: null,
        bars: [],
        sparkData: {} as Record<string, Array<{ x: number; y: number }>>,
        dominantNote: null as string | null,
      };
    }
    const latest = profile.agencies.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      profile.agencies[0].fiscal_year,
    );

    const latestRows = profile.agencies.filter((r) => r.fiscal_year === latest);
    const total = latestRows.reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);

    const bars = AGENCY_ORDER.map((bucket) => {
      const row = latestRows.find((r) => r.agency_bucket === bucket);
      const amount = Number(row?.amount_nominal) || 0;
      return {
        bucket,
        label: AGENCY_LABEL[bucket],
        color: AGENCY_COLOR[bucket],
        amount,
        share: total > 0 ? amount / total : 0,
      };
    })
      .filter((b) => b.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Per-agency 20-year sparkline series.
    const sparkData: Record<string, Array<{ x: number; y: number }>> = {};
    for (const bucket of AGENCY_ORDER) {
      sparkData[bucket] = profile.agencies
        .filter((r) => r.agency_bucket === bucket)
        .sort((a, b) => a.fiscal_year - b.fiscal_year)
        .map((r) => ({ x: r.fiscal_year, y: Number(r.amount_nominal) || 0 }));
    }

    const top = bars[0];
    const dominantNote = top
      ? `${top.label} was the dominant federal funder in FY${latest} at ${formatDollars(top.amount, { decimals: 2 })} — ${formatPercent(top.share)} of this institution's federal R&D.`
      : null;

    return { latestFy: latest, bars, sparkData, dominantNote };
  }, [profile]);

  if (bars.length === 0 || latestFy === null) {
    return (
      <section aria-labelledby="profile-section-4">
        <SectionDivider
          eyebrow="Section 4 · Federal agencies"
          title="Which federal agencies funded this university"
          dek="No HERD Q09 agency split was reported for this institution."
          color="hsl(var(--agency-nih))"
        />
      </section>
    );
  }

  const chartHeight = Math.max(220, bars.length * 44 + 40);

  return (
    <section aria-labelledby="profile-section-4">
      <SectionDivider
        eyebrow="Section 4 · Federal agencies"
        title="Which federal agencies funded this university"
        dek="HERD Q09 institution-reported federal funding by agency. Fixed agency-color lockup — NIH navy, NSF cherry, DOD forest, DOE goldenrod, NASA plum, USDA sienna."
        color="hsl(var(--agency-nih))"
      />

      <ChartFrame
        eyebrow={`FY${latestFy} federal split`}
        title="Federal funding by agency, latest reported year"
        dek="Bars are direct-labeled with the dollar amount and the share of this institution's federal R&D."
        source="HERD Q09 · agg_uni_agency_split"
      >
        <ResponsiveSvg height={chartHeight}>
          {(w, h) => <AgencyBars width={w} height={h} bars={bars} />}
        </ResponsiveSvg>
      </ChartFrame>

      {dominantNote && (
        <p className="mt-2 text-[11px] italic text-text-tertiary">{dominantNote}</p>
      )}

      {/* 20-year sparkline grid */}
      <div className="mt-6">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-text-tertiary">
          Twenty-year trajectory per agency
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {bars.map((b) => (
            <div key={b.bucket} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-primary">{b.label}</p>
                <p className="text-[11px] text-text-tertiary tnum">
                  {formatDollars(b.amount)} &middot; {formatPercent(b.share)}
                </p>
              </div>
              <Sparkline
                data={sparkData[b.bucket] ?? []}
                color={b.color}
                width={80}
                height={28}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgencyBars({
  bars,
  width,
  height,
}: {
  bars: Array<{ bucket: string; label: string; color: string; amount: number; share: number }>;
  width: number;
  height: number;
}) {
  const margin = { top: 8, right: 80, bottom: 28, left: 140 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const y = scaleBand({
    domain: bars.map((b) => b.label),
    range: [0, innerH],
    padding: 0.25,
  });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...bars.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });

  return (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.label) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          return (
            <g key={b.bucket}>
              <rect x={0} y={by} width={bw} height={bh} fill={b.color} rx={2} />
              <text
                x={bw + 6}
                y={by + bh / 2}
                dy="0.35em"
                className="fill-text-secondary text-[11px] tnum"
              >
                {formatDollars(b.amount)}
              </text>
            </g>
          );
        })}
        <AxisBottom
          top={innerH}
          scale={x}
          numTicks={4}
          tickFormat={(v) => formatDollars(Number(v))}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px] tnum',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          tickLabelProps={() => ({
            className: 'fill-text-primary text-[12px]',
            textAnchor: 'end',
            dx: -6,
            dy: 4,
          })}
          hideAxisLine
          hideTicks
        />
      </Group>
    </svg>
  );
}
