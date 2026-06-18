'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { PatentHubMap, type PatentHubPoint, type PatentMetricKey } from '@/components/charts/PatentHubMap';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCount, formatPercent } from '@/lib/format';

const CY_MIN = 2005;
const CY_MAX = 2025;
const ALL_YEARS = Array.from({ length: CY_MAX - CY_MIN + 1 }, (_, i) => CY_MAX - i);

interface YearRow {
  fiscal_year: number;
  granted: number;
  filed: number;
  fed_funded_granted: number | null;
  fed_funded_share: number | null;
  applications_truncated: boolean;
  citations_truncated: boolean;
}

interface TopRow {
  institution_sk: string;
  canonical_name: string;
  granted_5yr: number;
  filed_4yr: number | null;
  fed_share: number | null;
  industry_co_share: number | null;
  avg_cites_5yr: number | null;
  fed_rd_5yr_M: number | null;
  patents_per_M_fed_rd: number | null;
}

interface CpcRow {
  cpc_section: string;
  n_inst: number;
  granted: number;
  share_of_fy24: number;
}

interface StateFact {
  state_code: string;
  fiscal_year: number;
  granted: number | null;
  filed: number | null;
  n_institutions: number | null;
}

interface HubFact extends PatentHubPoint {
  fiscal_year: number;
}

interface IpSnapshot {
  overview: {
    total_granted_05_24: number;
    total_filed_05_23: number;
    n_institutions: number;
    fy24_granted: number;
    fy23_filed: number;
    fy24_fed_funded: number;
    fy20_avg_cites_5yr: number | null;
    fy24_avg_industry_co_share: number | null;
  };
  year_stack: YearRow[];
  top_institutions: TopRow[];
  cpc_mix: CpcRow[];
  fed_funded_trend: Array<{
    fiscal_year: number;
    fed_funded_share: number | null;
    fed_funded_count: number | null;
    total_granted: number | null;
  }>;
  state_facts: StateFact[];
  hub_facts: HubFact[];
  generated_at: string;
  cohort_note: string;
}

const CPC_SECTION_NAMES: Record<string, string> = {
  A: 'A · Human necessities (life sciences, medical, agri)',
  B: 'B · Performing operations / transporting',
  C: 'C · Chemistry, metallurgy, materials',
  D: 'D · Textiles, paper',
  E: 'E · Fixed constructions',
  F: 'F · Mechanical engineering, lighting, heating',
  G: 'G · Physics (instruments, computing)',
  H: 'H · Electricity',
};

