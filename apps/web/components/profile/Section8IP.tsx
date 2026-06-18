'use client';

import { useMemo } from 'react';

import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
import { formatCount, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

// Institutions where USPTO assignee disambiguation produces known
// systematic bias vs the per-campus HERD entity. Documented in
// ip_verification_report_round2.md and ip_data_dictionary.md.
const SYSTEM_PIN_SKS = new Set([
  'INST0000117', // UC Berkeley — absorbs Regents of the University of California
  'INST0000010', // CU Boulder — absorbs University of Colorado System
]);
const NORTHWESTERN_SK = 'INST0000013';

const CPC_SECTION_NAMES: Record<string, string> = {
  A: 'Human necessities (life sciences, medical, agri)',
  B: 'Performing operations / transporting',
  C: 'Chemistry, metallurgy, materials',
  D: 'Textiles, paper',
  E: 'Fixed constructions',
  F: 'Mechanical engineering, lighting, heating',
  G: 'Physics (instruments, computing)',
  H: 'Electricity',
};

/**
 * Section 8 — University patents & IP.
 *
 *   - KpiStrip: granted patents (latest mature CY), federal-funded share,
 *     industry co-assignment share, 5yr citation average (mature cohort).
 *   - Year table: per-CY granted + filed + federal share + truncation flags.
 *   - Inline caveat banner for system-pinned SKs (UC Berkeley, CU Boulder)
 *     and the Northwestern Memorial bleed.
 */
export function Section8IP({ profile }: Props) {
  const patents = profile.patents ?? [];

  const view = useMemo(() => {
    if (patents.length === 0) return null;
    // Pick the latest "mature" granted year — citations need 5 years
    // to mature, so the most useful KPI year is min(maxCY, 2020).
    const allCys = patents.map((r) => r.fiscal_year).filter((y) => y <= 2025);
    if (allCys.length === 0) return null;
    const latestCy = allCys.reduce((m, y) => (y > m ? y : m), allCys[0]);
    const matureCy = patents
      .filter((r) => r.fiscal_year <= 2020 && r.avg_cites_5yr_mature !== null)
      .reduce((m, r) => (r.fiscal_year > m ? r.fiscal_year : m), 0);

    const latest = patents.find((r) => r.fiscal_year === latestCy) ?? null;
    const mature = matureCy ? patents.find((r) => r.fiscal_year === matureCy) ?? null : null;

    // Lifetime totals for the secondary KPIs.
    const lifetimeGranted = patents.reduce((s, r) => s + (Number(r.patents_granted) || 0), 0);
    const lifetimeFedFunded = patents.reduce((s, r) => s + (Number(r.patents_granted_fed_funded) || 0), 0);
    const lifetimeFedShare = lifetimeGranted > 0 ? lifetimeFedFunded / lifetimeGranted : null;

    // Per-CY trend rows for the table (newest-first display).
    const trend = [...patents].sort((a, b) => b.fiscal_year - a.fiscal_year);

    return { latest, mature, lifetimeGranted, lifetimeFedShare, trend, latestCy };
  }, [patents]);

  if (!view) {
    return (
      <section aria-labelledby="profile-section-8">
        <SectionDivider
          eyebrow="Section 8 · Patents & IP"
          title="University inventions"
          dek="This institution does not appear in the USPTO PatentsView assignee universe for CY2005–CY2025. No granted-patent records to display."
          color="hsl(var(--agency-doe))"
        />
      </section>
    );
  }

  const { latest, mature, lifetimeGranted, lifetimeFedShare, trend, latestCy } = view;

  const tiles: KpiTile[] = [
    {
      label: `Granted patents · CY${latestCy}`,
      value: latest ? formatCount(latest.patents_granted) : '—',
      hint: <span className="text-text-tertiary">{formatCount(lifetimeGranted)} granted CY2005–CY2025</span>,
      sources: [
        {
          id: 'uspto_patentsview',
          subset: `patents_granted from sheet_13_ip_patents for this institution at fiscal_year = ${latestCy}`,
        },
      ],
    },
    {
      label: 'Lifetime federally-funded share',
      value: formatPercent(lifetimeFedShare),
      hint: <span className="text-text-tertiary">Bayh-Dole government-interest clause</span>,
      sources: [
        {
          id: 'uspto_patentsview',
          subset:
            'SUM(patents_granted_fed_funded) ÷ SUM(patents_granted) over all CYs. Flag from the government-interest clause in the patent text.',
        },
      ],
    },
    {
      label: `Industry co-assign share · CY${latestCy}`,
      value: latest && latest.co_industry_share !== null ? formatPercent(latest.co_industry_share) : '—',
      hint: <span className="text-text-tertiary">Share of patents with a corporate co-assignee</span>,
      sources: [
        {
          id: 'uspto_patentsview',
          subset: `co_industry_share at fiscal_year = ${latestCy}. Corporate = any non-government, non-university assignee on the same patent.`,
        },
      ],
    },
    {
      label: `5yr citations · CY${mature?.fiscal_year ?? '—'} mature`,
      value:
        mature && mature.avg_cites_5yr_mature !== null
          ? mature.avg_cites_5yr_mature.toFixed(2)
          : '—',
      hint: (
        <span className="text-text-tertiary">
          Avg forward citations, 5-yr window — last fully matured CY
        </span>
      ),
      sources: [
        {
          id: 'uspto_patentsview',
          subset: `avg_cites_5yr_mature for this institution at fiscal_year = ${mature?.fiscal_year ?? '—'}. Only CYs ≤ 2020 have a fully matured 5-year forward citation window.`,
        },
      ],
    },
  ];

  return (
    <section aria-labelledby="profile-section-8">
      <SectionDivider
        eyebrow="Section 8 · Patents & IP"
        title="University inventions"
        dek="Granted U.S. utility patents, federally-funded share, industry co-assignment, and forward citations. CY-keyed (patent grant calendar year) — distinct from federal fiscal year used elsewhere on this profile."
        color="hsl(var(--agency-doe))"
      />

      {SYSTEM_PIN_SKS.has(profile.institution_sk) && (
        <p className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-text-secondary">
          <strong>System-flagship pin.</strong>{' '}
          {profile.institution_sk === 'INST0000117'
            ? 'The Regents of the University of California — the legal assignee on all UC patents — are absorbed into UC Berkeley here, since HERD has no UC-System institution_sk. UC Davis, UCLA, UCSF, etc. each report HERD R&D under their own SK but legally own no patents directly.'
            : 'The University of Colorado System — the legal assignee on cross-campus patents — is absorbed into CU Boulder here, since HERD has no CU-System institution_sk. CU Denver, CU Anschutz, etc. each report HERD R&D under their own SK.'}
        </p>
      )}

      {profile.institution_sk === NORTHWESTERN_SK && (
        <p className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-text-secondary">
          <strong>Possible Northwestern Memorial bleed.</strong> Our CY2020 and CY2022 counts run ~55–59% over the NAI
          Top-100 published count. The likely cause is shared PatentsView assignee disambiguation between Northwestern
          University and Northwestern Memorial Hospital / Northwestern Medicine. The variance is documented as a known
          methodology delta in <a href="/patents" className="underline">methodology</a>.
        </p>
      )}

      <KpiStrip tiles={tiles} cols={4} />

      <div className="mt-8">
        <ChartFrame
          eyebrow="20-year trend"
          title="Granted patents and applications by calendar year"
          dek="One row per CY. Federal share is the fraction of that year's grants disclosing a Bayh-Dole government-interest clause. Applications come from pre-grant publications, lagged ~18 months."
          sources={[
            {
              id: 'uspto_patentsview',
              subset:
                'patents_granted, patents_granted_fed_funded, applications_filed, federally_funded_share from agg_uni_patents (=sheet_13_ip_patents) per fiscal_year for this institution_sk',
            },
            {
              id: 'nai_top100',
              subset:
                'External verification anchor — institution-level cells reconciled at ~78% within ±25% of NAI Top-100 counts after Phase 3 patches',
            },
          ]}
          methodology={{
            what: 'How many U.S. utility patents this institution was granted each calendar year, how many disclosed federal funding, and how many of its pre-grant applications have been published.',
            how: 'Each PatentsView assignee_id matched to this institution\'s HERD institution_sk contributes its granted patents per CY. Multi-assignee patents are whole-counted per institution. Federal-funded count = patents with a non-empty government-interest clause naming any federal agency. Pre-grant publications counted in their first publication year.',
            caveats:
              'CY2024 and CY2025 application counts are truncated by the ~18-month PGPub publication lag (true filings still publishing through ~mid-2026). 5-year forward citations only mature for CYs ≤ 2020. Universities with multiple HERD SKs (medical centers, athletics units, system entities) may not have patents recorded under each SK — patents go to the assignee_id our crosswalk pins.',
          }}
        >
          <YearTable rows={trend} />
        </ChartFrame>
      </div>
    </section>
  );
}

function YearTable({ rows }: { rows: NonNullable<UniversityProfile['patents']> }) {
  const accessors = {
    fiscal_year: (r: (typeof rows)[number]) => r.fiscal_year,
    patents_granted: (r: (typeof rows)[number]) => r.patents_granted,
    federally_funded_share: (r: (typeof rows)[number]) => r.federally_funded_share ?? 0,
    applications_filed: (r: (typeof rows)[number]) => r.applications_filed ?? 0,
    avg_cites_5yr_mature: (r: (typeof rows)[number]) => r.avg_cites_5yr_mature ?? 0,
    primary_cpc_top_section: (r: (typeof rows)[number]) => r.primary_cpc_top_section ?? '',
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
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-text-tertiary">
            <SortableTh sortKey="fiscal_year" sort={sort} onSort={requestSort} className="py-2 pr-4">
              CY
            </SortableTh>
            <SortableTh
              sortKey="patents_granted"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Granted
            </SortableTh>
            <SortableTh
              sortKey="federally_funded_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Federal share
            </SortableTh>
            <SortableTh
              sortKey="applications_filed"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Applications filed
            </SortableTh>
            <SortableTh
              sortKey="avg_cites_5yr_mature"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Avg cites (5yr)
            </SortableTh>
            <SortableTh
              sortKey="primary_cpc_top_section"
              sort={sort}
              onSort={requestSort}
              className="py-2 pl-3"
            >
              Top CPC
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.fiscal_year} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-4 tnum text-text-primary">CY{r.fiscal_year}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-primary">{formatCount(r.patents_granted)}</td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {formatPercent(r.federally_funded_share)}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {r.applications_truncated_flag ? (
                  <span title="Truncated by 18-month PGPub lag" className="text-text-tertiary">
                    {formatCount(r.applications_filed)}
                    <sup>†</sup>
                  </span>
                ) : (
                  formatCount(r.applications_filed)
                )}
              </td>
              <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                {r.avg_cites_5yr_mature === null
                  ? r.citations_truncated_5yr_flag
                    ? <span className="text-text-tertiary" title="5yr citation window not yet matured">—†</span>
                    : '—'
                  : r.avg_cites_5yr_mature.toFixed(2)}
              </td>
              <td className="py-1.5 pl-3 text-text-secondary">
                {r.primary_cpc_top_section
                  ? `${r.primary_cpc_top_section} · ${CPC_SECTION_NAMES[r.primary_cpc_top_section] ?? ''}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] italic text-text-tertiary">
        † Applications truncated by 18-month PGPub publication lag (CY2024–25). Citations need 5 years to mature (CYs &gt; 2020 still accruing).
      </p>
    </div>
  );
}
