#!/usr/bin/env python3
"""Agg 24 — State × topic × fiscal_year rollup.

Roll the 30-topic taxonomy up to U.S. state by joining
agg_uni_topic to dim_institution.state_code. Also records the
leading institution_sk per (state, topic, fy) for direct linking.

Grain: state_code × fiscal_year × topic
Columns: state_code, fiscal_year, topic, state_topic_amount,
         state_topic_share (state share of national topic),
         top_uni_in_state (institution_sk)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run  # noqa: E402


SQL = """
WITH topic_inst AS (
  SELECT
    t.institution_sk,
    t.fiscal_year,
    t.topic,
    t.tagged_amount AS amount,
    di.state_code
  FROM 'agg_uni_topic.parquet' t
  JOIN 'dim_institution.parquet' di USING (institution_sk)
  WHERE di.state_code IS NOT NULL
    AND t.tagged_amount > 0
),
ranked AS (
  SELECT
    state_code,
    fiscal_year,
    topic,
    institution_sk,
    amount,
    ROW_NUMBER() OVER (
      PARTITION BY state_code, fiscal_year, topic
      ORDER BY amount DESC
    ) AS rn
  FROM topic_inst
),
state_rolled AS (
  SELECT
    state_code,
    fiscal_year,
    topic,
    SUM(amount) AS state_topic_amount
  FROM topic_inst
  GROUP BY 1, 2, 3
),
national_topic AS (
  SELECT
    fiscal_year,
    topic,
    SUM(amount) AS national_topic_amount
  FROM topic_inst
  GROUP BY 1, 2
),
top_uni AS (
  SELECT state_code, fiscal_year, topic, institution_sk AS top_uni_in_state
  FROM ranked
  WHERE rn = 1
)
SELECT
  sr.state_code,
  sr.fiscal_year,
  sr.topic,
  sr.state_topic_amount,
  sr.state_topic_amount / NULLIF(nt.national_topic_amount, 0) AS state_topic_share,
  tu.top_uni_in_state
FROM state_rolled sr
JOIN national_topic nt USING (fiscal_year, topic)
LEFT JOIN top_uni tu USING (state_code, fiscal_year, topic)
"""


if __name__ == "__main__":
    run(SQL, "agg_state_topic.parquet")
