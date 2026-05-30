'use client';

import { useDuckDB } from '@/app/providers';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { formatDollars } from '@/lib/format';
import {
  type InstFySpark,
  type TopRecipient,
  sparklinesForCohort,
  topRecipientsByFy,
} from '@/lib/queries';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const FY = 2024;
const N = 15;
const FY_MIN = 2005;

export function HomeLeaderboard() {
  const { ready } = useDuckDB();
  const [top, setTop] = useState<TopRecipient[]>([]);
  const [sparks, setSparks] = useState<InstFySpark[]>([]);

  useEffect(() => {
    if (!ready) return;
    topRecipientsByFy(FY, N).then(setTop).catch(() => setTop([]));
  }, [ready]);

  useEffect(() => {
    if (!ready || top.length === 0) return;
    sparklinesForCohort(top.map((t) => t.institution_sk), FY_MIN, FY).then(setSparks).catch(() => setSparks([]));
  }, [ready, top]);

  // Pivot sparks: { institution_sk → [{x, y}] }
  const byInst = useMemo(() => {
    const m: Record<string, { x: number; y: number | null }[]> = {};
    for (const r of sparks) {
      if (!m[r.institution_sk]) m[r.institution_sk] = [];
      m[r.institution_sk].push({ x: r.fiscal_year, y: r.value });
    }
    return m;
  }, [sparks]);

  // Global max across all sparks so all sparklines share a y-scale (visual comparability)
  const sparkMax = useMemo(() => {
    let max = 0;
    for (const series of Object.values(byInst)) {
      for (const p of series) if (p.y !== null && p.y > max) max = p.y;
    }
    return max || 1;
  }, [byInst]);

  return (
    <section className="space-y-6">
      <ChartTitle
        eyebrow="Top 15 · FY2024"
        title="Where federal R&D landed in FY2024"
        subtitle="The 15 universities with the largest HERD-reported federal R&D in FY2024. Inline sparklines show 20-year trajectory; the highlighted dot marks FY2024."
        source="Sheet 07 · USD nominal"
      />
      <div className="rounded-md border border-rule bg-surface-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-text-secondary">
              <th className="text-left font-medium px-5 py-3 w-10">#</th>
              <th className="text-left font-medium px-5 py-3">Institution</th>
              <th className="text-left font-medium px-5 py-3 w-[200px]">FY2005 – FY2024</th>
              <th className="text-right font-medium px-5 py-3">FY2024 federal R&amp;D</th>
            </tr>
          </thead>
          <tbody>
            {top.map((inst, i) => {
              const spark = byInst[inst.institution_sk] ?? [];
              const norm = spark.map((p) => ({ x: p.x, y: p.y === null ? null : p.y / sparkMax }));
              return (
                <tr
                  key={inst.institution_sk}
                  className="border-b border-rule/60 last:border-0 hover:bg-accent-soft/40 transition-colors"
                >
                  <td className="px-5 py-3 text-text-tertiary tabular-nums font-mono text-xs">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/institution?sk=${encodeURIComponent(inst.institution_sk)}`}
                      className="hover:underline hover:text-accent focus:outline-none focus:underline"
                    >
                      {inst.canonical_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {norm.length > 1 ? (
                      <Sparkline data={norm} width={180} height={28} color="hsl(var(--accent))" />
                    ) : (
                      <span className="text-text-tertiary text-2xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-mono">
                    {formatDollars(inst.herd_federal_rd_usd_nominal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
