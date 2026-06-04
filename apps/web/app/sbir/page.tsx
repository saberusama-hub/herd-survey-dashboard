'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { USStateMap } from '@/components/charts/USStateMap';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCount, formatPercent } from '@/lib/format';
import type {
  SbirAgency,
  SbirDemographics,
  SbirFirm,
  SbirOverview,
  SbirRiUni,
  SbirState,
  SbirYearStack,
} from '@/lib/queries';

const FY_MIN = 2005;
const FY_MAX = 2024;
const ALL_YEARS = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MAX - i);

interface SbirSnapshot {
  overview: SbirOverview;
  year_stack: SbirYearStack[];
  agency_facts: Array<{ fiscal_year: number; agency_name: string; n_awards: number; amount: number }>;
  firm_facts: Array<{
    fiscal_year: number;
    firm_name: string;
    firm_state: string | null;
    n_awards: number;
    amount_real_m: number;
  }>;
  ri_facts: Array<{ fiscal_year: number; ri_canonical_name: string; n_awards: number; amount_real_m: number }>;
  state_facts: Array<{ fiscal_year: number; firm_state: string; n_awards: number; amount_real_m: number }>;
  demo_facts: Array<{
    fiscal_year: number;
    total_awards: number;
    woman_owned: number;
    hubzone: number;
    disadvantaged: number;
  }>;
}