export default function PatentsPage() {
  const [snapshot, setSnapshot] = useState<IpSnapshot | null>(null);
  const [windowStart, setWindowStart] = useState<number>(2020);
  const [windowEnd, setWindowEnd] = useState<number>(2024);
  // Geography section: single-CY picker + metric toggle.
  const [geoYear, setGeoYear] = useState<number>(2024);
  const [geoMetric, setGeoMetric] = useState<PatentMetricKey>('granted');

  useEffect(() => {
    let cancelled = false;
    fetch('/data/snapshots/ip-snapshot.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: IpSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const winLo = Math.min(windowStart, windowEnd);
  const winHi = Math.max(windowStart, windowEnd);
  const winLabel = winLo === winHi ? `CY${winLo}` : `CY${winLo}–${winHi}`;

  // Derived: per-window rollup of the top institutions table from the
  // 5-year cached top-50 (which is CY2020-CY2024). If the user picks a
  // different window we recompute client-side from the year_stack — but
  // top-institutions is precomputed for the 5yr mature cohort only, so
  // outside that window the table just collapses to "Adjust to CY2020–24
  // to see the leaderboard." This keeps the snapshot small.
  const showTopInstitutions = winLo === 2020 && winHi === 2024;

  const overview = snapshot?.overview ?? null;
  const yearStack = snapshot?.year_stack ?? [];

  // Cap displayed years at CY2025 — CY2026 is half-cycle bleed.
  const displayYearStack = useMemo(
    () => yearStack.filter((r) => r.fiscal_year >= CY_MIN && r.fiscal_year <= CY_MAX),
    [yearStack],
  );

  // Geography slices for the active year + metric.
  const stateValuesByAbbr = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!snapshot) return out;
    for (const s of snapshot.state_facts) {
      if (s.fiscal_year !== geoYear) continue;
      const v = geoMetric === 'granted' ? s.granted : s.filed;
      if (v !== null && v !== undefined) out[s.state_code] = Number(v);
    }
    return out;
  }, [snapshot, geoYear, geoMetric]);

  const geoHubs = useMemo<PatentHubPoint[]>(() => {
    if (!snapshot) return [];
    return snapshot.hub_facts
      .filter((h) => h.fiscal_year === geoYear)
      .map((h) => ({
        city: h.city,
        state_code: h.state_code,
        granted: Number(h.granted) || 0,
        filed: Number(h.filed) || 0,
        lat: h.lat,
        lon: h.lon,
      }));
  }, [snapshot, geoYear]);

  // Top 15 hubs by the active metric, for the leaderboard table below the map.
  const topHubs = useMemo(() => {
    const value = (h: PatentHubPoint) => (geoMetric === 'granted' ? h.granted : h.filed);
    return [...geoHubs]
      .filter((h) => value(h) > 0)
      .sort((a, b) => value(b) - value(a))
      .slice(0, 15);
  }, [geoHubs, geoMetric]);

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="University inventions"
        title="U.S. utility patents"
        description="20 years of granted patents and pre-grant publications from the ~471 HERD universities matched into USPTO PatentsView. Includes federally-funded share, university–industry co-assignment, 5-year forward citations, and the primary CPC technology mix."
      />

      {!overview ? (
        <p className="text-sm text-text-tertiary">Loading patent data layer…</p>
      ) : (
        <div className="space-y-4">
          <KpiStrip
            cols={4}
            tiles={[
              {
                label: 'Granted patents CY05-24',
                value: formatCount(overview.total_granted_05_24),
                hint: `Across ${formatCount(overview.n_institutions)} HERD institutions`,
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'SUM(patents_granted) from sheet_13_ip_patents over CY2005–CY2024, all matched HERD assignees',
                  },
                ],
              },
              {
                label: 'Applications filed CY05-23',
                value: formatCount(overview.total_filed_05_23),
                hint: 'Pre-grant publications (PGPub) proxy',
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'SUM(applications_filed) from PVPGPUBDIS — filed CY at first publication. CY2024+ truncated by ~18-month PGPub lag.',
                  },
                ],
              },
              {
                label: 'Federally-funded share CY24',
                value: formatPercent(
                  overview.fy24_granted > 0 ? overview.fy24_fed_funded / overview.fy24_granted : null,
                ),
                hint: `${formatCount(overview.fy24_fed_funded)} of ${formatCount(overview.fy24_granted)} CY2024 patents`,
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'patents_granted_fed_funded ÷ patents_granted, CY2024 — federally-funded flag from any Bayh-Dole grant clause in the patent text',
                  },
                ],
              },
              {
                label: 'Avg cites, CY20 mature cohort',
                value: overview.fy20_avg_cites_5yr === null ? '—' : overview.fy20_avg_cites_5yr.toFixed(2),
                hint: '5-year forward citations · 2020 grant cohort fully matured Dec 2025',
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'AVG(avg_cites_5yr_mature) where fiscal_year = 2020 — fully matured 5-year forward window. Earlier cohorts also mature; later ones truncated.',
                  },
                ],
              },
            ]}
          />
          <KpiStrip
            cols={2}
            tiles={[
              {
                label: 'Industry co-assign share CY24',
                value: formatPercent(overview.fy24_avg_industry_co_share),
                hint: 'Of granted patents, share with a corporate co-assignee',
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'AVG(co_industry_share) per institution where fiscal_year = 2024. Corporate co-assignee = any non-government, non-university assignee on the same patent.',
                  },
                ],
              },
              {
                label: 'CY24 applications filed',
                value: formatCount(overview.fy23_filed),
                hint: 'Latest non-truncated PGPub year (CY2023). CY2024+ still publishing through ~mid-2026.',
                sources: [
                  {
                    id: 'uspto_patentsview',
                    subset:
                      'SUM(applications_filed) where fiscal_year = 2023 — last fully published cohort by the 18-month PGPub lag.',
                  },
                ],
              },
            ]}
          />
        </div>
      )}

      <Caveats />

      {/* 20-year trend */}
      <ChartFrame
        eyebrow="20-year trend"
        title="Granted patents and pre-grant applications, by calendar year"
        sources={[
          {
            id: 'uspto_patentsview',
            subset:
              'SUM(patents_granted), SUM(applications_filed), SUM(patents_granted_fed_funded) grouped by fiscal_year CY2005–CY2025',
          },
        ]}
        methodology={{
          what: 'Per-CY patent grants (PVGPATDIS) and pre-grant applications (PVPGPUBDIS) across the ~471 HERD universities matched into PatentsView. Federal-funded count uses the Bayh-Dole government interest clause in the patent text.',
          how: 'Patent grants are counted in their grant calendar year, not application year. Pre-grant publications are counted in their first publication year (~18 months after filing on average). A patent with multiple university assignees is counted once per assigned institution (whole-counting).',
          caveats:
            'CY2024–25 application counts are truncated by the ~18-month PGPub publication lag — true CY2024 filings will appear in PatentsView through ~mid-2026. CY2026 bleeds in for institutions whose PatentsView cohort already includes early-2026 grants; we exclude it from the chart.',
        }}
      >
        <YearStackTable rows={displayYearStack} />
      </ChartFrame>

      {/* Federal funding share trend */}
      <ChartFrame
        eyebrow="Federal-funded share"
        title="Share of patents with a Bayh-Dole government-interest clause, by CY"
        sources={[
          {
            id: 'uspto_patentsview',
            subset:
              'patents_granted_fed_funded ÷ patents_granted by fiscal_year. Bayh-Dole flag from any government-interest clause in the patent text.',
          },
        ]}
        methodology={{
          what: 'How many of each year\'s university patents disclose federal R&D funding (mandated by the 1980 Bayh-Dole Act when federal money paid for the underlying research).',
          how: 'A patent is "federally-funded" if its government-interest clause names any federal agency (NIH, NSF, DOD, DOE, USDA, NASA, etc.). The patent text is scanned at PatentsView ingest time and exposed as a boolean flag we sum to a per-institution-year count.',
          caveats:
            'The flag is binary per patent: a patent with even a single federal acknowledgement counts as federally-funded, regardless of how many other (non-federal) sources also paid for the research.',
        }}
      >
        <FedShareTable rows={snapshot?.fed_funded_trend.filter((r) => r.fiscal_year <= CY_MAX) ?? []} />
      </ChartFrame>

      {/* Window picker for leaderboard */}
      <WindowPicker windowStart={windowStart} windowEnd={windowEnd} onStart={setWindowStart} onEnd={setWindowEnd} />

      {/* Top universities */}
      <ChartFrame
        eyebrow="Top recipients"
        title={`Top 25 universities by granted patents, ${winLabel}`}
        sources={[
          {
            id: 'uspto_patentsview',
            subset: 'SUM(patents_granted) grouped by institution × CY, filtered to CY2020–CY2024 window',
          },
          { id: 'ncses_herd', subset: 'herd_federal_rd_M denominator for the patents-per-$M-federal-R&D ratio' },
          {
            id: 'nai_top100',
            subset: 'External verification anchor: 89% of cells now within ±25% of NAI Top-100 published counts',
          },
        ]}
        methodology={{
          what: 'Universities ranked by granted utility patents over a 5-year window. Includes federal-funded share, university–industry co-assignment share (any corporate co-assignee), 5-year forward citation average, and patents per $M federal R&D.',
          how: 'PatentsView assignees are mapped to HERD institutions through a four-stage crosswalk (Appendix-B seeds → direct alias → foundation-pattern strip → filtered fuzzy). 872 disambiguated assignees map to 471 HERD institutions. Multi-assignee patents are whole-counted per institution.',
          caveats:
            'UC Berkeley and CU Boulder absorb their system-level legal-entity patents (Regents of the University of California, University of Colorado System) since HERD has no system-level institution_sk for these. Northwestern University may bleed in Northwestern Memorial / Northwestern Medicine patents via shared assignee disambiguation (+ ~55% over NAI in CY2020/2022). NAI counts use first-named-assignee (pre-2022) or all-inventors (post-2022) — our counting (distinct-assignee, whole-counted) creates a systematic 0–30% variance for multi-assignee patents.',
        }}
      >
        {showTopInstitutions ? (
          <TopInstitutionsTable rows={snapshot?.top_institutions.slice(0, 25) ?? []} />
        ) : (
          <p className="rounded border border-rule bg-mute-3/20 px-4 py-6 text-sm text-text-tertiary">
            The leaderboard is precomputed for the CY2020–CY2024 mature 5-year cohort (matches the 5-year forward
            citation window). Reset the picker above to CY2020 → CY2024 to view it.
          </p>
        )}
      </ChartFrame>

      {/* Geography — state choropleth + city hub bubbles, toggleable */}
      <GeographyPicker
        year={geoYear}
        metric={geoMetric}
        onYear={setGeoYear}
        onMetric={setGeoMetric}
      />

      <ChartFrame
        eyebrow="Geography"
        title={`University patent hubs, CY${geoYear} — ${geoMetric === 'granted' ? 'granted' : 'applications filed'}`}
        sources={[
          {
            id: 'uspto_patentsview',
            subset: `patents_granted (or applications_filed) per (institution × CY) joined to dim_institution.state_code + .city for fiscal_year = ${geoYear}. State choropleth = SUM across institutions in that state; city bubbles = SUM at the institution-headquarters city for cities with ≥ 5 lifetime granted patents.`,
          },
          {
            id: 'ipeds',
            subset: 'HD directory: state_code + city per institution_sk (via dim_institution).',
          },
        ]}
        methodology={{
          what: 'Where U.S. university patent activity concentrates geographically. State shading shows total volume; red dots mark the cities where the patents are actually being assigned to. Toggle between granted patents (final grants in this CY) and applications filed (PGPub publications in this CY).',
          how: 'Each university\'s patents are attributed to its headquarters state and city (from dim_institution). State choropleth = SUM(metric) across institutions in that state. City bubbles = SUM at the institution-HQ city for the ~470 universities with ≥ 5 lifetime granted patents. Bubble area is proportional to the active metric (granted or filed).',
          caveats:
            'Reflects institution HQ city, not where research was performed. A university research campus in another city (e.g., an extension or branch campus) is still rolled into the HQ. Multi-campus systems are pinned per Option B (UC Regents → Berkeley, CU System → Boulder, SUNY-RF → Albany, Texas A&M System → College Station, U Maine System → Orono). CY2024–25 application counts are truncated by the ~18-month PGPub publication lag.',
        }}
      >
        {geoHubs.length === 0 ? (
          <p className="text-sm text-text-tertiary">Loading…</p>
        ) : (
          <PatentHubMap
            stateValues={stateValuesByAbbr}
            hubs={geoHubs}
            metric={geoMetric}
            height={500}
            labelTop={10}
          />
        )}
      </ChartFrame>

      {/* Hub leaderboard for the active CY × metric */}
      <ChartFrame
        eyebrow="Hub leaderboard"
        title={`Top 15 patent hub cities, CY${geoYear} — ${geoMetric === 'granted' ? 'granted' : 'filed'}`}
        sources={[
          {
            id: 'uspto_patentsview',
            subset: `Same hub aggregation as the map above; ranked by ${geoMetric === 'granted' ? 'patents_granted' : 'applications_filed'} for fiscal_year = ${geoYear}.`,
          },
        ]}
      >
        <HubLeaderboard rows={topHubs} metric={geoMetric} />
      </ChartFrame>

      {/* CPC mix */}
      <ChartFrame
        eyebrow="Technology mix"
        title="Primary CPC top-section distribution, CY2024 grants"
        sources={[
          {
            id: 'uspto_patentsview',
            subset:
              'SUM(patents_granted) grouped by primary_cpc_top_section for fiscal_year = 2024. Primary CPC is the first listed CPC code on each patent.',
          },
        ]}
        methodology={{
          what: 'Which Cooperative Patent Classification (CPC) sections university grants fall into. CPC is a joint USPTO/EPO classification; the top section is the alphabetic prefix (A–H).',
          how: 'Each granted patent has a primary CPC code; we extract the leading letter (the "section"). Counts are summed across all universities for CY2024 grants only — earlier years would have a similar shape, since university CPC distribution is structural.',
          caveats:
            'Patents can hold codes in multiple sections; we only count the primary. Section H (electricity) is under-represented relative to industry filings because universities patent more in life sciences (A) and materials/chemistry (C) than in semiconductor manufacturing.',
        }}
      >
        <CpcMixTable rows={snapshot?.cpc_mix ?? []} />
      </ChartFrame>
    </div>
  );
}

