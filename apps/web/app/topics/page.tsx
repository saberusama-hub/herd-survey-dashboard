'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useDuckDB } from '@/app/providers';
import { LineChart } from '@/components/charts/LineChart';
import { ChartFrame } from '@/components/editorial/ChartFrame';
import { KpiStrip } from '@/components/editorial/KpiStrip';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatCount, formatPercent } from '@/lib/format';
import {
  type TopicSummary,
  type TopicTimeline,
  type TopicTopState,
  type TopicTopUni,
  getTopicSummaries,
  getTopicTimeline,
  getTopicTopStates,
  getTopicTopUnis,
} from '@/lib/queries';

export default function TopicsPage() {
  const { ready } = useDuckDB();
  const [summaries, setSummaries] = useState<TopicSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const data = await getTopicSummaries();
      if (cancelled) return;
      setSummaries(data);
      if (data.length > 0 && !selectedTopic) setSelectedTopic(data[0].topic);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, selectedTopic]);

  const fy24Total = summaries.reduce((s, r) => s + r.fy24_amount_m, 0);
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
            },
            {
              label: 'FY2024 tagged total',
              value: `$${(fy24Total / 1000).toFixed(1)}B`,
              hint: 'Sum of all topic tags (topics can overlap)',
            },
            {
              label: 'Topics growing > 10%/yr',
              value: String(climberCount),
              hint: '5-yr CAGR',
            },
            {
              label: 'Top topic FY24',
              value: summaries[0].topic.split(' &')[0].slice(0, 14),
              hint: `$${(summaries[0].fy24_amount_m / 1000).toFixed(1)}B`,
            },
          ]}
        />
      )}

      {/* All topics leaderboard */}
      <ChartFrame
        eyebrow="National ranking"
        title="All 30 topics, FY2024"
        source="NIH ExPORTER + NSF Awards + 30-topic regex matcher"
        methodology={{
          what: 'Total federal R&D dollars tagged with each topic in FY2024, with share-of-total (sum > 100% because topics overlap) and 5-year CAGR.',
          how: 'agg_national_topic joined with agg_uni_specialization for the top university per topic. Tags applied via hand-curated case-insensitive regex on NIH project title+abstract and NSF award title+description.',
          caveats:
            'A grant can carry multiple tags (e.g. a cancer-immunology grant is in both). Shares therefore sum >100% — they represent the topic’s coverage of the federal R&D portfolio, not a partition. See /methodology#topics for the full regex set.',
        }}
      >
        <SummaryTable rows={summaries} selected={selectedTopic} onSelect={setSelectedTopic} />
      </ChartFrame>

      {/* Per-topic drill-down */}
      {selectedTopic && <TopicDetail topic={selectedTopic} />}
    </div>
  );
}

function SummaryTable({
  rows,
  selected,
  onSelect,
}: {
  rows: TopicSummary[];
  selected: string | null;
  onSelect: (t: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-text-tertiary">Loading…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-4 font-medium">Topic</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">FY24 $</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Share</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">Grants</th>
            <th className="py-2 px-3 font-medium text-right whitespace-nowrap">5y CAGR</th>
            <th className="py-2 pl-3 font-medium">Top university</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
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
                <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatPercent(r.fy24_share)}</td>
                <td className="py-1.5 px-3 text-right tnum text-text-secondary">{formatCount(r.fy24_grant_count)}</td>
                <td className={`py-1.5 px-3 text-right tnum ${cagrColor}`}>{cagrStr}</td>
                <td className="py-1.5 pl-3 text-text-secondary text-xs">{r.top_uni_name ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopicDetail({ topic }: { topic: string }) {
  const { ready } = useDuckDB();
  const [timeline, setTimeline] = useState<TopicTimeline[]>([]);
  const [topUnis, setTopUnis] = useState<TopicTopUni[]>([]);
  const [topStates, setTopStates] = useState<TopicTopState[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const [tl, tu, ts] = await Promise.all([
        getTopicTimeline(topic),
        getTopicTopUnis(topic, 15),
        getTopicTopStates(topic, 10),
      ]);
      if (cancelled) return;
      setTimeline(tl);
      setTopUnis(tu);
      setTopStates(ts);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, topic]);

  return (
    <div className="space-y-6 border-t border-rule pt-8">
      <h2 className="h-section">{topic} — drill-down</h2>

      <ChartFrame
        eyebrow="Timeline"
        title={`Federal R&D tagged with "${topic}" — FY trend`}
        source="agg_national_topic"
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
        <ChartFrame eyebrow="Top universities" title="Top 15 by tagged FY2024 $" source="agg_uni_specialization">
          {topUnis.length === 0 ? (
            <p className="text-sm text-text-tertiary">Loading…</p>
          ) : (
            <TopUnisTable rows={topUnis} />
          )}
        </ChartFrame>

        <ChartFrame eyebrow="Top states" title="Top 10 by state-topic $" source="agg_state_topic">
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

function TopUnisTable({ rows }: { rows: TopicTopUni[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">University</th>
            <th className="py-2 pr-3 font-medium text-right">$M</th>
            <th className="py-2 pl-3 font-medium text-right whitespace-nowrap">Spec score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-text-tertiary text-left">
            <th className="py-2 pr-3 font-medium">State</th>
            <th className="py-2 pr-3 font-medium text-right">$M</th>
            <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">National share</th>
            <th className="py-2 pl-3 font-medium">Top university</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.state_code} className="border-b border-rule/60 hover:bg-mute-3/30">
              <td className="py-1.5 pr-3 text-text-primary tnum">{r.state_code}</td>
              <td className="py-1.5 pr-3 text-right tnum text-text-secondary">${r.state_topic_amount_m.toFixed(0)}M</td>
              <td className="py-1.5 pr-3 text-right tnum text-text-secondary">{formatPercent(r.state_topic_share)}</td>
              <td className="py-1.5 pl-3 text-text-secondary text-xs">{r.top_uni_in_state ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
