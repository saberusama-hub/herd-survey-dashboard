'use client';

import { useEffect, useMemo, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import { type PeerCard, type UniversityProfile, getPeerCards } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

/**
 * Section 9 — State context + peers.
 *
 *   - "Slope" callout: share of state R&D at first vs latest reported FY.
 *   - Peer panel: up to 5 same-state ±25%-size peers (from agg_uni_peers).
 *
 * Patent productivity used to live here as a stub; it has been removed pending
 * a separate IP & commercialization tab built from a real USPTO ingestion.
 */
export function Section9StateContext({ profile }: Props) {
  const { ready } = useDuckDB();
  const [peers, setPeers] = useState<PeerCard[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getPeerCards(profile.institution_sk)
      .then((rows) => {
        if (!cancelled) setPeers(rows);
      })
      .catch(() => {
        if (!cancelled) setPeers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, profile.institution_sk]);

  const { firstShare, latestShare, firstFy, latestFy, shareSpark } = useMemo(() => {
    const sortedState = [...profile.stateContext].sort((a, b) => a.fiscal_year - b.fiscal_year);
    const firstFy = sortedState[0]?.fiscal_year ?? null;
    const latestFy = sortedState[sortedState.length - 1]?.fiscal_year ?? null;
    const firstShare = sortedState[0]?.share_of_state ?? null;
    const latestShare = sortedState[sortedState.length - 1]?.share_of_state ?? null;
    const shareSpark = sortedState.map((r) => ({
      x: r.fiscal_year,
      y: r.share_of_state !== null ? Number(r.share_of_state) * 100 : null,
    }));
    return { firstShare, latestShare, firstFy, latestFy, shareSpark };
  }, [profile]);

  return (
    <section aria-labelledby="profile-section-9">
      <SectionDivider
        eyebrow="Section 9 · State context"
        title="In its state and among its peers"
        dek="Share of state R&D over time and similar-size peer institutions."
        color="hsl(var(--agency-nasa))"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* State share slope */}
        <ChartFrame
          eyebrow="Share of state R&D"
          title={firstFy && latestFy ? `FY${firstFy} → FY${latestFy} share` : 'Share of state R&D'}
          dek="This institution's R&D as a fraction of all R&D performed by HERD-tracked institutions in the same state."
          sources={[
            {
              id: 'ncses_herd',
              subset: 'Q01 (Total R&D) for this institution ÷ sum of Q01 across same-state institutions × FY',
            },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
          ]}
          methodology={{
            what: 'How big a fish this university is in its own state — what slice of all university research spending in the state belongs to it.',
            how: 'For each fiscal year we divide this institution’s total HERD R&D by the sum of HERD R&D across every HERD-tracked university in the same state. The two endpoints (first and latest reported FY) are shown side by side; the sparkline traces the in-between years.',
            caveats:
              'Denominator only includes HERD-tracked universities. State R&D performed by hospitals, FFRDCs, or non-HERD institutions is not in the comparison.',
          }}
        >
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                  {firstFy ? `FY${firstFy}` : 'Start'}
                </p>
                <p className="text-2xl font-semibold text-text-primary tnum">{formatPercent(firstShare)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                  {latestFy ? `FY${latestFy}` : 'Latest'}
                </p>
                <p className="text-2xl font-semibold text-accent tnum">{formatPercent(latestShare)}</p>
              </div>
            </div>
            {shareSpark.length > 1 && (
              <Sparkline
                data={shareSpark.map((p) => ({ x: p.x, y: p.y }))}
                color="hsl(var(--accent))"
                width={260}
                height={48}
              />
            )}
            {firstShare !== null && latestShare !== null && (
              <p className="text-[11px] text-text-tertiary">
                Net change:{' '}
                <span className="tnum">{formatPercent(latestShare - firstShare, { signed: true })} points</span> over{' '}
                {latestFy && firstFy ? `${latestFy - firstFy} years` : ''}.
              </p>
            )}
          </div>
        </ChartFrame>

        {/* Peers */}
        <ChartFrame
          eyebrow="Peer institutions"
          title="Same state, similar R&D size"
          dek="Up to five same-state peers within ±25% of this institution's latest total R&D, sorted by R&D-size closeness."
          sources={[
            { id: 'ncses_herd', subset: 'Q01 (Total R&D) used for ±25% size matching of same-state peers' },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
          ]}
          methodology={{
            what: 'A short list of other universities in the same state with roughly comparable research spending — useful for benchmarking.',
            how: 'Peers are HERD-tracked universities in the same `state_code` whose latest total R&D falls within ±25% of this institution’s. We rank by closeness in absolute dollars and keep up to five.',
            caveats:
              'Same-state ±25% is a coarse filter — peer set may include institutions with very different research portfolios. For richer peer matching, use the Compare page.',
          }}
        >
          {peers === null ? (
            <div className="h-32 animate-pulse rounded bg-border/20" />
          ) : peers.length === 0 ? (
            <p className="text-sm text-text-tertiary">No same-state peers within ±25% size match in the panel.</p>
          ) : (
            <ul className="divide-y divide-rule/60">
              {peers.map((p) => (
                <li key={p.peer_sk} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/universities/${encodeURIComponent(p.peer_sk)}`}
                      className="block truncate text-sm font-medium text-text-primary hover:text-accent"
                    >
                      {p.canonical_name}
                    </a>
                    <p className="text-[11px] text-text-tertiary tnum">
                      {p.state_code ?? '—'} &middot; rank #{p.peer_rank}
                    </p>
                  </div>
                  <p className="text-sm tnum text-text-secondary">{formatDollars(p.total_rd_nominal)}</p>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
      </div>
    </section>
  );
}
