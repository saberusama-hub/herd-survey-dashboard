#!/usr/bin/env python3
"""P1.7 — Decile distribution of $/PI per institution × fy.

Source: sheet_05_top_grants_ledger.parquet. Aggregates per-PI totals within
an institution × fy then buckets into NTILE(10) deciles.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
WITH pi_totals AS (
  SELECT
    institution_sk,
    fiscal_year,
    pi_sk,
    SUM(total_cost_or_amount_usd_nominal) AS pi_amount
  FROM 'sheet_05_top_grants_ledger.parquet'
  WHERE pi_sk IS NOT NULL
    AND institution_sk IS NOT NULL
    AND fiscal_year IS NOT NULL
    AND total_cost_or_amount_usd_nominal IS NOT NULL
  GROUP BY institution_sk, fiscal_year, pi_sk
),
ranked AS (
  SELECT
    institution_sk, fiscal_year, pi_amount,
    NTILE(10) OVER (
      PARTITION BY institution_sk, fiscal_year
      ORDER BY pi_amount
    ) AS decile
  FROM pi_totals
)
SELECT
  institution_sk,
  fiscal_year,
  decile,
  MIN(pi_amount) AS min_amount,
  MAX(pi_amount) AS max_amount,
  AVG(pi_amount) AS avg_amount,
  COUNT(*) AS pi_count
FROM ranked
GROUP BY institution_sk, fiscal_year, decile
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_pi_distribution.parquet")
