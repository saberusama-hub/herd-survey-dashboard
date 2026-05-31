'use client';

import { useDuckDB } from '@/app/providers';
import { searchInstitutions } from '@/lib/queries';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

interface SearchResult {
  sk: string;
  name: string;
  state: string | null;
}

interface Props {
  /** Optional placeholder override. */
  placeholder?: string;
  /** Override the wrapper width (defaults to max-w-xl). */
  className?: string;
}

/**
 * Typeahead search for the ~800 HERD-tracked universities. Renders an
 * absolutely-positioned results dropdown that links each match to
 * `/universities/[sk]`.
 *
 * Notes:
 * - `institution_sk` is a STRING in the dim schema (e.g., 'INST0000001').
 * - Queries are gated on `useDuckDB().ready` — calls before init are no-ops.
 * - Minimum query length is 2 chars to avoid 800-row floods on a single keystroke.
 * - The dropdown closes on outside click and on result selection.
 */
export function UniversitySearchBox({
  placeholder = 'Search any of ~800 universities…',
  className = 'max-w-xl',
}: Props) {
  const { ready } = useDuckDB();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  // Run the typeahead query on every keystroke once DuckDB is initialized.
  // The 2-char threshold keeps the dropdown empty until the user actually
  // commits to typing.
  useEffect(() => {
    if (!ready) return;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    searchInstitutions(q)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, q]);

  // Outside-click closes the dropdown without clearing the input.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const showDropdown = open && results.length > 0;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        role="combobox"
        aria-label="Search universities"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={showDropdown}
        className="w-full px-4 py-3 text-base border border-border rounded bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-surface border border-border rounded shadow-md divide-y divide-rule"
        >
          {results.map((r) => (
            <li key={r.sk} role="option" aria-selected={false}>
              <Link
                href={`/universities/${r.sk}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-mute-3 focus:bg-mute-3 focus:outline-none"
              >
                <span className="font-medium text-text-primary">{r.name}</span>
                {r.state && (
                  <span className="ml-2 text-text-tertiary tnum">({r.state})</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open && ready && q.trim().length >= 2 && results.length === 0 && (
        <p className="absolute z-20 left-0 right-0 mt-1 px-4 py-2 text-xs text-text-tertiary bg-surface border border-border rounded">
          No matches for &ldquo;{q}&rdquo;.
        </p>
      )}
    </div>
  );
}
