'use client';

import { useEffect, useState } from 'react';

import { Section1Hero } from '@/components/profile/Section1Hero';
import { Section2TotalRD } from '@/components/profile/Section2TotalRD';
import { Section3Sources } from '@/components/profile/Section3Sources';
import { Section4Agencies } from '@/components/profile/Section4Agencies';
import { Section6PIs } from '@/components/profile/Section6PIs';
import { Section7Disciplines } from '@/components/profile/Section7Disciplines';
import { Section8IP } from '@/components/profile/Section8IP';
import { Section9StateContext } from '@/components/profile/Section9StateContext';
import type { NihIcRow, SpecializationRow, UniversityProfile } from '@/lib/queries';

type ProfileSnapshot = UniversityProfile & {
  nihIcs: NihIcRow[];
  specialization: SpecializationRow[];
};

interface Props {
  sk: string;
  /** Fallback name when the profile JSON hasn't loaded yet (or fails). */
  fallbackName: string;
  /** State code from the static dim_institution.json. */
  state: string;
}

/**
 * Client-side profile body. Reads a single static JSON (~50 KB before
 * brotli, ~10 KB after) from /data/profiles/<sk>.json — precomputed at
 * build time by scripts/precompute_profile_snapshots.js. No DuckDB-WASM
 * load. No per-section queries. Profile sections that used to fire their
 * own DB queries (Section4 NIH ICs, Section7 specialization) now read
 * those slices from the same snapshot.
 */
export function ProfileBody({ sk, fallbackName, state }: Props) {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/profiles/${encodeURIComponent(sk)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ProfileSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [sk]);

  if (loadError) {
    return (
      <div className="mt-10 rounded border border-rule bg-surface p-6 text-sm text-text-secondary">
        Failed to load profile for {fallbackName}: {loadError.message}
      </div>
    );
  }
  if (!snapshot) {
    // Skeleton placeholder — brief flash while the ~50 KB JSON streams in.
    return (
      <div className="mt-12 space-y-12" aria-busy="true">
        <div className="h-24 animate-pulse rounded bg-border/20" />
        <div className="h-72 animate-pulse rounded bg-border/20" />
        <div className="h-72 animate-pulse rounded bg-border/20" />
      </div>
    );
  }

  // Reconstruct the UniversityProfile object the section components expect.
  // The snapshot JSON happens to match the shape because we serialise from
  // the same SQL columns at precompute time; institution_sk is the URL key.
  const profile: UniversityProfile = { ...snapshot, institution_sk: sk };

  return (
    <div className="mt-10 space-y-2">
      <Section1Hero profile={profile} state={state} />
      <Section2TotalRD profile={profile} />
      <Section3Sources profile={profile} />
      <Section4Agencies profile={profile} icRows={snapshot.nihIcs} />
      <Section6PIs profile={profile} />
      <Section7Disciplines profile={profile} specialization={snapshot.specialization} />
      <Section8IP profile={profile} />
      <Section9StateContext profile={profile} />

      <footer className="mt-16 border-t border-rule pt-8 space-y-3">
        <p className="text-[11px] text-text-tertiary max-w-prose">
          Source: Federal R&amp;D data from NSF Federal Funds (Vol 70 FY2005–FY2023, Vol 71 FY2015–FY2024); NIH
          RePORTER; USASpending; NSF Awards; institution-reported HERD/ARDES.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/compare?ids=${encodeURIComponent(profile.institution_sk)}`}
            className="inline-flex items-center rounded border border-rule px-3 py-1.5 text-sm hover:bg-mute-3/40"
          >
            Compare with another university →
          </a>
        </div>
      </footer>
    </div>
  );
}
