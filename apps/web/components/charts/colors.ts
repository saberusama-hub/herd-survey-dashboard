/**
 * Central palette module for the Research Data Platform.
 *
 * Spec section 3.2: Editorial Teal palette.
 *
 * - CATEGORICAL[0..6] — 7-color agency-mapped categorical
 * - SEQUENTIAL[0..6] — single-hue teal ramp (light → dark)
 * - DIVERGING[0..6] — PiYG diverging (3 below, zero, 3 above)
 * - colorForAgency(agency_sk) — canonical agency → categorical color
 * - highlightSeries(id, n) — returns [primary, gray, gray, ...] for "one callout" rule
 */

/* ───────────────── Categorical (7 colors) ───────────────── */
export const CATEGORICAL = [
  'hsl(var(--cat-1))', // NSF teal
  'hsl(var(--cat-2))', // NIH/HHS rose
  'hsl(var(--cat-3))', // DOD blue
  'hsl(var(--cat-4))', // DOE amber
  'hsl(var(--cat-5))', // NASA olive
  'hsl(var(--cat-6))', // USDA violet
  'hsl(var(--cat-7))', // Other slate
] as const;

/** Back-compat: code still importing CHART_COLORS keeps working. */
export const CHART_COLORS = CATEGORICAL;

export function colorFor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

/* ───────────────── Sequential (7-stop teal ramp) ─────────────────
 *
 * For ordered magnitude (choropleths, heatmaps). Light → dark in light mode;
 * dark → light in dark mode (handled by CSS vars).
 */
export const SEQUENTIAL = [
  'hsl(var(--seq-1))',
  'hsl(var(--seq-2))',
  'hsl(var(--seq-3))',
  'hsl(var(--seq-4))',
  'hsl(var(--seq-5))',
  'hsl(var(--seq-6))',
  'hsl(var(--seq-7))',
] as const;

/** Pick a sequential color by quantile (0..1). */
export function sequentialFor(t: number): string {
  const i = Math.max(0, Math.min(SEQUENTIAL.length - 1, Math.floor(t * SEQUENTIAL.length)));
  return SEQUENTIAL[i];
}

/* ───────────────── Diverging (PiYG, 7 stops) ─────────────────
 *
 * For above/below baseline (residuals, deltas, gaps). Index 3 is the neutral
 * mid; 0..2 are below, 4..6 are above.
 */
export const DIVERGING = [
  'hsl(var(--div-neg-3))',
  'hsl(var(--div-neg-2))',
  'hsl(var(--div-neg-1))',
  'hsl(var(--div-zero))',
  'hsl(var(--div-pos-1))',
  'hsl(var(--div-pos-2))',
  'hsl(var(--div-pos-3))',
] as const;

/** Map a signed value to a diverging color, given the absolute max for symmetry. */
export function divergingFor(value: number, absMax: number): string {
  if (absMax <= 0 || !Number.isFinite(value)) return DIVERGING[3];
  const t = Math.max(-1, Math.min(1, value / absMax)); // -1..+1
  const stops = DIVERGING.length;
  const idx = Math.round(((t + 1) / 2) * (stops - 1));
  return DIVERGING[idx];
}

/* ───────────────── Agency-mapped colors ─────────────────
 *
 * Spec section 3.2: categorical palette is mapped to agencies. We standardize
 * the assignment here so the same agency reads the same color across every
 * chart in the platform.
 */

/** Canonical agency keys. Match what arrives from `dim_agency.parquet`. */
export const AGENCY_KEYS = {
  NSF: 'NSF',
  HHS: 'HHS',
  NIH: 'NIH',
  DOD: 'DOD',
  DOE: 'DOE',
  NASA: 'NASA',
  USDA: 'USDA',
} as const;

const AGENCY_COLOR_INDEX: Record<string, number> = {
  // canonical
  NSF: 0,
  HHS: 1,
  NIH: 1, // NIH is the headline IC of HHS — same color
  DOD: 2,
  DOE: 3,
  NASA: 4,
  USDA: 5,
  // common aliases / longer-form spellings (lowercased on lookup)
  'national science foundation': 0,
  'department of health and human services': 1,
  'national institutes of health': 1,
  'department of defense': 2,
  'department of energy': 3,
  'national aeronautics and space administration': 4,
  'department of agriculture': 5,
};

/**
 * Resolve an agency identifier (sk, abbreviation, or name) to a categorical
 * color. Unknown agencies fall through to "Other" (cat-7).
 */
export function colorForAgency(input: string | null | undefined): string {
  if (!input) return CATEGORICAL[6];
  const key = String(input).trim();
  const direct = AGENCY_COLOR_INDEX[key];
  if (direct !== undefined) return CATEGORICAL[direct];
  const lower = AGENCY_COLOR_INDEX[key.toLowerCase()];
  if (lower !== undefined) return CATEGORICAL[lower];
  return CATEGORICAL[6];
}

/* ───────────────── Highlight helper ─────────────────
 *
 * Spec section 3.2 "Hard rule 1": one callout color per view. When a series is
 * highlighted, every other series goes to `--text-tertiary`. This helper
 * builds the per-series fill array.
 */
export function highlightSeries(highlightIndex: number | null, n: number): string[] {
  if (highlightIndex === null) {
    return Array.from({ length: n }, (_, i) => colorFor(i));
  }
  return Array.from({ length: n }, (_, i) =>
    i === highlightIndex ? 'hsl(var(--highlight))' : 'hsl(var(--text-tertiary))',
  );
}

/* ───────────────── CSS variable resolver ─────────────────
 *
 * Canvas-based libraries (ECharts, Visx with canvas renderer) can't parse
 * strings like `hsl(var(--cat-1))` — `var(...)` is only meaningful in CSS.
 * This helper reads the computed value from the document root and substitutes
 * it in so the canvas gets a real color (e.g., `hsl(191 88% 28%)`).
 *
 * No-op on the server (returns input unchanged).
 */
export function resolveCssVarColor(value: string): string {
  if (typeof window === 'undefined') return value;
  return value.replace(/var\(--([\w-]+)\)/g, (match, name) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    return v || match;
  });
}

/* ───────────────── Recharts shared styling ───────────────── */
export const AXIS_STYLE = {
  stroke: 'hsl(var(--text-tertiary))',
  fontSize: 11,
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
};

export const GRID_STYLE = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '0',
  vertical: false,
};
