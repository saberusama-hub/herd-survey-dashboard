#!/usr/bin/env python3
"""P1.16 — National concentration: share of total R&D held by top-10 / top-25 / top-100 unis per fy."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
WITH ranked AS (
  SELECT
    fiscal_year,
    institution_sk,
    total_rd_nominal,
    ROW_NUMBER() OVER (PARTITION BY fiscal_year ORDER BY total_rd_nominal DESC) AS rk
  FROM 'agg_uni_total_rd.parquet'
  WHERE total_rd_nominal IS NOT NULL
),
totals AS (
  SELECT fiscal_year, SUM(total_rd_nominal) AS national_total
  FROM ranked
  GROUP BY fiscal_year
),
buckets AS (
  SELECT
    r.fiscal_year,
    SUM(CASE WHEN r.rk <= 10  THEN r.total_rd_nominal ELSE 0 END) AS top_10_sum,
    SUM(CASE WHEN r.rk <= 25  THEN r.total_rd_nominal ELSE 0 END) AS top_25_sum,
    SUM(CASE WHEN r.rk <= 100 THEN r.total_rd_nominal ELSE 0 END) AS top_100_sum,
    MAX(t.national_total) AS national_total
  FROM ranked r
  JOIN totals t USING (fiscal_year)
  GROUP BY r.fiscal_year
)
SELECT fiscal_year, 'top_10'  AS bucket, top_10_sum  / NULLIF(national_total, 0) AS share FROM buckets
UNION ALL
SELECT fiscal_year, 'top_25',  top_25_sum  / NULLIF(national_total, 0) FROM buckets
UNION ALL
SELECT fiscal_year, 'top_100', top_100_sum / NULLIF(national_total, 0) FROM buckets
"""

if __name__ == "__main__":
    run(SQL, "agg_national_concentration.parquet")
