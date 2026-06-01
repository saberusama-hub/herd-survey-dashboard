#!/usr/bin/env python3
"""Agg 19 — National team-size distribution per fiscal year.

Nationally aggregated version of agg_uni_team_size (no institution group),
with share_of_total = bucket_amount / yearly_total.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402

SQL = """
WITH nsf_grants AS (
  SELECT
    n.fiscal_year,
    GREATEST(COALESCE(n.n_pi, 1), 1) AS team_size,
    COALESCE(n.awd_amount_nominal, 0) AS amount
  FROM nsf_fy n
  WHERE n.fiscal_year BETWEEN 2005 AND 2024
),
nih_team AS (
  SELECT application_id, COUNT(DISTINCT pi_sk) AS team_size
  FROM nih_pi_bridge
  WHERE pi_sk IS NOT NULL
  GROUP BY application_id
),
nih_grants AS (
  SELECT
    p.fy AS fiscal_year,
    COALESCE(t.team_size, 1) AS team_size,
    COALESCE(p.total_cost_nominal, 0) AS amount
  FROM nih_raw p
  LEFT JOIN nih_team t ON t.application_id = p.application_id
  WHERE p.fy BETWEEN 2005 AND 2024
),
all_grants AS (
  SELECT * FROM nsf_grants UNION ALL SELECT * FROM nih_grants
),
bucketed AS (
  SELECT
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
),
totals AS (
  SELECT fiscal_year, SUM(amount) AS yearly_total FROM bucketed GROUP BY 1
),
buckets AS (
  SELECT
    fiscal_year,
    team_size_bucket,
    COUNT(*) AS grant_count,
    SUM(amount) AS bucket_amount
  FROM bucketed
  GROUP BY 1, 2
)
SELECT
  b.fiscal_year,
  b.team_size_bucket,
  b.grant_count,
  b.bucket_amount AS total_amount,
  b.bucket_amount / NULLIF(t.yearly_total, 0) AS share_of_total
FROM buckets b
JOIN totals t USING (fiscal_year)
"""

if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_national_team_size.parquet")
