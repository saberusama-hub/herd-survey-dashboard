'use client';

import { CATEGORICAL, resolveCssVarColor } from '@/components/charts/colors';
import { formatDollars } from '@/lib/format';
import dynamic from 'next/dynamic';

const EChartsBase = dynamic(() => import('./EChartsBase'), { ssr: false });

export interface SankeyNode {
  /** Unique node identifier. Must be unique within the chart — used as the link source/target. */
  name: string;
  /** Optional friendly display label (shown on the chart). Defaults to `name`. */
  label?: string;
  /** Optional explicit color (defaults to categorical cycle). */
  itemStyle?: { color: string };
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface Props {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  title?: string;
  /** Currency-format the value (default true). */
  currency?: boolean;
  /** Click handler — receives node or edge data. */
  onClick?: (params: unknown) => void;
}

/** ECharts Sankey wrapper used by /flow (spec section 5.6). */
export function Sankey({ nodes, links, height = 520, currency = true, onClick }: Props) {
  // Build a name → label lookup so the formatter can show friendly text
  // while preserving link integrity (links use the unique `name`).
  const labelByName: Record<string, string> = {};
  for (const n of nodes) labelByName[n.name] = n.label ?? n.name;

  // Auto-color nodes if no explicit color set; resolve CSS vars to actual
  // colors (ECharts uses canvas which can't parse `var(--...)`).
  const coloredNodes = nodes.map((n, i) => {
    const raw = n.itemStyle?.color ?? CATEGORICAL[i % CATEGORICAL.length];
    return {
      name: n.name,
      itemStyle: { color: resolveCssVarColor(raw) },
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: {
        data: { source?: string; target?: string; value?: number; name?: string };
      }) => {
        const d = params.data;
        if (d.source && d.target) {
          const src = labelByName[d.source] ?? d.source;
          const tgt = labelByName[d.target] ?? d.target;
          return `<strong>${src}</strong> → <strong>${tgt}</strong><br/>${
            currency ? formatDollars(d.value) : (d.value ?? 0).toLocaleString('en-US')
          }`;
        }
        const friendly = labelByName[d.name ?? ''] ?? d.name ?? '';
        return `<strong>${friendly}</strong>`;
      },
    },
    series: [
      {
        type: 'sankey',
        data: coloredNodes,
        links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { curveness: 0.55, color: 'gradient', opacity: 0.45 },
        label: {
          fontSize: 11,
          fontFamily: 'Calibri, Carlito, system-ui',
          color: resolveCssVarColor('hsl(var(--text-secondary))'),
          formatter: (p: { name: string }) => labelByName[p.name] ?? p.name,
        },
        nodeGap: 8,
        nodeWidth: 12,
        left: 8,
        right: 80,
        top: 8,
        bottom: 8,
      },
    ],
  };

  return <EChartsBase option={option} height={height} onClick={onClick} />;
}
