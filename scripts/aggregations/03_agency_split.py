#!/usr/bin/env python3
"""P1.4 — Federal R&D per institution × fy × agency_bucket.

Source: sheet_02_institution_agency.parquet (long form, one row per inst × fy,
one column per agency). HERD Q09 reports HHS (which includes NIH) — there is
no separate NIH split here. Agency buckets retained: NSF, HHS, DOD, DOE, NASA,
USDA, plus Other (which sums ED + EPA + DOC + Other from the source).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

# Top buckets keep their HERD names; everything else is rolled into 'Other'.
KEPT = ["NSF", "HHS", "DOD", "DOE", "NASA", "USDA"]
ROLLED = ["ED", "EPA", "DOC", "Other"]

# Build the unpivot
selects = []
for agency in KEPT:
    selects.append(
        f"SELECT institution_sk, fiscal_year, '{agency}' AS agency_bucket, "
        f'"{agency}" AS amount_nominal '
        "FROM 'sheet_02_institution_agency.parquet'"
    )
# Other = sum of rolled-up columns. We coalesce nulls to 0 so the sum doesn't
# collapse to NULL when any single column is missing.
other_sum = " + ".join(f'COALESCE("{c}", 0)' for c in ROLLED)
selects.append(
    f"SELECT institution_sk, fiscal_year, 'Other' AS agency_bucket, "
    f"({other_sum}) AS amount_nominal "
    "FROM 'sheet_02_institution_agency.parquet'"
)
union = " UNION ALL ".join(selects)

SQL = f"""
WITH long AS ({union})
SELECT
  l.institution_sk,
  l.fiscal_year,
  l.agency_bucket,
  l.amount_nominal,
  l.amount_nominal * c.cpi_u_real_2024_factor AS amount_real
FROM long l
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = l.fiscal_year
WHERE l.amount_nominal IS NOT NULL
  AND l.amount_nominal > 0
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_agency_split.parquet")
