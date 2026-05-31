'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityIndexRow } from '@/lib/queries';

type SortKey = keyof UniversityIndexRow;
type SortDir = 'asc' | 'desc';
type Align = 'left' | 'right';

interface ColumnDef {
  key: SortKey;
  label: string;
  align: Align;
  /** Default sort direction when this column is first clicked. */
  defaultDir: SortDir;
  /** Cell formatter. Receives the row value (may be null). */
  fmt?: (v: UniversityIndexRow[SortKey]) => string;
}

const COLS: ColumnDef[] = [
  { key: 'name', label: 'Institution', align: 'left', defaultDir: 'asc' },
  { key: 'state', label: 'State', align: 'left', defaultDir: 'asc' },
  {
    key: 'total_rd_fy2024',
    label: 'Total R&D FY24',
    align: 'right',
    defaultDir: 'desc',
    fmt: (v) => (typeof v === 'number' ? formatDollars(v) : '—'),
  },
  {
    key: 'cagr_20yr',
    label: '20-yr CAGR',
    align: 'right',
    defaultDir: 'desc',
    fmt: (v) => (typeof v === 'number' ? formatPercent(v) : '—'),
  },
  {
    key: 'federal_share',
    label: 'Federal %',
    align: 'right',
    defaultDir: 'desc',
    fmt: (v) => (typeof v === 'number' ? formatPercent(v) : '—'),
  },
  {
    key: 'pi_count',
    label: '# PIs',
    align: 'right',
    defaultDir: 'desc',
    fmt: (v) => (typeof v === 'number' ? v.toLocaleString('en-US') : '—'),
  },
  {
    key: 'stem_share',
    label: 'STEM %',
    align: 'right',
    defaultDir: 'desc',
    fmt: (v) => (typeof v === 'number' ? formatPercent(v) : '—'),
  },
];

const MAX_ROWS = 500;

interface Props {
  rows: UniversityIndexRow[];
}

/**
 * Sortable, filterable directory of every HERD-tracked institution.
 *
 * - Click a header to sort. Click again to flip direction.
 * - Numeric columns default to descending sort (largest first); text columns
 *   default to ascending.
 * - Renders at most {@link MAX_ROWS} rows for perf — the counter shows the
 *   pre-cap filtered total so the user can tell when more are being clipped.
 * - The wrapping `overflow-x-auto` keeps the table usable on narrow screens
 *   without forcing layout shifts on the rest of the page.
 */
export function UniversityTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_rd_fy2024');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [stateFilter, setStateFilter] = useState('');
  const [search, setSearch] = useState('');

  const states = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.state).filter((s): s is string => Boolean(s)))).sort(),
    [rows],
  );

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (stateFilter === '' || r.state === stateFilter) &&
        (q === '' || (r.name ?? '').toLowerCase().includes(q)),
    );
    // Sentinel pushes nulls to the bottom regardless of direction.
    const sentinel = sortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const get = (row: UniversityIndexRow): number | string => {
      const v = row[sortKey];
      if (v === null || v === undefined) return sentinel;
      return v as number | string;
    };
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir, stateFilter, search]);

  const visible = sorted.slice(0, MAX_ROWS);
  const clipped = sorted.length > MAX_ROWS;

  function onHeaderClick(col: ColumnDef) {
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir(col.defaultDir);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search institutions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search institutions"
          className="flex-1 min-w-[200px] sm:flex-none sm:w-72 border border-border rounded px-3 py-1.5 text-sm bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="Filter by state"
          className="border border-border rounded px-3 py-1.5 text-sm bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-text-tertiary tnum">
          {sorted.length.toLocaleString('en-US')} institution{sorted.length === 1 ? '' : 's'}
          {clipped && ` · showing first ${MAX_ROWS}`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-rule rounded">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-mute-3">
            <tr>
              {COLS.map((c) => {
                const isActive = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`py-2 px-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-accent ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    } ${c.align === 'right' ? 'tnum' : ''} ${isActive ? 'text-accent' : 'text-text-primary'}`}
                    onClick={() => onHeaderClick(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onHeaderClick(c);
                      }
                    }}
                    tabIndex={0}
                    role="columnheader button"
                  >
                    {c.label}
                    <span aria-hidden="true" className="ml-1 inline-block w-3">
                      {isActive ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.institution_sk} className="border-t border-rule hover:bg-mute-3">
                <td className="py-1.5 px-3 whitespace-nowrap">
                  <Link
                    href={`/universities/${r.institution_sk}`}
                    className="text-accent hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="py-1.5 px-3 whitespace-nowrap text-text-secondary tnum">
                  {r.state ?? '—'}
                </td>
                {COLS.slice(2).map((c) => (
                  <td
                    key={c.key}
                    className={`py-1.5 px-3 whitespace-nowrap ${
                      c.align === 'right' ? 'text-right tnum' : 'text-left'
                    }`}
                  >
                    {c.fmt ? c.fmt(r[c.key]) : String(r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={COLS.length}
                  className="py-6 px-3 text-center text-text-tertiary text-sm"
                >
                  No institutions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
