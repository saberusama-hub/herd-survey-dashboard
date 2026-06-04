'use client';

import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

type Comparable = string | number | null | undefined;

/**
 * Drop-in sort hook for editorial tables. Each entry in `accessors` maps a
 * column key to a getter that returns a comparable primitive (number | string)
 * or null. Nulls sink to the bottom regardless of direction.
 *
 * Usage:
 *   const { rows, sort, requestSort } = useTableSort(rawRows, {
 *     initial: { key: 'amount', dir: 'desc' },
 *     accessors: { amount: (r) => r.amount, name: (r) => r.name.toLowerCase() },
 *     defaultDir: { amount: 'desc', name: 'asc' },
 *   });
 */
export function useTableSort<T, A extends Record<string, (row: T) => Comparable>>(
  source: T[],
  config: {
    initial: SortState<Extract<keyof A, string>>;
    accessors: A;
    /** Default direction when the user first clicks a given column. */
    defaultDir?: Partial<Record<Extract<keyof A, string>, SortDir>>;
  },
) {
  type K = Extract<keyof A, string>;
  const [sort, setSort] = useState<SortState<K>>(config.initial);

  const rows = useMemo(() => {
    const get = config.accessors[sort.key] as ((row: T) => Comparable) | undefined;
    if (!get) return source;
    const sentinel = sort.dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const norm = (row: T): number | string => {
      const v = get(row);
      if (v === null || v === undefined) return sentinel;
      return v;
    };
    return [...source].sort((a, b) => {
      const av = norm(a);
      const bv = norm(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      if (as < bs) return sort.dir === 'asc' ? -1 : 1;
      if (as > bs) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [source, sort, config.accessors]);

  function requestSort(key: K) {
    if (sort.key === key) {
      setSort({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      const def = config.defaultDir?.[key] ?? 'desc';
      setSort({ key, dir: def });
    }
  }

  return { rows, sort, requestSort };
}

interface SortableThProps<K extends string> {
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  className?: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * Clickable `<th>` for editorial tables. Renders the column label, a sort
 * indicator (▲/▼) when active, and the appropriate ARIA semantics. Drop-in
 * replacement for a plain `<th>` — no other markup changes required.
 */
export function SortableTh<K extends string>({
  sortKey,
  sort,
  onSort,
  align = 'left',
  className = '',
  title,
  children,
}: SortableThProps<K>) {
  const isActive = sort.key === sortKey;
  const alignTh = align === 'right' ? 'text-right' : 'text-left';
  const alignBtn = align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th
      scope="col"
      aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${alignTh} ${className}`}
      title={title}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 ${alignBtn} font-medium ${
          isActive ? 'text-accent' : 'text-text-tertiary'
        } hover:text-accent focus:outline-none focus:underline`}
      >
        <span>{children}</span>
        <span aria-hidden="true" className="inline-block w-3 text-[10px]">
          {isActive ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
