#!/usr/bin/env python3
"""P1.4 — Federal R&D per institution × fy × agency_bucket.

Source: sheet_02_institution_agency.parquet (long form, one row per inst × fy,
one column per agency). HERD Q09 reports HHS (which includes NIH) — there is
no separate NIH split here. Agency buckets retained: NSF, HHS, DOD, DOE, NASA,
USDA, plus Other (which sums ED + EPA + DOC + Other from the source).

S5.5 fix: sheet_02 uses a different `institution_sk` universe than sheet_01
(the HERD-tracked panel). We bridge through sheet01_sheet02_bridge.parquet so
the output is re-keyed by sheet_01 SK. Rows whose sheet_02 SK doesn't bridge
are dropped (a sheet_02-only institution can't appear on a HERD profile page,
which lives at /universities/[sheet_01_sk]).

Multiple sheet_02 SKs may bridge to the same sheet_01 SK (e.g. sub-units
rolling up to a parent). We SUM across bridged sheet_02 SKs grouped by
(sheet_01 SK, fiscal_year, agency_bucket).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

# Top buckets keep their HERD names; everything else is rolled into 'Other'.
KEPT = ["NSF", "HHS", "DOD", "DOE", "NASA", "USDA"]
ROLLED = ["ED", "EPA", "DOC", "Other"]

# Build the unpivot (LONG form for sheet_02; SK below is still sheet_02 SK).
selects = []
for agency in KEPT:
    selects.append(
        f"SELECT institution_sk AS sheet02_sk, fiscal_year, '{agency}' AS agency_bucket, "
        f'"{agency}" AS amount_nominal '
        "FROM 'sheet_02_institution_agency.parquet'"
    )
other_sum = " + ".join(f'COALESCE("{c}", 0)' for c in ROLLED)
selects.append(
    f"SELECT institution_sk AS sheet02_sk, fiscal_year, 'Other' AS agency_bucket, "
    f"({other_sum}) AS amount_nominal "
    "FROM 'sheet_02_institution_agency.parquet'"
)
union = " UNION ALL ".join(selects)

SQL = f"""
WITH long AS ({union}),
     bridged AS (
       SELECT
         b.sheet01_sk AS institution_sk,
         l.fiscal_year,
         l.agency_bucket,
         SUM(l.amount_nominal) AS amount_nominal
       FROM long l
       JOIN 'sheet01_sheet02_bridge.parquet' b
         ON l.sheet02_sk = b.sheet02_sk
       WHERE b.sheet01_sk IS NOT NULL
         AND l.amount_nominal IS NOT NULL
         AND l.amount_nominal > 0
       GROUP BY b.sheet01_sk, l.fiscal_year, l.agency_bucket
     )
SELECT
  br.institution_sk,
  br.fiscal_year,
  br.agency_bucket,
  br.amount_nominal,
  br.amount_nominal * c.cpi_u_real_2024_factor AS amount_real
FROM bridged br
LEFT JOIN 'cpi_u_annual.parquet' c
  ON c.fy = br.fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_agency_split.parquet")
