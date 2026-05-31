#!/usr/bin/env python3
"""P1.3 — R&D by source category per institution × fy × source.

Source: sheet_01_institution_funding_panel.parquet (wide). The wide schema has
columns `FY{YYYY} {SourceName}` for these source categories:
  - Federal government        -> federal
  - State and local government -> state
  - Business                  -> industry
  - Nonprofit organizations    -> nonprofit
  - Institution funds         -> institutional
  - All other sources         -> other
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

FYS = list(range(2005, 2025))
SOURCES = {
    "Federal government": "federal",
    "State and local government": "state",
    "Business": "industry",
    "Nonprofit organizations": "nonprofit",
    "Institution funds": "institutional",
    "All other sources": "other",
}

selects = []
for fy in FYS:
    for col, slug in SOURCES.items():
        selects.append(
            f"SELECT institution_sk, {fy} AS fiscal_year, '{slug}' AS source_category, "
            f"\"FY{fy} {col}\" AS amount_nominal "
            "FROM 'sheet_01_institution_funding_panel.parquet'"
        )
union = " UNION ALL ".join(selects)

SQL = f"""
WITH long AS ({union})
SELECT
  l.institution_sk,
  l.fiscal_year,
  l.source_category,
  l.amount_nominal,
  l.amount_nominal * c.cpi_u_real_2024_factor AS amount_real
FROM long l
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = l.fiscal_year
WHERE l.amount_nominal IS NOT NULL
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_source_split.parquet")
