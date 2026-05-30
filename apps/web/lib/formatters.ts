/**
 * Back-compat re-export. New code should import from `@/lib/format`.
 * (See spec section 4.3: single canonical formatting module.)
 */
export {
  type Nullish,
  formatCount,
  formatDelta,
  formatDollars,
  formatFy,
  formatFyRange,
  formatPct,
  formatUsd,
} from './format';
