"""MCP tools exposed to Claude (or any MCP client)."""

from __future__ import annotations

import json
import re
from typing import Any

import duckdb

# Defensive: only SELECT/WITH/DESCRIBE/SHOW/PRAGMA. Block any mutation.
ALLOWED_PREFIXES = re.compile(r"^\s*(SELECT|WITH|DESCRIBE|SHOW|PRAGMA|EXPLAIN)\b", re.IGNORECASE)
FORBIDDEN_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|ATTACH|COPY|EXPORT|IMPORT|"
    r"INSTALL|LOAD|SET|RESET|VACUUM|CHECKPOINT|FORCE)\b",
    re.IGNORECASE,
)

ROW_CAP = 50_000


def _validate_sql(sql: str) -> None:
    """Raises ValueError if the SQL is not safely read-only."""
    if not sql.strip():
        raise ValueError("Empty SQL")
    if not ALLOWED_PREFIXES.match(sql):
        raise ValueError("Query must start with SELECT, WITH, DESCRIBE, SHOW, PRAGMA, or EXPLAIN")
    if FORBIDDEN_KEYWORDS.search(sql):
        raise ValueError("Query contains forbidden keywords (write/admin ops are disallowed)")
    # one statement only
    if ";" in sql.rstrip(";\n").strip():
        raise ValueError("Only a single SQL statement is allowed")


def query_duckdb(con: duckdb.DuckDBPyConnection, sql: str) -> dict[str, Any]:
    """Run a read-only DuckDB query and return up to ROW_CAP rows."""
    _validate_sql(sql)
    con.execute(f"SET memory_limit = '512MB'; SET threads = 2;")
    capped_sql = sql.rstrip().rstrip(";")
    # Only wrap with LIMIT if the user didn't already cap rows
    if not re.search(r"\blimit\s+\d+\s*$", capped_sql, re.IGNORECASE):
        capped_sql = f"SELECT * FROM ({capped_sql}) LIMIT {ROW_CAP}"
    result = con.execute(capped_sql).fetch_arrow_table()
    df = result.to_pandas()
    columns = [{"name": c, "type": str(result.schema.field(c).type)} for c in result.column_names]
    rows = json.loads(df.to_json(orient="records", date_format="iso", default_handler=str))
    return {
        "row_count": len(rows),
        "row_cap_hit": len(rows) >= ROW_CAP,
        "columns": columns,
        "rows": rows,
    }


def list_tables(con: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    from .data import list_view_summaries

    return {"tables": list_view_summaries(con)}


def describe_table(con: duckdb.DuckDBPyConnection, table: str) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_]+", table):
        raise ValueError(f"Invalid table name: {table}")
    cols = con.execute(f"DESCRIBE {table}").fetchall()
    sample = con.execute(f"SELECT * FROM {table} LIMIT 5").fetch_arrow_table().to_pandas()
    return {
        "table": table,
        "columns": [{"name": c[0], "type": c[1]} for c in cols],
        "sample_rows": json.loads(sample.to_json(orient="records", date_format="iso", default_handler=str)),
    }


def search_institutions(con: duckdb.DuckDBPyConnection, q: str, limit: int = 25) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9 \-&,.'()]+", q):
        raise ValueError("Query contains invalid characters")
    if not (1 <= limit <= 200):
        raise ValueError("limit must be between 1 and 200")
    q_safe = q.replace("'", "''").lower()
    rows = con.execute(
        f"""
        SELECT
          institution_sk,
          ANY_VALUE(canonical_name) AS canonical_name,
          ANY_VALUE(state_code) AS state_code,
          ANY_VALUE(sector) AS sector,
          SUM(herd_federal_rd_usd_nominal) AS cumulative_herd_federal_usd_nominal
        FROM sheet_07_cross_source_reconciliation
        WHERE LOWER(canonical_name) LIKE '%{q_safe}%' OR LOWER(state_code) = '{q_safe}'
        GROUP BY institution_sk
        ORDER BY cumulative_herd_federal_usd_nominal DESC NULLS LAST
        LIMIT {limit}
        """
    ).fetchall()
    cols = ["institution_sk", "canonical_name", "state_code", "sector", "cumulative_herd_federal_usd_nominal"]
    return {"results": [dict(zip(cols, r)) for r in rows]}


def get_methodology() -> dict[str, Any]:
    """Returns the documented caveats and source attribution."""
    return {
        "sources": [
            {"name": "HERD", "agency": "NCSES", "role": "Top-down R&D expenditures (universities self-report)."},
            {"name": "USAspending", "agency": "Treasury/OMB", "role": "Federal contracts + assistance awards."},
            {"name": "NIH ExPORTER", "agency": "NIH", "role": "NIH project-level awards by FY."},
            {"name": "NSF Awards", "agency": "NSF", "role": "NSF award-level obligations by FY."},
            {"name": "SBIR.gov", "agency": "SBA", "role": "SBIR + STTR awards."},
            {"name": "Federal Funds", "agency": "NCSES", "role": "Agency-reported R&D obligations and outlays."},
            {"name": "BLS CPI-U", "agency": "BLS", "role": "Inflation adjustment to FY2024 dollars."},
        ],
        "fy_range": {"min": 2005, "max": 2024},
        "n_universities_in_herd": 1014,
        "caveats": [
            "USAspending coverage pre-FY2008 is sparse; pre-2008 USAS values may understate.",
            "NSF pi_sk null rate ~62.6% — cross-agency PI counts underreport.",
            "Sheet 6 has 38 fully-duplicate SBIR rows from source data.",
            "89 institutions are is_tiny_anchor (<$1M cumulative HERD federal); bottom-up deltas not meaningful.",
            "Sheet 10 absorbs Federal Funds tab003 vs agency_x_performer inconsistency in synthetic_remainder rows.",
            "HERD-reported federal R&D > Federal Funds explicit post-FY2018 (documented in Sheet 11).",
        ],
        "qa": {
            "structural_pass": "Phase 13.5 — 81 checks, 0 blockers",
            "value_pass": "Phase 13.6 — 2.7M cells scanned, 122 distinct value-level assertions, 0 blockers",
        },
        "citation": (
            "Afzal, U. (2026). Herd Survey: A longitudinal database of federal R&D funding to U.S. "
            "universities, FY2005–FY2024. NYU."
        ),
    }