export default function SbirPage() {
  const [snapshot, setSnapshot] = useState<SbirSnapshot | null>(null);

  // FY window for the cumulative panels (Agency / Firms / RI unis /
  // Demographics). Single FY for the State map + leaderboard.
  const [windowStart, setWindowStart] = useState<number>(2020);
  const [windowEnd, setWindowEnd] = useState<number>(FY_MAX);
  const [stateYear, setStateYear] = useState<number>(FY_MAX);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/snapshots/sbir-snapshot.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SbirSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const winLo = Math.min(windowStart, windowEnd);
  const winHi = Math.max(windowStart, windowEnd);
  const winLabel = winLo === winHi ? `FY${winLo}` : `FY${winLo}–${winHi}`;

  // Derived per-window aggregations: sum per-year facts over the chosen
  // window. Was a DuckDB roundtrip; now <5 ms client-side reduce.
  const overview = snapshot?.overview ?? null;
  const yearStack = snapshot?.year_stack ?? [];

  const agencies = useMemo<SbirAgency[]>(() => {
    const f = snapshot?.agency_facts ?? [];
    const byAgency = new Map<string, { n: number; amt: number }>();
    for (const r of f) {
      if (r.fiscal_year < winLo || r.fiscal_year > winHi) continue;
      const cur = byAgency.get(r.agency_name) ?? { n: 0, amt: 0 };
      cur.n += r.n_awards;
      cur.amt += r.amount;
      byAgency.set(r.agency_name, cur);
    }
    const totalAmt = [...byAgency.values()].reduce((s, x) => s + x.amt, 0);
    const totalN = [...byAgency.values()].reduce((s, x) => s + x.n, 0);
    return [...byAgency.entries()]
      .map(([agency_name, { n, amt }]) => ({
        agency_name,
        n_awards: n,
        amount_real_b: amt / 1e9,
        share_pct: totalAmt > 0 ? (amt / totalAmt) * 100 : 0,
        share_n_pct: totalN > 0 ? (n / totalN) * 100 : 0,
      }))
      .sort((a, b) => b.amount_real_b - a.amount_real_b);
  }, [snapshot, winLo, winHi]);

  const firms = useMemo<SbirFirm[]>(() => {
    const f = snapshot?.firm_facts ?? [];
    const byFirm = new Map<string, { state: string | null; n: number; amt: number }>();
    for (const r of f) {
      if (r.fiscal_year < winLo || r.fiscal_year > winHi) continue;
      const cur = byFirm.get(r.firm_name) ?? { state: r.firm_state, n: 0, amt: 0 };
      cur.n += r.n_awards;
      cur.amt += r.amount_real_m;
      byFirm.set(r.firm_name, cur);
    }
    return [...byFirm.entries()]
      .map(([firm_name, { state, n, amt }]) => ({
        firm_name,
        firm_state: state,
        n_awards: n,
        amount_real_m: amt,
      }))
      .sort((a, b) => b.amount_real_m - a.amount_real_m)
      .slice(0, 15);
  }, [snapshot, winLo, winHi]);

  const riUnis = useMemo<SbirRiUni[]>(() => {
    const f = snapshot?.ri_facts ?? [];
    const byRi = new Map<string, { n: number; amt: number }>();
    for (const r of f) {
      if (r.fiscal_year < winLo || r.fiscal_year > winHi) continue;
      const cur = byRi.get(r.ri_canonical_name) ?? { n: 0, amt: 0 };
      cur.n += r.n_awards;
      cur.amt += r.amount_real_m;
      byRi.set(r.ri_canonical_name, cur);
    }
    return [...byRi.entries()]
      .map(([ri_canonical_name, { n, amt }]) => ({ ri_canonical_name, n_awards: n, amount_real_m: amt }))
      .sort((a, b) => b.amount_real_m - a.amount_real_m)
      .slice(0, 15);
  }, [snapshot, winLo, winHi]);

  const demo = useMemo<SbirDemographics | null>(() => {
    const f = snapshot?.demo_facts ?? [];
    let total = 0;
    let woman = 0;
    let hub = 0;
    let disadv = 0;
    for (const r of f) {
      if (r.fiscal_year < winLo || r.fiscal_year > winHi) continue;
      total += r.total_awards;
      woman += r.woman_owned;
      hub += r.hubzone;
      disadv += r.disadvantaged;
    }
    if (total === 0) return null;
    return {
      total_awards: total,
      woman_owned: woman,
      hubzone: hub,
      disadvantaged: disadv,
      woman_pct: (woman * 100) / total,
      hubzone_pct: (hub * 100) / total,
      disadvantaged_pct: (disadv * 100) / total,
    };
  }, [snapshot, winLo, winHi]);

  const states = useMemo<SbirState[]>(() => {
    const f = snapshot?.state_facts ?? [];
    return f
      .filter((r) => r.fiscal_year === stateYear)
      .map((r) => ({
        firm_state: r.firm_state,
        n_awards: r.n_awards,
        amount_real_m: r.amount_real_m,
      }))
      .sort((a, b) => b.amount_real_m - a.amount_real_m);
  }, [snapshot, stateYear]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Small business innovation"
        title="SBIR / STTR awards"
        description="20 years of Small Business Innovation Research and Small Business Technology Transfer awards across 11 federal agencies. Awards go to firms, often with a university research-institution partner (mandatory for STTR)."
      />

      {!overview ? (
        <p className="text-sm text-text-tertiary">Loading SBIR data layer…</p>
      ) : (
        <div className="space-y-4">
          <KpiStrip
            cols={4}
            tiles={[
              {
                label: 'Total awards FY05-24',
                value: formatCount(overview.n_awards),
                hint: `FY${overview.fy_min}–${overview.fy_max}`,
                sources: [
                  { id: 'sbir_sttr', subset: 'All SBIR + STTR Phase I/II awards across 11 agencies, FY2005–FY2024' },
                ],
              },
              {
                label: 'Real cumulative $',
                value: `$${overview.total_real_b.toFixed(1)}B`,
                hint: 'Inflation-adjusted to FY2024',
                sources: [
                  { id: 'sbir_sttr', subset: 'Award amounts FY2005–FY2024, summed' },
                  { id: 'bls_cpi_u', subset: 'Series CUUR0000SA0 annual averages, FY2024 base' },
                ],
              },
              {
                label: 'Unique firms',
                value: formatCount(overview.n_firms),
                hint: 'Small businesses awarded',
                sources: [{ id: 'sbir_sttr', subset: 'COUNT(DISTINCT firm_name) across all awards FY2005–FY2024' }],
              },
              {
                label: 'University RI partners',
                value: formatCount(overview.n_ri_unis),
                hint: 'Research institutions on STTR / collaborative SBIR',
                sources: [
                  {
                    id: 'sbir_sttr',
                    subset: 'COUNT(DISTINCT ri_canonical_name) where research institution is named on award',
                  },
                ],
              },
            ]}
          />
          <KpiStrip
            cols={2}
            tiles={[
              {
                label: 'FY2024 total',
                value: `$${(overview.fy24_total_real_m / 1000).toFixed(1)}B`,
                hint: `${formatCount(overview.fy24_n_awards)} awards across ${overview.n_agencies} agencies`,
                sources: [{ id: 'sbir_sttr', subset: 'Award amounts filtered to fiscal_year = 2024' }],
              },
              {
                label: 'Avg award FY2024',
                value: `$${((overview.fy24_total_real_m * 1000) / overview.fy24_n_awards / 1000).toFixed(0)}K`,
                hint: 'Total ÷ award count',
                sources: [{ id: 'sbir_sttr', subset: 'Total FY2024 $ ÷ FY2024 award count' }],
              },
            ]}
          />
        </div>
      )}

      {/* Year timeline */}
      <ChartFrame
        eyebrow="20-year trend"
        title="Annual SBIR / STTR award $, by program × phase"
        sources={[
          { id: 'sbir_sttr', subset: 'Award amount summed by fiscal_year × program × phase, FY2005–FY2024' },
          { id: 'bls_cpi_u', subset: 'Series CUUR0000SA0 annual averages used to convert nominal → FY2024 real $' },
        ]}
        methodology={{
          what: 'Total award dollars per fiscal year, stacked by program (SBIR vs STTR) and phase (I = feasibility, II = R&D execution).',
          how: 'Sum of award_amount_real_2024 from sheet_06_sbir_sttr, grouped by fiscal_year × program × phase. All amounts adjusted to FY2024 dollars via BLS CPI-U.',
          caveats:
            'Phase III awards (commercialization, non-federal-funded) are excluded from the source data. STTR awards have a mandatory research-institution partner; SBIR optional.',
        }}
      >
        <YearStackTable rows={yearStack} />
      </ChartFrame>

      {/* Cumulative-window selector for the four panels below */}
      <WindowPicker windowStart={windowStart} windowEnd={windowEnd} onStart={setWindowStart} onEnd={setWindowEnd} />

      {/* Agencies */}
      <ChartFrame
        eyebrow="Federal agencies"
        title={`SBIR / STTR by agency, ${winLabel} cumulative`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `Filter fiscal_year BETWEEN ${winLo} AND ${winHi}, group by agency_name; two shares reported — share of award count and share of award $ (both ≤100%)`,
          },
        ]}
        methodology={{
          what: `Total real award dollars by federal agency over ${winLabel}, with shares of program total — one by number of awards, one by award $.`,
          how: `sheet_06_sbir_sttr filtered to fiscal_year BETWEEN ${winLo} AND ${winHi}, grouped by agency_name. Awards share = agency award count ÷ total awards; $ share = agency $ ÷ total $. Each ≤100%; together each column sums to 100%.`,
          caveats:
            'DOD typically takes ~50% of the program $ but a smaller share of award count; HHS (NIH-heavy) ~30%.',
        }}
      >
        <AgencyTable rows={agencies} />
      </ChartFrame>

      {/* Top firms */}
      <ChartFrame
        eyebrow="Top recipients"
        title={`Top 15 firms by SBIR / STTR funding, ${winLabel}`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `Filter fiscal_year BETWEEN ${winLo} AND ${winHi}, group by firm_name + firm_state, summed and ranked`,
          },
        ]}
        methodology={{
          what: `Firms ranked by total real award dollars over ${winLabel}.`,
          how: 'sheet_06_sbir_sttr grouped by firm_name + firm_state, summed and ranked.',
          caveats:
            'Firm-name dedup is exact-string; corporate-relationship dedup (parent vs subsidiary) is not applied. Some firms appear under multiple capitalizations.',
        }}
      >
        <FirmTable rows={firms} />
      </ChartFrame>

      {/* Top RI universities */}
      <ChartFrame
        eyebrow="University research partners"
        title={`Top 15 university research-institution (RI) partners, ${winLabel}`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `ri_canonical_name filtered non-null (RI partner named on award), grouped + summed FY${winLo}–FY${winHi}`,
          },
        ]}
        methodology={{
          what: 'Universities that appear as research-institution partners on the most SBIR / STTR awards. STTR mandates an RI partner; SBIR allows one.',
          how: 'sheet_06_sbir_sttr.ri_canonical_name (filtered for non-null), grouped and summed.',
          caveats:
            'The RI name is self-reported on the award application and is not joined to dim_institution_sk for ~50% of rows (entity resolution gap on small-grant data). Treat names as approximate.',
        }}
      >
        <RiUniTable rows={riUnis} />
      </ChartFrame>

      {/* Single-FY selector for the geography panels */}
      <SingleYearPicker year={stateYear} onChange={setStateYear} />

      {/* State geography */}
      <ChartFrame
        eyebrow="Geography"
        title={`SBIR / STTR award $ by firm state, FY${stateYear}`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `Filter fiscal_year = ${stateYear}, group by firm_state, summed; choropleth fills by total real $`,
          },
        ]}
        methodology={{
          what: `Total FY${stateYear} award dollars by the firm headquarters state.`,
          how: `sheet_06_sbir_sttr filtered to fiscal_year = ${stateYear}, grouped by firm_state.`,
          caveats:
            'CA + MA together routinely capture ~40% of the national total. Reflects firm HQ, not award performance location.',
        }}
      >
        {states.length === 0 ? (
          <p className="text-sm text-text-tertiary">Loading…</p>
        ) : (
          <USStateMap values={Object.fromEntries(states.map((s) => [s.firm_state, s.amount_real_m]))} height={400} />
        )}
      </ChartFrame>

      {/* State table */}
      <ChartFrame
        eyebrow="State leaderboard"
        title={`Top 10 states by SBIR / STTR award $, FY${stateYear}`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `Filter fiscal_year = ${stateYear}, group by firm_state, summed and ranked top 10`,
          },
        ]}
      >
        <StateTable rows={states.slice(0, 10)} />
      </ChartFrame>

      {/* Demographics — uses cumulative window */}
      <ChartFrame
        eyebrow="Demographic set-asides"
        title={`Set-aside program participation, ${winLabel}`}
        sources={[
          {
            id: 'sbir_sttr',
            subset: `Boolean flags is_woman_owned, is_hubzone, is_socially_economically_disadvantaged per award; share = flagged ÷ total awards FY${winLo}–FY${winHi}`,
          },
        ]}
        methodology={{
          what: 'Share of awards going to small businesses that self-certify as woman-owned, HUBZone, or socially/economically disadvantaged.',
          how: `Boolean flags is_woman_owned, is_hubzone, is_socially_economically_disadvantaged on each award row, summed and divided by the ${winLabel} award total.`,
          caveats:
            'Categories overlap (a firm can certify multiple). Reflects firm self-certification at award time, not verified status.',
        }}
      >
        {demo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DemoCard label="Woman-owned" count={demo.woman_owned} pct={demo.woman_pct} total={demo.total_awards} />
            <DemoCard label="HUBZone" count={demo.hubzone} pct={demo.hubzone_pct} total={demo.total_awards} />
            <DemoCard
              label="Socially / economically disadvantaged"
              count={demo.disadvantaged}
              pct={demo.disadvantaged_pct}
              total={demo.total_awards}
            />
          </div>
        )}
      </ChartFrame>
    </div>
  );
}

