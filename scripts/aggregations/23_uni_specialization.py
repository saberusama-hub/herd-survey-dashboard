#!/usr/bin/env python3
"""Agg 23 — University specialization scores per (uni, fy, topic).

Specialization = how disproportionately this uni concentrates a topic
relative to its general size.

  specialization_score = uni_topic_share / uni_total_share

where
  uni_topic_share = uni_topic_amount / national_topic_amount (this FY/topic)
  uni_total_share = uni_total_rd      / national_total_rd  (this FY)

Score > 1 ⇒ over-indexed; < 1 ⇒ under-indexed. Also: national rank
(by uni_topic_amount within (fy, topic)).

Grain: institution_sk × fiscal_year × topic
Inputs (lake-resident pre-aggs):
  - agg_uni_topic         (uni topic amount + grant count, HERD-side SK)
  - agg_uni_total_rd      (uni total R&D, HERD-side SK)

We compute the national topic + total denominators inline (so 5.2 isn't
coupled to other agg outputs).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run  # noqa: E402


SQL = """
WITH uni_topic AS (
  SELECT
    institution_sk,
    fiscal_year,
    topic,
    tagged_amount AS uni_topic_amount
  FROM 'agg_uni_topic.parquet'
  WHERE tagged_amount > 0
),
uni_total AS (
  SELECT
    institution_sk,
    fiscal_year,
    total_rd_nominal AS uni_total_amount
  FROM 'agg_uni_total_rd.parquet'
  WHERE total_rd_nominal > 0
),
national_topic AS (
  SELECT fiscal_year, topic, SUM(uni_topic_amount) AS national_topic_amount
  FROM uni_topic
  GROUP BY 1, 2
),
national_total AS (
  SELECT fiscal_year, SUM(uni_total_amount) AS national_total_amount
  FROM uni_total
  GROUP BY 1
),
joined AS (
  SELECT
    ut.institution_sk,
    ut.fiscal_year,
    ut.topic,
    ut.uni_topic_amount,
    nt.national_topic_amount,
    utot.uni_total_amount,
    ntot.national_total_amount,
    ut.uni_topic_amount / NULLIF(nt.national_topic_amount, 0) AS uni_topic_share,
    utot.uni_total_amount / NULLIF(ntot.national_total_amount, 0) AS uni_total_share
  FROM uni_topic ut
  JOIN national_topic nt USING (fiscal_year, topic)
  -- HERD total_rd is only available for HERD-tracked universities;
  -- restrict specialization scores to those (a federal-only uni without
  -- HERD has no meaningful baseline).
  JOIN uni_total utot
    ON utot.institution_sk = ut.institution_sk
   AND utot.fiscal_year = ut.fiscal_year
  JOIN national_total ntot USING (fiscal_year)
)
SELECT
  institution_sk,
  fiscal_year,
  topic,
  uni_topic_amount,
  uni_topic_share,
  national_topic_amount,
  uni_total_amount,
  uni_total_share,
  uni_topic_share / NULLIF(uni_total_share, 0) AS specialization_score,
  CAST(
    RANK() OVER (PARTITION BY fiscal_year, topic ORDER BY uni_topic_amount DESC)
    AS INTEGER
  ) AS topic_rank_national
FROM joined
"""


if __name__ == "__main__":
    run(SQL, "agg_uni_specialization.parquet")
