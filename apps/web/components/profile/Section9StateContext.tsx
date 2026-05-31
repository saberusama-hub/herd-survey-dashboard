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
 * Section 9 — State context, peers, patents.
 *
 *   - "Slope" callout: share of state R&D at first vs latest reported FY.
 *   - Peer panel: up to 5 same-state ±25%-size peers (from agg_uni_peers).
 *   - Patent stub: NULL in source data (USPTO ingestion not implemented),
 *     surfaced as an em-dash so readers see the box but understand the gap.
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

  const { firstShare, latestShare, firstFy, latestFy, shareSpark, latestPatents } = useMemo(() => {
    const sortedState = [...profile.stateContext].sort(
      (a, b) => a.fiscal_year - b.fiscal_year,
    );
    const firstFy = sortedState[0]?.fiscal_year ?? null;
    const latestFy = sortedState[sortedState.length - 1]?.fiscal_year ?? null;
    const firstShare = sortedState[0]?.share_of_state ?? null;
    const latestShare = sortedState[sortedState.length - 1]?.share_of_state ?? null;
    const shareSpark = sortedState.map((r) => ({
      x: r.fiscal_year,
      y: r.share_of_state !== null ? Number(r.share_of_state) * 100 : null,
    }));
    const sortedPatents = [...profile.patents].sort((a, b) => a.fiscal_year - b.fiscal_year);
    const latestPatents = sortedPatents[sortedPatents.length - 1] ?? null;
    return { firstShare, latestShare, firstFy, latestFy, shareSpark, latestPatents };
  }, [profile]);

  return (
    <section aria-labelledby="profile-section-9">
      <SectionDivider
        eyebrow="Section 9 · State context"
        title="In its state and among its peers"
        dek="Share of state R&D over time, similar-size peer institutions, and patent productivity (currently a stub — USPTO ingestion is out of scope for this build)."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* State share slope */}
        <ChartFrame
          eyebrow="Share of state R&D"
          title={
            firstFy && latestFy
              ? `FY${firstFy} → FY${latestFy} share`
              : 'Share of state R&D'
          }
          dek="This institution's R&D as a fraction of all R&D performed by HERD-tracked institutions in the same state."
          source="agg_uni_state_context"
        >
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                  {firstFy ? `FY${firstFy}` : 'Start'}
                </p>
                <p className="text-2xl font-semibold text-text-primary tnum">
                  {formatPercent(firstShare)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                  {latestFy ? `FY${latestFy}` : 'Latest'}
                </p>
                <p className="text-2xl font-semibold text-accent tnum">
                  {formatPercent(latestShare)}
                </p>
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
                <span className="tnum">
                  {formatPercent(latestShare - firstShare, { signed: true })} points
                </span>{' '}
                over {latestFy && firstFy ? `${latestFy - firstFy} years` : ''}.
              </p>
            )}
          </div>
        </ChartFrame>

        {/* Peers */}
        <ChartFrame
          eyebrow="Peer institutions"
          title="Same state, similar R&D size"
          dek="Up to five same-state peers within ±25% of this institution's latest total R&D, sorted by R&D-size closeness."
          source="agg_uni_peers"
        >
          {peers === null ? (
            <div className="h-32 animate-pulse rounded bg-border/20" />
          ) : peers.length === 0 ? (
            <p className="text-sm text-text-tertiary">
              No same-state peers within ±25% size match in the panel.
            </p>
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
                  <p className="text-sm tnum text-text-secondary">
                    {formatDollars(p.total_rd_nominal)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>

        {/* Patents (stub) */}
        <ChartFrame
          eyebrow="Patent productivity"
          title="Patents per federal award"
          dek="Patent counts come from USPTO assignee data — not yet loaded into this build."
          source="agg_uni_patents (stub)"
          note="USPTO ingestion is out of scope for the current data layer. The metric will appear here once that source is added."
        >
          <div className="space-y-2">
            <p className="text-3xl font-semibold text-text-tertiary tnum">—</p>
            <p className="text-[11px] text-text-tertiary">
              {latestPatents
                ? `Latest FY${latestPatents.fiscal_year}: ${
                    latestPatents.award_count ?? 0
                  } NIH/NSF awards on record · patent count not yet loaded.`
                : 'No award-count reference available for this institution.'}
            </p>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
