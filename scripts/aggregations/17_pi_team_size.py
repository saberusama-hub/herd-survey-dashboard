#!/usr/bin/env python3
"""Agg 17 — Team size distribution per institution × fiscal_year × bucket.

Team size = number of distinct PIs (lead + co-PIs) on one grant.
  - NSF: use `n_pi` column (already counts the team)
  - NIH: count rows in nih_pi_bridge per application_id

Buckets: '1' (single PI), '2-5', '6-10', '11-20', '21+'.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402

SQL = """
WITH nsf_grants AS (
  SELECT
    COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
    n.fiscal_year,
    GREATEST(COALESCE(n.n_pi, 1), 1) AS team_size,
    COALESCE(n.awd_amount_nominal, 0) AS amount
  FROM nsf_fy n
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
  WHERE n.institution_sk IS NOT NULL
    AND n.fiscal_year BETWEEN 2005 AND 2024
),
nih_team AS (
  SELECT application_id, COUNT(DISTINCT pi_sk) AS team_size
  FROM nih_pi_bridge
  WHERE pi_sk IS NOT NULL
  GROUP BY application_id
),
nih_grants AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    COALESCE(t.team_size, 1) AS team_size,
    COALESCE(p.total_cost_nominal, 0) AS amount
  FROM nih_raw p
  LEFT JOIN nih_team t ON t.application_id = p.application_id
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE p.institution_sk IS NOT NULL
    AND p.fy BETWEEN 2005 AND 2024
),
all_grants AS (
  SELECT * FROM nsf_grants
  UNION ALL
  SELECT * FROM nih_grants
),
bucketed AS (
  SELECT
    institution_sk,
    fiscal_year,
    CASE
      WHEN team_size = 1 THEN '1'
      WHEN team_size BETWEEN 2 AND 5 THEN '2-5'
      WHEN team_size BETWEEN 6 AND 10 THEN '6-10'
      WHEN team_size BETWEEN 11 AND 20 THEN '11-20'
      ELSE '21+'
    END AS team_size_bucket,
    amount
  FROM all_grants
)
SELECT
  institution_sk,
  fiscal_year,
  team_size_bucket,
  COUNT(*) AS grant_count,
  SUM(amount) AS total_amount,
  CASE
    WHEN fiscal_year = 2005 THEN 'fy05_entity_resolution_break'
    WHEN fiscal_year = 2016 THEN 'fy16_minor_break'
    ELSE 'clean'
  END AS data_quality
FROM bucketed
GROUP BY 1, 2, 3
"""

if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_uni_team_size.parquet")
