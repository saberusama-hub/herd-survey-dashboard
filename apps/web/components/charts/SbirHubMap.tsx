'use client';

import { formatUsd } from '@/lib/formatters';
import { STATE_FIPS_TO_ABBR } from '@/lib/us-states';
import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

export interface SbirHubPoint {
  firm_city: string;
  firm_state: string;
  awards: number;
  amount_real_m: number;
  top_topic: string | null;
  top_agency: string | null;
  lat: number;
  lon: number;
}

interface Props {
  /** State-level $ for the background choropleth, keyed by 2-letter abbr. */
  stateValues: Record<string, number>;
  /** Per-city hub points to overlay as dots. */
  hubs: SbirHubPoint[];
  /** How many top hubs to label inline (by $). Default 8. */
  labelTop?: number;
  height?: number;
}

// Reuse the national choropleth ramp for visual consistency.
const RAMP = ['hsl(var(--seq-1))', 'hsl(var(--seq-3))', 'hsl(var(--seq-4))', 'hsl(var(--seq-6))', 'hsl(var(--seq-7))'];

function bucketize(values: number[]): (v: number) => number {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return () => 0;
  const stops = [0.2, 0.4, 0.6, 0.8].map((q) => positive[Math.floor((positive.length - 1) * q)]);
  return (v: number) => {
    if (v <= 0) return -1;
    for (let i = 0; i < stops.length; i++) if (v <= stops[i]) return i;
    return stops.length;
  };
}

const TOPO_URL = '/us-states-10m.json';

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function SbirHubMap({ stateValues, hubs, labelTop = 8, height = 480 }: Props) {
  const [topo, setTopo] = useState<unknown>(null);
  const [hover, setHover] = useState<
    { kind: 'state'; abbr: string; value: number } | { kind: 'hub'; hub: SbirHubPoint } | null
  >(null);

  const bucketOf = useMemo(() => bucketize(Object.values(stateValues)), [stateValues]);

  // Radius scale: sqrt of $ so area is proportional to amount.
  const maxAmount = useMemo(() => hubs.reduce((m, h) => (h.amount_real_m > m ? h.amount_real_m : m), 1), [hubs]);
  const radiusOf = (m: number) => 3 + 13 * Math.sqrt(Math.max(0, m) / maxAmount);

  const labeledCities = useMemo(() => {
    return [...hubs]
      .sort((a, b) => b.amount_real_m - a.amount_real_m)
      .slice(0, labelTop)
      .map((h) => `${h.firm_city}|${h.firm_state}`);
  }, [hubs, labelTop]);
  const labeledSet = useMemo(() => new Set(labeledCities), [labeledCities]);

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
                const value = abbr ? (stateValues[abbr] ?? 0) : 0;
                const bucket = bucketOf(value);
                const fill = bucket < 0 ? 'hsl(var(--surface-elevated))' : RAMP[bucket];
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="hsl(var(--border))"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', filter: 'brightness(1.03)' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={() => abbr && setHover({ kind: 'state', abbr, value })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })
            }
          </Geographies>
          {hubs.map((h) => {
            const key = `${h.firm_city}|${h.firm_state}`;
            const r = radiusOf(h.amount_real_m);
            const labeled = labeledSet.has(key);
            return (
              <Marker key={key} coordinates={[h.lon, h.lat]}>
                <circle
                  r={r}
                  fill="hsl(var(--accent))"
                  fillOpacity={0.75}
                  stroke="white"
                  strokeWidth={0.6}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover({ kind: 'hub', hub: h })}
                  onMouseLeave={() => setHover(null)}
                />
                {labeled && (
                  <text
                    y={-r - 3}
                    textAnchor="middle"
                    className="fill-text-primary text-[10px] font-medium"
                    style={{ pointerEvents: 'none' }}
                  >
                    {titleCase(h.firm_city)}
                  </text>
                )}
              </Marker>
            );
          })}
        </ComposableMap>
      )}

      {hover && hover.kind === 'state' && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm">
          <div className="font-medium">{hover.abbr} (state total)</div>
          <div className="text-text-secondary tabular-nums">{formatUsd(hover.value)}</div>
        </div>
      )}
      {hover && hover.kind === 'hub' && (
        <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm">
          <div className="font-medium">
            {titleCase(hover.hub.firm_city)}, {hover.hub.firm_state}
          </div>
          <div className="text-text-secondary tabular-nums">
            ${hover.hub.amount_real_m.toFixed(1)}M · {hover.hub.awards.toLocaleString('en-US')} awards
          </div>
          {hover.hub.top_topic && (
            <div className="mt-1 text-text-tertiary">
              Top topic: <span className="text-text-secondary">{hover.hub.top_topic}</span>
            </div>
          )}
          {hover.hub.top_agency && (
            <div className="text-text-tertiary">
              Top agency: <span className="text-text-secondary">{hover.hub.top_agency}</span>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 text-2xs text-text-tertiary">
        <div className="flex items-center gap-1">
          <span>state $:</span>
          <span>less</span>
          {RAMP.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable color ramp
            <span key={i} className="inline-block h-3 w-4 border border-border" style={{ background: c }} />
          ))}
          <span>more</span>
        </div>
        <div className="flex items-center gap-2">
          <span>city hubs:</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'hsl(var(--accent))' }} />
            <span>area ∝ $</span>
          </span>
        </div>
      </div>
    </div>
  );
}
