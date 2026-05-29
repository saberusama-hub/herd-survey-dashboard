'use client';

import { useDuckDB } from '@/app/providers';
import { formatCount, formatUsd } from '@/lib/formatters';
import { type HeadlineKpis, headlineKpis } from '@/lib/queries';
import { useEffect, useState } from 'react';

export function KpiStrip() {
  const { ready, error } = useDuckDB();
  const [k, setK] = useState<HeadlineKpis | null>(null);

  useEffect(() => {
    if (!ready) return;
    headlineKpis()
      .then(setK)
      .catch(() => setK(null));
  }, [ready]);

  if (error) {
    return <div className="text-negative text-sm">Failed to load data: {error.message}</div>;
  }

  const tiles = [
    { label: 'FY2024 Federal R&D', value: k ? formatUsd(k.fy2024_federal) : '—' },
    { label: 'Universities (HERD)', value: k ? formatCount(k.n_universities) : '—' },
    { label: 'Federal Agencies', value: k ? formatCount(k.n_agencies) : '—' },
    { label: 'Years Covered', value: k ? `${k.fy_min}–${k.fy_max}` : '—' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface-elevated p-6">
          <div className="h-card mb-2">{t.label}</div>
          <div className="text-3xl md:text-4xl font-medium tabular-nums tracking-tight">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
