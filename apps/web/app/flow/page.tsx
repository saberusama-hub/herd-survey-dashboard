'use client';

import { useDuckDB } from '@/app/providers';
import { LazyChart } from '@/components/charts/LazyChart';
import { Sankey, type SankeyLink, type SankeyNode } from '@/components/charts/Sankey';
import { colorForAgency } from '@/components/charts/colors';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartTitle } from '@/components/ui/ChartTitle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { formatDollars } from '@/lib/format';
import { type FlowRow, federalRdFlow } from '@/lib/queries';
import { useEffect, useMemo, useState } from 'react';

const FY_OPTIONS = Array.from({ length: 20 }, (_, i) => 2005 + i);

export default function FlowPage() {
  const { ready } = useDuckDB();
  const [fy, setFy] = useState(2024);
  const [mode, setMode] = useState<'nominal' | 'real'>('nominal');
  const [rows, setRows] = useState<FlowRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    federalRdFlow(fy).then(setRows).catch(() => setRows([]));
  }, [ready, fy]);

  const { nodes, links, total } = useMemo(() => {
    const valueKey = mode === 'real' ? 'amount_usd_real_2024' : 'amount_usd_nominal';
    const byNode = new Map<string, FlowRow>();
    for (const r of rows) byNode.set(r.node_id, r);

    // Find max level present so we can cap drawing depth (typically 2 = federal → agency → performer)
    const maxLevel = rows.reduce((m, r) => Math.max(m, r.level), 0);

    // Distinct node IDs that are referenced as a parent or have a non-null amount
    const nodeIds = new Set<string>();
    for (const r of rows) {
      nodeIds.add(r.node_id);
      if (r.parent_node_id) nodeIds.add(r.parent_node_id);
    }

    const builtNodes: SankeyNode[] = Array.from(nodeIds).map((id) => {
      const row = byNode.get(id);
      const display =
        row?.level === 0
          ? 'Federal R&D total'
          : row?.level === 1
            ? row.agency_name ?? id
            : row?.performer_category ?? id;
      const color =
        row?.level === 1 && row.agency_name
          ? colorForAgency(row.agency_name)
          : row?.level === 0
            ? 'hsl(var(--text-secondary))'
            : 'hsl(var(--seq-5))';
      return { name: display, itemStyle: { color } };
    });

    // Links: for each row with a parent, create a link from parent → self
    const builtLinks: SankeyLink[] = [];
    const idToDisplay = new Map<string, string>();
    for (const n of builtNodes) idToDisplay.set(n.name, n.name); // identity; ensure name is unique

    // Construct linkable display names by id
    const nameById = new Map<string, string>();
    for (const id of nodeIds) {
      const row = byNode.get(id);
      const name =
        row?.level === 0
          ? 'Federal R&D total'
          : row?.level === 1
            ? row.agency_name ?? id
            : row?.performer_category ?? id;
      nameById.set(id, name);
    }

    for (const r of rows) {
      if (!r.parent_node_id) continue;
      if (r.level > maxLevel) continue;
      const v = (r as Record<string, unknown>)[valueKey] as number | null | undefined;
      if (!v || v <= 0) continue;
      const sourceName = nameById.get(r.parent_node_id);
      const targetName = nameById.get(r.node_id);
      if (!sourceName || !targetName) continue;
      builtLinks.push({ source: sourceName, target: targetName, value: v });
    }

    const totalAmount = rows
      .filter((r) => r.level === 0)
      .reduce((s, r) => s + ((r as Record<string, unknown>)[valueKey] as number), 0);

    return { nodes: builtNodes, links: builtLinks, total: totalAmount };
  }, [rows, mode]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Federal flow"
        title="Where federal R&D dollars go"
        description="Sankey of FY-level federal R&D obligations from the Treasury all the way down to the performer category. Drag node positions to compare; hover for detail."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <ChartTitle
            eyebrow={`FY${fy}`}
            title="Federal → Agency → Performer"
            subtitle={`Total federal R&D obligations: ${formatDollars(total)} (${mode === 'real' ? 'FY2024 real' : 'nominal'} USD). Width of each ribbon equals its dollar share.`}
            source="Sheet 10 (federal R&D flow)"
            actions={
              <div className="flex items-center gap-2">
                <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FY_OPTIONS.slice()
                      .reverse()
                      .map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          FY{y}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={mode} onValueChange={(v) => setMode(v as 'nominal' | 'real')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nominal">Nominal $</SelectItem>
                    <SelectItem value="real">FY2024 real $</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          />
          <LazyChart height={520}>
            {rows.length > 0 ? (
              <Sankey nodes={nodes} links={links} height={520} />
            ) : (
              <div className="h-[520px] flex items-center justify-center text-text-tertiary text-sm">
                Loading flow data…
              </div>
            )}
          </LazyChart>
          <p className="t-small text-text-secondary leading-relaxed max-w-prose">
            Synthetic remainder rows in Sheet 10 represent agency obligations that the source data could not
            allocate to a named performer. They appear here for completeness and are visible if Federal Funds
            recorded a balance for that agency.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
