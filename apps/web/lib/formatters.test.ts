import { describe, expect, it } from 'vitest';
import { formatCount, formatDelta, formatFy, formatPct, formatUsd } from './formatters';

describe('formatUsd', () => {
  it('formats billions with B suffix', () => {
    expect(formatUsd(199_460_000_000)).toBe('$199.5B');
  });
  it('formats sub-100B billions with 2 decimals', () => {
    expect(formatUsd(3_325_000_000)).toBe('$3.33B');
  });
  it('formats sub-million with K suffix', () => {
    expect(formatUsd(450_000)).toBe('$450K');
  });
  it('handles negative values', () => {
    expect(formatUsd(-1_500_000_000)).toBe('-$1.50B');
  });
  it('handles null/undefined', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(undefined)).toBe('—');
  });
  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0');
  });
});

describe('formatCount', () => {
  it('uses thousand separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
  });
  it('handles null', () => {
    expect(formatCount(null)).toBe('—');
  });
});

describe('formatPct', () => {
  it('formats decimal as percent with one decimal', () => {
    expect(formatPct(0.737)).toBe('73.7%');
  });
  it('formats whole-number-style', () => {
    expect(formatPct(73.7, { source: 'percent' })).toBe('73.7%');
  });
  it('handles null', () => {
    expect(formatPct(null)).toBe('—');
  });
});

describe('formatFy', () => {
  it('prefixes with FY', () => {
    expect(formatFy(2024)).toBe('FY2024');
  });
});

describe('formatDelta', () => {
  it('positive delta gets + sign', () => {
    expect(formatDelta(0.123)).toBe('+12.3%');
  });
  it('negative delta keeps - sign', () => {
    expect(formatDelta(-0.05)).toBe('-5.0%');
  });
  it('zero is plain 0', () => {
    expect(formatDelta(0)).toBe('0.0%');
  });
});
