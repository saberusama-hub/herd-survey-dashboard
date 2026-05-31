'use client';

import { useMemo } from 'react';

import { GroupedBar } from '@/components/charts/GroupedBar';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/**
 * Section 5 — Reconciliation.
 *
 * Per spec §3.3 and the P3 task note: this chart compares
 *   (a) HERD-reported federal R&D (top-down: from agg_uni_agency_split, summed
 *       across all agency buckets), and
 *   (b) Bottom-up federal streams (NIH RePORTER + NSF Awards + USASpending
 *       contracts + USASpending assistance), per the federalFunds slice that
 *       04_federal_funds.py builds out of sheet_07_cross_source_reconciliation.
 *
 * GroupedBar with one group per fiscal year and two bars per group: HERD on
 * the left, bottom-up sum on the right. The chart is editorial — readers see
 * coverage gaps appear as the bottom-up bar falling short of HERD.
 */
export function Section5Reconciliation({ profile }: Props) {
  const { rows, latestCoverage, latestFy, hasData } = useMemo(() => {
    // Aggregate HERD federal per FY.
    const herdByFy = new Map<number, number>();
    for (const r of profile.agencies) {
      herdByFy.set(
        r.fiscal_year,
        (herdByFy.get(r.fiscal_year) ?? 0) + (Number(r.amount_nominal) || 0),
      );
    }
    // Aggregate bottom-up streams per FY.
    const buByFy = new Map<number, number>();
    for (const r of profile.federalFunds) {
      buByFy.set(
        r.fiscal_year,
        (buByFy.get(r.fiscal_year) ?? 0) + (Number(r.amount_nominal) || 0),
      );
    }
    const fys = Array.from(new Set([...herdByFy.keys(), ...buByFy.keys()])).sort(
      (a, b) => a - b,
    );
    const rows = fys.map((fy) => ({
      fiscal_year: fy,
      herd: herdByFy.get(fy) ?? 0,
      bottom_up: buByFy.get(fy) ?? 0,
    }));
    const latestFy = fys.length > 0 ? fys[fys.length - 1] : null;
    const latestRow = rows[rows.length - 1];
    const latestCoverage =
      latestRow && latestRow.herd > 0 ? latestRow.bottom_up / latestRow.herd : null;
    return {
      rows,
      latestCoverage,
      latestFy,
      hasData: rows.some((r) => r.herd > 0 || r.bottom_up > 0),
    };
  }, [profile]);

  if (!hasData) {
    return (
      <section aria-labelledby="profile-section-5">
        <SectionDivider
          eyebrow="Section 5 · Reconciliation"
          title="HERD vs bottom-up federal streams"
          dek="Neither HERD federal R&D nor bottom-up streams were reported for this institution."
          color="hsl(var(--agency-doe))"
        />
      </section>
    );
  }

  const colors: Record<string, string> = {
    herd: 'hsl(var(--accent))',
    bottom_up: 'hsl(var(--mute-1))',
  };

  return (
    <section aria-labelledby="profile-section-5">
      <SectionDivider
        eyebrow="Section 5 · Reconciliation"
        title="HERD vs bottom-up federal streams"
        dek="Institution-reported HERD federal R&D (accent) side-by-side with the sum of NIH RePORTER + NSF Awards + USASpending. Gaps are expected — the methodology footnote below explains why."
        color="hsl(var(--agency-doe))"
      />

      {latestCoverage !== null && latestFy !== null && (
        <div className="mb-4 rounded border border-rule bg-surface px-4 py-3 text-sm">
          <p className="text-text-secondary">
            FY{latestFy} bottom-up coverage:{' '}
            <span className="font-semibold text-text-primary tnum">
              {formatPercent(latestCoverage)}
            </span>{' '}
            of HERD-reported federal R&D was found in the bottom-up streams.
          </p>
        </div>
      )}

      <ChartFrame
        eyebrow="Federal R&D coverage"
        title="Top-down HERD vs bottom-up bottom-line, year by year"
        dek="Bars are grouped by fiscal year. Left bar (accent): HERD federal R&D. Right bar (gray): sum of bottom-up federal streams."
        source="HERD Q09 · sheet_07_cross_source_reconciliation"
        note="HERD measures expenditures; bottom-up streams measure obligations or outlays. A 15–25% gap is expected; larger gaps may reflect sub-agency allocation method or PIID collision in USASpending. See Methodology."
      >
        <ResponsiveSvg height={340}>
          {(w, h) => (
            <GroupedBar
              data={rows as unknown as Array<{ [key: string]: string | number }>}
              groupKey="fiscal_year"
              seriesKeys={['herd', 'bottom_up']}
              colors={colors}
              width={w}
              height={h}
            />
          )}
        </ResponsiveSvg>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: colors.herd }}
            />
            HERD-reported federal R&D
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: colors.bottom_up }}
            />
            Bottom-up streams (NIH + NSF + USASpending)
          </li>
        </ul>
      </ChartFrame>

      <p className="mt-2 text-[11px] italic text-text-tertiary">
        Note: the Federal Funds Vol&nbsp;70→71 taxonomy break (FY2015–FY2016) is not
        re-applied at the per-institution level here — only NSF national totals
        carry that flag.
      </p>

      {/* Compact year-by-year coverage table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm tnum">
          <thead className="text-text-tertiary">
            <tr className="border-b border-rule">
              <th className="py-1.5 text-left font-medium">FY</th>
              <th className="py-1.5 text-right font-medium">HERD federal</th>
              <th className="py-1.5 text-right font-medium">Bottom-up sum</th>
              <th className="py-1.5 text-right font-medium">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .reverse()
              .slice(0, 6)
              .map((r) => {
                const cov = r.herd > 0 ? r.bottom_up / r.herd : null;
                return (
                  <tr key={r.fiscal_year} className="border-b border-rule/60">
                    <td className="py-1.5 text-text-primary">FY{r.fiscal_year}</td>
                    <td className="py-1.5 text-right text-text-secondary">
                      {formatDollars(r.herd)}
                    </td>
                    <td className="py-1.5 text-right text-text-secondary">
                      {formatDollars(r.bottom_up)}
                    </td>
                    <td className="py-1.5 text-right text-text-secondary">
                      {formatPercent(cov)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-text-tertiary">Most recent six years.</p>
      </div>
    </section>
  );
}
