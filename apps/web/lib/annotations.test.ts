import { describe, expect, it } from 'vitest';
import { inflectionYear, largestYoY, peakYear } from './annotations';

describe('annotation heuristics', () => {
  const series = [
    { x: 2020, y: 100 },
    { x: 2021, y: 120 },
    { x: 2022, y: 200 },
    { x: 2023, y: 180 },
    { x: 2024, y: 250 },
  ];

  it('peakYear returns the highest point', () => {
    expect(peakYear(series)).toEqual({ x: 2024, y: 250, label: 'Peak: 250' });
  });

  it('largestYoY returns biggest absolute YoY change', () => {
    const r = largestYoY(series);
    expect(r.x).toBe(2022);
    expect(r.label).toMatch(/jumped|grew/i);
  });

  it('largestYoY uses "fell" when the biggest move is negative', () => {
    const falling = [
      { x: 2020, y: 100 },
      { x: 2021, y: 95 },
      { x: 2022, y: 20 },
      { x: 2023, y: 22 },
    ];
    const r = largestYoY(falling);
    expect(r.x).toBe(2022);
    expect(r.label).toMatch(/fell/i);
  });

  it('inflectionYear finds the largest direction change', () => {
    const r = inflectionYear(series);
    expect(r.x).toBe(2023);
  });

  it('handles short series gracefully', () => {
    const short = [{ x: 2020, y: 10 }];
    expect(peakYear(short)).toEqual({ x: 2020, y: 10, label: 'Peak: 10' });
    expect(largestYoY(short).label).toBe('');
    expect(inflectionYear(short).label).toBe('');
  });
});
