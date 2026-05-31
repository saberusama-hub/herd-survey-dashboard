#!/usr/bin/env python3
"""P1.10 — HHI, Shannon entropy, and 5-yr Coefficient of Variation per inst × fy.

Inputs:
  - agg_uni_agency_split.parquet (built in P1.4) — agency shares for HHI / Shannon
  - agg_uni_total_rd.parquet     (built in P1.2) — total time series for CoV
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
WITH agency_shares AS (
  SELECT
    institution_sk,
    fiscal_year,
    agency_bucket,
    amount_nominal,
    SUM(amount_nominal) OVER (PARTITION BY institution_sk, fiscal_year) AS total
  FROM 'agg_uni_agency_split.parquet'
),
hhi AS (
  SELECT
    institution_sk,
    fiscal_year,
    SUM(POWER(amount_nominal / NULLIF(total, 0), 2)) * 10000 AS hhi,
    -SUM(
      CASE
        WHEN amount_nominal > 0 AND total > 0
          THEN (amount_nominal / total) * LN(amount_nominal / total)
        ELSE 0
      END
    ) AS shannon_entropy
  FROM agency_shares
  GROUP BY institution_sk, fiscal_year
),
cov AS (
  SELECT
    institution_sk,
    fiscal_year,
    STDDEV_POP(total_rd_nominal) OVER (
      PARTITION BY institution_sk ORDER BY fiscal_year
      ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
    ) / NULLIF(
      AVG(total_rd_nominal) OVER (
        PARTITION BY institution_sk ORDER BY fiscal_year
        ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
      ), 0) AS cov_5yr
  FROM 'agg_uni_total_rd.parquet'
)
SELECT h.institution_sk, h.fiscal_year, h.hhi, h.shannon_entropy, c.cov_5yr
FROM hhi h
LEFT JOIN cov c USING (institution_sk, fiscal_year)
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_concentration.parquet")
