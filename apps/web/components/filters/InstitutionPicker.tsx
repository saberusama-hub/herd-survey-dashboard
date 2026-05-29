'use client';

import { useDuckDB } from '@/app/providers';
import { Badge } from '@/components/ui/Badge';
import { formatUsd } from '@/lib/formatters';
import { type InstitutionListItem, allInstitutions } from '@/lib/queries';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  onSelect: (sk: string) => void;
  placeholder?: string;
  /** Initial query string (e.g., from URL). */
  initialQuery?: string;
}

export function InstitutionPicker({ onSelect, placeholder = 'Search by name, state…', initialQuery = '' }: Props) {
  const { ready } = useDuckDB();
  const [all, setAll] = useState<InstitutionListItem[]>([]);
  const [q, setQ] = useState(initialQuery);

  useEffect(() => {
    if (!ready) return;
    allInstitutions()
      .then(setAll)
      .catch(() => setAll([]));
  }, [ready]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 50);
    return all
      .filter((i) => i.canonical_name.toLowerCase().includes(needle) || (i.state_code ?? '').toLowerCase() === needle)
      .slice(0, 50);
  }, [all, q]);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Search institutions</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full h-10 pl-10 pr-3 rounded-md border border-border bg-surface-elevated text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
      </label>
      <ul className="divide-y divide-border border border-border rounded-md bg-surface-elevated max-h-[480px] overflow-auto">
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-sm text-text-secondary text-center">
            {ready ? 'No institutions match.' : 'Loading…'}
          </li>
        ) : (
          filtered.map((inst) => (
            <li key={inst.institution_sk}>
              <button
                type="button"
                onClick={() => onSelect(inst.institution_sk)}
                className="w-full px-4 py-3 text-left hover:bg-accent-muted/40 focus:bg-accent-muted/40 focus:outline-none transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{inst.canonical_name}</div>
                  <div className="text-xs text-text-tertiary mt-0.5 flex items-center gap-2">
                    {inst.state_code && <Badge variant="outline">{inst.state_code}</Badge>}
                    {inst.sector && <span>{inst.sector}</span>}
                  </div>
                </div>
                <div className="text-right tabular-nums text-sm text-text-secondary shrink-0">
                  {formatUsd(inst.total_herd_federal_rd_usd_nominal)}
                  <div className="text-2xs text-text-tertiary">cumulative HERD federal</div>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
