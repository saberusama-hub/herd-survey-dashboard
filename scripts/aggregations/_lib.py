"""Shared helpers for aggregation scripts.

Each aggregation script reads source parquets, computes the aggregate,
writes the result to apps/web/public/data/agg_<name>.parquet, and prints
row count + size.

Source schema reality (verified on real data, not the spec's hypotheticals):
  - No fact_* tables exist; we derive from existing sheet_NN parquets.
  - institution_sk is STRING ('INST0000001'); state column is `state_code`;
    institution name is `canonical_name`.
  - sheet_01_institution_funding_panel.parquet is WIDE (one column per
    FY × source). Other sheets are LONG.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC = REPO_ROOT / "apps" / "web" / "public" / "data"
OUT = SRC  # write outputs into the same dir served to the browser


def run(sql: str, out_name: str) -> None:
    """Execute SQL with the data dir as the working dir, write parquet, print stats."""
    out_path = OUT / out_name
    con = duckdb.connect()
    # All input paths inside `sql` are resolved relative to OUT/SRC by convention.
    os.chdir(OUT)
    # zstd compression; out_path is absolute so it's robust regardless of cwd.
    con.execute(
        f"COPY ({sql}) TO '{out_path}' (FORMAT 'parquet', COMPRESSION 'zstd')"
    )
    rows = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{out_path}')"
    ).fetchone()[0]
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"{out_name}: {rows:,} rows, {size_mb:.2f} MB")


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)