function Caveats() {
  return (
    <details className="rounded-md border border-rule bg-mute-3/20 px-4 py-3">
      <summary className="cursor-pointer text-[12px] font-medium text-text-secondary">
        Three reading notes
      </summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12px] text-text-tertiary">
        <li>
          <strong>UC Berkeley / CU Boulder</strong> patent counts absorb their system-level entities (Regents of UC,
          University of Colorado System). HERD has no UC-System or CU-System institution_sk; the flagship pin is
          intentional.
        </li>
        <li>
          <strong>Northwestern University</strong> may bleed in Northwestern Memorial / Northwestern Medicine patents
          through shared PatentsView assignee disambiguation. Our CY2020/2022 counts run ~55% over NAI for this reason.
        </li>
        <li>
          Counts use <strong>distinct-assignee whole-counting</strong>; NAI's Top-100 uses first-named-assignee (pre-
          CY2022) or all-inventors (CY2022+). The methodologies diverge by 0–30% on patents with multiple university
          assignees.
        </li>
      </ol>
    </details>
  );
}

function GeographyPicker({
  year,
  metric,
  onYear,
  onMetric,
}: {
  year: number;
  metric: PatentMetricKey;
  onYear: (y: number) => void;
  onMetric: (m: PatentMetricKey) => void;
}) {
  const yearId = useId();
  return (
    <div className="-mb-2 flex flex-col gap-2 rounded-md border border-rule bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Geography view</p>
      <div className="flex items-center gap-2">
        <label htmlFor={yearId} className="text-xs text-text-tertiary">
          CY
        </label>
        <select
          id={yearId}
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          className="h-7 w-24 rounded border border-rule bg-surface px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_YEARS.map((y) => (
            <option key={y} value={y}>
              CY{y}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1 rounded border border-rule bg-surface p-0.5">
        <button
          type="button"
          onClick={() => onMetric('granted')}
          className={`px-2.5 py-1 text-xs rounded ${
            metric === 'granted'
              ? 'bg-accent/10 text-text-primary font-medium'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Granted patents
        </button>
        <button
          type="button"
          onClick={() => onMetric('filed')}
          className={`px-2.5 py-1 text-xs rounded ${
            metric === 'filed'
              ? 'bg-accent/10 text-text-primary font-medium'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Applications filed
        </button>
      </div>
      <span className="text-[11px] italic text-text-tertiary">
        Toggle drives the map fill, bubble size, and leaderboard ranking below.
      </span>
    </div>
  );
}

function HubLeaderboard({ rows, metric }: { rows: PatentHubPoint[]; metric: PatentMetricKey }) {
  const accessors = {
    city: (r: PatentHubPoint) => r.city.toLowerCase(),
    state_code: (r: PatentHubPoint) => r.state_code,
    granted: (r: PatentHubPoint) => r.granted,
    filed: (r: PatentHubPoint) => r.filed,
  };
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: metric === 'granted' ? 'granted' : 'filed', dir: 'desc' },
    accessors,
    defaultDir: { city: 'asc', state_code: 'asc' },
  });
  if (rows.length === 0) {
    return <p className="text-sm text-text-tertiary">No hubs to show for this year.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <SortableTh sortKey="city" sort={sort} onSort={requestSort} className="py-2 pr-4">
              City
            </SortableTh>
            <SortableTh sortKey="state_code" sort={sort} onSort={requestSort} className="py-2 pr-4">
              State
            </SortableTh>
            <SortableTh
              sortKey="granted"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Granted
            </SortableTh>
            <SortableTh
              sortKey="filed"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Applications filed
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={`${r.city}|${r.state_code}`} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">
                {r.city
                  .toLowerCase()
                  .split(/\s+/)
                  .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
                  .join(' ')}
              </td>
              <td className="py-1.5 pr-4 text-text-secondary">{r.state_code}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">{formatCount(r.granted)}</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">{formatCount(r.filed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Leaderboard window</p>
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
              CY{y}
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
              CY{y}
            </option>
          ))}
        </select>
      </div>
      <span className="text-[11px] italic text-text-tertiary">
        Leaderboard is precomputed for CY2020–CY2024 (matches the 5yr citation cohort).
      </span>
    </div>
  );
}

