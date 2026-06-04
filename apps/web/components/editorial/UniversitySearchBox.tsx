'use client';

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
 * Typeahead search for ~1,014 HERD-tracked universities.
 *
 * Performance refactor: previously this component ran every keystroke through
 * `searchInstitutions()` against DuckDB-WASM, which forced the homepage to
 * eagerly initialise the ~2-5 MB WASM bundle just to support a feature most
 * visitors don't use. The component now fetches the tiny (80 KB)
 * `dim_institution.json` on first input focus and searches it in plain JS.
 * DuckDB is never touched by the homepage.
 */
export function UniversitySearchBox({
  placeholder = 'Search any of ~1,014 universities…',
  className = 'max-w-xl',
}: Props) {
  const [q, setQ] = useState('');
  const [institutions, setInstitutions] = useState<SearchResult[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  // Lazy-fetch the institution index on first focus. The 80 KB JSON is
  // cached by Cloudflare + the browser after first hit, so subsequent
  // visits are effectively free.
  const ensureIndex = () => {
    if (institutions !== null || loadError !== null) return;
    fetch('/data/dim_institution.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SearchResult[]) => setInstitutions(data))
      .catch((e: Error) => setLoadError(e));
  };

  // Outside-click closes the dropdown without clearing the input.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const needle = q.trim().toLowerCase();
  const ready = institutions !== null;
  const results: SearchResult[] =
    ready && needle.length >= 2
      ? (institutions as SearchResult[]).filter((r) => r.name.toLowerCase().includes(needle)).slice(0, 20)
      : [];
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
        onFocus={() => {
          ensureIndex();
          setOpen(true);
        }}
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
        <div
          id={listboxId}
          // biome-ignore lint/a11y/useSemanticElements: ARIA combobox pattern; native <select> can't host <Link> per-option
          role="listbox"
          tabIndex={-1}
          className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-surface border border-border rounded shadow-md divide-y divide-rule"
        >
          {results.map((r) => (
            <div
              key={r.sk}
              // biome-ignore lint/a11y/useSemanticElements: ARIA listbox option pattern; native <option> can't host <Link>
              role="option"
              aria-selected={false}
              tabIndex={-1}
            >
              <Link
                href={`/universities/${r.sk}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-mute-3 focus:bg-mute-3 focus:outline-none"
              >
                <span className="font-medium text-text-primary">{r.name}</span>
                {r.state && <span className="ml-2 text-text-tertiary tnum">({r.state})</span>}
              </Link>
            </div>
          ))}
        </div>
      )}
      {open && ready && needle.length >= 2 && results.length === 0 && (
        <p className="absolute z-20 left-0 right-0 mt-1 px-4 py-2 text-xs text-text-tertiary bg-surface border border-border rounded">
          No matches for &ldquo;{q}&rdquo;.
        </p>
      )}
      {loadError && (
        <p className="mt-1 text-xs text-negative">Couldn&rsquo;t load institution index: {loadError.message}</p>
      )}
    </div>
  );
}
