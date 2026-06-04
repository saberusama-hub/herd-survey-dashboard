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
  // FY. Computes trailing 5y CAGR and long-run CAGR (FY2005→year) in JS.
  // Was a multi-CTE DuckDB query (~2 s); now ~5 ms.
  const rows = useMemo<UniversityIndexRow[] | null>(() => {
    if (!snapshot) return null;
    const yi = snapshot.years.indexOf(year);
    if (yi < 0) return [];
    const yi5 = snapshot.years.indexOf(year - 5);
    const yiFirst = 0; // FY2005 always present per precompute coverage
    const fiscalYearGap = year - snapshot.years[yiFirst];
    return snapshot.institutions
      .map((inst, i) => {
        const total = snapshot.total_rd[i][yi];
        if (total === null) return null;
        const t5 = yi5 >= 0 ? snapshot.total_rd[i][yi5] : null;
        const tFirst = snapshot.total_rd[i][yiFirst];
        return {
          institution_sk: inst.sk,
          name: inst.name,
          state: inst.state ?? '',
          total_rd: total,
          cagr_5yr: yi5 >= 0 && t5 !== null && t5 > 0 ? (total / t5) ** (1 / 5) - 1 : null,
          cagr_long_run:
            fiscalYearGap > 0 && tFirst !== null && tFirst > 0 ? (total / tFirst) ** (1 / fiscalYearGap) - 1 : null,
          federal_share: snapshot.federal_share[i][yi],
          pi_count: snapshot.pi_count[i][yi] ?? 0,
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
          Re-ranks the table for the selected year. Trailing 5y CAGR is blank for FY{FY_MIN}–FY{FY_MIN + 4} (window
          starts before FY{FY_MIN}); long-run CAGR is blank at FY{FY_MIN}.
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
