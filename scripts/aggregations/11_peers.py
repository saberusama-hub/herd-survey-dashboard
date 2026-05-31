#!/usr/bin/env python3
"""P1.12 — Top 5 peer institutions per uni: same state + ±25% R&D size,
nearest by absolute R&D distance in the institution's latest fiscal year.

Inputs:
  - agg_uni_total_rd.parquet
  - dim_institution.parquet (state_code)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SQL = """
WITH latest AS (
  SELECT institution_sk, MAX(fiscal_year) AS fy
  FROM 'agg_uni_total_rd.parquet'
  GROUP BY institution_sk
),
totals AS (
  SELECT
    t.institution_sk,
    t.fiscal_year,
    t.total_rd_nominal,
    i.state_code
  FROM 'agg_uni_total_rd.parquet' t
  JOIN latest l
    ON l.institution_sk = t.institution_sk
   AND l.fy = t.fiscal_year
  JOIN 'dim_institution.parquet' i
    ON i.institution_sk = t.institution_sk
  WHERE i.state_code IS NOT NULL
),
pairs AS (
  SELECT
    a.institution_sk AS uni_sk,
    b.institution_sk AS peer_sk,
    ROW_NUMBER() OVER (
      PARTITION BY a.institution_sk
      ORDER BY ABS(a.total_rd_nominal - b.total_rd_nominal)
    ) AS rk
  FROM totals a
  JOIN totals b
    ON a.state_code = b.state_code
   AND a.institution_sk <> b.institution_sk
   AND b.total_rd_nominal BETWEEN a.total_rd_nominal * 0.75
                                AND a.total_rd_nominal * 1.25
)
SELECT uni_sk, peer_sk, rk AS peer_rank
FROM pairs
WHERE rk <= 5
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_peers.parquet")
