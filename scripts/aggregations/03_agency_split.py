#!/usr/bin/env python3
"""P1.4 — Federal R&D per institution × fy × agency_bucket.

S5.5 v3 REBUILD: This script now reads directly from raw
`fact_herd_expenditures.parquet` (Q='09K' for FY10-24 and Q='02b' for FY05-09)
instead of going through the sheet_02 → bridge → sheet_01 path. The bridge was
fanning out cross-tabulated totals onto multiple sheet_01 SKs (Bug #1) and
sheet_02 itself was systematically under-reporting vs HERD raw (Bug #2). The
two upstream issues cascaded into a broken national agency trend (Bug #3).

HERD raw schema for these questions:
  Q='09K' (FY10-24): `column_label` ∈ {DOD,DOE,HHS,NASA,NSF,USDA,Other agencies,Total}
                    `row_label`='All' is the cross-field total per agency.
  Q='02b' (FY05-09): same `column_label` agencies (no 'Total' column);
                    `row_label`='All' is the cross-field total per agency.
                    Other row_labels are per field of science and must be
                    excluded to avoid double-counting.

We KEEP rows with `column_label` ∈ {HHS,NSF,DOD,DOE,NASA,USDA,Other agencies}
and remap 'Other agencies' → 'Other' to match the bucket labels used
elsewhere in the dashboard. We drop the 'Total' column_label (it's just the
sum across the other buckets and would double-count).

HERD raw's `institution_sk` is the sheet_01 SK universe (verified: 1006 SKs
out of sheet_01's 1014 appear in HERD raw; the missing 8 just don't report
federal funding). No bridge, no SK remap, no fanout.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run  # noqa: E402

HERD_RAW = (
    "/Users/Usama/Documents/Documents - Usama’s MacBook Pro"
    "/Claude Projects/Herd Survey/data/processed/fact_herd_expenditures.parquet"
)

SQL = f"""
WITH raw AS (
  SELECT
    institution_sk,
    fiscal_year,
    CASE
      WHEN column_label = 'Other agencies' THEN 'Other'
      ELSE column_label
    END AS agency_bucket,
    amount_usd_nominal AS amount_nominal
  FROM read_parquet('{HERD_RAW}')
  WHERE
    -- FY10+ uses Q09K; FY05-09 uses Q02b. Both share the column_label agency
    -- buckets so a single SELECT handles the entire 20-year span.
    questionnaire_no IN ('09K', '02b')
    -- row_label='All' is the cross-field total. Other rows are per-field
    -- breakdowns (Q02b only) and must be excluded to avoid double-counting.
    AND row_label = 'All'
    -- Drop the 'Total' column (subtotal of the other agency columns).
    AND column_label <> 'Total'
    AND amount_usd_nominal IS NOT NULL
    AND amount_usd_nominal > 0
    AND institution_sk IS NOT NULL
    AND fiscal_year IS NOT NULL
)
SELECT
  r.institution_sk,
  r.fiscal_year,
  r.agency_bucket,
  r.amount_nominal,
  r.amount_nominal * c.cpi_u_real_2024_factor AS amount_real
FROM raw r
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = r.fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_agency_split.parquet")