function YearStackTable({ rows }: { rows: YearRow[] }) {
  const accessors = {
    fiscal_year: (r: YearRow) => r.fiscal_year,
    granted: (r: YearRow) => r.granted,
    filed: (r: YearRow) => r.filed,
    fed_funded_share: (r: YearRow) => r.fed_funded_share ?? 0,
  };
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'fiscal_year', dir: 'desc' },
    accessors,
    defaultDir: { fiscal_year: 'desc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <SortableTh sortKey="fiscal_year" sort={sort} onSort={requestSort} className="py-2 pr-4">
              CY
            </SortableTh>
            <SortableTh
              sortKey="granted"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Granted patents
            </SortableTh>
            <SortableTh
              sortKey="filed"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Applications filed
            </SortableTh>
            <SortableTh
              sortKey="fed_funded_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Federally-funded share
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.fiscal_year} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 tnum text-text-primary">
                CY{r.fiscal_year}
                {r.applications_truncated && (
                  <span className="ml-1 text-[10px] text-text-tertiary" title="Application count truncated by 18-month PGPub lag">
                    ⟁
                  </span>
                )}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">{formatCount(r.granted)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {r.applications_truncated ? (
                  <span title="Truncated by PGPub publication lag" className="text-text-tertiary">
                    {formatCount(r.filed)}<sup>†</sup>
                  </span>
                ) : (
                  formatCount(r.filed)
                )}
              </td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">
                {formatPercent(r.fed_funded_share)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] italic text-text-tertiary">
        ⟁ / † Application counts for CY2024–CY2025 are truncated by the ~18-month pre-grant publication lag.
      </p>
    </div>
  );
}

