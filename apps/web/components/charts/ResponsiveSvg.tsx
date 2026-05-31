'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Render-prop receives the measured inner width and the chosen height. */
  children: (width: number, height: number) => ReactNode;
  /** Fixed pixel height for the chart. */
  height: number;
  /** Optional minimum width (defaults to 280px so small SVGs don't collapse). */
  minWidth?: number;
  className?: string;
}

/**
 * Width-measuring wrapper for Visx charts (which need explicit pixel
 * dimensions). Subscribes to ResizeObserver so the chart re-renders when
 * the container resizes. SSR-safe: emits a `minWidth × height` placeholder
 * until the first client-side measurement lands.
 */
export function ResponsiveSvg({ children, height, minWidth = 280, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(minWidth);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(minWidth, Math.floor(e.contentRect.width));
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minWidth]);

  return (
    <div ref={ref} className={className} style={{ width: '100%', height }}>
      {children(width, height)}
    </div>
  );
}
