#!/usr/bin/env python3
"""Agg 25 — Per-institution 5/10/20-yr growth + rank-change snapshot.

One row per HERD-tracked institution. Computes:
  - fy{05,14,19,24}_total           (nominal HERD R&D at those anchor years)
  - cagr_{5,10,20}yr                (compound annual growth, nominal)
  - yoy_change_pct                  (FY24 vs FY23)
  - fy24_rank, fy19_rank, rank_change_5yr

Filter: only institutions with FY24 total >= $5M (avoid tiny-base noise).
This filter is documented in /methodology.

Grain: institution_sk (1 row each)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run  # noqa: E402


MIN_FY24_FILTER = 5_000_000  # $5M floor — see /methodology


SQL = f"""
WITH pivoted AS (
  SELECT
    institution_sk,
    MAX(CASE WHEN fiscal_year = 2024 THEN total_rd_nominal END) AS fy24_total,
    MAX(CASE WHEN fiscal_year = 2023 THEN total_rd_nominal END) AS fy23_total,
    MAX(CASE WHEN fiscal_year = 2019 THEN total_rd_nominal END) AS fy19_total,
    MAX(CASE WHEN fiscal_year = 2014 THEN total_rd_nominal END) AS fy14_total,
    MAX(CASE WHEN fiscal_year = 2005 THEN total_rd_nominal END) AS fy05_total
  FROM 'agg_uni_total_rd.parquet'
  GROUP BY institution_sk
),
filtered AS (
  -- Floor: avoid divide-by-tiny CAGRs.
  SELECT * FROM pivoted WHERE fy24_total >= {MIN_FY24_FILTER}
),
ranked AS (
  SELECT
    p.institution_sk,
    p.fy24_total,
    p.fy23_total,
    p.fy19_total,
    p.fy14_total,
    p.fy05_total,
    -- CAGRs (nominal). Requires positive base.
    CASE WHEN p.fy19_total > 0
      THEN POWER(p.fy24_total / p.fy19_total, 1.0 / 5.0) - 1
    END AS cagr_5yr,
    CASE WHEN p.fy14_total > 0
      THEN POWER(p.fy24_total / p.fy14_total, 1.0 / 10.0) - 1
    END AS cagr_10yr,
    CASE WHEN p.fy05_total > 0
      THEN POWER(p.fy24_total / p.fy05_total, 1.0 / 19.0) - 1
    END AS cagr_20yr,
    CASE WHEN p.fy23_total > 0
      THEN (p.fy24_total - p.fy23_total) / p.fy23_total
    END AS yoy_change_pct,
    CAST(RANK() OVER (ORDER BY p.fy24_total DESC) AS INTEGER) AS fy24_rank,
    CAST(RANK() OVER (ORDER BY p.fy19_total DESC NULLS LAST) AS INTEGER) AS fy19_rank
  FROM filtered p
)
SELECT
  institution_sk,
  fy24_total,
  fy19_total,
  fy14_total,
  fy05_total,
  cagr_5yr,
  cagr_10yr,
  cagr_20yr,
  yoy_change_pct,
  fy24_rank,
  fy19_rank,
  CASE WHEN fy19_rank IS NOT NULL THEN fy19_rank - fy24_rank END AS rank_change_5yr
FROM ranked
"""


if __name__ == "__main__":
    run(SQL, "agg_uni_growth.parquet")
