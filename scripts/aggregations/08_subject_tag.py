#!/usr/bin/env python3
"""P1.9 — Subject-area tagging (AI, biomedical, materials, climate, quantum)
per institution × fy × subject_tag.

Source: sheet_05_top_grants_ledger.parquet (NIH + NSF top-grants, with
project_title). The full NSF abstract / NIH summary text is not available
in the current data layer, so this is a TITLE-ONLY tag — documented in
methodology. Coverage will be a floor (titles miss subject mentions present
only in abstracts).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import run

SUBJECT_PATTERNS = {
    "AI": r"\b(artificial intelligence|machine learning|deep learning|neural network|transformer|LLM|computer vision|NLP|natural language processing)\b",
    "biomedical": r"\b(biomedical|biomedicine|therapeutic|clinical trial|disease|cancer|immunology|oncology)\b",
    "materials": r"\b(materials science|nanomaterial|polymer|composite|alloy|semiconductor)\b",
    "climate": r"\b(climate change|carbon|greenhouse|sustainability|renewable|emission)\b",
    "quantum": r"\b(quantum computing|quantum information|qubit|quantum cryptography)\b",
}


def case_clause(tag: str, pattern: str) -> str:
    safe = pattern.replace("'", "''")
    return f"CASE WHEN regexp_matches(text, '{safe}', 'i') THEN 1 ELSE 0 END AS is_{tag.lower()}"


cases = ",\n  ".join(case_clause(t, p) for t, p in SUBJECT_PATTERNS.items())

SQL = f"""
WITH base AS (
  SELECT
    institution_sk,
    fiscal_year,
    total_cost_or_amount_usd_nominal AS amount_nominal,
    COALESCE(project_title, '') AS text
  FROM 'sheet_05_top_grants_ledger.parquet'
  WHERE institution_sk IS NOT NULL
    AND fiscal_year IS NOT NULL
    AND total_cost_or_amount_usd_nominal IS NOT NULL
),
tagged AS (
  SELECT
    institution_sk,
    fiscal_year,
    amount_nominal,
    {cases}
  FROM base
)
SELECT institution_sk, fiscal_year, 'AI' AS subject_tag,
       SUM(CASE WHEN is_ai = 1 THEN amount_nominal ELSE 0 END) AS tagged_amount
FROM tagged GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'biomedical',
       SUM(CASE WHEN is_biomedical = 1 THEN amount_nominal ELSE 0 END)
FROM tagged GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'materials',
       SUM(CASE WHEN is_materials = 1 THEN amount_nominal ELSE 0 END)
FROM tagged GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'climate',
       SUM(CASE WHEN is_climate = 1 THEN amount_nominal ELSE 0 END)
FROM tagged GROUP BY institution_sk, fiscal_year
UNION ALL
SELECT institution_sk, fiscal_year, 'quantum',
       SUM(CASE WHEN is_quantum = 1 THEN amount_nominal ELSE 0 END)
FROM tagged GROUP BY institution_sk, fiscal_year
"""

if __name__ == "__main__":
    run(SQL, "agg_uni_subject_tag.parquet")
