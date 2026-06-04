'use client';

import { useDuckDB } from '@/app/providers';
import { SourceLine } from '@/components/editorial/SourceLine';
import { UniversityTable } from '@/components/editorial/UniversityTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { type UniversityIndexRow, getUniversityIndex } from '@/lib/queries';
import { useEffect, useId, useState } from 'react';

const FY_MIN = 2005;
const FY_MAX = 2024;
const ALL_YEARS = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MAX - i);

/**
 * Sortable directory of every HERD-tracked institution. Year selector above
 * the table drives the FY-specific columns (Total R&D, Federal %, # PIs,
 * STEM %, trailing 5y CAGR, long-run CAGR FY2005→year). UniversityTable
 * handles sort/search/state-filter internally.
 */
export default function UniversitiesPage() {
  const { ready, error } = useDuckDB();
  const [year, setYear] = useState<number>(FY_MAX);
  const [rows, setRows] = useState<UniversityIndexRow[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const yearSelectId = useId();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setPending(true);
    setLoadError(null);
    getUniversityIndex(year)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setPending(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e : new Error(String(e)));
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, year]);

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

      {error || loadError ? (
        <p className="text-sm text-negative">
          Failed to load institutions: {(error ?? loadError)?.message ?? 'unknown error'}
        </p>
      ) : rows ? (
        <>
          <div className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={pending}>
            <UniversityTable rows={rows} year={year} />
          </div>
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
