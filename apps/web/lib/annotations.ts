/**
 * Registry of pre-defined timeline annotations (spec section 6.1 / 4.3 pattern #4).
 *
 * These are the policy fingerprints visible across federal-R&D timeseries.
 * They're imported by chart components that want to overlay reference bands.
 */

export interface TimelineEvent {
  id: string;
  /** Display label (compact, < 24 chars). Shown next to the band. */
  label: string;
  /** Longer description (for tooltips / methodology). */
  description: string;
  /** Inclusive FY range. A single year uses `from === to`. */
  from: number;
  to: number;
  /** What variant of annotation to render by default. */
  variant: 'band' | 'line';
  /** Semantic tone for color. */
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  /** Optional citation. */
  source?: string;
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'arra',
    label: 'ARRA stimulus',
    description:
      'American Recovery & Reinvestment Act (P.L. 111-5) injected $787B into the economy. NIH/NSF received $10.4B + $3B over two-year obligation windows, visible as an FY09–FY10 bulge.',
    from: 2009,
    to: 2010,
    variant: 'band',
    tone: 'positive',
    source: 'Pub. L. 111-5',
  },
  {
    id: 'sequester',
    label: 'Sequester',
    description:
      'Budget Control Act sequestration (FY13) cut non-defense discretionary by ~5%. NIH lost $1.5B; NSF lost $200M. Recovery began FY15.',
    from: 2013,
    to: 2015,
    variant: 'band',
    tone: 'negative',
    source: 'BCA 2011',
  },
  {
    id: 'covid',
    label: 'COVID surge',
    description:
      'Operation Warp Speed and CARES Act extramural research funding. HHS development spending spiked by $37.6B before tapering FY23.',
    from: 2020,
    to: 2022,
    variant: 'band',
    tone: 'positive',
    source: 'CARES Act, HHS BARDA',
  },
  {
    id: 'chips',
    label: 'CHIPS + IRA',
    description:
      'CHIPS & Science Act (2022) authorized $52.7B in semiconductor R&D; Inflation Reduction Act funded DOE clean-energy R&D. Combined obligations land starting FY23.',
    from: 2023,
    to: 2024,
    variant: 'band',
    tone: 'positive',
    source: 'P.L. 117-167, P.L. 117-169',
  },
];

/** Subset selectors used by charts. */
export const KEY_EVENTS_BANDS = TIMELINE_EVENTS.filter((e) => e.variant === 'band');

/** Lookup. */
export function getEvent(id: string): TimelineEvent | undefined {
  return TIMELINE_EVENTS.find((e) => e.id === id);
}

/** CSS color tokens by tone. */
export function colorForTone(tone: TimelineEvent['tone']): { fill: string; stroke: string } {
  switch (tone) {
    case 'positive':
      return { fill: 'hsl(var(--positive) / 0.08)', stroke: 'hsl(var(--positive) / 0.45)' };
    case 'negative':
      return { fill: 'hsl(var(--negative) / 0.08)', stroke: 'hsl(var(--negative) / 0.45)' };
    case 'warning':
      return { fill: 'hsl(var(--warning) / 0.08)', stroke: 'hsl(var(--warning) / 0.45)' };
    default:
      return { fill: 'hsl(var(--text-tertiary) / 0.08)', stroke: 'hsl(var(--text-tertiary) / 0.45)' };
  }
}

/* ───────────────── Heuristic annotation generators (spec §4.3) ─────────────────
 *
 * Helpers that scan a single-series timeseries and surface the most
 * editorially-interesting point. Used by ChartFrame consumers to auto-place
 * one or two annotations without hand-curating every chart.
 */

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface AnnotationResult extends SeriesPoint {
  label: string;
}

/** Highest-y point. Label: `Peak: <value>`. */
export function peakYear(s: SeriesPoint[]): AnnotationResult {
  const p = s.reduce((a, b) => (b.y > a.y ? b : a));
  return { ...p, label: `Peak: ${p.y}` };
}

/**
 * Biggest absolute year-over-year change. Label includes direction
 * ("jumped" / "fell") and the absolute delta in original units.
 */
export function largestYoY(s: SeriesPoint[]): AnnotationResult {
  if (s.length < 2) return { ...s[0], label: '' };
  let max = { x: s[0].x, y: s[0].y, delta: 0 };
  for (let i = 1; i < s.length; i++) {
    const d = s[i].y - s[i - 1].y;
    if (Math.abs(d) > Math.abs(max.delta)) {
      max = { x: s[i].x, y: s[i].y, delta: d };
    }
  }
  const dir = max.delta > 0 ? 'jumped' : 'fell';
  return {
    x: max.x,
    y: max.y,
    label: `${dir} ${Math.abs(Math.round(max.delta))} from prior year`,
  };
}

/**
 * Largest local "kink" — point where the rate of change reverses most. Uses
 * |prev_slope − next_slope| as the score and returns the *next* point so the
 * annotation lands on the visible inflection.
 */
export function inflectionYear(s: SeriesPoint[]): AnnotationResult {
  if (s.length < 3) return { ...s[0], label: '' };
  let max = { x: s[1].x, y: s[1].y, score: 0 };
  for (let i = 1; i < s.length - 1; i++) {
    const prev = s[i].y - s[i - 1].y;
    const next = s[i + 1].y - s[i].y;
    const score = Math.abs(prev - next);
    if (score > max.score) {
      max = { x: s[i + 1].x, y: s[i + 1].y, score };
    }
  }
  return { x: max.x, y: max.y, label: 'Inflection' };
}
