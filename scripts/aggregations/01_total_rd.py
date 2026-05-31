#!/usr/bin/env python3
"""P1.2 — Total R&D per institution × fy.

Source: sheet_01_institution_funding_panel.parquet (wide). Joins CPI for real_2024.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

# Build the unpivot UNION ALL inline for FY2005..FY2024.
FYS = list(range(2005, 2025))
union = " UNION ALL ".join(
    f"SELECT institution_sk, {fy} AS fiscal_year, \"FY{fy} Total\" AS total_rd_nominal "
    "FROM 'sheet_01_institution_funding_panel.parquet'"
    for fy in FYS
)

SQL = f"""
WITH long AS (
  {union}
)
SELECT
  l.institution_sk,
  l.fiscal_year,
  l.total_rd_nominal,
  l.total_rd_nominal * c.cpi_u_real_2024_factor AS total_rd_real
FROM long l
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = l.fiscal_year
WHERE l.total_rd_nominal IS NOT NULL
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_total_rd.parquet")
