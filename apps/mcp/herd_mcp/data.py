"""DuckDB connection + parquet registration for the Herd Survey MCP server.

The server runs in two modes:
  - LOCAL: points at a local directory of parquet files (e.g., the dashboard
    repo's apps/web/public/data/). Set HERD_DATA_DIR.
  - REMOTE: downloads parquet from a published Cloudflare Pages site at
    startup. Set HERD_DATA_URL = "https://herd-survey-dashboard.pages.dev".

In remote mode, DuckDB streams parquet over HTTP via range requests (no
local download needed). This is what runs on Hugging Face Spaces.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import duckdb

PARQUET_FILES = [
    "sheet_01_institution_funding_panel",
    "sheet_02_institution_agency",
    "sheet_03_rd_by_field",
    "sheet_04_federal_rd_by_agency",
    "sheet_05_top_grants_ledger",
    "sheet_06_sbir_sttr",
    "sheet_07_cross_source_reconciliation",
    "sheet_08_pi_cross_agency_portfolio",
    "sheet_09_data_quality",
    "sheet_10_federal_rd_flow",
    "sheet_11_federal_university_bridge",
    "sheet_12_nih_ic_breakdown",
    "dim_institution",
    "dim_agency",
    "cpi_u_annual",
]


def _resolve_source() -> tuple[str, str]:
    """Returns (mode, base) where mode is 'local' or 'remote'."""
    data_dir = os.environ.get("HERD_DATA_DIR")
    if data_dir:
        path = Path(data_dir).resolve()
        if not path.exists():
            raise FileNotFoundError(f"HERD_DATA_DIR does not exist: {path}")
        return "local", str(path)
    data_url = os.environ.get("HERD_DATA_URL", "https://herd-survey-dashboard.saber-usama.workers.dev")
    return "remote", data_url.rstrip("/")


def open_connection() -> duckdb.DuckDBPyConnection:
    """Open a read-only DuckDB connection with all sheets + dims registered as views."""
    con = duckdb.connect(":memory:", read_only=False)
    # we install httpfs for remote mode
    con.execute("INSTALL httpfs; LOAD httpfs;")

    mode, base = _resolve_source()
    for name in PARQUET_FILES:
        if mode == "local":
            url = f"{base}/{name}.parquet"
            if not Path(url).exists():
                continue
        else:
            url = f"{base}/data/{name}.parquet"
        con.execute(f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{url}')")
    return con


def list_view_summaries(con: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    """Returns metadata for each registered view: row count, columns, description."""
    summaries = []
    descriptions = _view_descriptions()
    for name in PARQUET_FILES:
        try:
            row_count = con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
            cols = con.execute(f"DESCRIBE {name}").fetchall()
            summaries.append(
                {
                    "name": name,
                    "rows": int(row_count),
                    "columns": [{"name": c[0], "type": c[1]} for c in cols],
                    "description": descriptions.get(name, ""),
                }
            )
        except Exception as e:
            summaries.append({"name": name, "error": str(e)})
    return summaries


def _view_descriptions() -> dict[str, str]:
    return {
        "sheet_01_institution_funding_panel": (
            "Wide: one row per institution, columns are FY×source crossings "
            "(FY2005 Federal government, FY2005 State and local government, ...)."
        ),
        "sheet_02_institution_agency": (
            "Long: (institution × FY) with agency-short columns (NSF, DOD, DOE, NASA, USDA, ED, EPA, HHS, DOC, Other)."
        ),
        "sheet_03_rd_by_field": "R&D expenditures by field of science (institution × FY × field).",
        "sheet_04_federal_rd_by_agency": (
            "Federal R&D obligations by agency × fiscal_year. "
            "Includes basic/applied/dev splits and CPI-adjusted real_2024 columns."
        ),
        "sheet_05_top_grants_ledger": "Ledger of top federal grants (institution × award).",
        "sheet_06_sbir_sttr": "SBIR + STTR awards.",
        "sheet_07_cross_source_reconciliation": (
            "Per-institution × FY reconciliation between HERD (top-down) "
            "and bottom-up sum (NIH+NSF+USAS contracts+USAS assistance). "
            "Includes delta_usd, delta_pct, is_tiny_anchor flag, cumulative columns."
        ),
        "sheet_08_pi_cross_agency_portfolio": "PIs active across multiple federal agencies.",
        "sheet_09_data_quality": "Build provenance and data-quality artifacts.",
        "sheet_10_federal_rd_flow": (
            "3-level tree of federal R&D flow: Federal total → Agency → Performer category. "
            "Includes synthetic_remainder rows for Federal Funds source-family inconsistency."
        ),
        "sheet_11_federal_university_bridge": (
            "National-level bridge: Federal Funds explicit vs FF estimate-with-allocation vs HERD reported."
        ),
        "sheet_12_nih_ic_breakdown": (
            "NIH IC breakdown (institution × FY) with columns nih_<IC>_usd_nominal for top 12 ICs."
        ),
        "dim_institution": "Canonical institution dimension (75k rows including FFRDCs and related).",
        "dim_agency": "Canonical agency dimension (1,898 rows including sub-agencies).",
        "cpi_u_annual": "BLS CPI-U annual averages (used to compute real_2024 columns).",
    }
