'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Pixels from the viewport edge that count as "in view". */
  rootMargin?: string;
  /** Fraction of the element that must be visible to fire. */
  threshold?: number;
  /** Fire once and stop observing (default true). */
  once?: boolean;
}

/**
 * Observe an element with IntersectionObserver. Returns a ref to attach plus
 * a boolean that flips true the first time the element scrolls into view.
 *
 * Used to drive `.reveal[data-state='visible']` entrance animations across
 * the dashboard without React state churn (writes a data-attribute, not a
 * className change, so React reconciliation stays cheap).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(options: Options = {}) {
  const { rootMargin = '0px 0px -8% 0px', threshold = 0.05, once = true } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      // SSR fallback / very old browser — just reveal immediately.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
