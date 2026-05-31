#!/usr/bin/env python3
"""P1.15 — National federal R&D by fy × agency_bucket."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
SELECT
  fiscal_year,
  agency_bucket,
  SUM(amount_nominal) AS amount_nominal,
  SUM(amount_real) AS amount_real
FROM 'agg_uni_agency_split.parquet'
GROUP BY fiscal_year, agency_bucket
"""

if __name__ == "__main__":
    run(SQL, "agg_national_agency_trend.parquet")
