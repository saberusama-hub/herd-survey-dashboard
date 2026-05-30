/**
 * Canonical formatting utilities for the Research Data Platform.
 *
 * Spec section 4.3: "single canonical formatDollars() utility used everywhere"
 *
 * - formatDollars / formatUsd: $X.XB | $XXM | $XXK | $XXX
 * - formatPct: percentage (handles fraction or percent inputs)
 * - formatFy: FY20XX
 * - formatDelta: signed percentage change
 * - formatCount: thousands-separated count
 * - formatRange: "FY2005 – FY2024"
 */

export type Nullish<T> = T | null | undefined;

const DASH = '—';

export interface FormatDollarsOptions {
  /** Output style. "compact" = $48.2B, "long" = $48,200,000,000 */
  style?: 'compact' | 'long';
  /** Suppress dollar sign (for axis labels that share one $-prefix) */
  noSymbol?: boolean;
  /** Force a specific unit, skipping auto-selection */
  unit?: 'B' | 'M' | 'K' | null;
  /** Override decimals; default chosen by magnitude */
  decimals?: number;
}

/** Canonical dollar formatter. */
export function formatDollars(
  value: Nullish<number>,
  opts: FormatDollarsOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const { style = 'compact', noSymbol = false, unit, decimals } = opts;
  const sym = noSymbol ? '' : '$';
  if (value === 0) return `${sym}0`;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (style === 'long') {
    return `${sign}${sym}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  const picked = unit ?? (abs >= 1e9 ? 'B' : abs >= 1e6 ? 'M' : abs >= 1e3 ? 'K' : null);

  if (picked === 'B') {
    const d = decimals ?? (abs >= 100e9 ? 1 : 2);
    return `${sign}${sym}${(abs / 1e9).toFixed(d)}B`;
  }
  if (picked === 'M') {
    const d = decimals ?? (abs >= 100e6 ? 0 : 1);
    return `${sign}${sym}${(abs / 1e6).toFixed(d)}M`;
  }
  if (picked === 'K') {
    const d = decimals ?? 0;
    return `${sign}${sym}${(abs / 1e3).toFixed(d)}K`;
  }
  return `${sign}${sym}${abs.toLocaleString('en-US', { maximumFractionDigits: decimals ?? 0 })}`;
}

/** Back-compat alias matching the old name. */
export const formatUsd = formatDollars;

export function formatCount(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString('en-US');
}

export interface FormatPctOptions {
  source?: 'fraction' | 'percent';
  decimals?: number;
  signed?: boolean;
}

export function formatPct(value: Nullish<number>, opts: FormatPctOptions = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const { source = 'fraction', decimals = 1, signed = false } = opts;
  const pct = source === 'fraction' ? value * 100 : value;
  const sign = signed && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function formatFy(year: Nullish<number>): string {
  if (year === null || year === undefined || Number.isNaN(year)) return DASH;
  return `FY${year}`;
}

export function formatFyRange(min: Nullish<number>, max: Nullish<number>): string {
  if (min === null || min === undefined || max === null || max === undefined) return DASH;
  if (min === max) return formatFy(min);
  return `${formatFy(min)} – ${formatFy(max)}`;
}

export function formatDelta(
  value: Nullish<number>,
  opts: { source?: 'fraction' | 'percent'; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const { source = 'fraction', decimals = 1 } = opts;
  const pct = source === 'fraction' ? value * 100 : value;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/** Compact unit suffix only (for stacking under tile values). */
export function dollarUnit(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return 'billion';
  if (abs >= 1e6) return 'million';
  if (abs >= 1e3) return 'thousand';
  return '';
}
