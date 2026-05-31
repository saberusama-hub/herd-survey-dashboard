#!/usr/bin/env python3
"""P1.11 — State context per institution × fy: uni total / state total share.

Inputs:
  - agg_uni_total_rd.parquet
  - dim_institution.parquet (state_code column — NOT 'state_abbrev')
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
WITH inst_state AS (
  SELECT institution_sk, state_code
  FROM 'dim_institution.parquet'
  WHERE state_code IS NOT NULL
),
inst_fy AS (
  SELECT t.institution_sk, t.fiscal_year, t.total_rd_nominal, i.state_code
  FROM 'agg_uni_total_rd.parquet' t
  JOIN inst_state i USING (institution_sk)
),
state_total AS (
  SELECT state_code, fiscal_year, SUM(total_rd_nominal) AS state_total
  FROM inst_fy
  GROUP BY state_code, fiscal_year
)
SELECT
  f.institution_sk,
  f.fiscal_year,
  f.state_code,
  f.total_rd_nominal AS uni_total,
  s.state_total,
  f.total_rd_nominal / NULLIF(s.state_total, 0) AS share_of_state
FROM inst_fy f
JOIN state_total s
  ON s.state_code = f.state_code
 AND s.fiscal_year = f.fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_state_context.parquet")
