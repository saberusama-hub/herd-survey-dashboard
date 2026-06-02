#!/usr/bin/env python3
"""Agg 22 — National NIH Institute breakdown per fiscal year.

Nationally aggregated version of agg_uni_nih_ic. Includes pct_of_nih =
IC amount / total NIH amount for that FY (so the 27-IC pie always sums
to 100%).

Grain: fiscal_year × ic_code
Columns: fiscal_year, ic_code, ic_full_name, amount_nominal,
         project_count, pct_of_nih
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lake import connect, write  # noqa: E402


SQL = """
WITH ic AS (
  SELECT
    p.fy AS fiscal_year,
    p.admin_ic_code AS ic_code,
    CASE
      WHEN p.ic_name IS NULL OR p.ic_name = '' THEN p.admin_ic_code
      WHEN position(':' IN p.ic_name) > 0
        THEN trim(substring(p.ic_name, 1, position(':' IN p.ic_name) - 1))
      ELSE p.ic_name
    END AS ic_full_name,
    COALESCE(p.total_cost_nominal, 0) AS amount
  FROM nih_raw p
  WHERE p.admin_ic_code IS NOT NULL
    AND p.admin_ic_code <> ''
    AND p.fy BETWEEN 2005 AND 2024
),
agg AS (
  SELECT
    fiscal_year,
    ic_code,
    arg_max(ic_full_name, amount) AS ic_full_name,
    SUM(amount) AS amount_nominal,
    COUNT(*) AS project_count
  FROM ic
  GROUP BY 1, 2
),
totals AS (
  SELECT fiscal_year, SUM(amount_nominal) AS national_total
  FROM agg
  GROUP BY 1
)
SELECT
  a.fiscal_year,
  a.ic_code,
  a.ic_full_name,
  a.amount_nominal,
  a.project_count,
  a.amount_nominal / NULLIF(t.national_total, 0) AS pct_of_nih
FROM agg a
JOIN totals t USING (fiscal_year)
"""


if __name__ == "__main__":
    con = connect()
    write(con, SQL, "agg_national_nih_ic.parquet")
