#!/usr/bin/env python3
"""Agg 20 — National 30-topic mix per fiscal year.

Nationally aggregated version of agg_uni_topic, with share_of_total.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402
from _topics import TOPICS  # noqa: E402


def topic_union_sql() -> str:
    parts = []
    for topic, pat in TOPICS.items():
        safe = pat.replace("'", "''")
        topic_lit = topic.replace("'", "''")
        parts.append(f"""
SELECT
  fiscal_year,
  '{topic_lit}' AS topic,
  COUNT(*) FILTER (WHERE regexp_matches(text, '{safe}', 'i')) AS grant_count,
  SUM(CASE WHEN regexp_matches(text, '{safe}', 'i') THEN amount ELSE 0 END) AS tagged_amount
FROM tagged_grants
GROUP BY 1
""")
    return "UNION ALL".join(parts)


SQL = f"""
WITH nsf_grants AS (
  SELECT
    n.fiscal_year,
    COALESCE(n.awd_amount_nominal, 0) AS amount,
    COALESCE(n.awd_titl_txt, '') || ' ' || COALESCE(n.awd_abstr_narration, '') AS text
  FROM nsf_fy n
  WHERE n.fiscal_year BETWEEN 2005 AND 2024
),
nih_grants AS (
  SELECT
    p.fy AS fiscal_year,
    COALESCE(p.total_cost_nominal, 0) AS amount,
    COALESCE(p.project_title, '') || ' ' || COALESCE(p.project_terms, '') AS text
  FROM nih_raw p
  WHERE p.fy BETWEEN 2005 AND 2024
),
tagged_grants AS (
  SELECT * FROM nsf_grants UNION ALL SELECT * FROM nih_grants
),
totals AS (
  SELECT fiscal_year, SUM(amount) AS yearly_total
  FROM tagged_grants GROUP BY 1
),
topic_rows AS (
  {topic_union_sql()}
)
SELECT
  tr.fiscal_year,
  tr.topic,
  tr.grant_count,
  tr.tagged_amount,
  tr.tagged_amount / NULLIF(t.yearly_total, 0) AS share_of_total
FROM topic_rows tr
JOIN totals t USING (fiscal_year)
WHERE tr.grant_count > 0
"""

if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_national_topic.parquet")
