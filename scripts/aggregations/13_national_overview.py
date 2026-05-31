#!/usr/bin/env python3
"""P1.14 — National R&D by fy × source_category (sum across all institutions)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
SELECT
  fiscal_year,
  source_category,
  SUM(amount_nominal) AS amount_nominal,
  SUM(amount_real) AS amount_real
FROM 'agg_uni_source_split.parquet'
GROUP BY fiscal_year, source_category
"""

if __name__ == "__main__":
    run(SQL, "agg_national_overview.parquet")