function FedShareTable({ rows }: { rows: IpSnapshot['fed_funded_trend'] }) {
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <th className="py-2 pr-4">CY</th>
            <th className="py-2 px-3 text-right whitespace-nowrap">Federally-funded</th>
            <th className="py-2 px-3 text-right whitespace-nowrap">Total granted</th>
            <th className="py-2 pl-3 text-right whitespace-nowrap">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fiscal_year} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 tnum text-text-primary">CY{r.fiscal_year}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {formatCount(r.fed_funded_count)}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {formatCount(r.total_granted)}
              </td>
              <td className="py-1.5 pl-3 text-right tnum text-text-primary">
                {formatPercent(r.fed_funded_share)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopInstitutionsTable({ rows }: { rows: TopRow[] }) {
  const accessors = {
    canonical_name: (r: TopRow) => r.canonical_name.toLowerCase(),
    granted_5yr: (r: TopRow) => r.granted_5yr,
    fed_share: (r: TopRow) => r.fed_share ?? 0,
    industry_co_share: (r: TopRow) => r.industry_co_share ?? 0,
    avg_cites_5yr: (r: TopRow) => r.avg_cites_5yr ?? 0,
    patents_per_M_fed_rd: (r: TopRow) => r.patents_per_M_fed_rd ?? 0,
  };
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'granted_5yr', dir: 'desc' },
    accessors,
    defaultDir: { canonical_name: 'asc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <SortableTh sortKey="canonical_name" sort={sort} onSort={requestSort} className="py-2 pr-4">
              Institution
            </SortableTh>
            <SortableTh
              sortKey="granted_5yr"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Granted (5yr)
            </SortableTh>
            <SortableTh
              sortKey="fed_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Federal share
            </SortableTh>
            <SortableTh
              sortKey="industry_co_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Industry co-assign
            </SortableTh>
            <SortableTh
              sortKey="avg_cites_5yr"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Avg cites (5yr)
            </SortableTh>
            <SortableTh
              sortKey="patents_per_M_fed_rd"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Patents / $M fed R&D
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.institution_sk} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">
                <a
                  href={`/universities/${encodeURIComponent(r.institution_sk)}`}
                  className="hover:text-accent hover:underline"
                >
                  {r.canonical_name}
                </a>
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">{formatCount(r.granted_5yr)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatPercent(r.fed_share)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatPercent(r.industry_co_share)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {r.avg_cites_5yr === null ? '—' : r.avg_cites_5yr.toFixed(2)}
              </td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">
                {r.patents_per_M_fed_rd === null ? '—' : r.patents_per_M_fed_rd.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CpcMixTable({ rows }: { rows: CpcRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <th className="py-2 pr-4">CPC section</th>
            <th className="py-2 px-3 text-right whitespace-nowrap">CY24 grants</th>
            <th className="py-2 px-3 text-right whitespace-nowrap">Share</th>
            <th className="py-2 pl-3 text-right whitespace-nowrap">Institutions reporting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cpc_section} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 text-text-primary">
                {CPC_SECTION_NAMES[r.cpc_section] ?? r.cpc_section}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">{formatCount(r.granted)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {formatPercent(r.share_of_fy24, { source: 'fraction' })}
              </td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">{formatCount(r.n_inst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
