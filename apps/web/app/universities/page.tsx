'use client';

import { useEffect, useState } from 'react';
import { useDuckDB } from '@/app/providers';
import { UniversityTable } from '@/components/editorial/UniversityTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { getUniversityIndex, type UniversityIndexRow } from '@/lib/queries';

/**
 * Sortable directory of every HERD-tracked institution. The heavy lifting
 * (sort, filter, search) lives in `UniversityTable` — this page is just the
 * data fetch + header chrome.
 *
 * The query waits on `useDuckDB().ready` so we don't fire it during SSR or
 * before the WASM bundle has initialised.
 */
export default function UniversitiesPage() {
  const { ready, error } = useDuckDB();
  const [rows, setRows] = useState<UniversityIndexRow[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getUniversityIndex()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-6">
      <PageHeader
        eyebrow="Browse"
        title="All universities"
        description="Sortable directory of every institution in the dataset. Click a column to sort, filter by state, or jump to a single university's profile."
      />

      {error || loadError ? (
        <p className="text-sm text-negative">
          Failed to load institutions: {(error ?? loadError)?.message ?? 'unknown error'}
        </p>
      ) : rows ? (
        <UniversityTable rows={rows} />
      ) : (
        <p className="text-text-secondary text-sm">Loading universities…</p>
      )}
    </div>
  );
}
