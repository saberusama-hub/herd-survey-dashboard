#!/usr/bin/env python3
"""Agg 16 — Full federal PI universe per institution × fiscal_year.

Replaces the top-1K-grants `agg_uni_pi_metrics` floor estimate. Counts every
distinct PI (lead + co-PIs) receiving any NSF or NIH funding to an
institution in a given fiscal year, summed across the two agencies.

Grain: herd_sk × fiscal_year.

distinct_pi_count = COUNT(DISTINCT pi_sk) UNION across:
  - nsf_fy.pi_sk (lead PI; NSF has 1 row per award)
  - nih_pi_bridge.pi_sk (all PIs incl. co-PIs from multi-PI projects)

Amounts come from the FULL nsf/nih project tables (not the top-grants sample).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402

SQL = """
WITH nsf_pis AS (
  SELECT
    COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
    n.fiscal_year,
    n.pi_sk
  FROM nsf_fy n
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
  WHERE n.pi_sk IS NOT NULL
    AND n.institution_sk IS NOT NULL
    AND n.fiscal_year BETWEEN 2005 AND 2024
),
nih_pis AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    b.pi_sk
  FROM nih_pi_bridge b
  JOIN nih_raw p ON p.application_id = b.application_id
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE b.pi_sk IS NOT NULL
    AND p.institution_sk IS NOT NULL
    AND p.fy BETWEEN 2005 AND 2024
),
all_pis AS (
  SELECT institution_sk, fiscal_year, pi_sk FROM nsf_pis
  UNION
  SELECT institution_sk, fiscal_year, pi_sk FROM nih_pis
),
pi_counts AS (
  SELECT institution_sk, fiscal_year, COUNT(DISTINCT pi_sk) AS distinct_pi_count
  FROM all_pis
  GROUP BY 1, 2
),
nsf_amounts AS (
  SELECT
    COALESCE(cw.herd_sk, n.institution_sk) AS institution_sk,
    n.fiscal_year,
    SUM(n.awd_amount_nominal) AS amount_nsf
  FROM nsf_fy n
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = n.institution_sk
  WHERE n.institution_sk IS NOT NULL
    AND n.fiscal_year BETWEEN 2005 AND 2024
    AND n.awd_amount_nominal IS NOT NULL
  GROUP BY 1, 2
),
nih_amounts AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    SUM(p.total_cost_nominal) AS amount_nih
  FROM nih_raw p
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE p.institution_sk IS NOT NULL
    AND p.fy BETWEEN 2005 AND 2024
    AND p.total_cost_nominal IS NOT NULL
  GROUP BY 1, 2
)
SELECT
  pc.institution_sk,
  pc.fiscal_year,
  pc.distinct_pi_count,
  COALESCE(na.amount_nsf, 0) AS federal_amount_nsf,
  COALESCE(nh.amount_nih, 0) AS federal_amount_nih,
  COALESCE(na.amount_nsf, 0) + COALESCE(nh.amount_nih, 0) AS federal_amount_total,
  (COALESCE(na.amount_nsf, 0) + COALESCE(nh.amount_nih, 0))
    / NULLIF(pc.distinct_pi_count, 0) AS amount_per_pi
FROM pi_counts pc
LEFT JOIN nsf_amounts na
  ON na.institution_sk = pc.institution_sk AND na.fiscal_year = pc.fiscal_year
LEFT JOIN nih_amounts nh
  ON nh.institution_sk = pc.institution_sk AND nh.fiscal_year = pc.fiscal_year
WHERE pc.distinct_pi_count > 0
"""

if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_uni_pi_universe.parquet")
