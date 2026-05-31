'use client';

import { AXIS_STYLE, CATEGORICAL } from '@/components/charts/colors';
import { LineEndLabel } from '@/components/ui/DirectLabel';
import { formatFy, formatUsd } from '@/lib/formatters';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Brush } from '@visx/brush';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Line, LinePath } from '@visx/shape';
import { useCallback, useMemo, useState } from 'react';

export interface BrushableLineSeries {
  key: string;
  label: string;
  data: Array<{ x: number; y: number | null }>;
  color?: string;
}

interface Props {
  series: BrushableLineSeries[];
  width?: number;
  /** Main chart height. Brush chart is fixed 70px below. */
  height?: number;
  /** Inclusive x-range of the data; if omitted, derived from series. */
  domain?: [number, number];
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  /** Show end-of-line labels instead of legend. */
  directLabels?: boolean;
  /** Initial brush range; if omitted, full domain is selected. */
  initialBrush?: [number, number];
  onBrush?: (range: [number, number]) => void;
}

const BRUSH_HEIGHT = 60;
const BRUSH_GAP = 12;

/** Visx brushable line chart with synced detail + mini-axis brush. */
export function BrushableLine({
  series,
  width = 800,
  height = 360,
  domain,
  yFormat = formatUsd,
  xFormat = (v) => formatFy(v),
  directLabels = true,
  initialBrush,
  onBrush,
}: Props) {
  const allXs = useMemo(() => series.flatMap((s) => s.data.map((d) => d.x)), [series]);
  const xMin = domain?.[0] ?? Math.min(...allXs);
  const xMax = domain?.[1] ?? Math.max(...allXs);

  const [brushRange, setBrushRange] = useState<[number, number]>(initialBrush ?? [xMin, xMax]);

  const allYs = useMemo(
    () => series.flatMap((s) => s.data.filter((d) => d.y !== null && d.x >= brushRange[0] && d.x <= brushRange[1]).map((d) => d.y as number)),
    [series, brushRange],
  );
  const yMax = allYs.length ? Math.max(...allYs) : 1;

  const margin = { top: 16, right: directLabels ? 120 : 16, bottom: BRUSH_HEIGHT + BRUSH_GAP + 24, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const brushTop = margin.top + innerHeight + BRUSH_GAP;
  const brushInnerWidth = innerWidth;
  const brushInnerHeight = BRUSH_HEIGHT - 4;

  const xMain = scaleLinear<number>({ domain: brushRange, range: [0, innerWidth], clamp: true });
  const yMain = scaleLinear<number>({ domain: [0, yMax], range: [innerHeight, 0], nice: true });
  const xBrushScale = scaleLinear<number>({ domain: [xMin, xMax], range: [0, brushInnerWidth] });
  const yBrushScale = scaleLinear<number>({ domain: [0, yMax], range: [brushInnerHeight, 0] });

  const handleBrush = useCallback(
    (b: { x0: number; x1: number } | null) => {
      if (!b) {
        const full: [number, number] = [xMin, xMax];
        setBrushRange(full);
        onBrush?.(full);
        return;
      }
      const range: [number, number] = [Math.round(b.x0), Math.round(b.x1)];
      setBrushRange(range);
      onBrush?.(range);
    },
    [xMin, xMax, onBrush],
  );

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Brushable line chart with draggable focus range"
    >
      <title>Brushable line chart</title>
      <Group left={margin.left} top={margin.top}>
        {series.map((s, i) => {
          const visible = s.data.filter((d) => d.y !== null && d.x >= brushRange[0] && d.x <= brushRange[1]);
          const color = s.color ?? CATEGORICAL[i % CATEGORICAL.length];
          return (
            <Group key={s.key}>
              <LinePath
                data={visible}
                x={(d) => xMain(d.x)}
                y={(d) => yMain((d.y ?? 0) as number)}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {directLabels && visible.length > 0 && (
                <g
                  transform={`translate(${xMain(visible[visible.length - 1].x)}, ${yMain((visible[visible.length - 1].y ?? 0) as number)})`}
                >
                  {/* Reuse the LineEndLabel renderer */}
                  <LineEndLabel
                    x={0}
                    y={0}
                    index={visible.length - 1}
                    total={visible.length}
                    label={s.label}
                    color={color}
                  />
                </g>
              )}
            </Group>
          );
        })}
        <AxisBottom
          top={innerHeight}
          scale={xMain}
          tickFormat={(v) => xFormat(Number(v))}
          numTicks={Math.min(10, Math.round(brushRange[1] - brushRange[0]))}
          stroke="hsl(var(--border))"
          tickStroke="hsl(var(--text-tertiary))"
          tickLabelProps={() => ({
            fill: AXIS_STYLE.stroke,
            fontSize: AXIS_STYLE.fontSize,
            fontFamily: AXIS_STYLE.fontFamily,
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={yMain}
          tickFormat={(v) => yFormat(Number(v))}
          numTicks={5}
          stroke="hsl(var(--border))"
          tickStroke="hsl(var(--text-tertiary))"
          tickLabelProps={() => ({
            fill: AXIS_STYLE.stroke,
            fontSize: AXIS_STYLE.fontSize,
            fontFamily: AXIS_STYLE.fontFamily,
            textAnchor: 'end',
            dx: -4,
            dy: 4,
          })}
        />
      </Group>

      {/* Brush */}
      <Group left={margin.left} top={brushTop}>
        {series.map((s, i) => {
          const color = s.color ?? CATEGORICAL[i % CATEGORICAL.length];
          return (
            <LinePath
              key={`brush-${s.key}`}
              data={s.data}
              x={(d) => xBrushScale(d.x)}
              y={(d) => yBrushScale((d.y ?? 0) as number)}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.55}
            />
          );
        })}
        <Brush
          xScale={xBrushScale}
          yScale={yBrushScale}
          width={brushInnerWidth}
          height={brushInnerHeight}
          margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
          handleSize={6}
          initialBrushPosition={{
            start: { x: xBrushScale(brushRange[0]) },
            end: { x: xBrushScale(brushRange[1]) },
          }}
          onChange={(domainState) =>
            handleBrush(domainState ? { x0: domainState.x0, x1: domainState.x1 } : null)
          }
          onClick={() => handleBrush(null)}
          selectedBoxStyle={{
            fill: 'hsl(var(--accent-soft))',
            stroke: 'hsl(var(--accent))',
            fillOpacity: 0.3,
          }}
          useWindowMoveEvents
        />
        <Line
          from={{ x: 0, y: brushInnerHeight }}
          to={{ x: brushInnerWidth, y: brushInnerHeight }}
          stroke="hsl(var(--border))"
        />
      </Group>
    </svg>
  );
}
