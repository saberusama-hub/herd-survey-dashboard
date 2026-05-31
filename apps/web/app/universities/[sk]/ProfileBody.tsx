'use client';

import { useEffect, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { Section1Hero } from '@/components/profile/Section1Hero';
import { Section2TotalRD } from '@/components/profile/Section2TotalRD';
import { Section3Sources } from '@/components/profile/Section3Sources';
import { Section4Agencies } from '@/components/profile/Section4Agencies';
import { Section5Reconciliation } from '@/components/profile/Section5Reconciliation';
import { Section6PIs } from '@/components/profile/Section6PIs';
import { Section7Disciplines } from '@/components/profile/Section7Disciplines';
import { Section8Concentration } from '@/components/profile/Section8Concentration';
import { Section9StateContext } from '@/components/profile/Section9StateContext';
import { type UniversityProfile, getUniversityProfile } from '@/lib/queries';

interface Props {
  sk: string;
  /** Fallback name when DuckDB hasn't loaded yet (or fails). */
  fallbackName: string;
  /** State code from the static dim_institution.json. */
  state: string;
}

/**
 * Client-side profile body. Loads the full UniversityProfile bundle in one
 * call and hands each slice to a dedicated section component. The 9 sections
 * render in the editorial order specified in §3.3 of the design.
 */
export function ProfileBody({ sk, fallbackName, state }: Props) {
  const { ready, error } = useDuckDB();
  const [profile, setProfile] = useState<UniversityProfile | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getUniversityProfile(sk)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [sk, ready]);

  if (error) {
    return (
      <div className="mt-10 rounded border border-rule bg-surface p-6 text-sm text-text-secondary">
        Failed to initialize the data layer: {error.message}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mt-10 rounded border border-rule bg-surface p-6 text-sm text-text-secondary">
        Failed to load profile for {fallbackName}: {loadError.message}
      </div>
    );
  }
  if (!profile) {
    // Skeleton placeholder — keeps the page layout from jumping while DuckDB-WASM
    // streams parquet aggregates from /data/.
    return (
      <div className="mt-12 space-y-12" aria-busy="true">
        <div className="h-24 animate-pulse rounded bg-border/20" />
        <div className="h-72 animate-pulse rounded bg-border/20" />
        <div className="h-72 animate-pulse rounded bg-border/20" />
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-2">
      <Section1Hero profile={profile} state={state} />
      <Section2TotalRD profile={profile} />
      <Section3Sources profile={profile} />
      <Section4Agencies profile={profile} />
      <Section5Reconciliation profile={profile} />
      <Section6PIs profile={profile} />
      <Section7Disciplines profile={profile} />
      <Section8Concentration profile={profile} />
      <Section9StateContext profile={profile} />

      {/* Footer per spec §3.3 */}
      <footer className="mt-16 border-t border-rule pt-8 space-y-3">
        <p className="text-[11px] text-text-tertiary max-w-prose">
          Source: Federal R&amp;D data from NSF Federal Funds (Vol 70 FY2005–FY2023, Vol 71 FY2015–FY2024);
          NIH RePORTER; USASpending; NSF Awards; institution-reported HERD/ARDES.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="inline-flex items-center rounded border border-rule px-3 py-1.5 text-sm hover:bg-mute-3/40"
          >
            Download CSV
          </a>
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
