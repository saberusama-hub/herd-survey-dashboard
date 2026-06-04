interface Props {
  /** Pre-formatted className for shape (e.g., "h-4 w-32"). */
  className?: string;
  /**
   * Pre-set shapes:
   *   line  — single text line (h-4 w-3/4)
   *   title — heading line (h-6 w-1/2)
   *   chart — chart placeholder (h-72 w-full)
   *   tile  — KPI tile placeholder (h-24)
   */
  shape?: 'line' | 'title' | 'chart' | 'tile';
}

const SHAPE_CLASSES: Record<NonNullable<Props['shape']>, string> = {
  line: 'h-3.5 w-3/4',
  title: 'h-6 w-1/2',
  chart: 'h-72 w-full',
  tile: 'h-24 w-full',
};

/**
 * Subtle pulsing placeholder. Used in place of "Loading…" text so the
 * page rhythm holds while DuckDB-WASM loads the parquet bundle.
 *
 * Pure CSS animation — no JS, no React state. Respects
 * prefers-reduced-motion via the global media query in globals.css.
 */
export function Skeleton({ className, shape }: Props) {
  const shapeClass = shape ? SHAPE_CLASSES[shape] : '';
  return (
    <div aria-hidden className={`relative overflow-hidden rounded bg-mute-3/40 ${shapeClass} ${className ?? ''}`}>
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--rule) / 0.5), transparent)',
        }}
      />
    </div>
  );
}
