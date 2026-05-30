'use client';

import { CATEGORICAL } from '@/components/charts/colors';
import { formatDollars } from '@/lib/format';
import dynamic from 'next/dynamic';

const EChartsBase = dynamic(() => import('./EChartsBase'), { ssr: false });

export interface SankeyNode {
  name: string;
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
  // Auto-color nodes if no explicit color set
  const coloredNodes = nodes.map((n, i) => ({
    ...n,
    itemStyle: n.itemStyle ?? { color: CATEGORICAL[i % CATEGORICAL.length] },
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: { data: { source?: string; target?: string; value?: number; name?: string } }) => {
        const d = params.data;
        if (d.source && d.target) {
          return `<strong>${d.source}</strong> → <strong>${d.target}</strong><br/>${currency ? formatDollars(d.value) : (d.value ?? 0).toLocaleString('en-US')}`;
        }
        return `<strong>${d.name}</strong>`;
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
          fontFamily: 'var(--font-sans), system-ui',
          color: 'hsl(var(--text-secondary))',
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
