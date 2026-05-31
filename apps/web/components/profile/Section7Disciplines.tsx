'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useMemo } from 'react';

import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
}

const SUBJECT_ORDER = ['AI', 'biomedical', 'materials', 'climate', 'quantum'] as const;
type SubjectKey = (typeof SUBJECT_ORDER)[number];

const SUBJECT_LABEL: Record<SubjectKey, string> = {
  AI: 'Artificial intelligence',
  biomedical: 'Biomedical',
  materials: 'Materials',
  climate: 'Climate & sustainability',
  quantum: 'Quantum',
};

/**
 * Section 7 — Discipline mix.
 *
 *   - KpiStrip: STEM share %, Non-STEM share %, Shannon-entropy proxy
 *     (computed inline over the field shares).
 *   - Horizontal bar chart: 8 HERD field categories, latest FY.
 *   - Below: 5 subject-area buckets (AI, biomedical, materials, climate,
 *     quantum) — keyword-tagged from grant *titles only* (no abstract text
 *     in source data), each with a small sparkline.
 */
export function Section7Disciplines({ profile }: Props) {
  const { fieldMix, subjectTags } = profile;

  const { tiles, fieldBars, subjectRows, subjectSpark, latestFy } = useMemo(() => {
    if (fieldMix.length === 0) {
      return {
        tiles: [] as KpiTile[],
        fieldBars: [],
        subjectRows: [],
        subjectSpark: {} as Record<string, Array<{ x: number; y: number }>>,
        latestFy: null,
      };
    }
    const latestFy = fieldMix.reduce(
      (m, r) => (r.fiscal_year > m ? r.fiscal_year : m),
      fieldMix[0].fiscal_year,
    );

    const latestFieldRows = fieldMix.filter((r) => r.fiscal_year === latestFy);
    const totalAmt = latestFieldRows.reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    const stemAmt = latestFieldRows
      .filter((r) => r.is_stem)
      .reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    const stemShare = totalAmt > 0 ? stemAmt / totalAmt : null;

    // Shannon entropy proxy across the field categories (natural log).
    let shannon = 0;
    if (totalAmt > 0) {
      for (const r of latestFieldRows) {
        const p = (Number(r.amount_nominal) || 0) / totalAmt;
        if (p > 0) shannon -= p * Math.log(p);
      }
    }

    const tiles: KpiTile[] = [
      {
        label: `STEM share · FY${latestFy}`,
        value: formatPercent(stemShare),
        hint: <span className="text-text-tertiary">of HERD R&D by field</span>,
      },
      {
        label: `Non-STEM share · FY${latestFy}`,
        value: formatPercent(stemShare !== null ? 1 - stemShare : null),
        hint: <span className="text-text-tertiary">humanities + social sciences</span>,
      },
      {
        label: 'Field diversity (Shannon)',
        value: shannon ? shannon.toFixed(2) : '—',
        hint: <span className="text-text-tertiary">higher = more spread</span>,
      },
    ];

    // Field-category bars (top-12 by amount, descending).
    const fieldBars = latestFieldRows
      .map((r) => ({
        label: r.field_category,
        amount: Number(r.amount_nominal) || 0,
        share: totalAmt > 0 ? (Number(r.amount_nominal) || 0) / totalAmt : 0,
        is_stem: r.is_stem,
      }))
      .filter((b) => b.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);

    // Subject-tag bars + sparkline per tag.
    const latestSubject = subjectTags.filter((r) => r.fiscal_year === latestFy);
    const subjectTotal = latestSubject.reduce((s, r) => s + (Number(r.tagged_amount) || 0), 0);
    const subjectRows = SUBJECT_ORDER.map((k) => {
      const row = latestSubject.find((r) => r.subject_tag === k);
      const amount = Number(row?.tagged_amount) || 0;
      return {
        key: k,
        label: SUBJECT_LABEL[k],
        amount,
        share: subjectTotal > 0 ? amount / subjectTotal : 0,
      };
    });

    const subjectSpark: Record<string, Array<{ x: number; y: number }>> = {};
    for (const k of SUBJECT_ORDER) {
      subjectSpark[k] = subjectTags
        .filter((r) => r.subject_tag === k)
        .sort((a, b) => a.fiscal_year - b.fiscal_year)
        .map((r) => ({ x: r.fiscal_year, y: Number(r.tagged_amount) || 0 }));
    }

    return { tiles, fieldBars, subjectRows, subjectSpark, latestFy };
  }, [fieldMix, subjectTags]);

  if (fieldBars.length === 0 || latestFy === null) {
    return (
      <section aria-labelledby="profile-section-7">
        <SectionDivider
          eyebrow="Section 7 · Disciplines"
          title="What research the money funded"
          dek="No HERD field-of-science breakdown was reported for this institution."
          color="hsl(var(--agency-dod))"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-section-7">
      <SectionDivider
        eyebrow="Section 7 · Disciplines"
        title="What research the money funded"
        dek="STEM share, the 8 HERD field-of-science categories, and emerging-subject keyword tags. Subjects are title-tagged (no abstract text in source data)."
        color="hsl(var(--agency-dod))"
      />

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8 space-y-10">
        <ChartFrame
          eyebrow={`FY${latestFy} field mix`}
          title="R&D spending by HERD field of science"
          dek="Latest reported year. Bars are sorted descending and direct-labeled with the dollar amount."
          source="HERD Q03 · agg_uni_field_mix"
        >
          <ResponsiveSvg height={Math.max(280, fieldBars.length * 32 + 40)}>
            {(w, h) => <FieldBars width={w} height={h} bars={fieldBars} />}
          </ResponsiveSvg>
        </ChartFrame>

        <ChartFrame
          eyebrow={`FY${latestFy} subject tags`}
          title="Emerging subject areas — title-tagged"
          dek="Five keyword buckets applied to NIH + NSF top-grant titles. Sparkline shows the 20-year trajectory."
          source="agg_uni_subject_tag (title-only)"
          note="Title-only tagging — full grant abstracts are not present in the source data, so tagged dollars are a lower bound."
        >
          <ul className="divide-y divide-rule/60">
            {subjectRows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{r.label}</p>
                  <p className="text-[11px] text-text-tertiary tnum">
                    {formatDollars(r.amount)} &middot; {formatPercent(r.share)} of tagged
                  </p>
                </div>
                <Sparkline
                  data={subjectSpark[r.key] ?? []}
                  color="hsl(var(--accent))"
                  width={120}
                  height={30}
                />
              </li>
            ))}
          </ul>
        </ChartFrame>
      </div>
    </section>
  );
}

