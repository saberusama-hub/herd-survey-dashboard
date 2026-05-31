'use client';

import { useMemo } from 'react';

import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { StackedBar } from '@/components/charts/StackedBar';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

const SOURCE_ORDER = [
  'federal',
  'state',
  'industry',
  'institutional',
  'nonprofit',
  'other',
] as const;
type SourceKey = (typeof SOURCE_ORDER)[number];

const SOURCE_LABEL: Record<SourceKey, string> = {
  federal: 'Federal',
  state: 'State & local',
  industry: 'Industry',
  institutional: 'Institutional',
  nonprofit: 'Nonprofit',
  other: 'Other',
};

// Color assignment: federal gets the accent (it's the editorial "main
// character"), other sources fade through warm earth tones / mutes.
const SOURCE_COLOR: Record<SourceKey, string> = {
  federal: 'hsl(var(--accent))',
  state: 'hsl(var(--seq-5))',
  industry: 'hsl(var(--seq-3))',
  institutional: 'hsl(var(--agency-doe))',
  nonprofit: 'hsl(var(--agency-usda))',
  other: 'hsl(var(--mute-1))',
};

/**
 * Section 3 — R&D by source. Visx stacked bar (vertical on desktop, flips
 * horizontal on mobile via useIsMobile inside StackedBar). One bar per
 * fiscal year, six stacked source categories.
 */
export function Section3Sources({ profile }: Props) {
  const { rows, finalBreakdown, finalFy, ardesWarning } = useMemo(() => {
    // Pivot the long source-split rows into wide rows keyed by fy.
    const byFy = new Map<number, Record<string, number>>();
    for (const r of profile.sources) {
      const row = byFy.get(r.fiscal_year) ?? {};
      row[r.source_category] = Number(r.amount_nominal) || 0;
      byFy.set(r.fiscal_year, row);
    }
    const fys = Array.from(byFy.keys()).sort((a, b) => a - b);
    const wide = fys.map((fy) => {
      const v = byFy.get(fy) ?? {};
      const row: Record<string, number | string> = { fiscal_year: fy };
      for (const k of SOURCE_ORDER) row[k] = v[k] ?? 0;
      return row;
    });

    const finalFy = fys.length > 0 ? fys[fys.length - 1] : null;
    const finalRow = wide[wide.length - 1] as Record<string, number | string> | undefined;
    const finalTotal = finalRow
      ? SOURCE_ORDER.reduce((s, k) => s + (Number(finalRow[k]) || 0), 0)
      : 0;
    const finalBreakdown = SOURCE_ORDER.map((k) => ({
      key: k,
      label: SOURCE_LABEL[k],
      amount: finalRow ? Number(finalRow[k]) || 0 : 0,
      share: finalRow && finalTotal > 0 ? (Number(finalRow[k]) || 0) / finalTotal : 0,
      color: SOURCE_COLOR[k],
    }));

    // Pre-FY2010 ARDES non-response: nonprofit column is suppressed for
    // those years. Flag if our data window overlaps that period.
    const ardesWarning = fys.some((fy) => fy >= 2005 && fy <= 2009);

    return { rows: wide, finalBreakdown, finalFy, ardesWarning };
  }, [profile]);

  if (rows.length === 0) {
    return (
      <section aria-labelledby="profile-section-3">
        <SectionDivider
          eyebrow="Section 3 · Sources"
          title="Where the money came from"
          dek="No HERD source-of-funds data was reported for this institution."
          color="hsl(var(--agency-doe))"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-section-3">
      <SectionDivider
        eyebrow="Section 3 · Sources"
        title="Where the money came from"
        dek="Composition of total R&D across six funding sources, every year of the reported window. Federal funding gets the accent color."
        color="hsl(var(--agency-doe))"
      />

      <ChartFrame
        eyebrow="HERD Q01 sources of funds"
        title="R&D expenditure by source, by fiscal year"
        dek="Each bar is one fiscal year's total HERD R&D, stacked by the six reporting source categories."
        source="HERD Q01 · agg_uni_source_split"
        note={
          ardesWarning
            ? 'Nonprofit funding was not collected in HERD before FY2010 (ARDES non-response), so pre-FY2010 stacks understate that slice.'
            : undefined
        }
      >
        <ResponsiveSvg height={340}>
          {(w, h) => (
            <StackedBar
              data={rows}
              keys={[...SOURCE_ORDER]}
              xKey="fiscal_year"
              colors={SOURCE_COLOR}
              width={w}
              height={h}
              orientation="vertical"
            />
          )}
        </ResponsiveSvg>

        {/* Legend chips — Visx StackedBar doesn't render its own legend. */}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
          {finalBreakdown.map((b) => (
            <li key={b.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: b.color }}
              />
              <span>{b.label}</span>
            </li>
          ))}
        </ul>
      </ChartFrame>

      {/* Final-year breakdown table */}
      {finalFy !== null && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-text-tertiary">
            FY{finalFy} breakdown
          </p>
          <table className="w-full text-sm tnum">
            <thead className="text-text-tertiary">
              <tr className="border-b border-rule">
                <th className="py-1.5 text-left font-medium">Source</th>
                <th className="py-1.5 text-right font-medium">Amount</th>
                <th className="py-1.5 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {finalBreakdown.map((b) => (
                <tr key={b.key} className="border-b border-rule/60">
                  <td className="py-1.5 text-text-primary">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: b.color }}
                      />
                      {b.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-text-secondary">
                    {formatDollars(b.amount)}
                  </td>
                  <td className="py-1.5 text-right text-text-secondary">
                    {formatPercent(b.share)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
