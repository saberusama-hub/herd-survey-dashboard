#!/usr/bin/env python3
"""Agg 18 — Per-institution 30-topic mix per fiscal year.

Replaces the 5-tag, title-only, top-grants-sampled `agg_uni_subject_tag`.
Tags ALL NSF awards (title + abstract) and ALL NIH projects (title; abstracts
not loaded into nih_raw, project_terms is structured terms only) with the
30-topic taxonomy in `_topics.py`. A grant can match multiple topics
(non-exclusive). Sums amount per (herd_sk, fiscal_year, topic).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402
from _topics import TOPICS  # noqa: E402


def topic_union_sql(amount_alias: str = "amount") -> str:
    """Emit a UNION ALL of 30 SELECTs, one per topic, against `tagged_grants`."""
    parts = []
    for topic, pat in TOPICS.items():
        safe = pat.replace("'", "''")
        topic_lit = topic.replace("'", "''")
        parts.append(f"""
SELECT
  institution_sk,
  fiscal_year,
  '{topic_lit}' AS topic,
  COUNT(*) FILTER (WHERE regexp_matches(text, '{safe}', 'i')) AS grant_count,
  SUM(CASE WHEN regexp_matches(text, '{safe}', 'i') THEN {amount_alias} ELSE 0 END) AS tagged_amount
FROM tagged_grants
GROUP BY 1, 2
""")
    return "UNION ALL".join(parts)


SQL = f"""
WITH nsf_grants AS (
  SELECT
    COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
    n.fiscal_year,
    COALESCE(n.awd_amount_nominal, 0) AS amount,
    COALESCE(n.awd_titl_txt, '') || ' ' || COALESCE(n.awd_abstr_narration, '') AS text
  FROM nsf_fy n
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
  WHERE n.institution_sk IS NOT NULL
    AND n.fiscal_year BETWEEN 2005 AND 2024
),
nih_grants AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    COALESCE(p.total_cost_nominal, 0) AS amount,
    COALESCE(p.project_title, '') || ' ' || COALESCE(p.project_terms, '') AS text
  FROM nih_raw p
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE p.institution_sk IS NOT NULL
    AND p.fy BETWEEN 2005 AND 2024
),
tagged_grants AS (
  SELECT * FROM nsf_grants
  UNION ALL
  SELECT * FROM nih_grants
)
SELECT institution_sk, fiscal_year, topic, grant_count, tagged_amount
FROM ({topic_union_sql('amount')})
WHERE grant_count > 0
"""

if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_uni_topic.parquet")
