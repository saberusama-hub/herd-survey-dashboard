#!/usr/bin/env python3
"""P1.6 — Distinct federal PIs + $/PI per institution × fy.

Source: sheet_05_top_grants_ledger.parquet (top 20K NIH + NSF grants, with
source_system, pi_sk, institution_sk, fiscal_year, total_cost). This is a
top-grants cap (20K rows total), so pi_count is a floor estimate, not full.
Documented in methodology page (P5).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
SELECT
  institution_sk,
  fiscal_year,
  COUNT(DISTINCT pi_sk) AS pi_count,
  SUM(total_cost_or_amount_usd_nominal) AS federal_amount,
  SUM(total_cost_or_amount_usd_nominal) / NULLIF(COUNT(DISTINCT pi_sk), 0) AS amount_per_pi
FROM 'sheet_05_top_grants_ledger.parquet'
WHERE pi_sk IS NOT NULL
  AND institution_sk IS NOT NULL
  AND fiscal_year IS NOT NULL
  AND total_cost_or_amount_usd_nominal IS NOT NULL
GROUP BY institution_sk, fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_pi_metrics.parquet")
