'use client';

import { SourceLine } from '@/components/editorial/SourceLine';
import { UniversityTable } from '@/components/editorial/UniversityTable';
import { PageHeader } from '@/components/layout/PageHeader';
import type { UniversityIndexRow } from '@/lib/queries';
import { useEffect, useId, useMemo, useState } from 'react';

const FY_MIN = 2005;
const FY_MAX = 2024;
const ALL_YEARS = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MAX - i);

interface UniversitiesSnapshot {
  years: number[];
  institutions: Array<{ sk: string; name: string; state: string | null }>;
  /** total_rd[institutionIdx][yearIdx] */
  total_rd: Array<Array<number | null>>;
  federal_share: Array<Array<number | null>>;
  pi_count: Array<Array<number | null>>;
  nsf_lead_pi_count: Array<Array<number | null>>;
  nih_pi_count: Array<Array<number | null>>;
  nsf_amount: Array<Array<number | null>>;
  nih_amount: Array<Array<number | null>>;
  nsf_amount_per_lead_pi: Array<Array<number | null>>;
  nih_amount_per_pi: Array<Array<number | null>>;
  stem_share: Array<Array<number | null>>;
}

/**
 * Sortable directory of every HERD-tracked institution. The snapshot holds
 * every institution × year for every column the table renders, in a
 * columnar layout (parallel arrays). Year-change re-pivot happens client
 * side over ~20k cells in <10 ms.
 */
export default function UniversitiesPage() {
  const [snapshot, setSnapshot] = useState<UniversitiesSnapshot | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [year, setYear] = useState<number>(FY_MAX);
  const yearSelectId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch('/data/snapshots/universities-snapshot.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: UniversitiesSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pivot the columnar snapshot to UniversityIndexRow[] for the selected
  // FY. Both CAGR columns are now ADAPTIVE: rather than insisting on the
  // strict "FY2005 → selected year" and "selected year-5 → selected year"
  // windows (which left ~30% of rows blank for institutions that joined the
  // panel after FY2005), we pick the longest available window per row:
  //   - cagr_long_run: earliest non-null FY → selected FY (1+ year window).
  //   - cagr_5yr: longest trailing window ending at selected FY, capped at
  //     5 years. Falls back to 4/3/2/1 yr when an institution has less
  //     history. Per-row window length is surfaced in the cell tooltip so
  //     readers can see when a value is short-window noise vs. a real
  //     20-yr trend.
  const rows = useMemo<UniversityIndexRow[] | null>(() => {
    if (!snapshot) return null;
    const yi = snapshot.years.indexOf(year);
    if (yi < 0) return [];
    return snapshot.institutions
      .map((inst, i) => {
        const series = snapshot.total_rd[i];
        const total = series[yi];
        if (total === null) return null;

        // Earliest year with reported R&D > 0 for this institution. The
        // adaptive long-run CAGR uses (earliest → selected) as its window.
        let earliestIdx = -1;
        for (let yy = 0; yy < series.length; yy++) {
          const v = series[yy];
          if (v !== null && v > 0) {
            earliestIdx = yy;
            break;
          }
        }
        let cagrLongRun: number | null = null;
        let cagrLongRunWindow: number | null = null;
        if (earliestIdx >= 0 && earliestIdx < yi) {
          const tFirst = series[earliestIdx];
          const span = snapshot.years[yi] - snapshot.years[earliestIdx];
          if (tFirst !== null && tFirst > 0 && span > 0) {
            cagrLongRun = (total / tFirst) ** (1 / span) - 1;
            cagrLongRunWindow = span;
          }
        }

        // Trailing CAGR with an adaptive window capped at 5 years. Walks
        // back from (year - 5) up to (year - 1), picks the oldest non-null
        // year, computes CAGR over that span.
        let cagr5: number | null = null;
        let cagr5Window: number | null = null;
        const trailStart = Math.max(0, yi - 5);
        for (let yy = trailStart; yy < yi; yy++) {
          const tStart = series[yy];
          if (tStart !== null && tStart > 0) {
            const span = snapshot.years[yi] - snapshot.years[yy];
            if (span > 0) {
              cagr5 = (total / tStart) ** (1 / span) - 1;
              cagr5Window = span;
            }
            break;
          }
        }

        return {
          institution_sk: inst.sk,
          name: inst.name,
          state: inst.state ?? '',
          total_rd: total,
          cagr_5yr: cagr5,
          cagr_5yr_window: cagr5Window,
          cagr_long_run: cagrLongRun,
          cagr_long_run_window: cagrLongRunWindow,
          federal_share: snapshot.federal_share[i][yi],
          pi_count: snapshot.pi_count[i][yi] ?? 0,
          nsf_lead_pi_count: snapshot.nsf_lead_pi_count?.[i]?.[yi] ?? 0,
          nih_pi_count: snapshot.nih_pi_count?.[i]?.[yi] ?? 0,
          nsf_amount: snapshot.nsf_amount?.[i]?.[yi] ?? 0,
          nih_amount: snapshot.nih_amount?.[i]?.[yi] ?? 0,
          nsf_amount_per_lead_pi: snapshot.nsf_amount_per_lead_pi?.[i]?.[yi] ?? null,
          nih_amount_per_pi: snapshot.nih_amount_per_pi?.[i]?.[yi] ?? null,
          stem_share: snapshot.stem_share[i][yi],
        };
      })
      .filter((r): r is UniversityIndexRow => r !== null)
      .sort((a, b) => (b.total_rd ?? 0) - (a.total_rd ?? 0));
  }, [snapshot, year]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-6">
      <PageHeader
        eyebrow="Browse"
        title="All universities"
        description={`Sortable directory of every institution in the dataset. Every numeric column is computed for the selected fiscal year — change the year dropdown to re-rank for any FY${FY_MIN}–FY${FY_MAX}. Click a column header to sort.`}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={yearSelectId} className="text-[11px] uppercase tracking-wider text-text-tertiary">
          Year
        </label>
        <select
          id={yearSelectId}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-8 w-32 rounded-md border border-rule bg-surface-elevated px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_YEARS.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
        <span className="text-[11px] italic text-text-tertiary">
          Re-ranks the table for the selected year. CAGR columns adapt per institution: long-run CAGR uses the
          institution's earliest reported FY (not strictly FY{FY_MIN}); 5y CAGR uses the longest available trailing
          window up to five years. Hover any CAGR cell to see the exact window used.
        </span>
      </div>

      {loadError ? (
        <p className="text-sm text-negative">Failed to load institutions: {loadError.message}</p>
      ) : rows ? (
        <>
          <UniversityTable rows={rows} year={year} />
          <div className="border-t border-rule pt-3 text-[11px] leading-relaxed text-text-tertiary">
            <SourceLine
              variant="block"
              sources={[
                { id: 'ncses_herd', subset: `Q01 Total R&D for FY${year}; federal & STEM shares for FY${year}` },
                {
                  id: 'nsf_awards',
                  subset: `Lead PI per award for FY${year} contributes to # PIs column`,
                },
                {
                  id: 'nih_exporter',
                  subset: `PI bridge file (project × PI) for FY${year} contributes to # PIs column`,
                },
                { id: 'ipeds', subset: 'HD directory: institution name, state, IPEDS UNITID' },
              ]}
            />
            <p className="mt-1">
              Table: Research Data Platform · Trace every column back to its federal raw archive at{' '}
              <a href="/sources" className="underline-offset-2 hover:text-accent hover:underline">
                /sources
              </a>
              .
            </p>
          </div>
        </>
      ) : (
        <p className="text-text-secondary text-sm">Loading universities…</p>
      )}
    </div>
  );
}
