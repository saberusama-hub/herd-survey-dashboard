#!/usr/bin/env python3
"""P1.5 — Federal Funds bottom-up side for reconciliation:
institution × fy × agency_bucket × taxonomy_version.

S5.5 v3 REBUILD: Reads raw fact tables (fact_nih_project,
fact_nsf_award_fy_obligation + fact_nsf_award, fact_usaspending_prime,
fact_usaspending_subaward_*) directly. The previous version sourced from
`sheet_07_cross_source_reconciliation.parquet`, which under-counts NIH by
10-15% at major HHS institutions (Bug #4 — sheet_07's NIH consolidation
applies a filter we can't reproduce cleanly).

Schema notes:
  - NIH: `fact_nih_project.fy` + `institution_sk`. Sub-project rows have
    NULL `total_cost_nominal`, so SUM() naturally drops them. Parent
    projects (with non-null `total_cost_nominal`) are what HERD-style
    reconciliation expects.
  - NSF: `fact_nsf_award_fy_obligation.awd_id` joins to
    `fact_nsf_award.awd_id` for `institution_sk`. The obligation table
    splits a multi-year award into its FY-of-obligation slices.
  - USAS: `fact_usaspending_prime` has one row per prime award; bucket
    by `awarding_agency_name_raw`. Subawards live in two siblings
    (assistance + contracts) keyed by `subawardee_institution_sk`.

Agency bucket mapping for USAS prime (everything else → 'Other'):
  Department of Defense                            → DOD
  Department of Health and Human Services          → HHS
  National Science Foundation                      → NSF
  Department of Energy                             → DOE
  National Aeronautics and Space Administration    → NASA
  Department of Agriculture                        → USDA

We map every raw stream through `dim_institution_crosswalk.parquet` to
re-key onto the HERD `institution_sk` (sheet_01 universe). Rows where the
federal SK doesn't bridge fall back to themselves (already a HERD SK).

`taxonomy_version = 'raw_bottomup'` distinguishes these rows from any
legacy sheet_07-sourced rows that downstream code may still be reading.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run  # noqa: E402

LAKE = (
    "/Users/Usama/Documents/Documents - Usama’s MacBook Pro"
    "/Claude Projects/Herd Survey/data/processed"
)

NIH_PROJECT = f"{LAKE}/fact_nih_project.parquet"
NSF_AWARD = f"{LAKE}/fact_nsf_award.parquet"
NSF_FY_OBLIG = f"{LAKE}/fact_nsf_award_fy_obligation.parquet"
USAS_PRIME = f"{LAKE}/fact_usaspending_prime.parquet"

SQL = f"""
WITH crosswalk AS (
  SELECT herd_sk, fed_sk
  FROM 'dim_institution_crosswalk.parquet'
),
-- NIH RePORTER: parent projects only (sub-project rows have NULL total_cost).
nih AS (
  SELECT
    COALESCE(cw.herd_sk, p.institution_sk) AS institution_sk,
    p.fy AS fiscal_year,
    'HHS' AS agency_bucket,
    SUM(p.total_cost_nominal) AS amount_nominal
  FROM read_parquet('{NIH_PROJECT}') p
  LEFT JOIN crosswalk cw ON cw.fed_sk = p.institution_sk
  WHERE p.institution_sk IS NOT NULL
    AND p.fy BETWEEN 2005 AND 2024
    AND p.total_cost_nominal IS NOT NULL
    AND p.total_cost_nominal > 0
  GROUP BY 1, 2
),
-- NSF: obligation table joined to award table for institution_sk.
nsf AS (
  SELECT
    COALESCE(cw.herd_sk, a.institution_sk) AS institution_sk,
    o.fund_oblg_fiscal_yr AS fiscal_year,
    'NSF' AS agency_bucket,
    SUM(o.fund_oblg_amt_nominal) AS amount_nominal
  FROM read_parquet('{NSF_FY_OBLIG}') o
  JOIN read_parquet('{NSF_AWARD}') a ON a.awd_id = o.awd_id
  LEFT JOIN crosswalk cw ON cw.fed_sk = a.institution_sk
  WHERE a.institution_sk IS NOT NULL
    AND o.fund_oblg_fiscal_yr BETWEEN 2005 AND 2024
    AND o.fund_oblg_amt_nominal IS NOT NULL
    AND o.fund_oblg_amt_nominal > 0
  GROUP BY 1, 2
),
-- USAS prime: bucket by awarding agency, exclude HHS+NSF (covered by NIH/NSF
-- direct streams above) so we don't double-count. Map remaining agencies into
-- the same {{HHS,NSF,DOD,DOE,NASA,USDA,Other}} buckets the HERD side uses.
usas AS (
  SELECT
    COALESCE(cw.herd_sk, u.institution_sk) AS institution_sk,
    u.fy AS fiscal_year,
    CASE
      WHEN u.awarding_agency_name_raw = 'Department of Defense' THEN 'DOD'
      WHEN u.awarding_agency_name_raw = 'Department of Energy' THEN 'DOE'
      WHEN u.awarding_agency_name_raw = 'National Aeronautics and Space Administration' THEN 'NASA'
      WHEN u.awarding_agency_name_raw = 'Department of Agriculture' THEN 'USDA'
      WHEN u.awarding_agency_name_raw = 'Department of Health and Human Services' THEN 'HHS_usas'
      WHEN u.awarding_agency_name_raw = 'National Science Foundation' THEN 'NSF_usas'
      ELSE 'Other'
    END AS agency_bucket,
    SUM(u.total_obligated_amount_nominal) AS amount_nominal
  FROM read_parquet('{USAS_PRIME}') u
  LEFT JOIN crosswalk cw ON cw.fed_sk = u.institution_sk
  WHERE u.institution_sk IS NOT NULL
    AND u.fy BETWEEN 2005 AND 2024
    AND u.total_obligated_amount_nominal IS NOT NULL
    AND u.total_obligated_amount_nominal > 0
  GROUP BY 1, 2, 3
),
-- Drop HHS_usas + NSF_usas (use NIH RePORTER + NSF Awards as authoritative).
usas_filtered AS (
  SELECT institution_sk, fiscal_year, agency_bucket, amount_nominal
  FROM usas
  WHERE agency_bucket NOT IN ('HHS_usas', 'NSF_usas')
),
combined AS (
  SELECT * FROM nih
  UNION ALL
  SELECT * FROM nsf
  UNION ALL
  SELECT * FROM usas_filtered
),
consolidated AS (
  SELECT
    institution_sk,
    fiscal_year,
    agency_bucket,
    'raw_bottomup' AS taxonomy_version,
    SUM(amount_nominal) AS amount_nominal
  FROM combined
  GROUP BY 1, 2, 3
)
SELECT
  c.institution_sk,
  c.fiscal_year,
  c.agency_bucket,
  c.taxonomy_version,
  c.amount_nominal,
  c.amount_nominal * cpi.cpi_u_real_2024_factor AS amount_real
FROM consolidated c
LEFT JOIN 'cpi_u_annual.parquet' cpi
  ON cpi.fy = c.fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_federal_funds.parquet")
