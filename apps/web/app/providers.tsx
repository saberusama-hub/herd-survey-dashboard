'use client';

import { getConnection } from '@/lib/duckdb';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useEffect, useState } from 'react';

/**
 * App-wide providers. Used to eagerly initialize DuckDB-WASM for every page;
 * now reduced to ThemeProvider so the homepage and other static pages can
 * mount without paying the ~2-5 MB WASM download + 41-parquet view
 * registration round-trip cost.
 *
 * Pages that need DuckDB call `useDuckDB()` (below) which lazily fires
 * initialization on first render. Pages that don't (e.g., the homepage —
 * served from a precomputed JSON snapshot) skip DuckDB entirely.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

interface DuckCtx {
  ready: boolean;
  error: Error | null;
}

/**
 * Triggers lazy DuckDB-WASM initialization on first call. Returns
 * `{ ready, error }` so the calling page can render a skeleton until
 * the parquet bundle is queryable.
 *
 * Cheap to call multiple times — `getConnection()` memoises the init
 * promise, so concurrent calls share a single WASM download.
 */
export function useDuckDB(): DuckCtx {
  const [state, setState] = useState<DuckCtx>({ ready: false, error: null });

  useEffect(() => {
    let cancelled = false;
    getConnection()
      .then(() => {
        if (!cancelled) setState({ ready: true, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ ready: false, error: e instanceof Error ? e : new Error(String(e)) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
