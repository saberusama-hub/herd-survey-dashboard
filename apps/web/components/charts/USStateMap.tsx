'use client';

import { formatUsd } from '@/lib/formatters';
import { STATE_FIPS_TO_ABBR } from '@/lib/us-states';
import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

interface Props {
  /** Map of state 2-letter abbr → numeric value */
  values: Record<string, number>;
  /** Currently selected state (2-letter), if any */
  selected?: string | null;
  onSelect?: (abbr: string | null) => void;
  height?: number;
}

const TOPO_URL = '/us-states-10m.json';

/** Log-scale 5-step color ramp (light → deep teal). Subset of the design system's sequential teal. */
const RAMP = [
  'hsl(var(--seq-1))',
  'hsl(var(--seq-3))',
  'hsl(var(--seq-4))',
  'hsl(var(--seq-6))',
  'hsl(var(--seq-7))',
];

function bucketize(values: number[]): (v: number) => number {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return () => 0;
  // log-quantile thresholds
  const stops = [0.2, 0.4, 0.6, 0.8].map((q) => {
    const idx = Math.floor((positive.length - 1) * q);
    return positive[idx];
  });
  return (v: number) => {
    if (v <= 0) return -1;
    for (let i = 0; i < stops.length; i++) if (v <= stops[i]) return i;
    return stops.length;
  };
}

export function USStateMap({ values, selected, onSelect, height = 480 }: Props) {
  const [hover, setHover] = useState<{ abbr: string; value: number } | null>(null);

  const bucketOf = useMemo(() => bucketize(Object.values(values)), [values]);

  // Eagerly fetch topojson so first paint of the map has it ready (avoids a flash).
  const [topo, setTopo] = useState<unknown>(null);
  useEffect(() => {
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then(setTopo)
      .catch(() => setTopo(null));
  }, []);

  return (
    <div className="relative w-full" style={{ height }}>
      {topo === null && (
        <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-sm">Loading map…</div>
      )}
      {topo !== null && (
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={topo}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const fips = String(geo.id ?? geo.properties?.STATEFP ?? '').padStart(2, '0');
                const abbr = STATE_FIPS_TO_ABBR[fips]?.abbr ?? null;
                const value = abbr ? (values[abbr] ?? 0) : 0;
                const bucket = bucketOf(value);
                const fill = bucket < 0 ? 'hsl(var(--surface-elevated))' : RAMP[bucket];
                const isSelected = selected && abbr === selected;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke={isSelected ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', cursor: abbr ? 'pointer' : 'default', filter: 'brightness(1.05)' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={() => abbr && setHover({ abbr, value })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => abbr && onSelect?.(abbr === selected ? null : abbr)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      )}
      {hover && (
        <div className="absolute left-4 top-4 bg-surface-elevated border border-border rounded-md px-3 py-2 text-sm shadow-sm pointer-events-none">
          <div className="font-medium">{hover.abbr}</div>
          <div className="text-text-secondary tabular-nums">{formatUsd(hover.value)}</div>
        </div>
      )}
      <div className="absolute right-4 bottom-4 flex items-center gap-1 text-2xs text-text-tertiary">
        <span>less</span>
        {RAMP.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable color ramp
          <span key={i} className="inline-block w-4 h-3 border border-border" style={{ background: c }} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
