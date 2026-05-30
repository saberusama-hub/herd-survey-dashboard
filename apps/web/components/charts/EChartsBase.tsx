'use client';

import * as echarts from 'echarts/core';
import { HeatmapChart, LineChart, SankeyChart, SunburstChart } from 'echarts/charts';
import {
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactECharts from 'echarts-for-react/lib/core';
import { useEffect, useState } from 'react';

echarts.use([
  SankeyChart,
  SunburstChart,
  LineChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  CalendarComponent,
  CanvasRenderer,
]);

interface Props {
  option: Record<string, unknown>;
  height?: number;
  className?: string;
  onClick?: (params: unknown) => void;
}

/**
 * Lightweight ECharts wrapper with theme-aware styling.
 *
 * Imported lazily via `dynamic(() => import('./EChartsBase'), { ssr: false })`
 * by chart-specific wrappers (Sankey, Sunburst, Ridgeline, etc.).
 */
export default function EChartsBase({ option, height = 360, className, onClick }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const update = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const events = onClick ? { click: onClick } : undefined;

  return (
    <ReactECharts
      echarts={echarts}
      option={option}
      style={{ height, width: '100%' }}
      className={className}
      theme={theme === 'dark' ? 'dark' : undefined}
      onEvents={events}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  );
}
