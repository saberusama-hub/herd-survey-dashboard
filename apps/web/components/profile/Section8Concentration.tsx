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

  const { latest, tiles, lineData, hhiTrendNote } = useMemo(() => {
    if (concentration.length === 0) {
      return { latest: null, tiles: [] as KpiTile[], lineData: [], hhiTrendNote: null as string | null };
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
        sources: [
          {
            id: 'ncses_herd',
            subset: 'Q09 agency shares for this institution squared and summed × 10,000 (HHI), latest FY',
          },
        ],
      },
      {
        label: `Shannon entropy · FY${latest.fiscal_year}`,
        value: Number.isFinite(latest.shannon_entropy) ? Number(latest.shannon_entropy).toFixed(2) : '—',
        hint: <span className="text-text-tertiary">higher = more even spread</span>,
        sources: [
          { id: 'ncses_herd', subset: 'Q09 agency shares for this institution → Shannon entropy in nats, latest FY' },
        ],
      },
      {
        label: `5-yr CoV · FY${latest.fiscal_year}`,
        value: latest.cov_5yr !== null && Number.isFinite(latest.cov_5yr) ? formatPercent(latest.cov_5yr) : '—',
        hint: <span className="text-text-tertiary">total R&D volatility</span>,
        sources: [
          { id: 'ncses_herd', subset: 'Q01 (Total R&D) trailing-5yr coefficient of variation for this institution' },
        ],
      },
    ];
    const lineData = sorted.map((r) => ({
      fiscal_year: r.fiscal_year,
      hhi: Number.isFinite(r.hhi) ? Number(r.hhi) : null,
    }));

    // HHI direction note: compare first to last finite value.
    const finite = sorted.filter((r) => Number.isFinite(r.hhi));
    let hhiTrendNote: string | null = null;
    if (finite.length >= 2) {
      const first = finite[0];
      const last = finite[finite.length - 1];
      const dir =
        Number(last.hhi) > Number(first.hhi)
          ? 'rising concentration'
          : Number(last.hhi) < Number(first.hhi)
            ? 'falling concentration (more diversified)'
            : 'flat concentration';
      hhiTrendNote = `HHI moved from ${Math.round(Number(first.hhi)).toLocaleString('en-US')} in FY${first.fiscal_year} to ${Math.round(Number(last.hhi)).toLocaleString('en-US')} in FY${last.fiscal_year} — ${dir}.`;
    }

    return { latest, tiles, lineData, hhiTrendNote };
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
          sources={[
            {
              id: 'ncses_herd',
              subset: 'Q09 agency shares for this institution × FY → HHI = Σ(share²) × 10,000, FY2005–FY2024',
            },
          ]}
          note="HHI thresholds — < 1500 = diversified; 1500–2500 = moderately concentrated; > 2500 = highly concentrated."
          methodology={{
            what: 'Whether this university leans heavily on one or two federal agencies for its research money, or has spread funding across many.',
            how: 'For each fiscal year we compute the Herfindahl-Hirschman Index (HHI) of the seven HERD agency buckets — square each agency’s share of the institution’s federal R&D, sum them, multiply by 10,000. The result ranges 0 (perfectly even) to 10,000 (all funding from one agency).',
            caveats:
              'HHI is computed at the parent-agency level (HHS, NSF, DOD, DOE, NASA, USDA, Other). Sub-agency diversity (e.g., across NIH institutes) is not captured.',
          }}
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

      {hhiTrendNote && <p className="mt-3 text-[11px] italic text-text-tertiary">{hhiTrendNote}</p>}
    </section>
  );
}
