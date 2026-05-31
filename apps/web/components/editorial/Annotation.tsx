interface Props {
  /** SVG x-coordinate of the data point being annotated. */
  x: number;
  /** SVG y-coordinate of the data point being annotated. */
  y: number;
  /** Short label, < 24 chars. */
  label: string;
  /** Side of the data point to anchor the label to. */
  anchor?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Inline SVG annotation. Renders a small accent dot at (x, y), a short
 * leader line, and a single line of text on the chosen side.
 *
 * Designed to be dropped inside a chart's SVG (e.g., a BarChart / LineChart
 * via the new `annotations` prop). The text is `aria-hidden` because the
 * data is already represented by the underlying chart geometry.
 */
export function Annotation({ x, y, label, anchor = 'top' }: Props) {
  const dy = anchor === 'top' ? -18 : anchor === 'bottom' ? 18 : 0;
  const dx = anchor === 'left' ? -18 : anchor === 'right' ? 18 : 0;
  const textAnchor =
    anchor === 'left' ? 'end' : anchor === 'right' ? 'start' : 'middle';

  return (
    <g aria-hidden>
      <line
        x1={x}
        y1={y}
        x2={x + dx}
        y2={y + dy}
        stroke="hsl(var(--mute-1))"
        strokeWidth={1}
      />
      <circle cx={x} cy={y} r={3} fill="hsl(var(--accent))" />
      <text
        x={x + dx}
        y={y + dy}
        textAnchor={textAnchor}
        className="text-[11px] fill-text-secondary"
      >
        {label}
      </text>
    </g>
  );
}
