'use client';

import { useEffect, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { USStateMap } from '@/components/charts/USStateMap';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCount, formatPercent } from '@/lib/format';
import {
  type SbirAgency,
  type SbirDemographics,
  type SbirFirm,
  type SbirOverview,
  type SbirRiUni,
  type SbirState,
  type SbirYearStack,
  getSbirAgencies,
  getSbirDemographics,
  getSbirOverview,
  getSbirStates,
  getSbirTopFirms,
  getSbirTopRiUnis,
  getSbirYearStack,
} from '@/lib/queries';

export default function SbirPage() {
  const { ready } = useDuckDB();
  const [overview, setOverview] = useState<SbirOverview | null>(null);
  const [yearStack, setYearStack] = useState<SbirYearStack[]>([]);
  const [agencies, setAgencies] = useState<SbirAgency[]>([]);
  const [firms, setFirms] = useState<SbirFirm[]>([]);
  const [riUnis, setRiUnis] = useState<SbirRiUni[]>([]);
  const [states, setStates] = useState<SbirState[]>([]);
  const [demo, setDemo] = useState<SbirDemographics | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const [ov, ys, ag, fm, ri, st, dm] = await Promise.all([
        getSbirOverview(),
        getSbirYearStack(),
        getSbirAgencies(2020, 2024),
        getSbirTopFirms(2020, 2024, 15),
        getSbirTopRiUnis(2020, 2024, 15),
        getSbirStates(2024),
        getSbirDemographics(2020, 2024),
      ]);
      if (cancelled) return;
      setOverview(ov);
      setYearStack(ys);
      setAgencies(ag);
      setFirms(fm);
      setRiUnis(ri);
      setStates(st);
      setDemo(dm);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

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

      {/* Agencies */}
      <ChartFrame
        eyebrow="Federal agencies"
        title="SBIR / STTR by agency, FY2020-2024 cumulative"
        sources={[
          {
            id: 'sbir_sttr',
            subset:
              'Filter fiscal_year BETWEEN 2020 AND 2024, group by agency_name; two shares reported — share of award count and share of award $ (both ≤100%)',
          },
        ]}
        methodology={{
          what: 'Total real award dollars by federal agency over the most recent 5-year window, with shares of program total — one by number of awards, one by award $.',
          how: 'sheet_06_sbir_sttr filtered to fiscal_year BETWEEN 2020 AND 2024, grouped by agency_name. Awards share = agency award count ÷ total awards; $ share = agency $ ÷ total $. Each ≤100%; together each column sums to 100%.',
          caveats:
            'DOD typically takes ~50% of the program $ but a smaller share of award count; HHS (NIH-heavy) ~30%.',
        }}
      >
        <AgencyTable rows={agencies} />
      </ChartFrame>

      {/* Top firms */}
      <ChartFrame
        eyebrow="Top recipients"
        title="Top 15 firms by SBIR / STTR funding, FY2020-2024"
        sources={[
          {
            id: 'sbir_sttr',
            subset: 'Filter fiscal_year BETWEEN 2020 AND 2024, group by firm_name + firm_state, summed and ranked',
          },
        ]}
        methodology={{
          what: 'Firms ranked by total real award dollars over FY2020-2024.',
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
        title="Top 15 university research-institution (RI) partners, FY2020-2024"
        sources={[
          {
            id: 'sbir_sttr',
            subset: 'ri_canonical_name filtered non-null (RI partner named on award), grouped + summed FY2020–FY2024',
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

      {/* State geography */}
      <ChartFrame
        eyebrow="Geography"
        title="SBIR / STTR award $ by firm state, FY2024"
        sources={[
          {
            id: 'sbir_sttr',
            subset: 'Filter fiscal_year = 2024, group by firm_state, summed; choropleth fills by total real $',
          },
        ]}
        methodology={{
          what: 'Total FY2024 award dollars by the firm headquarters state.',
          how: 'sheet_06_sbir_sttr filtered to fiscal_year = 2024, grouped by firm_state.',
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
        title="Top 10 states by SBIR / STTR award $, FY2024"
        sources={[
          { id: 'sbir_sttr', subset: 'Filter fiscal_year = 2024, group by firm_state, summed and ranked top 10' },
        ]}
      >
        <StateTable rows={states.slice(0, 10)} />
      </ChartFrame>

      {/* Demographics */}
      <ChartFrame
        eyebrow="Demographic set-asides"
        title="Set-aside program participation, FY2020-2024"
        sources={[
          {
            id: 'sbir_sttr',
            subset:
              'Boolean flags is_woman_owned, is_hubzone, is_socially_economically_disadvantaged per award; share = flagged ÷ total awards FY2020–FY2024',
          },
        ]}
        methodology={{
          what: 'Share of awards going to small businesses that self-certify as woman-owned, HUBZone, or socially/economically disadvantaged.',
          how: 'Boolean flags is_woman_owned, is_hubzone, is_socially_economically_disadvantaged on each award row, summed and divided by the 5-year award total.',
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

function YearStackTable({ rows }: { rows: SbirYearStack[] }) {
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  const years = Array.from(new Set(rows.map((r) => r.fiscal_year))).sort((a, b) => b - a);
  const buckets = ['SBIR Phase I', 'SBIR Phase II', 'STTR Phase I', 'STTR Phase II'];
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.fiscal_year}|${r.program} ${r.phase}`, r.amount_real_m);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">FY</th>
            {buckets.map((b) => (
              <th key={b} className="py-2 px-3 font-medium text-right whitespace-nowrap">
                {b}
              </th>
            ))}
            <th className="py-2 pl-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const vals = buckets.map((b) => map.get(`${y}|${b}`) ?? 0);
            const total = vals.reduce((a, b) => a + b, 0);
            return (
              <tr key={y} className="border-b border-rule/60 hover:bg-mute-3/30">
                <td className="py-1.5 pr-4 tnum text-text-primary">FY{y}</td>
                {buckets.map((b, i) => (
                  <td key={`${y}-${b}`} className="py-1.5 px-3 text-right tnum text-text-secondary">
                    ${vals[i].toFixed(0)}M
                  </td>
                ))}
                <td className="py-1.5 pl-3 text-right tnum font-semibold text-text-primary">${total.toFixed(0)}M</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgencyTable({ rows }: { rows: SbirAgency[] }) {
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">Agency</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Awards</th>
            <th
              className="py-2 px-3 font-medium text-right whitespace-nowrap"
              title="Agency award count ÷ program-wide award count (FY2020–24). Sums to 100% across agencies."
            >
              Awards share
            </th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Total real $</th>
            <th
              className="py-2 pl-3 font-medium text-right whitespace-nowrap"
              title="Agency $ ÷ program-wide $ (FY2020–24). Sums to 100% across agencies."
            >
              $ share
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">Firm</th>
            <th className="py-2 px-3 font-medium">State</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Awards</th>
            <th className="py-2 pl-3 font-medium text-right whitespace-nowrap">Real $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
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
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">University RI</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Awards</th>
            <th className="py-2 pl-3 font-medium text-right whitespace-nowrap">Real $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
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
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">State</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Awards</th>
            <th className="py-2 pl-3 font-medium text-right whitespace-nowrap">Real $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
