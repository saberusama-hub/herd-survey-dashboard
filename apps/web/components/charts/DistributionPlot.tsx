'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';

import { formatDollars } from '@/lib/format';

interface Props {
  /** Decile rows — `decile` is the 1..10 bucket, `avg_amount` the mean per bucket. */
  data: Array<{ decile: number; avg_amount: number }>;
  width: number;
  height: number;
  /** Accessible label for the SVG root (axe svg-img-alt). */
  ariaLabel?: string;
}

/**
 * Visx-based decile bar chart. Used to show how funding (or any other
 * dollar-denominated metric) distributes across the population — typical
 * inputs come from a pre-aggregated decile table.
 */
export function DistributionPlot({ data, width, height, ariaLabel }: Props) {
  const label = ariaLabel ?? 'Decile distribution of average amount per bucket';
  const margin = { top: 16, right: 16, bottom: 36, left: 80 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const x = scaleBand({
    domain: data.map((d) => String(d.decile)),
    range: [0, innerW],
    padding: 0.15,
  });
  const y = scaleLinear({
    domain: [0, Math.max(1, ...data.map((d) => d.avg_amount))],
    range: [innerH, 0],
    nice: true,
  });

  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <Group left={margin.left} top={margin.top}>
        {data.map((d) => {
          const bw = x.bandwidth();
          const bx = x(String(d.decile)) ?? 0;
          const by = y(d.avg_amount);
          return (
            <rect
              key={d.decile}
              x={bx}
              y={by}
              width={bw}
              height={Math.max(0, innerH - by)}
              fill="hsl(var(--accent))"
            />
          );
        })}
        <AxisBottom
          top={innerH}
          scale={x}
          label="Decile"
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px]',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          tickFormat={(v) => formatDollars(Number(v))}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px] tnum',
            textAnchor: 'end',
            dx: -4,
            dy: 4,
          })}
        />
      </Group>
    </svg>
  );
}
