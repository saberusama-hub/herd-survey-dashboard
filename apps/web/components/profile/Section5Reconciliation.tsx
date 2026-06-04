'use client';

import { useMemo } from 'react';

import { GroupedBar } from '@/components/charts/GroupedBar';
import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
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
  const { rows, latestCoverage, latestFy, hasData, gapNote } = useMemo(() => {
    // Aggregate HERD federal per FY.
    const herdByFy = new Map<number, number>();
    for (const r of profile.agencies) {
      herdByFy.set(r.fiscal_year, (herdByFy.get(r.fiscal_year) ?? 0) + (Number(r.amount_nominal) || 0));
    }
    // Aggregate bottom-up streams per FY.
    const buByFy = new Map<number, number>();
    for (const r of profile.federalFunds) {
      buByFy.set(r.fiscal_year, (buByFy.get(r.fiscal_year) ?? 0) + (Number(r.amount_nominal) || 0));
    }
    const fys = Array.from(new Set([...herdByFy.keys(), ...buByFy.keys()])).sort((a, b) => a - b);
    const rows = fys.map((fy) => ({
      fiscal_year: fy,
      herd: herdByFy.get(fy) ?? 0,
      bottom_up: buByFy.get(fy) ?? 0,
    }));
    const latestFy = fys.length > 0 ? fys[fys.length - 1] : null;
    const latestRow = rows[rows.length - 1];
    const latestCoverage = latestRow && latestRow.herd > 0 ? latestRow.bottom_up / latestRow.herd : null;
    // Largest absolute coverage gap (HERD - bottom-up) across the years.
    let maxGap = { fy: 0, gap: 0 };
    for (const r of rows) {
      const g = r.herd - r.bottom_up;
      if (Math.abs(g) > Math.abs(maxGap.gap)) maxGap = { fy: r.fiscal_year, gap: g };
    }
    const gapNote =
      maxGap.fy && maxGap.gap !== 0
        ? `Largest reconciliation gap landed in FY${maxGap.fy} — HERD reported ${formatDollars(Math.abs(maxGap.gap), { decimals: 2 })} ${maxGap.gap > 0 ? 'more' : 'less'} than the bottom-up streams.`
        : null;

    return {
      rows,
      latestCoverage,
      latestFy,
      hasData: rows.some((r) => r.herd > 0 || r.bottom_up > 0),
      gapNote,
    };
  }, [profile]);

  if (!hasData) {
    return (
      <section aria-labelledby="profile-section-5">
        <SectionDivider
          eyebrow="Section 5 · Reconciliation"
          title="HERD vs bottom-up federal streams"
          dek="Neither HERD federal R&D nor bottom-up streams were reported for this institution."
          color="hsl(var(--accent))"
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
        color="hsl(var(--accent))"
      />

      {latestCoverage !== null && latestFy !== null && (
        <div className="mb-4 rounded border border-rule bg-surface px-4 py-3 text-sm">
          <p className="text-text-secondary">
            FY{latestFy} bottom-up coverage:{' '}
            <span className="font-semibold text-text-primary tnum">{formatPercent(latestCoverage)}</span> of
            HERD-reported federal R&D was found in the bottom-up streams.
          </p>
        </div>
      )}

      <ChartFrame
        eyebrow="Federal R&D coverage"
        title="Top-down HERD vs bottom-up bottom-line, year by year"
        dek="Bars are grouped by fiscal year. Left bar (accent): HERD federal R&D. Right bar (gray): sum of bottom-up federal streams."
        sources={[
          {
            id: 'ncses_herd',
            subset: 'Q09 (Federal R&D by Agency) summed across all agency buckets for this institution × FY (top-down)',
          },
          { id: 'nih_exporter', subset: 'Project total_cost summed per FY for this institution (bottom-up)' },
          { id: 'nsf_awards', subset: 'Award obligations summed per FY for this institution (bottom-up)' },
          {
            id: 'usaspending',
            subset: 'Contract + assistance face value summed per FY for this institution (bottom-up)',
          },
        ]}
        note="HERD measures expenditures; bottom-up streams measure obligations or outlays. A 15–25% gap is expected; larger gaps may reflect sub-agency allocation method or PIID collision in USASpending. See Methodology."
        methodology={{
          what: 'A reality check: does the university’s reported federal funding (HERD) match what we can actually find by counting up individual grants and contracts in the federal databases?',
          how: 'Left bar = HERD Q09 total federal R&D for the year (top-down, self-reported). Right bar = sum of NIH RePORTER + NSF Awards + USAspending contracts + USAspending assistance for the same institution and year (bottom-up, transaction-level).',
          caveats:
            'HERD measures expenditures spent in the FY; the bottom-up streams measure obligations awarded. A 15–25% gap is normal. Larger gaps usually point to sub-agency allocation, PIID collisions in USAspending, or sub-award flows we cannot see.',
        }}
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
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.herd }} />
            HERD-reported federal R&D
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.bottom_up }} />
            Bottom-up streams (NIH + NSF + USASpending)
          </li>
        </ul>
      </ChartFrame>

      {gapNote && <p className="mt-2 text-[11px] italic text-text-tertiary">{gapNote}</p>}

      <p className="mt-1 text-[11px] italic text-text-tertiary">
        Note: the Federal Funds Vol&nbsp;70→71 taxonomy break (FY2015–FY2016) is not re-applied at the per-institution
        level here — only NSF national totals carry that flag.
      </p>

      {/* Compact year-by-year coverage table */}
      <CoverageTable rows={rows} />
    </section>
  );
}

function CoverageTable({ rows }: { rows: Array<{ fiscal_year: number; herd: number; bottom_up: number }> }) {
  const enriched = rows
    .slice()
    .reverse()
    .slice(0, 6)
    .map((r) => ({
      fiscal_year: r.fiscal_year,
      herd: r.herd,
      bottom_up: r.bottom_up,
      coverage: r.herd > 0 ? r.bottom_up / r.herd : null,
    }));
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(enriched, {
    initial: { key: 'fiscal_year', dir: 'desc' },
    accessors: {
      fiscal_year: (r) => r.fiscal_year,
      herd: (r) => r.herd,
      bottom_up: (r) => r.bottom_up,
      coverage: (r) => r.coverage,
    },
    defaultDir: { fiscal_year: 'desc' },
  });
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm tnum">
        <thead className="text-text-tertiary">
          <tr className="border-b border-rule">
            <SortableTh sortKey="fiscal_year" sort={sort} onSort={requestSort} className="py-1.5">
              FY
            </SortableTh>
            <SortableTh sortKey="herd" sort={sort} onSort={requestSort} align="right" className="py-1.5">
              HERD federal
            </SortableTh>
            <SortableTh sortKey="bottom_up" sort={sort} onSort={requestSort} align="right" className="py-1.5">
              Bottom-up sum
            </SortableTh>
            <SortableTh sortKey="coverage" sort={sort} onSort={requestSort} align="right" className="py-1.5">
              Coverage
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.fiscal_year} className="border-b border-rule/60">
              <td className="py-1.5 text-text-primary">FY{r.fiscal_year}</td>
              <td className="py-1.5 text-right text-text-secondary">{formatDollars(r.herd)}</td>
              <td className="py-1.5 text-right text-text-secondary">{formatDollars(r.bottom_up)}</td>
              <td className="py-1.5 text-right text-text-secondary">{formatPercent(r.coverage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-tertiary">Most recent six years.</p>
    </div>
  );
}
