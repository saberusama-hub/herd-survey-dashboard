'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { BarGroup } from '@visx/shape';

import { formatDollars } from '@/lib/format';

interface Props {
  data: Array<{ [key: string]: number | string }>;
  /** Outer-group key (e.g., 'agency_bucket'). */
  groupKey: string;
  /** Series keys grouped within each category (e.g., ['herd', 'federal_funds']). */
  seriesKeys: string[];
  /** Map of series key → CSS color string. */
  colors: Record<string, string>;
  width: number;
  height: number;
}

/**
 * Visx-based grouped bar chart. Used for the reconciliation §5 view that
 * compares HERD vs Federal Funds side-by-side per agency bucket. The caller
 * supplies a flat row per group with one numeric column per series key.
 */
export function GroupedBar({ data, groupKey, seriesKeys, colors, width, height }: Props) {
  const margin = { top: 16, right: 16, bottom: 36, left: 80 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const groups = data.map((d) => String(d[groupKey]));
  const max = Math.max(
    1,
    ...data.flatMap((d) => seriesKeys.map((k) => Number(d[k]) || 0)),
  );

  const x0 = scaleBand({ domain: groups, range: [0, innerW], padding: 0.2 });
  const x1 = scaleBand({ domain: seriesKeys, range: [0, x0.bandwidth()], padding: 0.05 });
  const y = scaleLinear({ domain: [0, max], range: [innerH, 0], nice: true });
  const color = scaleOrdinal<string, string>({
    domain: seriesKeys,
    range: seriesKeys.map((k) => colors[k] ?? 'hsl(var(--mute-1))'),
  });

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Grouped bar chart of ${seriesKeys.join(' vs ')} by ${groupKey}`}
    >
      <Group left={margin.left} top={margin.top}>
        <BarGroup
          data={data}
          keys={seriesKeys}
          height={innerH}
          x0={(d) => String(d[groupKey])}
          x0Scale={x0}
          x1Scale={x1}
          yScale={y}
          color={color}
        >
          {(barGroups) =>
            barGroups.map((bg) => (
              <Group key={`bg-${bg.index}`} left={bg.x0}>
                {bg.bars.map((bar) => (
                  <rect
                    key={`${bg.index}-${bar.index}`}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={bar.color}
                  />
                ))}
              </Group>
            ))
          }
        </BarGroup>
        <AxisBottom
          top={innerH}
          scale={x0}
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
