'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';

import { LineChart } from '@/components/charts/LineChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { SortableTh, useTableSort } from '@/components/editorial/SortableTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCount, formatPercent } from '@/lib/format';
import type { TopicSummary, TopicTimeline, TopicTopState, TopicTopUni } from '@/lib/queries';

const FY_MIN = 2005;
const FY_MAX = 2024;
const ALL_YEARS = Array.from({ length: FY_MAX - FY_MIN + 1 }, (_, i) => FY_MAX - i);

interface TopicsSnapshot {
  summaries: Array<TopicSummary & { fiscal_year: number }>;
  timelines: Array<TopicTimeline & { topic: string }>;
  top_unis: Array<TopicTopUni & { fiscal_year: number; topic: string }>;
  top_states: Array<TopicTopState & { fiscal_year: number; topic: string }>;
}

export default function TopicsPage() {
  const [snapshot, setSnapshot] = useState<TopicsSnapshot | null>(null);
  const [summaryYear, setSummaryYear] = useState<number>(FY_MAX);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/snapshots/topics-snapshot.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: TopicsSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot({ summaries: [], timelines: [], top_unis: [], top_states: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter summaries to the selected year in-memory (was a DuckDB query).
  const summaries = useMemo(
    () => (snapshot?.summaries ?? []).filter((r) => r.fiscal_year === summaryYear),
    [snapshot, summaryYear],
  );

  // Auto-pick a default drill-down topic when summaries change.
  useEffect(() => {
    if (summaries.length === 0) return;
    if (!selectedTopic || !summaries.some((r) => r.topic === selectedTopic)) {
      setSelectedTopic(summaries[0].topic);
    }
  }, [summaries, selectedTopic]);

  const fySummaryTotal = summaries.reduce((s, r) => s + r.fy24_amount_m, 0);
  const topicCount = summaries.length;
  const climberCount = summaries.filter((r) => (r.cagr_5yr_pct ?? 0) > 10).length;

  return (
    <div className="container-wide py-10 md:py-14 space-y-8">
      <PageHeader
        eyebrow="Research taxonomy"
        title="Research topics"
        description="Federal R&D dollars tagged by a 30-topic taxonomy applied to grant title + abstract text. Each topic has its own dashboard — pick one to drill in."
      />

      {summaries.length === 0 ? (
        <p className="text-sm text-text-tertiary">Loading topic data…</p>
      ) : (
        <KpiStrip
          cols={4}
          tiles={[
            {
              label: 'Topics tracked',
              value: String(topicCount),
              hint: 'Hand-curated regex taxonomy',
              sources: [
                { id: 'nsf_awards', subset: 'Award title + abstract text regex-tagged against 30 topics' },
                { id: 'nih_exporter', subset: 'Project title + structured terms regex-tagged against 30 topics' },
              ],
            },
            {
              label: `FY${summaryYear} tagged total`,
              value: `$${(fySummaryTotal / 1000).toFixed(1)}B`,
              hint: 'Sum of all topic tags (topics can overlap)',
              sources: [
                { id: 'nsf_awards', subset: `Award $ summed across all topic tags for FY${summaryYear}` },
                { id: 'nih_exporter', subset: `Project $ summed across all topic tags for FY${summaryYear}` },
              ],
            },
            {
              label: 'Topics growing > 10%/yr',
              value: String(climberCount),
              hint: `5-yr CAGR ending FY${summaryYear}`,
              sources: [
                {
                  id: 'nsf_awards',
                  subset: `Tagged $ FY${summaryYear - 5} → FY${summaryYear} 5-yr CAGR per topic, count where > 10%`,
                },
                {
                  id: 'nih_exporter',
                  subset: `Tagged $ FY${summaryYear - 5} → FY${summaryYear} 5-yr CAGR per topic, count where > 10%`,
                },
              ],
            },
            {
              label: `Top topic FY${summaryYear}`,
              value: summaries[0].topic.split(' &')[0].slice(0, 14),
              hint: `$${(summaries[0].fy24_amount_m / 1000).toFixed(1)}B`,
              sources: [
                { id: 'nsf_awards', subset: `Highest tagged-$ topic for FY${summaryYear}` },
                { id: 'nih_exporter', subset: `Highest tagged-$ topic for FY${summaryYear}` },
              ],
            },
          ]}
        />
      )}

      {/* All topics leaderboard with year selector */}
      <ChartFrame
        eyebrow="National ranking"
        title={`All 30 topics, FY${summaryYear}`}
        sources={[
          {
            id: 'nsf_awards',
            subset: `Award title + abstract regex-tagged with 30-topic taxonomy; $ + grant count summed per topic for FY${summaryYear}`,
          },
          {
            id: 'nih_exporter',
            subset: `Project title + project_terms regex-tagged with 30-topic taxonomy; $ + grant count summed per topic for FY${summaryYear}`,
          },
          {
            id: 'ncses_herd',
            subset: 'Q01 Total R&D used to identify "top university" per topic via specialization score',
          },
        ]}
        methodology={{
          what: `Total federal R&D dollars tagged with each topic in FY${summaryYear}, with two share columns ($-share and grant-count share, each ≤100% per topic) and 5-year trailing CAGR.`,
          how: '$-share = topic $ ÷ total federal R&D $ for the year. Grant-share = topic grants ÷ sum of grants across all topic tags. agg_national_topic joined with agg_uni_specialization for the top university per topic. Tags applied via hand-curated case-insensitive regex on NIH project title+abstract and NSF award title+description.',
          caveats:
            'A grant can carry multiple tags (e.g. a cancer-immunology grant is in both). Each per-topic share is ≤100%, but shares can sum to >100% across topics because tags are not mutually exclusive. See /methodology#topics for the full regex set.',
        }}
      >
        <YearPicker
          label="Year"
          value={summaryYear}
          years={ALL_YEARS}
          onChange={setSummaryYear}
          helper={`Switch the leaderboard between any FY${FY_MIN} – FY${FY_MAX} ranking.`}
        />
        <SummaryTable rows={summaries} selected={selectedTopic} onSelect={setSelectedTopic} year={summaryYear} />
      </ChartFrame>

      {/* Per-topic drill-down */}
      {summaries.length > 0 && (
        <TopicDetail
          topic={selectedTopic}
          onTopicChange={setSelectedTopic}
          topics={summaries.map((r) => r.topic)}
          snapshot={snapshot}
        />
      )}
    </div>
  );
}

function SummaryTable({
  rows,
  selected,
  onSelect,
  year,
}: {
  rows: TopicSummary[];
  selected: string | null;
  onSelect: (t: string) => void;
  year: number;
}) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'fy24_amount_m', dir: 'desc' },
    accessors: {
      topic: (r) => r.topic.toLowerCase(),
      fy24_amount_m: (r) => r.fy24_amount_m,
      fy24_share: (r) => r.fy24_share,
      fy24_grant_count: (r) => r.fy24_grant_count,
      fy24_count_share: (r) => r.fy24_count_share,
      cagr_5yr_pct: (r) => r.cagr_5yr_pct,
      top_uni_name: (r) => (r.top_uni_name ?? '').toLowerCase(),
    },
    defaultDir: { topic: 'asc', top_uni_name: 'asc' },
  });
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="topic" sort={sort} onSort={requestSort} className="py-2 pr-4">
              Topic
            </SortableTh>
            <SortableTh
              sortKey="fy24_amount_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              FY{year} $
            </SortableTh>
            <SortableTh
              sortKey="fy24_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
              title="Topic $ ÷ total federal R&D $ for the year (per-topic ≤100%; sum across topics can exceed 100% because tags overlap)"
            >
              $ share
            </SortableTh>
            <SortableTh
              sortKey="fy24_grant_count"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
            >
              Grants
            </SortableTh>
            <SortableTh
              sortKey="fy24_count_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
              title="Topic grant count ÷ sum of grants across all topic tags (per-topic ≤100%; sum across topics can exceed 100% because a grant can match multiple topics)"
            >
              Grants share
            </SortableTh>
            <SortableTh
              sortKey="cagr_5yr_pct"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 px-3 whitespace-nowrap"
              title="Trailing CAGR ending in the selected FY, capped at a 5-year window. Falls back to a shorter window when 5 years of history isn't available (e.g. FY2006-FY2009 use 1-4 yr windows). Hover a value to see the exact window used."
            >
              5y CAGR
            </SortableTh>
            <SortableTh sortKey="top_uni_name" sort={sort} onSort={requestSort} className="py-2 pl-3">
              Top university
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isSelected = r.topic === selected;
            const cagrStr =
              r.cagr_5yr_pct == null ? '—' : `${r.cagr_5yr_pct > 0 ? '+' : ''}${r.cagr_5yr_pct.toFixed(1)}%`;
            const cagrColor =
              r.cagr_5yr_pct == null
                ? 'text-text-tertiary'
                : r.cagr_5yr_pct > 5
                  ? 'text-positive'
                  : r.cagr_5yr_pct < -5
                    ? 'text-negative'
                    : 'text-text-secondary';
            const cagrTitle =
              r.cagr_5yr_pct == null
                ? 'No prior-year tagged $ in the trailing 5-year window — cannot compute a CAGR.'
                : typeof r.cagr_window_yr === 'number' && r.cagr_window_yr > 0
                  ? `${r.cagr_window_yr}-year window: FY${year - r.cagr_window_yr} → FY${year}`
                  : undefined;
            return (
              <tr
                key={r.topic}
                className={`border-b border-rule/60 cursor-pointer ${isSelected ? 'bg-accent-soft/30' : 'hover:bg-mute-3/30'}`}
              >
                <td className="py-1.5 pr-4">
                  <button
                    type="button"
                    className={`text-left ${isSelected ? 'text-accent font-medium' : 'text-text-primary'}`}
                    onClick={() => onSelect(r.topic)}
                  >
                    {r.topic}
                  </button>
                </td>
                <td className="py-1.5 px-3 text-right tnum text-text-primary">
                  ${(r.fy24_amount_m / 1000).toFixed(2)}B
                </td>
                <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                  {formatPercent(r.fy24_share, { source: 'percent' })}
                </td>
                <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.fy24_grant_count)}</td>
                <td className="py-1.5 px-3 text-right tnum text-text-secondary">
                  {formatPercent(r.fy24_count_share, { source: 'percent' })}
                </td>
                <td className={`py-1.5 px-3 text-right tnum ${cagrColor}`} title={cagrTitle}>
                  {cagrStr}
                </td>
                <td className="py-1.5 pl-3 text-text-secondary text-xs">{r.top_uni_name ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopicDetail({
  topic,
  topics,
  onTopicChange,
  snapshot,
}: {
  topic: string | null;
  topics: string[];
  onTopicChange: (t: string) => void;
  snapshot: TopicsSnapshot | null;
}) {
  const [drillYear, setDrillYear] = useState<number>(FY_MAX);

  // Client-side filtering of the snapshot replaces 3 DuckDB queries per
  // (topic, year) change. Each filter runs over ~9k rows in <5 ms.
  const timeline = useMemo<TopicTimeline[]>(
    () =>
      (snapshot?.timelines ?? [])
        .filter((r) => r.topic === topic)
        .map((r) => ({
          fiscal_year: r.fiscal_year,
          tagged_amount_m: r.tagged_amount_m,
          grant_count: r.grant_count,
          share_pct: r.share_pct,
        })),
    [snapshot, topic],
  );
  const topUnis = useMemo<TopicTopUni[]>(
    () => (snapshot?.top_unis ?? []).filter((r) => r.topic === topic && r.fiscal_year === drillYear),
    [snapshot, topic, drillYear],
  );
  const topStates = useMemo<TopicTopState[]>(
    () => (snapshot?.top_states ?? []).filter((r) => r.topic === topic && r.fiscal_year === drillYear),
    [snapshot, topic, drillYear],
  );

  if (!topic) return null;

  return (
    <div className="space-y-6 border-t border-rule pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="h-section">{topic} — drill-down</h2>
        <TopicPicker value={topic} topics={topics} onChange={onTopicChange} />
      </div>

      <ChartFrame
        eyebrow="Timeline"
        title={`Federal R&D tagged with "${topic}" — FY trend`}
        sources={[
          { id: 'nsf_awards', subset: `Tagged award $ for topic "${topic}" summed per FY, FY2005–FY2024` },
          { id: 'nih_exporter', subset: `Tagged project $ for topic "${topic}" summed per FY, FY2005–FY2024` },
        ]}
        methodology={{
          what: 'Yearly tagged-amount totals for the selected topic, FY2005-2024.',
          how: 'agg_national_topic filtered to topic, ordered by fiscal_year. Tagged-amount is the sum of grant award $ where the title+abstract regex matches.',
        }}
      >
        {timeline.length === 0 ? (
          <p className="text-sm text-text-tertiary">Loading…</p>
        ) : (
          <LineChart
            data={timeline.map((r) => ({ fy: r.fiscal_year, amount: r.tagged_amount_m }))}
            xKey="fy"
            series={[{ key: 'amount', label: 'Tagged $M' }]}
            yFormat={(v) => `$${(v / 1000).toFixed(1)}B`}
            xFormat={(v) => `FY${v}`}
            height={300}
            showLegend={false}
          />
        )}
      </ChartFrame>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartFrame
          eyebrow="Top universities"
          title={`Top 15 by tagged FY${drillYear} $`}
          sources={[
            {
              id: 'nsf_awards',
              subset: `Tagged award $ for topic "${topic}" per institution, ranked top 15 for FY${drillYear}`,
            },
            {
              id: 'nih_exporter',
              subset: `Tagged project $ for topic "${topic}" per institution, ranked top 15 for FY${drillYear}`,
            },
            {
              id: 'ncses_herd',
              subset: 'Q01 Total R&D as denominator for specialization score (topic share ÷ size share)',
            },
          ]}
        >
          <YearPicker
            label="Year"
            value={drillYear}
            years={ALL_YEARS}
            onChange={setDrillYear}
            helper="Switch ranking year for both tables in this drill-down."
          />
          {topUnis.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <TopUnisTable rows={topUnis} />
          )}
        </ChartFrame>

        <ChartFrame
          eyebrow="Top states"
          title={`Top 10 by state-topic $, FY${drillYear}`}
          sources={[
            {
              id: 'nsf_awards',
              subset: `Tagged award $ for topic "${topic}" joined to state_code, summed per state, ranked top 10 for FY${drillYear}`,
            },
            {
              id: 'nih_exporter',
              subset: `Tagged project $ for topic "${topic}" joined to state_code, summed per state, ranked top 10 for FY${drillYear}`,
            },
            { id: 'ipeds', subset: 'HD directory: STABBR (state) attached to each institution_sk' },
          ]}
        >
          <YearPicker
            label="Year"
            value={drillYear}
            years={ALL_YEARS}
            onChange={setDrillYear}
            helper="Shared year selector — controls both tables."
          />
          {topStates.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <TopStatesTable rows={topStates} />
          )}
        </ChartFrame>
      </div>
    </div>
  );
}

