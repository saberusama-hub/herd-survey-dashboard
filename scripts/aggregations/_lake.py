"""Helper for aggregations sourced from the raw NSF+NIH data lake.

The data lake lives outside the dashboard repo (see paths below). These
helpers build a DuckDB connection with read-only views over the raw
fact tables and the SK crosswalk, so every script can run the same
`herd_sk` joins consistently.

Output paths follow `_lib.py` conventions (parquet to apps/web/public/data,
zstd compression, printed row count + size).
"""
from __future__ import annotations

import os
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[2]
DASH = REPO_ROOT / "apps" / "web" / "public" / "data"
LAKE = Path(
    "/Users/Usama/Documents/Documents - Usama’s MacBook Pro"
    "/Claude Projects/Herd Survey/data/processed"
)

NSF_AWARD = LAKE / "fact_nsf_award.parquet"
NIH_PROJECT = LAKE / "fact_nih_project.parquet"
NIH_PI_BRIDGE = LAKE / "fact_nih_project_pi_bridge.parquet"
DIM_INSTITUTION = LAKE / "dim_institution.parquet"
CROSSWALK = DASH / "dim_institution_crosswalk.parquet"


def connect() -> duckdb.DuckDBPyConnection:
    """Open a DuckDB connection with views over the raw data lake.

    Views registered:
      - nsf_raw         (266K rows)
      - nih_raw         (1.7M rows)
      - nih_pi_bridge   (1.96M rows — multi-PI per project)
      - dim_institution
      - sk_crosswalk
      - nsf_fy   (NSF awards with derived fiscal_year from awd_eff_date)
      - nih_fy   (NIH projects with fy renamed to fiscal_year)
    """
    for p in (NSF_AWARD, NIH_PROJECT, NIH_PI_BRIDGE, DIM_INSTITUTION, CROSSWALK):
        if not p.exists():
            raise FileNotFoundError(f"Missing data lake source: {p}")

    con = duckdb.connect()
    con.execute(f"CREATE VIEW nsf_raw AS SELECT * FROM read_parquet('{NSF_AWARD}')")
    con.execute(f"CREATE VIEW nih_raw AS SELECT * FROM read_parquet('{NIH_PROJECT}')")
    con.execute(
        f"CREATE VIEW nih_pi_bridge AS SELECT * FROM read_parquet('{NIH_PI_BRIDGE}')"
    )
    con.execute(
        f"CREATE VIEW dim_institution AS SELECT * FROM read_parquet('{DIM_INSTITUTION}')"
    )
    con.execute(f"CREATE VIEW sk_crosswalk AS SELECT * FROM read_parquet('{CROSSWALK}')")

    # NSF FY = federal fiscal year of obligation date (Oct → next CY).
    con.execute("""
        CREATE VIEW nsf_fy AS
        SELECT
          *,
          CAST(
            CASE
              WHEN awd_eff_date IS NULL THEN NULL
              WHEN CAST(SUBSTRING(awd_eff_date, 6, 2) AS INTEGER) >= 10
                THEN CAST(SUBSTRING(awd_eff_date, 1, 4) AS INTEGER) + 1
              ELSE CAST(SUBSTRING(awd_eff_date, 1, 4) AS INTEGER)
            END
            AS INTEGER
          ) AS fiscal_year
        FROM nsf_raw
        WHERE awd_eff_date IS NOT NULL
    """)

    con.execute("""
        CREATE VIEW nih_fy AS
        SELECT
          *,
          fy AS fiscal_year
        FROM nih_raw
        WHERE fy IS NOT NULL
    """)
    return con


def write(con: duckdb.DuckDBPyConnection, sql: str, out_name: str) -> None:
    out_path = DASH / out_name
    os.chdir(DASH)
    con.execute(
        f"COPY ({sql}) TO '{out_path}' (FORMAT 'parquet', COMPRESSION 'zstd')"
    )
    rows = con.execute(f"SELECT COUNT(*) FROM read_parquet('{out_path}')").fetchone()[0]
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"{out_name}: {rows:,} rows, {size_mb:.2f} MB")
