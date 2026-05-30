'use client';

import { CATEGORICAL, colorForAgency } from '@/components/charts/colors';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { AreaStack } from '@visx/shape';
import type { SeriesPoint } from 'd3-shape';

export interface StreamgraphDatum {
  x: number;
  /** key → value at this x */
  values: Record<string, number>;
}

interface Props {
  /** Rows ordered by x. */
  data: StreamgraphDatum[];
  /** Series keys (stacking order, bottom → top). */
  keys: string[];
  /** Optional per-key display label (defaults to the key). */
  keyLabels?: Record<string, string>;
  /** Map series key → color. If absent, agency mapping is tried, then categorical. */
  colorFor?: (key: string, idx: number) => string;
  height?: number;
  width?: number;
  xFormat?: (v: number) => string;
}

/**
 * Visx streamgraph (wiggle-offset stacked area). Use case: NIH IC mix over time
 * (spec section 5.3 NIH tab).
 */
export function Streamgraph({
  data,
  keys,
  keyLabels,
  colorFor,
  height = 320,
  width = 700,
  xFormat = (v) => v.toString(),
}: Props) {
  const margin = { top: 8, right: 16, bottom: 32, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xs = data.map((d) => d.x);
  const x = scaleLinear<number>({ domain: [Math.min(...xs), Math.max(...xs)], range: [0, innerWidth] });

  // Compute stacked extent for the wiggle offset
  const yExtent = (() => {
    if (data.length === 0) return [0, 1];
    let min = 0;
    let max = 0;
    for (const d of data) {
      const total = keys.reduce((s, k) => s + (d.values[k] ?? 0), 0);
      if (total > max) max = total;
    }
    // wiggle baseline ≈ ±max/2
    return [-max / 2, max / 2];
  })();
  const y = scaleLinear<number>({ domain: [yExtent[1], yExtent[0]], range: [0, innerHeight] });

  const resolve = (k: string, i: number): string => {
    if (colorFor) return colorFor(k, i);
    const ag = colorForAgency(k);
    if (ag !== CATEGORICAL[6]) return ag;
    return CATEGORICAL[i % CATEGORICAL.length];
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Streamgraph</title>
      <Group left={margin.left} top={margin.top}>
        <AreaStack<StreamgraphDatum>
          data={data}
          keys={keys}
          value={(d, k) => d.values[k] ?? 0}
          x={(d: SeriesPoint<StreamgraphDatum>) => x(d.data.x)}
          y0={(d: SeriesPoint<StreamgraphDatum>) => y(d[0])}
          y1={(d: SeriesPoint<StreamgraphDatum>) => y(d[1])}
          offset="wiggle"
          curve={undefined}
        >
          {({ stacks, path }) =>
            stacks.map((stack, i) => (
              <path
                key={`stack-${stack.key}`}
                d={path(stack) ?? ''}
                fill={resolve(stack.key as string, i)}
                fillOpacity={0.85}
                stroke="hsl(var(--surface))"
                strokeWidth={0.5}
              >
                <title>{keyLabels?.[stack.key as string] ?? (stack.key as string)}</title>
              </path>
            ))
          }
        </AreaStack>
        <AxisBottom
          top={innerHeight}
          scale={x}
          tickFormat={(v) => xFormat(Number(v))}
          numTicks={Math.min(10, data.length)}
          stroke="hsl(var(--border))"
          tickStroke="hsl(var(--text-tertiary))"
          tickLabelProps={() => ({
            fill: 'hsl(var(--text-tertiary))',
            fontSize: 11,
            fontFamily: 'var(--font-mono), monospace',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          numTicks={0}
          stroke="hsl(var(--border))"
          hideTicks
        />
      </Group>
    </svg>
  );
}
