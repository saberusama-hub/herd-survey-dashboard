'use client';

import { CATEGORICAL, colorForAgency } from '@/components/charts/colors';
import { formatDollars } from '@/lib/format';
import { Group } from '@visx/group';
import { Treemap as VisxTreemap, hierarchy, treemapSquarify } from '@visx/hierarchy';
import { scaleOrdinal } from '@visx/scale';

export interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
  /** If set, overrides default coloring. */
  color?: string;
  /** Used to map to an agency color (NSF, HHS, DOD, ...) if no `color` set. */
  agencyKey?: string;
}

interface Props {
  data: TreemapNode;
  width?: number;
  height?: number;
  /** Currency-format the value (default true). */
  currency?: boolean;
  /** Min cell size (px) for showing the label. Cells below this are blank. */
  minLabelSize?: number;
}

/**
 * Treemap. Default coloring: agencyKey → colorForAgency, otherwise round-robin categorical.
 */
export function Treemap({ data, width = 640, height = 360, currency = true, minLabelSize = 36 }: Props) {
  const root = hierarchy<TreemapNode>(data).sum((d) => (d.children ? 0 : d.value ?? 0));
  const ordinal = scaleOrdinal<string, string>({
    domain: [],
    range: [...CATEGORICAL],
  });

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Treemap</title>
      <VisxTreemap<TreemapNode>
        top={0}
        root={root}
        size={[width, height]}
        tile={treemapSquarify}
        round
      >
        {(treemap) => (
          <Group>
            {treemap.descendants().map((node, i) => {
              if (!node.parent) return null; // skip root
              const w = node.x1 - node.x0;
              const h = node.y1 - node.y0;
              const datum = node.data;
              const fill =
                datum.color ??
                (datum.agencyKey ? colorForAgency(datum.agencyKey) : ordinal(`${i}-${datum.name}`));
              return (
                <Group
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional cells
                  key={`tile-${i}-${datum.name}`}
                  top={node.y0}
                  left={node.x0}
                >
                  <rect
                    width={w}
                    height={h}
                    fill={fill}
                    fillOpacity={0.78}
                    stroke="hsl(var(--surface))"
                    strokeWidth={1}
                  >
                    <title>
                      {datum.name}
                      {datum.value ? `: ${currency ? formatDollars(datum.value) : datum.value.toLocaleString()}` : ''}
                    </title>
                  </rect>
                  {w > minLabelSize && h > 22 && (
                    <text
                      x={6}
                      y={14}
                      fontSize={11}
                      fontFamily="var(--font-sans), system-ui"
                      fill="hsl(var(--text-primary))"
                      fontWeight={500}
                    >
                      {datum.name}
                    </text>
                  )}
                  {w > minLabelSize && h > 36 && datum.value !== undefined && (
                    <text
                      x={6}
                      y={28}
                      fontSize={11}
                      fontFamily="var(--font-mono), monospace"
                      fill="hsl(var(--text-primary) / 0.78)"
                    >
                      {currency ? formatDollars(datum.value) : datum.value.toLocaleString()}
                    </text>
                  )}
                </Group>
              );
            })}
          </Group>
        )}
      </VisxTreemap>
    </svg>
  );
}
