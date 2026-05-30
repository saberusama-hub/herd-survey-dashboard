'use client';

import { CATEGORICAL, resolveCssVarColor } from '@/components/charts/colors';
import { formatDollars } from '@/lib/format';
import dynamic from 'next/dynamic';

const EChartsBase = dynamic(() => import('./EChartsBase'), { ssr: false });

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
  itemStyle?: { color: string };
}

interface Props {
  data: SunburstNode[];
  height?: number;
  currency?: boolean;
  onClick?: (params: unknown) => void;
}

/** ECharts Sunburst — hierarchical drilldown (spec section 5.4 agency tabs). */
export function Sunburst({ data, height = 480, currency = true, onClick }: Props) {
  // Recursively assign categorical colors to root-level nodes and resolve
  // CSS variables (canvas can't parse `var(--...)`).
  const colored = data.map((d, i) => ({
    ...d,
    itemStyle: {
      color: resolveCssVarColor(d.itemStyle?.color ?? CATEGORICAL[i % CATEGORICAL.length]),
    },
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: { data: { name: string; value?: number } }) => {
        const d = params.data;
        return `<strong>${d.name}</strong><br/>${currency ? formatDollars(d.value) : (d.value ?? 0).toLocaleString('en-US')}`;
      },
    },
    series: [
      {
        type: 'sunburst',
        data: colored,
        radius: [0, '90%'],
        sort: 'desc',
        emphasis: { focus: 'ancestor' },
        label: {
          rotate: 'radial',
          fontFamily: 'Calibri, Carlito, system-ui',
          fontSize: 11,
          color: resolveCssVarColor('hsl(var(--text-secondary))'),
        },
        levels: [
          {},
          { r0: 0, r: '35%', label: { rotate: 0 } },
          { r0: '35%', r: '70%' },
          { r0: '70%', r: '90%', label: { position: 'outside', padding: 3, silent: false } },
        ],
      },
    ],
  };

  return <EChartsBase option={option} height={height} onClick={onClick} />;
}
