'use client';

import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';

interface Props {
  /** Min height while loading (prevents layout shift). */
  height?: number;
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Optional fallback. Default: animated skeleton. */
  fallback?: ReactNode;
  /** Don't wait for IntersectionObserver — render immediately. */
  eager?: boolean;
  children: ReactNode;
}

/**
 * Wraps a chart so it doesn't render until the user scrolls it into view.
 * Combines IntersectionObserver gating with React Suspense for chart libraries
 * loaded via dynamic import.
 *
 * Spec section 7 perf rule: "every chart is wrapped in a Suspense + IntersectionObserver".
 */
export function LazyChart({ children, height = 320, className, fallback, eager = false }: Props) {
  const [inView, setInView] = useState(eager);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (eager || inView) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [eager, inView]);

  return (
    <div ref={ref} style={{ minHeight: height }} className={className}>
      {inView ? (
        <Suspense fallback={fallback ?? <ChartSkeleton height={height} />}>{children}</Suspense>
      ) : (
        fallback ?? <ChartSkeleton height={height} />
      )}
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-md bg-border/15"
      style={{ height }}
      aria-label="Loading chart…"
      aria-busy="true"
    />
  );
}