function YearPicker({
  label,
  value,
  years,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  years: number[];
  onChange: (y: number) => void;
  helper?: string;
}) {
  const id = useId();
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider text-text-tertiary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-32 rounded-md border border-rule bg-surface-elevated px-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            FY{y}
          </option>
        ))}
      </select>
      {helper && <span className="text-[11px] italic text-text-tertiary">{helper}</span>}
    </div>
  );
}

function TopicPicker({
  value,
  topics,
  onChange,
}: {
  value: string;
  topics: string[];
  onChange: (t: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider text-text-tertiary">
        Topic
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-xs rounded-md border border-rule bg-surface-elevated px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {topics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function TopUnisTable({ rows }: { rows: TopicTopUni[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'topic_rank_national', dir: 'asc' },
    accessors: {
      topic_rank_national: (r) => r.topic_rank_national,
      canonical_name: (r) => r.canonical_name.toLowerCase(),
      uni_topic_amount_m: (r) => r.uni_topic_amount_m,
      specialization_score: (r) => r.specialization_score,
    },
    defaultDir: { topic_rank_national: 'asc', canonical_name: 'asc' },
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="topic_rank_national" sort={sort} onSort={requestSort} className="py-2 pr-3">
              #
            </SortableTh>
            <SortableTh sortKey="canonical_name" sort={sort} onSort={requestSort} className="py-2 pr-3">
              University
            </SortableTh>
            <SortableTh
              sortKey="uni_topic_amount_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pr-3"
            >
              $M
            </SortableTh>
            <SortableTh
              sortKey="specialization_score"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pl-3 whitespace-nowrap"
            >
              Spec score
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.institution_sk} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-3 tnum text-text-tertiary">{r.topic_rank_national}</td>
              <td className="py-1.5 pr-3 text-text-primary">
                <Link href={`/universities/${r.institution_sk}`} className="hover:text-accent">
                  {r.canonical_name}
                  {r.state_code && <span className="ml-2 text-text-tertiary text-xs">({r.state_code})</span>}
                </Link>
              </td>
              <td className="py-1.5 pr-3 text-right tnum text-text-secondary">${r.uni_topic_amount_m.toFixed(0)}M</td>
              <td className="py-1.5 pl-3 text-right tnum text-text-secondary">{r.specialization_score.toFixed(2)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopStatesTable({ rows }: { rows: TopicTopState[] }) {
  const {
    rows: sorted,
    sort,
    requestSort,
  } = useTableSort(rows, {
    initial: { key: 'state_topic_amount_m', dir: 'desc' },
    accessors: {
      state_code: (r) => r.state_code,
      state_topic_amount_m: (r) => r.state_topic_amount_m,
      state_topic_share: (r) => r.state_topic_share,
      top_uni_in_state: (r) => (r.top_uni_in_state ?? '').toLowerCase(),
    },
    defaultDir: { state_code: 'asc', top_uni_in_state: 'asc' },
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <SortableTh sortKey="state_code" sort={sort} onSort={requestSort} className="py-2 pr-3">
              State
            </SortableTh>
            <SortableTh
              sortKey="state_topic_amount_m"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pr-3"
            >
              $M
            </SortableTh>
            <SortableTh
              sortKey="state_topic_share"
              sort={sort}
              onSort={requestSort}
              align="right"
              className="py-2 pr-3 whitespace-nowrap"
            >
              National share
            </SortableTh>
            <SortableTh sortKey="top_uni_in_state" sort={sort} onSort={requestSort} className="py-2 pl-3">
              Top university
            </SortableTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.state_code} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-3 text-text-primary tnum">{r.state_code}</td>
              <td className="py-1.5 pr-3 text-right tnum text-text-secondary">${r.state_topic_amount_m.toFixed(0)}M</td>
              <td className="py-1.5 pr-3 text-right tnum text-text-secondary">
                {formatPercent(r.state_topic_share, { source: 'percent' })}
              </td>
              <td className="py-1.5 pl-3 text-text-secondary text-xs">{r.top_uni_in_state ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