function FieldBars({
  bars,
  width,
  height,
}: {
  bars: Array<{ label: string; amount: number; is_stem: boolean }>;
  width: number;
  height: number;
}) {
  const margin = { top: 8, right: 90, bottom: 28, left: 220 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const y = scaleBand({
    domain: bars.map((b) => b.label),
    range: [0, innerH],
    padding: 0.2,
  });
  const x = scaleLinear({
    domain: [0, Math.max(1, ...bars.map((b) => b.amount))],
    range: [0, innerW],
    nice: true,
  });

  return (
    <svg width={width} height={height} role="img">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.label) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          const color = b.is_stem ? 'hsl(var(--accent))' : 'hsl(var(--mute-1))';
          return (
            <g key={b.label}>
              <rect x={0} y={by} width={bw} height={bh} fill={color} rx={2} />
              <text
                x={bw + 6}
                y={by + bh / 2}
                dy="0.35em"
                className="fill-text-secondary text-[11px] tnum"
              >
                {formatDollars(b.amount)}
              </text>
            </g>
          );
        })}
        <AxisBottom
          top={innerH}
          scale={x}
          numTicks={4}
          tickFormat={(v) => formatDollars(Number(v))}
          tickLabelProps={() => ({
            className: 'fill-text-tertiary text-[11px] tnum',
            textAnchor: 'middle',
          })}
        />
        <AxisLeft
          scale={y}
          tickLabelProps={() => ({
            className: 'fill-text-primary text-[12px]',
            textAnchor: 'end',
            dx: -6,
            dy: 4,
          })}
          hideAxisLine
          hideTicks
        />
      </Group>
    </svg>
  );
}
