'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useMemo, useState } from 'react';

import { ResponsiveSvg } from '@/components/charts/ResponsiveSvg';
import { Sparkline } from '@/components/charts/Sparkline';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip, type KpiTile } from '@/components/editorial/KpiStrip';
import { SectionDivider } from '@/components/editorial/SectionDivider';
import { formatDollars, formatPercent } from '@/lib/format';
import type { SpecializationRow, UniversityProfile } from '@/lib/queries';

interface Props {
  profile: UniversityProfile;
  /** Pre-computed top-5 specialization rows from the profile snapshot. */
  specialization: SpecializationRow[];
}

/**
 * Section 7 — Discipline mix.
 *
 *   - KpiStrip: STEM share %, Non-STEM share %, Shannon-entropy proxy.
 *   - Horizontal bar chart: 8 HERD field categories, latest FY.
 *   - Top-10 (expand to 30) of the new RESEARCH TOPICS taxonomy with
 *     20-year sparkline per topic. Title + (NSF) abstract / (NIH) terms
 *     pattern-matched into 30 buckets — see /methodology.
 */
export function Section7Disciplines({ profile, specialization }: Props) {
  const { fieldMix, topics } = profile;
  const [showAllTopics, setShowAllTopics] = useState(false);

  const specializationKpis = useMemo<KpiTile[]>(() => {
    if (!specialization || specialization.length === 0) return [];
    return specialization.slice(0, 3).map((s) => {
      const score = Number(s.specialization_score) || 0;
      const rank = Number(s.topic_rank_national) || 0;
      return {
        label: s.topic,
        value: `${score.toFixed(2)}×`,
        delta: `${score >= 1 ? 'Over' : 'Under'}-indexed · rank #${rank} nationally`,
        hint: (
          <span className="text-text-tertiary">{formatDollars(Number(s.uni_topic_amount) || 0)} federal $ tagged</span>
        ),
        sources: [
          { id: 'nsf_awards', subset: `Tagged award $ for topic "${s.topic}" at this institution × FY` },
          { id: 'nih_exporter', subset: `Tagged project $ for topic "${s.topic}" at this institution × FY` },
          { id: 'ncses_herd', subset: 'Q01 Total R&D as size denominator for the share-of-share normalization' },
        ],
      };
    });
  }, [specialization]);

  const view = useMemo(() => {
    if (fieldMix.length === 0 && topics.length === 0) {
      return null;
    }
    // Latest FY across the two sources.
    const allFys = [...fieldMix.map((r) => r.fiscal_year), ...topics.map((r) => r.fiscal_year)];
    if (allFys.length === 0) return null;
    const latestFy = allFys.reduce((m, fy) => (fy > m ? fy : m), allFys[0]);

    // Field mix bars (8 HERD categories, latest FY).
    const latestFieldRows = fieldMix.filter((r) => r.fiscal_year === latestFy);
    const totalAmt = latestFieldRows.reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    const stemAmt = latestFieldRows.filter((r) => r.is_stem).reduce((s, r) => s + (Number(r.amount_nominal) || 0), 0);
    const stemShare = totalAmt > 0 ? stemAmt / totalAmt : null;

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
        sources: [{ id: 'ncses_herd', subset: 'Q03 (R&D by Field of Science) STEM dollars ÷ total R&D for latest FY' }],
      },
      {
        label: `Non-STEM share · FY${latestFy}`,
        value: formatPercent(stemShare !== null ? 1 - stemShare : null),
        hint: <span className="text-text-tertiary">humanities + social sciences</span>,
        sources: [{ id: 'ncses_herd', subset: 'Q03 non-STEM dollars ÷ total R&D for latest FY' }],
      },
      {
        label: 'Field diversity (Shannon)',
        value: shannon ? shannon.toFixed(2) : '—',
        hint: <span className="text-text-tertiary">higher = more spread</span>,
        sources: [{ id: 'ncses_herd', subset: 'Q03 field shares → Shannon entropy in nats for latest FY' }],
      },
    ];

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

    // Topic rollup — latest FY ranking + 20-year sparkline per topic.
    const latestTopics = topics.filter((r) => r.fiscal_year === latestFy);
    const sortedTopics = [...latestTopics]
      .map((r) => ({
        topic: r.topic,
        amount: Number(r.tagged_amount) || 0,
        grants: Number(r.grant_count) || 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topicSpark: Record<string, Array<{ x: number; y: number }>> = {};
    for (const t of sortedTopics) {
      topicSpark[t.topic] = topics
        .filter((r) => r.topic === t.topic)
        .sort((a, b) => a.fiscal_year - b.fiscal_year)
        .map((r) => ({ x: r.fiscal_year, y: Number(r.tagged_amount) || 0 }));
    }

    return { tiles, fieldBars, sortedTopics, topicSpark, latestFy };
  }, [fieldMix, topics]);

  if (!view) {
    return (
      <section aria-labelledby="profile-section-7">
        <SectionDivider
          eyebrow="Section 7 · Disciplines"
          title="What research the money funded"
          dek="No HERD field-of-science breakdown or NSF/NIH topic data was found for this institution."
          color="hsl(var(--agency-dod))"
        />
      </section>
    );
  }

  const { tiles, fieldBars, sortedTopics, topicSpark, latestFy } = view;
  const topicsToShow = showAllTopics ? sortedTopics : sortedTopics.slice(0, 10);

  return (
    <section aria-labelledby="profile-section-7">
      <SectionDivider
        eyebrow="Section 7 · Disciplines"
        title="What research the money funded"
        dek="STEM share, the 8 HERD field-of-science categories, and a 30-topic taxonomy over NSF + NIH grant titles and abstracts. Topics are NOT mutually exclusive — a grant can match multiple."
        color="hsl(var(--agency-dod))"
      />

      <KpiStrip tiles={tiles} cols={3} />

      <div className="mt-8 space-y-10">
        {fieldBars.length > 0 && (
          <ChartFrame
            eyebrow={`FY${latestFy} field mix`}
            title="R&D spending by HERD field of science"
            dek="Latest reported year. Bars are sorted descending and direct-labeled with the dollar amount."
            sources={[
              {
                id: 'ncses_herd',
                subset:
                  'Q03 (R&D by Field of Science) for this institution, latest reported FY, across 8 HERD field categories',
              },
            ]}
            methodology={{
              what: 'Which broad academic disciplines drove R&D spending at this university in the latest year — life sciences, engineering, social sciences, humanities, and so on.',
              how: 'We sum HERD Q03 ("R&D expenditures by field of science") for the latest fiscal year across the eight HERD field categories. STEM bars are accent-colored; humanities + social sciences are muted.',
              caveats:
                'HERD field categories are coarse — "Life sciences" lumps biology + medicine; "Engineering" lumps every engineering discipline. For finer-grained labels, see the Topics chart below.',
            }}
          >
            <ResponsiveSvg height={Math.max(280, fieldBars.length * 32 + 40)}>
              {(w, h) => <FieldBars width={w} height={h} bars={fieldBars} />}
            </ResponsiveSvg>
          </ChartFrame>
        )}

        {sortedTopics.length > 0 && (
          <ChartFrame
            eyebrow={`FY${latestFy} research topics`}
            title={`Top ${showAllTopics ? sortedTopics.length : Math.min(10, sortedTopics.length)} research topics by federal $`}
            dek="30-topic taxonomy over NSF + NIH grant text (titles + NSF abstracts + NIH project terms). Sparkline = 20-year topic trajectory."
            sources={[
              {
                id: 'nsf_awards',
                subset:
                  'Award title + abstract text regex-tagged with 30-topic taxonomy; $ summed per topic × FY for this institution',
              },
              {
                id: 'nih_exporter',
                subset:
                  'Project title + project_terms regex-tagged with 30-topic taxonomy; $ summed per topic × FY for this institution',
              },
            ]}
            methodology={{
              what: 'What this university actually researches — concrete topics like "Cancer," "Quantum computing," or "Climate" — and how each topic has trended over 20 years.',
              how: 'Each NSF and NIH grant is tagged against a 30-topic regex taxonomy that scans the grant title, NSF abstract, and NIH project terms for keyword matches. We sum the tagged dollars per topic per year for this institution.',
              caveats:
                'Topics are NOT mutually exclusive — one grant can match multiple topics (e.g., "Cancer" and "AI/ML"). Patterns were tightened in May 2026 to reduce false positives on "Neuroscience" and "Earth observation." Sums per FY can exceed 100% of grants for that reason.',
            }}
          >
            <ul className="divide-y divide-rule/60">
              {topicsToShow.map((r) => (
                <li key={r.topic} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{r.topic}</p>
                    <p className="text-[11px] text-text-tertiary tnum">
                      {formatDollars(r.amount)} &middot; {r.grants.toLocaleString()} grants
                    </p>
                  </div>
                  <Sparkline data={topicSpark[r.topic] ?? []} color="hsl(var(--accent))" width={120} height={30} />
                </li>
              ))}
            </ul>
            {sortedTopics.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllTopics((v) => !v)}
                className="mt-3 text-[12px] text-accent hover:underline"
              >
                {showAllTopics ? 'Show top 10' : `Show all ${sortedTopics.length} topics`}
              </button>
            )}
          </ChartFrame>
        )}

        {/* Specialization KPIs — where this uni is over-indexed vs general size */}
        {specializationKpis.length > 0 && (
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-wider text-text-tertiary">
              Where this university specializes
            </p>
            <KpiStrip tiles={specializationKpis} cols={3} />
            <p className="mt-3 text-[11px] italic text-text-tertiary">
              Specialization score = (uni's share of that topic's national federal $) ÷ (uni's share of national HERD
              R&amp;D). Score &gt; 1 ⇒ over-indexed for the uni's size. See{' '}
              <a className="text-accent underline underline-offset-2" href="/methodology#specialization">
                methodology
              </a>{' '}
              for the formula.
            </p>
          </div>
        )}
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
    <svg width={width} height={height} role="img" aria-label="Research topics by federal funding amount">
      <Group left={margin.left} top={margin.top}>
        {bars.map((b) => {
          const by = y(b.label) ?? 0;
          const bw = x(b.amount);
          const bh = y.bandwidth();
          const color = b.is_stem ? 'hsl(var(--accent))' : 'hsl(var(--mute-1))';
          return (
            <g key={b.label}>
              <rect x={0} y={by} width={bw} height={bh} fill={color} rx={2} />
              <text x={bw + 6} y={by + bh / 2} dy="0.35em" className="fill-text-secondary text-[11px] tnum">
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
