'use client';

import { useMemo, useState } from 'react';

import { BarChart } from '@/components/charts/BarChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { peakYear } from '@/lib/annotations';
import { formatDollars } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

type DollarMode = 'nominal' | 'real';

/**
 * Section 2 — Total R&D timeline. Vertical bar chart spanning the institution's
 * full reported window, with a nominal / FY2024-real toggle. The most recent
 * year is highlighted in accent; everything else is muted (per the "one
 * accent, gray rest" rule in spec §4.4).
 */
export function Section2TotalRD({ profile }: Props) {
  const [mode, setMode] = useState<DollarMode>('nominal');
  const valueKey = mode === 'nominal' ? 'total_rd_nominal' : 'total_rd_real';

  const data = profile.totalRd;

  const { latestValue, peakNote, yoyNote } = useMemo(() => {
    const series = data.map((d) => ({
      x: d.fiscal_year,
      y: Number(d[valueKey] as number) || 0,
    }));
    if (series.length === 0) {
      return { latestValue: null, peakNote: null, yoyNote: null };
    }
    const peak = peakYear(series);
    // Compute largest YoY delta directly (label not parsed) so the footnote
    // can render in compact dollars rather than the raw scalar baked into
    // the heuristic's string output.
    let yoyFy = series[0].x;
    let yoyDelta = 0;
    for (let i = 1; i < series.length; i++) {
      const d = series[i].y - series[i - 1].y;
      if (Math.abs(d) > Math.abs(yoyDelta)) {
        yoyDelta = d;
        yoyFy = series[i].x;
      }
    }
    const yoyDir = yoyDelta >= 0 ? 'jumped' : 'fell';
    return {
      latestValue: series[series.length - 1].y,
      peakNote: `Peak in FY${peak.x}: ${formatDollars(peak.y, { decimals: 2 })}`,
      yoyNote:
        series.length >= 2
          ? `Largest year-over-year change landed in FY${yoyFy} — funding ${yoyDir} ${formatDollars(Math.abs(yoyDelta), { decimals: 1 })} vs the prior year.`
          : null,
    };
  }, [data, valueKey]);

  if (data.length === 0) {
    return (
      <section aria-labelledby="profile-section-2">
        <SectionDivider
          eyebrow="Section 2 · Total R&D"
          title="Twenty years of R&D expenditure"
          dek="No HERD R&D data was reported for this institution."
        />
      </section>
    );
  }

  const highlightIndex = data.length - 1;

  return (
    <section aria-labelledby="profile-section-2">
      <SectionDivider
        eyebrow="Section 2 · Total R&D"
        title="Twenty years of R&D expenditure"
        dek="Nominal dollars by default; toggle to FY2024-real to strip inflation. The most recent year is highlighted."
      />

      <div className="mb-4 flex items-center gap-2">
        <ModeToggle mode={mode} onChange={setMode} />
        {latestValue !== null && (
          <span className="ml-auto text-sm text-text-secondary tnum">
            FY{data[data.length - 1].fiscal_year}:{' '}
            <span className="font-semibold text-text-primary">
              {formatDollars(latestValue, { decimals: 2 })}
            </span>
          </span>
        )}
      </div>

      <ChartFrame
        eyebrow="HERD R&D expenditure"
        title={
          mode === 'nominal'
            ? 'Nominal dollars (as reported)'
            : 'Inflation-adjusted (FY2024 dollars)'
        }
        dek={
          mode === 'nominal'
            ? 'Year-on-year reported HERD expenditure in current-year dollars.'
            : 'Same HERD expenditure rebased to FY2024 purchasing power via BLS CPI-U.'
        }
        source="HERD Q01 · agg_uni_total_rd"
        note={peakNote ?? undefined}
      >
        <BarChart
          data={data as unknown as Array<Record<string, unknown>>}
          xKey="fiscal_year"
          series={[{ key: valueKey, label: 'Total R&D' }]}
          highlightIndex={highlightIndex}
          yFormat={(v) => formatDollars(v)}
          height={320}
          showLegend={false}
        />
      </ChartFrame>

      {yoyNote && (
        <p className="mt-2 text-[11px] italic text-text-tertiary">{yoyNote}</p>
      )}
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: DollarMode;
  onChange: (m: DollarMode) => void;
}) {
  const base =
    'rounded-full px-3 py-1 text-xs transition border border-rule tnum';
  const active = 'bg-accent text-white border-accent';
  const idle = 'bg-surface text-text-secondary hover:bg-mute-3/40';
  return (
    <div className="inline-flex items-center gap-1.5" role="tablist" aria-label="Dollar mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'nominal'}
        className={`${base} ${mode === 'nominal' ? active : idle}`}
        onClick={() => onChange('nominal')}
      >
        Nominal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'real'}
        className={`${base} ${mode === 'real' ? active : idle}`}
        onClick={() => onChange('real')}
      >
        FY2024 real
      </button>
    </div>
  );
}
