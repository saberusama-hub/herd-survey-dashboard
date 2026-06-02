#!/usr/bin/env python3
"""Agg 21 — Per-institution NIH Institute breakdown per fiscal year.

Drills into HHS's HERD bar: for each university, how much NIH $ went to
each NIH Institute/Center (IC). Sourced from fact_nih_project (admin_ic
allocates each project to its administering IC).

Grain: HERD-side institution_sk × fiscal_year × ic_code
Columns: institution_sk, fiscal_year, ic_code, ic_full_name,
         amount_nominal, project_count
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402


SQL = """
WITH ic AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    p.admin_ic_code AS ic_code,
    -- ic_name = "<IC FULL NAME>:<project title>", split on first ':'.
    CASE
      WHEN p.ic_name IS NULL OR p.ic_name = '' THEN p.admin_ic_code
      WHEN position(':' IN p.ic_name) > 0
        THEN trim(substring(p.ic_name, 1, position(':' IN p.ic_name) - 1))
      ELSE p.ic_name
    END AS ic_full_name,
    COALESCE(p.total_cost_nominal, 0) AS amount
  FROM nih_raw p
  LEFT JOIN sk_crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE p.institution_sk IS NOT NULL
    AND p.admin_ic_code IS NOT NULL
    AND p.admin_ic_code <> ''
    AND p.fy BETWEEN 2005 AND 2024
    AND cw.herd_sk IS NOT NULL  -- HERD-side only
)
SELECT
  institution_sk,
  fiscal_year,
  ic_code,
  -- canonical: most-frequent name observed for this ic_code across all rows
  arg_max(ic_full_name, amount) AS ic_full_name,
  SUM(amount) AS amount_nominal,
  COUNT(*) AS project_count
FROM ic
GROUP BY 1, 2, 3
"""


if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_uni_nih_ic.parquet")
