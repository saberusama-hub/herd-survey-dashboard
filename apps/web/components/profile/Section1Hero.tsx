'use client';

import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
  state: string;
}

/**
 * Section 1 — Hero KPI strip.
 *
 * Four tiles, sticky on desktop:
 *   1. Total R&D expenditures (latest reported FY, all sources combined)
 *   2. 20-year growth rate (CAGR, nominal $)
 *   3. Federal funding share (latest reported FY)
 *   4. National rank by total R&D (latest reported FY)
 *
 * Every value comes from the precomputed profile snapshot — no runtime DuckDB
 * query. The previous live `getUniversityRank()` round-trip is replaced by a
 * lookup against `profile.ranks` (baked at precompute time, one row per FY).
 */
export function Section1Hero({ profile, state }: Props) {
  // Latest reported fiscal year for which we have total R&D.
  const totalRd = profile.totalRd;
  const latest = totalRd.length > 0 ? totalRd[totalRd.length - 1] : null;
  const earliest = totalRd.length > 0 ? totalRd[0] : null;
  const fy = latest?.fiscal_year ?? null;

  const totalLatest = latest?.total_rd_nominal ?? null;

  // 20-year CAGR (nominal). Uses earliest reported FY (not literal FY2005)
  // so institutions that joined the panel later don't render NaN.
  const yearsSpan = earliest && latest ? latest.fiscal_year - earliest.fiscal_year : null;
  const cagr =
    earliest && latest && yearsSpan && yearsSpan > 0 && earliest.total_rd_nominal > 0
      ? (latest.total_rd_nominal / earliest.total_rd_nominal) ** (1 / yearsSpan) - 1
      : null;

  // Federal share % for the latest FY (federal source ÷ total sources).
  const sourcesLatest = profile.sources.filter((s) => s.fiscal_year === fy);
  const federalAmount = sourcesLatest.find((s) => s.source_category === 'federal')?.amount_nominal ?? 0;
  const totalAmount = sourcesLatest.reduce((sum, s) => sum + (Number(s.amount_nominal) || 0), 0);
  const federalShare = totalAmount > 0 ? federalAmount / totalAmount : null;

  // National rank lookup — find the latest-FY row in the precomputed ranks
  // slice. Falls back to "—" if rank wasn't computed for that institution.
  const rankRow = fy !== null ? (profile.ranks.find((r) => r.fiscal_year === fy) ?? null) : null;

  const tiles: KpiTile[] = [
    {
      label: fy ? `Total R&D expenditures · FY${fy}` : 'Total R&D expenditures',
      value: formatDollars(totalLatest, { decimals: 2 }),
      hint: <span className="text-text-tertiary">all funding sources combined · {state}-based institution</span>,
      sources: [
        { id: 'ncses_herd', subset: 'Q01 (Total R&D) for this institution, latest reported FY, nominal dollars' },
      ],
    },
    {
      label:
        earliest && latest
          ? `20-yr growth rate · FY${earliest.fiscal_year}–FY${latest.fiscal_year}`
          : '20-yr growth rate',
      value: formatPercent(cagr, { decimals: 1 }),
      hint: (
        <span className="text-text-tertiary">
          compound annual growth (CAGR){yearsSpan ? `, ${yearsSpan} yr window` : ''} · nominal $
        </span>
      ),
      sources: [
        { id: 'ncses_herd', subset: 'Q01 Total R&D earliest reported FY → latest, compound annual growth rate' },
      ],
    },
    {
      label: fy ? `Federal funding share · FY${fy}` : 'Federal funding share',
      value: formatPercent(federalShare, { decimals: 1 }),
      hint: <span className="text-text-tertiary">% of total R&D coming from federal sources</span>,
      sources: [
        {
          id: 'ncses_herd',
          subset: 'Q01 federal-source dollars ÷ total all-source dollars for this institution, latest FY',
        },
      ],
    },
    {
      label: fy ? `Rank by total R&D · FY${fy}` : 'National rank',
      value: rankRow ? `#${rankRow.national_rank.toLocaleString('en-US')}` : '—',
      hint: rankRow ? (
        <span className="text-text-tertiary tnum">
          of {rankRow.total_ranked.toLocaleString('en-US')} U.S. universities ranked on total R&D
        </span>
      ) : (
        <span className="text-text-tertiary">not ranked for this FY</span>
      ),
      sources: [{ id: 'ncses_herd', subset: 'Q01 Total R&D ranked across all HERD institutions for latest FY' }],
    },
  ];

  return (
    <section aria-labelledby="profile-section-1">
      <SectionDivider
        eyebrow="Section 1 · At a glance"
        title="Hero KPIs"
        dek="Four headline numbers that frame the rest of the profile — total R&D, 20-year growth rate, federal-funding share, and where this institution sits in the national ranking by total R&D."
      />
      <KpiStrip tiles={tiles} cols={4} />
    </section>
  );
}
