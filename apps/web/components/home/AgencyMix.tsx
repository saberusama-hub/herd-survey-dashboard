'use client';

import { useDuckDB } from '@/app/providers';
import { colorForAgency } from '@/components/charts/colors';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { formatDollars } from '@/lib/format';
import { type AgencyMixRow, fyAgencyMix } from '@/lib/queries';
import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const FY = 2024;

export function HomeAgencyMix() {
  const { ready } = useDuckDB();
  const [rows, setRows] = useState<AgencyMixRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    fyAgencyMix(FY).then(setRows).catch(() => setRows([]));
  }, [ready]);

  const total = useMemo(() => rows.reduce((s, r) => s + (r.total ?? 0), 0), [rows]);

  // Cap at 6 agencies + "Other" bucket so the donut stays legible
  const display = useMemo(() => {
    if (rows.length <= 7) return rows;
    const top = rows.slice(0, 6);
    const rest = rows.slice(6);
    const restTotal = rest.reduce((s, r) => s + (r.total ?? 0), 0);
    return [...top, { agency_name: 'Other', total: restTotal }];
  }, [rows]);

  return (
    <div className="space-y-5">
      <ChartTitle
        eyebrow={`FY${FY}`}
        title="Where federal R&D dollars go"
        subtitle="Federal R&D obligations to U.S. universities by top-level agency in FY2024. Click a slice to drill into an agency profile."
        source="Sheet 04 (federal R&D by agency)"
      />
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
        <div className="sm:col-span-2">
          {display.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={display}
                  dataKey="total"
                  nameKey="agency_name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={1}
                  stroke="hsl(var(--surface))"
                  strokeWidth={2}
                >
                  {display.map((d) => (
                    <Cell key={d.agency_name} fill={colorForAgency(d.agency_name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--surface-elevated))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [formatDollars(v), name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] animate-pulse bg-border/20 rounded-md" />
          )}
        </div>
        <div className="sm:col-span-3 space-y-1">
          {display.map((d) => {
            const pct = total ? (d.total ?? 0) / total : 0;
            return (
              <div
                key={d.agency_name}
                className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-accent-soft/40 rounded text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ background: colorForAgency(d.agency_name) }}
                  />
                  <span className="truncate" title={d.agency_name}>
                    {d.agency_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-text-tertiary text-2xs">{(pct * 100).toFixed(1)}%</span>
                  <span className="font-mono text-text-secondary">{formatDollars(d.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
