#!/usr/bin/env python3
"""P1.5 — Federal Funds side for reconciliation: institution × fy × agency_bucket × taxonomy_version.

Source: sheet_07_cross_source_reconciliation.parquet (bottom-up federal R&D
decomposed into NIH / NSF / USAS contracts / USAS assistance per inst × fy).
There is no per-institution Federal Funds allocation table in the current data
stack (FF is national-level, materialized in sheet_11_federal_university_bridge
for /reconciliation national chart). The closest stand-in for the per-uni
chart is the bottom-up sum, keyed by reporting source — which is what the UI
needs to dumbbell against HERD per agency.

The `taxonomy_version` column is hard-coded to 'current' because the bottom-up
streams (NIH RePORTER, NSF Awards, USASpending) do not version their taxonomy
the way Federal Funds Vol 70 vs 71 do.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SOURCES = [
    ("HHS", "nih_total_cost_usd_nominal"),
    ("NSF", "nsf_fy_obligation_usd_nominal"),
    ("USAS contracts", "usaspending_contracts_usd_nominal"),
    ("USAS assistance", "usaspending_assistance_usd_nominal"),
]

selects = []
for bucket, col in SOURCES:
    selects.append(
        f"SELECT institution_sk, fiscal_year, '{bucket}' AS agency_bucket, "
        f"'current' AS taxonomy_version, "
        f"{col} AS amount_nominal "
        "FROM 'sheet_07_cross_source_reconciliation.parquet' "
        f"WHERE {col} IS NOT NULL AND {col} > 0"
    )
union = " UNION ALL ".join(selects)

SQL = f"""
WITH long AS ({union})
SELECT
  l.institution_sk,
  l.fiscal_year,
  l.agency_bucket,
  l.taxonomy_version,
  l.amount_nominal,
  l.amount_nominal * c.cpi_u_real_2024_factor AS amount_real
FROM long l
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = l.fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_federal_funds.parquet")
