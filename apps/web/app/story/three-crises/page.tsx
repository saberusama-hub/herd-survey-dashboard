'use client';

import { useDuckDB } from '@/app/providers';
import { LineChart } from '@/components/charts/LineChart';
import { PageHeader } from '@/components/layout/PageHeader';
import { StorySection } from '@/components/layout/StorySection';
import { type TimelineEvent } from '@/lib/annotations';
import { query } from '@/lib/duckdb';
import type { Row } from '@/lib/types';
import { useEffect, useState } from 'react';

interface FederalTotal extends Row {
  fiscal_year: number;
  total: number;
}

const EVENT_ARRA: TimelineEvent = {
  id: 'arra',
  label: 'ARRA',
  description: 'American Recovery & Reinvestment Act injected $13.4B into NIH+NSF over two years.',
  from: 2009,
  to: 2010,
  variant: 'band',
  tone: 'positive',
};
const EVENT_SEQUESTER: TimelineEvent = {
  id: 'sequester',
  label: 'Sequester',
  description: 'Budget Control Act cut non-defense discretionary ~5%.',
  from: 2013,
  to: 2015,
  variant: 'band',
  tone: 'negative',
};
const EVENT_COVID: TimelineEvent = {
  id: 'covid',
  label: 'COVID surge',
  description: 'Operation Warp Speed + CARES Act spiked HHS development spending $37.6B.',
  from: 2020,
  to: 2022,
  variant: 'band',
  tone: 'positive',
};
const EVENT_CHIPS: TimelineEvent = {
  id: 'chips',
  label: 'CHIPS + IRA',
  description: 'CHIPS & Science + Inflation Reduction Act authorized $52.7B+ in semiconductor/clean energy R&D.',
  from: 2023,
  to: 2024,
  variant: 'band',
  tone: 'positive',
};

const BAND_BY_STEP: Record<string, TimelineEvent[]> = {
  intro: [],
  arra: [EVENT_ARRA],
  sequester: [EVENT_ARRA, EVENT_SEQUESTER],
  covid: [EVENT_ARRA, EVENT_SEQUESTER, EVENT_COVID],
  chips: [EVENT_ARRA, EVENT_SEQUESTER, EVENT_COVID, EVENT_CHIPS],
};

export default function ThreeCrisesStory() {
  const { ready } = useDuckDB();
  const [data, setData] = useState<FederalTotal[]>([]);

  useEffect(() => {
    if (!ready) return;
    query<FederalTotal>(`
      SELECT fiscal_year,
             SUM(total_obligations_usd_nominal) AS total
      FROM sheet_04_federal_rd_by_agency
      WHERE agency_parent IS NULL OR agency_parent = ''
      GROUP BY fiscal_year
      ORDER BY fiscal_year
    `)
      .then(setData)
      .catch(() => setData([]));
  }, [ready]);

  return (
    <div className="container-wide py-12 md:py-20 space-y-12">
      <PageHeader
        eyebrow="Story 2"
        title="Three crises in twenty years"
        description="ARRA, the sequester, COVID-19 — and now CHIPS+IRA. Each one drew a clean fingerprint into the federal R&D timeline. Scroll to walk the four shocks one at a time."
      />

      <StorySection
        steps={[
          {
            id: 'intro',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-accent">A line, then four bands</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The line, plain</h2>
                <p className="t-body-lg">
                  Total federal R&amp;D obligations to U.S. universities — sum of every agency, every dollar — from FY2005
                  to FY2024. Two decades. One curve. Scroll to add context, one shock at a time.
                </p>
              </div>
            ),
          },
          {
            id: 'arra',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow" style={{ color: 'hsl(var(--positive))' }}>FY2009 – FY2010 · ARRA</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The first shock: a stimulus</h2>
                <p className="t-body-lg">
                  The American Recovery and Reinvestment Act injected $787 billion into the U.S. economy. $13.4 billion
                  flowed through NIH and NSF in just two years. The bulge in the curve is visible without any annotation;
                  the curve simply lifts and then settles, but never quite returns to trend.
                </p>
              </div>
            ),
          },
          {
            id: 'sequester',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow" style={{ color: 'hsl(var(--negative))' }}>FY2013 – FY2015 · Sequester</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The second shock: an arrow downward</h2>
                <p className="t-body-lg">
                  The Budget Control Act of 2011 forced automatic across-the-board cuts. Non-defense discretionary
                  spending fell about 5%. NIH lost $1.5B. NSF lost $200M. The curve flattens — three years of basically
                  no growth, the longest pause in the entire twenty-year window.
                </p>
              </div>
            ),
          },
          {
            id: 'covid',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow" style={{ color: 'hsl(var(--positive))' }}>FY2020 – FY2022 · COVID</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The third shock: a different kind of surge</h2>
                <p className="t-body-lg">
                  Operation Warp Speed and the CARES Act unleashed an unprecedented infusion of federal R&amp;D. HHS
                  development funding alone spiked by $37.6 billion. Not all of it went to universities, but enough did to
                  visibly tilt the curve. Then, just as fast, it evaporated by FY2023.
                </p>
              </div>
            ),
          },
          {
            id: 'chips',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-accent">FY2023 – FY2024 · CHIPS + IRA</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The next chapter, still landing</h2>
                <p className="t-body-lg">
                  The CHIPS &amp; Science Act and the Inflation Reduction Act authorized $52.7B+ for semiconductor and
                  clean-energy R&amp;D. The full impact won&apos;t be visible for several FY cycles, but the right edge of the
                  curve is already starting to inflect upward — and the agencies most affected (DOE, NSF, DOC) all show it.
                </p>
              </div>
            ),
          },
        ]}
        chart={(activeId) => (
          <div className="space-y-3">
            <p className="h-eyebrow text-text-tertiary">Total federal R&amp;D obligations</p>
            <p className="font-serif text-lg font-semibold leading-tight">
              {activeId === 'intro'
                ? 'FY2005 → FY2024'
                : activeId === 'arra'
                  ? 'ARRA (FY09–FY10)'
                  : activeId === 'sequester'
                    ? 'Sequester (FY13–FY15)'
                    : activeId === 'covid'
                      ? 'COVID surge (FY20–FY22)'
                      : 'CHIPS + IRA (FY23+)'}
            </p>
            <LineChart
              data={data}
              xKey="fiscal_year"
              series={[{ key: 'total', label: 'Federal R&D total', color: 'hsl(var(--accent))' }]}
              height={360}
              showLegend={false}
              directLabels={false}
              referenceBands={BAND_BY_STEP[activeId] ?? []}
            />
            <p className="t-caption">Sheet 04 federal R&amp;D by agency · USD nominal</p>
          </div>
        )}
      />
    </div>
  );
}
