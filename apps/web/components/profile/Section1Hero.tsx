'use client';

import { useEffect, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import {
  type UniversityProfile,
  type UniversityRank,
  getUniversityRank,
} from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
  state: string;
}

/**
 * Section 1 — Hero KPI strip per spec §3.3.
 *
 * Four tiles, sticky on desktop:
 *   1. Total R&D (latest reported FY)
 *   2. 20-year CAGR (first reported FY → latest)
 *   3. Federal share % (latest reported FY)
 *   4. National rank (latest FY, out of all ranked universities)
 *
 * Inputs come from the UniversityProfile bundle except the rank, which is
 * pulled separately because it needs a cross-institution window over
 * agg_uni_total_rd that doesn't fit into the per-institution bundle.
 */
export function Section1Hero({ profile, state }: Props) {
  const { ready } = useDuckDB();
  const [rank, setRank] = useState<UniversityRank | null>(null);

  // Latest reported fiscal year (covered by both totalRd and sources).
  const totalRd = profile.totalRd;
  const latest = totalRd.length > 0 ? totalRd[totalRd.length - 1] : null;
  const earliest = totalRd.length > 0 ? totalRd[0] : null;
  const fy = latest?.fiscal_year ?? null;

  // Total R&D FY{latest}.
  const totalLatest = latest?.total_rd_nominal ?? null;

  // 20-year CAGR (nominal). Use earliest reported FY, not literal FY2005, so
  // institutions that joined the panel later don't show NaN.
  const yearsSpan =
    earliest && latest ? latest.fiscal_year - earliest.fiscal_year : null;
  const cagr =
    earliest && latest && yearsSpan && yearsSpan > 0 && earliest.total_rd_nominal > 0
      ? (latest.total_rd_nominal / earliest.total_rd_nominal) ** (1 / yearsSpan) - 1
      : null;

  // Federal share % (latest FY) from sources.
  const sourcesLatest = profile.sources.filter((s) => s.fiscal_year === fy);
  const federalAmount =
    sourcesLatest.find((s) => s.source_category === 'federal')?.amount_nominal ?? 0;
  const totalAmount = sourcesLatest.reduce(
    (sum, s) => sum + (Number(s.amount_nominal) || 0),
    0,
  );
  const federalShare = totalAmount > 0 ? federalAmount / totalAmount : null;

  useEffect(() => {
    if (!ready || fy === null) return;
    let cancelled = false;
    getUniversityRank(profile.institution_sk, fy)
      .then((r) => {
        if (!cancelled) setRank(r);
      })
      .catch(() => {
        if (!cancelled) setRank(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, fy, profile.institution_sk]);

  const tiles: KpiTile[] = [
    {
      label: fy ? `Total R&D · FY${fy}` : 'Total R&D',
      value: formatDollars(totalLatest, { decimals: 2 }),
      hint: <span className="text-text-tertiary">{state}-based institution</span>,
    },
    {
      label:
        earliest && latest
          ? `CAGR · FY${earliest.fiscal_year}–FY${latest.fiscal_year}`
          : '20-yr CAGR',
      value: formatPercent(cagr, { decimals: 1 }),
      hint: (
        <span className="text-text-tertiary">
          {yearsSpan ? `over ${yearsSpan} years, nominal` : '—'}
        </span>
      ),
    },
    {
      label: fy ? `Federal share · FY${fy}` : 'Federal share',
      value: formatPercent(federalShare, { decimals: 1 }),
      hint: <span className="text-text-tertiary">of all R&D sources</span>,
    },
    {
      label: fy ? `National rank · FY${fy}` : 'National rank',
      value: rank ? `#${rank.rank.toLocaleString('en-US')}` : '—',
      hint: rank ? (
        <span className="text-text-tertiary tnum">
          of {rank.total_ranked.toLocaleString('en-US')} ranked universities
        </span>
      ) : (
        <span className="text-text-tertiary">computing…</span>
      ),
    },
  ];

  return (
    <section aria-labelledby="profile-section-1">
      <SectionDivider
        eyebrow="Section 1 · At a glance"
        title="Hero KPIs"
        dek="Four headline numbers that frame the rest of the profile — total R&D, growth rate, federal dependence, and where this institution stands nationally."
      />
      <KpiStrip tiles={tiles} cols={4} />
    </section>
  );
}
