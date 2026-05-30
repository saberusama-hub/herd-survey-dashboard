'use client';

import { getConnection } from '@/lib/duckdb';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

interface DuckCtx {
  ready: boolean;
  error: Error | null;
}

const Ctx = createContext<DuckCtx>({ ready: false, error: null });

export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConnection()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <Ctx.Provider value={{ ready, error }}>{children}</Ctx.Provider>
    </ThemeProvider>
  );
}

export function useDuckDB() {
  return useContext(Ctx);
}
