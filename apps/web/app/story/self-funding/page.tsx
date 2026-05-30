'use client';

import { useDuckDB } from '@/app/providers';
import { LineChart } from '@/components/charts/LineChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { StorySection } from '@/components/layout/StorySection';
import { KEY_EVENTS_BANDS } from '@/lib/annotations';
import { query } from '@/lib/duckdb';
import type { Row } from '@/lib/types';
import { useEffect, useState } from 'react';

interface SourceShareRow extends Row {
  fiscal_year: number;
  federal_share: number | null;
  institutional_share: number | null;
  hbcu_federal_share: number | null;
}

const HIGHLIGHT_BY_STEP: Record<string, number | null> = {
  intro: null,
  decline: 0,
  rise: 1,
  hbcu: 2,
};

export default function SelfFundingStory() {
  const { ready } = useDuckDB();
  const [data, setData] = useState<SourceShareRow[]>([]);

  useEffect(() => {
    if (!ready) return;
    // Use sheet_01 funding panel to compute federal vs institutional share of total R&D
    query<SourceShareRow>(`
      WITH totals AS (
        SELECT
          fiscal_year,
          SUM(federal_government_usd_nominal) AS fed,
          SUM(institutional_funds_usd_nominal) AS inst,
          SUM(total_rd_usd_nominal) AS total
        FROM sheet_01_institution_funding_panel
        GROUP BY fiscal_year
      ),
      hbcu AS (
        SELECT
          p.fiscal_year,
          SUM(p.federal_government_usd_nominal) AS fed_hbcu,
          SUM(p.total_rd_usd_nominal) AS total_hbcu
        FROM sheet_01_institution_funding_panel p
        JOIN dim_institution d ON p.institution_sk = d.institution_sk
        WHERE d.is_hbcu = true
        GROUP BY p.fiscal_year
      )
      SELECT
        t.fiscal_year,
        100.0 * t.fed / NULLIF(t.total, 0) AS federal_share,
        100.0 * t.inst / NULLIF(t.total, 0) AS institutional_share,
        CASE WHEN COALESCE(h.total_hbcu, 0) > 0
             THEN 100.0 * h.fed_hbcu / h.total_hbcu
             ELSE NULL END AS hbcu_federal_share
      FROM totals t
      LEFT JOIN hbcu h ON h.fiscal_year = t.fiscal_year
      ORDER BY t.fiscal_year
    `)
      .then(setData)
      .catch(() => setData([]));
  }, [ready]);

  return (
    <div className="container-wide py-12 md:py-20 space-y-12">
      <PageHeader
        eyebrow="Story 1"
        title="The self-funding revolution"
        description="Federal dollars used to underwrite the majority of university research. Institutions now do that themselves. Here is what changed — and what it cost the universities that could not keep up."
      />

      <StorySection
        steps={[
          {
            id: 'intro',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-accent">Setup</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">Federal vs institutional, side by side</h2>
                <p className="t-body-lg">
                  Every U.S. university reports its R&amp;D expenditures and the source of those dollars to NCSES every
                  year. The two largest sources are the federal government and the institutions themselves — endowment
                  income, tuition, designated state appropriations, and so on. Scroll to see how the balance changed.
                </p>
              </div>
            ),
          },
          {
            id: 'decline',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-1">Federal share, in retreat</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The line that&apos;s declining</h2>
                <p className="t-body-lg">
                  In FY2005, federal dollars funded roughly 64% of all university R&amp;D. By FY2024, that share had
                  fallen to about 53% — and the trend through every recent fiscal cycle has been further down. Note
                  that this is a <em>share</em> story, not a dollar story; federal R&amp;D in absolute terms continued to
                  grow.
                </p>
              </div>
            ),
          },
          {
            id: 'rise',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-3">Institutional share, in ascent</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The line that&apos;s rising</h2>
                <p className="t-body-lg">
                  Institutions are now expected to put up more of their own research dollars to keep their research
                  enterprises growing. Some can. Endowment-rich universities pull this off through internal investment;
                  state schools by raising tuition-allocated R&amp;D. Many simply cannot — which sets up the next view.
                </p>
              </div>
            ),
          },
          {
            id: 'hbcu',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-2">HBCU sector — held flat</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The HBCU plateau</h2>
                <p className="t-body-lg">
                  When the federal share fell, institutional capacity had to absorb the rest. HBCU sector R&amp;D
                  stayed almost completely flat in real dollars from FY2005 to FY2024 — even as the overall federal R&amp;D
                  pie expanded 38% in nominal terms. The federal share for the sector tracks the national line, but the
                  underlying base never grew. The cost of an enterprise-funded model falls hardest on the institutions
                  least able to fund it.
                </p>
              </div>
            ),
          },
        ]}
        chart={(activeId) => (
          <div className="space-y-3">
            <p className="h-eyebrow text-text-tertiary">Share of total university R&amp;D, %</p>
            <p className="font-serif text-lg font-semibold leading-tight">
              {activeId === 'intro' && 'Federal vs institutional · 20 years'}
              {activeId === 'decline' && 'Federal share is falling'}
              {activeId === 'rise' && 'Institutional share is rising'}
              {activeId === 'hbcu' && 'HBCU federal share follows — but the base does not grow'}
            </p>
            <LineChart
              data={data}
              xKey="fiscal_year"
              series={[
                { key: 'federal_share', label: 'Federal government share', color: 'hsl(var(--cat-1))' },
                { key: 'institutional_share', label: 'Institutional funds share', color: 'hsl(var(--cat-3))' },
                { key: 'hbcu_federal_share', label: 'HBCU federal share', color: 'hsl(var(--cat-2))' },
              ]}
              height={340}
              showLegend
              directLabels={false}
              yFormat={(v) => `${v.toFixed(0)}%`}
              referenceBands={KEY_EVENTS_BANDS.filter((e) => e.id === 'arra' || e.id === 'covid')}
              highlightIndex={HIGHLIGHT_BY_STEP[activeId] ?? null}
            />
            <p className="t-caption">Sheet 01 institution funding panel · sector flag from dim_institution</p>
          </div>
        )}
      />
    </div>
  );
}