interface YearStackRow {
  fy: number;
  sbir1: number;
  sbir2: number;
  sttr1: number;
  sttr2: number;
  total: number;
}

function WindowPicker({
  windowStart,
  windowEnd,
  onStart,
  onEnd,
}: {
  windowStart: number;
  windowEnd: number;
  onStart: (y: number) => void;
  onEnd: (y: number) => void;
}) {
  const startId = useId();
  const endId = useId();
  return (
    <div className="-mb-2 flex flex-col gap-2 rounded-md border border-rule bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Cumulative window</p>
      <div className="flex items-center gap-2">
        <label htmlFor={startId} className="text-xs text-text-tertiary">
          From
        </label>
        <select
          id={startId}
          value={windowStart}
          onChange={(e) => onStart(Number(e.target.value))}
          className="h-7 w-24 rounded border border-rule bg-surface px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_YEARS.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
        <label htmlFor={endId} className="text-xs text-text-tertiary">
          to
        </label>
        <select
          id={endId}
          value={windowEnd}
          onChange={(e) => onEnd(Number(e.target.value))}
          className="h-7 w-24 rounded border border-rule bg-surface px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_YEARS.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
      </div>
      <span className="text-[11px] italic text-text-tertiary">
        Drives the Agency, Top firms, RI partners, and Demographics panels below.
      </span>
    </div>
  );
}

function SingleYearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const id = useId();
  return (
    <div className="-mb-2 flex flex-col gap-2 rounded-md border border-rule bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">State view year</p>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-text-tertiary">
          FY
        </label>
        <select
          id={id}
          value={year}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-24 rounded border border-rule bg-surface px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_YEARS.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>
      </div>
      <span className="text-[11px] italic text-text-tertiary">
        Drives both the choropleth map and the state leaderboard below.
      </span>
    </div>
  );
}

function YearStackTable({ rows }: { rows: SbirYearStack[] }) {
  const buckets = ['SBIR Phase I', 'SBIR Phase II', 'STTR Phase I', 'STTR Phase II'] as const;
  const years = Array.from(new Set(rows.map((r) => r.fiscal_year)));
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.fiscal_year}|${r.program} ${r.phase}`, r.amount_real_m);
  const flatRows: YearStackRow[] = years.map((fy) => {
    const sbir1 = map.get(`${fy}|SBIR Phase I`) ?? 0;
    const sbir2 = map.get(`${fy}|SBIR Phase II`) ?? 0;
    const sttr1 = map.get(`${fy}|STTR Phase I`) ?? 0;
    const sttr2 = map.get(`${fy}|STTR Phase II`) ?? 0;
    return { fy, sbir1, sbir2, sttr1, sttr2, total: sbir1 + sbir2 + sttr1 + sttr2 };
  });
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(flatRows, {
    initial: { key: 'fy', dir: 'desc' },
    accessors: {
      fy: (r) => r.fy,
      sbir1: (r) => r.sbir1,
      sbir2: (r) => r.sbir2,
      sttr1: (r) => r.sttr1,
      sttr2: (r) => r.sttr2,
      total: (r) => r.total,
    },
    defaultDir: { fy: 'desc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  const bucketKeys = ['sbir1', 'sbir2', 'sttr1', 'sttr2'] as const;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="fy" sort={sort} onSort={requestSort} className="py-2 pr-4">
              FY
            </SortableTh>
            {buckets.map((label, i) => (
              <SortableTh
                key={label}
                sortKey={bucketKeys[i]}
                sort={sort}
                onSort={requestSort}
                align="right"
                className="py-2 px-3 whitespace-nowrap"
              >
                {label}
              </SortableTh>
            ))}
            <SortableTh sortKey="total" sort={sort} onSort={requestSort} align="right" className="py-2 pl-3">
              Total
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.fy} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 tnum text-text-primary">FY{r.fy}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">${r.sbir1.toFixed(0)}M</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">${r.sbir2.toFixed(0)}M</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">${r.sttr1.toFixed(0)}M</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">${r.sttr2.toFixed(0)}M</td>
              <td className="py-1.5 pl-3 text-right tnum font-semibold text-text-primary">${r.total.toFixed(0)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgencyTable({ rows }: { rows: SbirAgency[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'amount_real_b', dir: 'desc' },
    accessors: {
      agency_name: (r) => r.agency_name.toLowerCase(),
      n_awards: (r) => r.n_awards,
      share_n_pct: (r) => r.share_n_pct,
      amount_real_b: (r) => r.amount_real_b,
      share_pct: (r) => r.share_pct,
    },
    defaultDir: { agency_name: 'asc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="agency_name" sort={sort} onSort={requestSort} className="py-2 pr-4">
              Agency
            </SortableTh>
            <SortableTh
              sortKey="n_awards"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Awards
            </SortableTh>
            <SortableTh
              sortKey="share_n_pct"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
              title="Agency award count ÷ program-wide award count (FY2020–24). Sums to 100% across agencies."
            >
              Awards share
            </SortableTh>
            <SortableTh
              sortKey="amount_real_b"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Total real $
            </SortableTh>
            <SortableTh
              sortKey="share_pct"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
              title="Agency $ ÷ program-wide $ (FY2020–24). Sums to 100% across agencies."
            >
              $ share
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.agency_name} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">{r.agency_name}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.n_awards)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {formatPercent(r.share_n_pct, { source: 'percent' })}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">${r.amount_real_b.toFixed(2)}B</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">
                {formatPercent(r.share_pct, { source: 'percent' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FirmTable({ rows }: { rows: SbirFirm[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'amount_real_m', dir: 'desc' },
    accessors: {
      firm_name: (r) => r.firm_name.toLowerCase(),
      firm_state: (r) => r.firm_state ?? '',
      n_awards: (r) => r.n_awards,
      amount_real_m: (r) => r.amount_real_m,
    },
    defaultDir: { firm_name: 'asc', firm_state: 'asc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="firm_name" sort={sort} onSort={requestSort} className="py-2 pr-4">
              Firm
            </SortableTh>
            <SortableTh sortKey="firm_state" sort={sort} onSort={requestSort} className="py-2 px-3">
              State
            </SortableTh>
            <SortableTh
              sortKey="n_awards"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Awards
            </SortableTh>
            <SortableTh
              sortKey="amount_real_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Real $
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.firm_name}|${i}`} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">{r.firm_name}</td>
              <td className="py-1.5 px-3 text-text-secondary">{r.firm_state}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.n_awards)}</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-primary">${r.amount_real_m.toFixed(1)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiUniTable({ rows }: { rows: SbirRiUni[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'amount_real_m', dir: 'desc' },
    accessors: {
      ri_canonical_name: (r) => r.ri_canonical_name.toLowerCase(),
      n_awards: (r) => r.n_awards,
      amount_real_m: (r) => r.amount_real_m,
    },
    defaultDir: { ri_canonical_name: 'asc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="ri_canonical_name" sort={sort} onSort={requestSort} className="py-2 pr-4">
              University RI
            </SortableTh>
            <SortableTh
              sortKey="n_awards"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Awards
            </SortableTh>
            <SortableTh
              sortKey="amount_real_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Real $
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.ri_canonical_name}|${i}`} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">{r.ri_canonical_name}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.n_awards)}</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-primary">${r.amount_real_m.toFixed(1)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StateTable({ rows }: { rows: SbirState[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'amount_real_m', dir: 'desc' },
    accessors: {
      firm_state: (r) => r.firm_state,
      n_awards: (r) => r.n_awards,
      amount_real_m: (r) => r.amount_real_m,
    },
    defaultDir: { firm_state: 'asc' },
  });
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="firm_state" sort={sort} onSort={requestSort} className="py-2 pr-4">
              State
            </SortableTh>
            <SortableTh
              sortKey="n_awards"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Awards
            </SortableTh>
            <SortableTh
              sortKey="amount_real_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Real $
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.firm_state} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">{r.firm_state}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.n_awards)}</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-primary">${r.amount_real_m.toFixed(1)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemoCard({
  label,
  count,
  pct,
  total,
}: {
  label: string;
  count: number;
  pct: number;
  total: number;
}) {
  return (
    <div className="rounded border border-rule bg-surface p-4 space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="t-num text-text-primary text-2xl">{formatPercent(pct, { source: 'percent' })}</p>
      <p className="text-xs text-text-secondary tnum">
        {formatCount(count)} of {formatCount(total)} awards
      </p>
    </div>
  );
}
