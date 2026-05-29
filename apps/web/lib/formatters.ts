export type Nullish<T> = T | null | undefined;

const DASH = '—';

export function formatUsd(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 100e9 ? 1 : 2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 100e6 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  if (abs === 0) return '$0';
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatCount(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString('en-US');
}

export function formatPct(
  value: Nullish<number>,
  opts: { source?: 'fraction' | 'percent'; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const { source = 'fraction', decimals = 1 } = opts;
  const pct = source === 'fraction' ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

export function formatFy(year: number): string {
  return `FY${year}`;
}

export function formatDelta(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
