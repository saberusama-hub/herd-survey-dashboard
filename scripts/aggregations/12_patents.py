#!/usr/bin/env python3
"""P1.13 — Patent-to-award ratio per institution × fy.

A `fact_uspto_patents` table does NOT exist in the current data layer, so
this script emits a stub per the plan: returns award_count from
sheet_05_top_grants_ledger and NULL patent_count / patents_per_award. The
methodology page documents that USPTO ingestion is out of scope for now.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
SELECT
  institution_sk,
  fiscal_year,
  COUNT(DISTINCT award_id) AS award_count,
  CAST(NULL AS BIGINT) AS patent_count,
  CAST(NULL AS DOUBLE) AS patents_per_award
FROM 'sheet_05_top_grants_ledger.parquet'
WHERE institution_sk IS NOT NULL
  AND fiscal_year IS NOT NULL
  AND award_id IS NOT NULL
GROUP BY institution_sk, fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_patents.parquet")
