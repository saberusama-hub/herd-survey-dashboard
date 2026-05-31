'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarStack, BarStackHorizontal } from '@visx/shape';

import { formatDollars } from '@/lib/format';
import { useIsMobile } from '@/lib/mobile';

export interface StackedBarDatum {
  [key: string]: number | string;
}

interface Props {
  data: StackedBarDatum[];
  /** Stack keys (e.g., the agencies inside a year). */
  keys: string[];
  /** Category key (e.g., 'fiscal_year' or 'agency_bucket'). */
  xKey: string;
  /** Map of stack key → CSS color string. */
  colors: Record<string, string>;
  width: number;
  height: number;
  /** Vertical (default desktop) or horizontal (auto on mobile). */
  orientation?: 'vertical' | 'horizontal';
}

/**
 * Visx-based stacked bar chart. On viewports below the mobile breakpoint
 * (768 px) the orientation flips to horizontal so long category labels and
 * tall stacks remain readable on phones.
 */
export function StackedBar({
  data,
  keys,
  xKey,
  colors,
  width,
  height,
  orientation = 'vertical',
}: Props) {
  const isMobile = useIsMobile();
  const o = isMobile ? 'horizontal' : orientation;

  const margin = { top: 16, right: 24, bottom: 32, left: 80 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const categories = data.map((d) => String(d[xKey]));
  const totals = data.map((d) => keys.reduce((s, k) => s + (Number(d[k]) || 0), 0));
  const maxTotal = Math.max(1, ...totals);

  const color = scaleOrdinal<string, string>({
    domain: keys,
    range: keys.map((k) => colors[k] ?? 'hsl(var(--mute-1))'),
  });

  if (o === 'horizontal') {
    const yScale = scaleBand({ domain: categories, range: [0, innerH], padding: 0.2 });
    const xScale = scaleLinear({ domain: [0, maxTotal], range: [0, innerW], nice: true });
    return (
      <svg width={width} height={height} role="img">
        <Group left={margin.left} top={margin.top}>
          <BarStackHorizontal<StackedBarDatum, string>
            data={data}
            keys={keys}
            y={(d) => String(d[xKey])}
            xScale={xScale}
            yScale={yScale}
            color={color}
          >
            {(stacks) =>
              stacks.map((stack) =>
                stack.bars.map((bar) => (
                  <rect
                    key={`${stack.index}-${bar.index}`}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={bar.color}
                  />
                )),
              )
            }
          </BarStackHorizontal>
          <AxisBottom
            top={innerH}
            scale={xScale}
            tickFormat={(v) => formatDollars(Number(v))}
            tickLabelProps={() => ({
              className: 'fill-text-tertiary text-[11px] tnum',
              textAnchor: 'middle',
            })}
          />
          <AxisLeft
            scale={yScale}
            tickLabelProps={() => ({
              className: 'fill-text-tertiary text-[11px]',
              textAnchor: 'end',
              dx: -4,
              dy: 4,
            })}
          />
        </Group>
      </svg>
    );
  }

  // Vertical (default)
  const xScale = scaleBand({ domain: categories, range: [0, innerW], padding: 0.2 });
  const yScale = scaleLinear({ domain: [0, maxTotal], range: [innerH, 0], nice: true });
  return (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        <BarStack<StackedBarDatum, string>
          data={data}
          keys={keys}
          x={(d) => String(d[xKey])}
          xScale={xScale}
          yScale={yScale}
          color={color}
        >
          {(stacks) =>
            stacks.map((stack) =>
              stack.bars.map((bar) => (
                <rect
                  key={`${stack.index}-${bar.index}`}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill={bar.color}
                />
              )),
            )
          }
        </BarStack>
        <AxisBottom
          top={innerH}
          scale={xScale}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px]',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={yScale}
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
