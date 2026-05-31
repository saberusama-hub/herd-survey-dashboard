'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to a `(max-width: <bp - 1>px)` media query. Returns `false`
 * during SSR / first paint (no `window`) and updates on the client once
 * the matchMedia listener attaches.
 *
 * Used by responsive chart components (StackedBar, etc.) to flip to a
 * horizontal / mobile layout below the breakpoint.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return mobile;
}
