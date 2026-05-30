'use client';

import { useDuckDB } from '@/app/providers';
import { USStateMap } from '@/components/charts/USStateMap';
import { PageHeader } from '@/components/layout/PageHeader';
import { StorySection } from '@/components/layout/StorySection';
import { type StateRollup, stateRollup } from '@/lib/queries';
import { useEffect, useState } from 'react';

const FY_BY_STEP: Record<string, number> = {
  intro: 2005,
  east: 2010,
  rise: 2018,
  now: 2024,
};

const HIGHLIGHTED_STATES_BY_STEP: Record<string, string[]> = {
  intro: [],
  east: ['MA', 'NC', 'MD', 'NY'],
  rise: ['MD', 'GA', 'TX'],
  now: ['MD', 'CA', 'TX'],
};

export default function GeographyStory() {
  const { ready } = useDuckDB();
  const [rollups, setRollups] = useState<Record<number, StateRollup[]>>({});

  useEffect(() => {
    if (!ready) return;
    const wantFys = Object.values(FY_BY_STEP);
    Promise.all(
      wantFys.map((fy) =>
        stateRollup('herd_federal', fy)
          .then((rows) => [fy, rows] as const)
          .catch(() => [fy, [] as StateRollup[]] as const),
      ),
    ).then((pairs) => {
      const m: Record<number, StateRollup[]> = {};
      for (const [fy, rows] of pairs) m[fy] = rows;
      setRollups(m);
    });
  }, [ready]);

  return (
    <div className="container-wide py-12 md:py-20 space-y-12">
      <PageHeader
        eyebrow="Story 3"
        title="The geography of American science"
        description="Federal research dollars moved on the map. Maryland tripled its share. The South Atlantic surged. Some Midwestern centers consolidated. Some collapsed. Scroll to watch the map redraw itself."
      />

      <StorySection
        steps={[
          {
            id: 'intro',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-accent">FY2005 · setting the scene</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">Where the money was, twenty years ago</h2>
                <p className="t-body-lg">
                  In FY2005, federal R&amp;D was clustered in a fairly predictable pattern: Massachusetts (Boston and
                  Cambridge), New York (Cornell + Columbia + NYU), Maryland (NIH&apos;s home + Johns Hopkins), California
                  (the UC system + Stanford), and the long tail of major state research universities. Watch what
                  happens next.
                </p>
              </div>
            ),
          },
          {
            id: 'east',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-2">FY2010 · the East Coast holds, the South starts to grow</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The first wave: South Atlantic gains</h2>
                <p className="t-body-lg">
                  By FY2010, North Carolina (Duke + UNC + NC State) and Georgia (Georgia Tech) had emerged as serious
                  centers — the Research Triangle had become more than the name suggested. Maryland kept growing,
                  thanks to Johns Hopkins APL contracts plus the NIH proximity. New York and California stayed flat.
                </p>
              </div>
            ),
          },
          {
            id: 'rise',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-3">FY2018 · Maryland triples, Texas joins, Midwest consolidates</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The second wave: Texas and Maryland</h2>
                <p className="t-body-lg">
                  Texas A&amp;M&apos;s federal R&amp;D more than doubled in a few years (largely DOD aviation research). UT
                  Austin grew similarly. Maryland kept pulling ahead, hitting 3x its FY2005 base. Wichita State grew
                  18x off a single DOD aviation program. Meanwhile, several Rust Belt research universities lost
                  ground — Indiana and Ohio consolidated downward.
                </p>
              </div>
            ),
          },
          {
            id: 'now',
            content: (
              <div className="space-y-3">
                <p className="h-eyebrow text-cat-1">FY2024 · the steady state</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">The board today</h2>
                <p className="t-body-lg">
                  As of FY2024, California is again the single largest state for federal R&amp;D (UCSD + Stanford + UCLA
                  + UCB are extraordinary). Maryland holds second. Texas has stabilized at third. The South Atlantic
                  research belt (NC, GA, FL) is now a permanent feature of the map. CHIPS+IRA money beginning to land
                  is starting to redraw the map yet again, with semiconductor-adjacent states (NY, AZ, OH) primed for
                  the next wave.
                </p>
              </div>
            ),
          },
        ]}
        chart={(activeId) => {
          const fy = FY_BY_STEP[activeId] ?? 2024;
          const highlighted = HIGHLIGHTED_STATES_BY_STEP[activeId] ?? [];
          const rows = rollups[fy] ?? [];
          const valuesMap: Record<string, number> = {};
          for (const r of rows) valuesMap[r.state_code] = r.total;
          return (
            <div className="space-y-3">
              <p className="h-eyebrow text-text-tertiary">HERD federal R&amp;D by state · FY{fy}</p>
              <p className="font-serif text-lg font-semibold leading-tight">
                {activeId === 'intro' && 'Where it began'}
                {activeId === 'east' && 'East Coast still leads; South Atlantic emerging'}
                {activeId === 'rise' && 'Texas + Maryland tripling'}
                {activeId === 'now' && 'Today: CA + MD lead, South Atlantic permanent'}
              </p>
              <USStateMap values={valuesMap} selected={highlighted[0] ?? null} height={360} />
              {highlighted.length > 0 && (
                <p className="t-small text-text-secondary">
                  Watching: {highlighted.join(' · ')}
                </p>
              )}
              <p className="t-caption">Sheet 07 cross-source reconciliation · HERD federal R&amp;D · USD nominal</p>
            </div>
          );
        }}
      />
    </div>
  );
}
