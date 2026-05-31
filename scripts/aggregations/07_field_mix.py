#!/usr/bin/env python3
"""P1.8 — STEM/non-STEM + 8 HERD field categories per institution × fy.

Source: sheet_03_rd_by_field.parquet (already long-format, with field_label
and is_se boolean). The 8 HERD S&E categories plus 'Non-S&E' map directly.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
SELECT
  institution_sk,
  fiscal_year,
  field_label AS field_category,
  is_se AS is_stem,
  SUM(total_rd_usd_nominal) AS amount_nominal
FROM 'sheet_03_rd_by_field.parquet'
WHERE total_rd_usd_nominal IS NOT NULL
GROUP BY institution_sk, fiscal_year, field_label, is_se
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_field_mix.parquet")
