'use client';

import { useMemo } from 'react';

import { LineChart } from '@/components/charts/LineChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/**
 * Section 8 — Concentration & volatility.
 *
 * Three diversification metrics computed at aggregation time:
 *   - HHI: Herfindahl–Hirschman Index of the agency mix (0..10,000; <1500 = diversified)
 *   - Shannon entropy of the agency mix (higher = more even spread)
 *   - CoV: 5-yr rolling coefficient of variation of total R&D (volatility)
 *
 * KpiStrip surfaces the latest values; LineChart traces HHI over time.
 */
export function Section8Concentration({ profile }: Props) {
  const { concentration } = profile;

  const { latest, tiles, lineData } = useMemo(() => {
    if (concentration.length === 0) {
      return { latest: null, tiles: [] as KpiTile[], lineData: [] };
    }
    const sorted = [...concentration].sort((a, b) => a.fiscal_year - b.fiscal_year);
    const latest = sorted[sorted.length - 1];
    const tiles: KpiTile[] = [
      {
        label: `HHI · FY${latest.fiscal_year}`,
        value: Number.isFinite(latest.hhi) ? Math.round(Number(latest.hhi)).toLocaleString('en-US') : '—',
        hint: (
          <span className="text-text-tertiary">
            {Number(latest.hhi) < 1500
              ? 'Diversified (< 1500)'
              : Number(latest.hhi) < 2500
                ? 'Moderately concentrated'
                : 'Highly concentrated'}
          </span>
        ),
      },
      {
        label: `Shannon entropy · FY${latest.fiscal_year}`,
        value: Number.isFinite(latest.shannon_entropy)
          ? Number(latest.shannon_entropy).toFixed(2)
          : '—',
        hint: <span className="text-text-tertiary">higher = more even spread</span>,
      },
      {
        label: `5-yr CoV · FY${latest.fiscal_year}`,
        value:
          latest.cov_5yr !== null && Number.isFinite(latest.cov_5yr)
            ? formatPercent(latest.cov_5yr)
            : '—',
        hint: <span className="text-text-tertiary">total R&D volatility</span>,
      },
    ];
    const lineData = sorted.map((r) => ({
      fiscal_year: r.fiscal_year,
      hhi: Number.isFinite(r.hhi) ? Number(r.hhi) : null,
    }));
    return { latest, tiles, lineData };
  }, [concentration]);

  if (!latest) {
    return (
      <section aria-labelledby="profile-section-8">
        <SectionDivider
          eyebrow="Section 8 · Concentration"
          title="How concentrated is this portfolio?"
          dek="No agency-mix concentration metrics were computed for this institution."
          color="hsl(var(--agency-doe))"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-section-8">
      <SectionDivider
        eyebrow="Section 8 · Concentration"
        title="How concentrated is this portfolio?"
        dek="Three lenses on diversification: the Herfindahl–Hirschman index of agency dependence, Shannon entropy across the same mix, and a 5-year rolling coefficient of variation of total R&D."
        color="hsl(var(--agency-doe))"
      />

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8">
        <ChartFrame
          eyebrow="Concentration over time"
          title="Herfindahl–Hirschman index of agency mix"
          dek="A single line: how concentrated the federal-agency mix has been each year. HHI ranges 0–10,000 — below 1500 is conventionally diversified."
          source="agg_uni_concentration"
          note="HHI thresholds — < 1500 = diversified; 1500–2500 = moderately concentrated; > 2500 = highly concentrated."
        >
          <LineChart
            data={lineData as unknown as Array<Record<string, unknown>>}
            xKey="fiscal_year"
            series={[{ key: 'hhi', label: 'HHI' }]}
            yFormat={(v) => Math.round(v).toLocaleString('en-US')}
            height={300}
            showLegend={false}
          />
        </ChartFrame>
      </div>
    </section>
  );
}
