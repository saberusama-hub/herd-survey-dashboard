"""
build_data.py — Convert Herd Survey data lake → browser-bundled parquet.

Uses pyarrow only (no duckdb in the build pipeline — DuckDB lives in the
browser via DuckDB-WASM at runtime). Pre-built pyarrow wheel works on
Python 3.8 + macOS x86_64.

Source:
  - Sheets: workbook_sheets/sheet_NN_*.csv (12 sheets in long or wide format)
  - Dims:   dim_institution.parquet, dim_agency.parquet
  - Aux:    lookups/cpi_u_annual.csv

Output:
  - apps/web/public/data/*.parquet  (ZSTD-compressed)
  - apps/web/public/manifest.json   (file metadata + headline KPIs)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pacsv
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parent.parent
DATA_LAKE = Path("/Users/Usama/Documents/Documents - Usama’s MacBook Pro/Claude Projects/Herd Survey/data/processed")
SHEETS_DIR = DATA_LAKE / "workbook_sheets"
CPI_PATH = DATA_LAKE / "lookups" / "cpi_u_annual.csv"
OUT_DIR = REPO / "apps/web/public/data"
MANIFEST_PATH = REPO / "apps/web/public/manifest.json"

# (source_csv_basename, output_parquet_basename, sort_columns_or_None)
SHEET_MAP: list[tuple[str, str, Optional[list[str]]]] = [
    ("sheet_01_institution_funding_panel",   "sheet_01_institution_funding_panel",   ["institution_sk"]),
    ("sheet_02_institution_agency",          "sheet_02_institution_agency",          ["institution_sk", "fiscal_year"]),
    ("sheet_03_rd_by_field",                 "sheet_03_rd_by_field",                 None),
    ("sheet_04_federal_rd_by_agency",        "sheet_04_federal_rd_by_agency",        ["fiscal_year", "agency_sk"]),
    ("sheet_05_top_grants_ledger",           "sheet_05_top_grants_ledger",           None),
    ("sheet_06_sbir_sttr",                   "sheet_06_sbir_sttr",                   ["fiscal_year"]),
    ("sheet_07_cross_source_reconciliation", "sheet_07_cross_source_reconciliation", ["institution_sk", "fiscal_year"]),
    ("sheet_08_pi_cross_agency_portfolio",   "sheet_08_pi_cross_agency_portfolio",   None),
    ("sheet_09_data_quality",                "sheet_09_data_quality",                None),
    ("sheet_10_federal_rd_flow",             "sheet_10_federal_rd_flow",             ["fiscal_year"]),
    ("sheet_11_federal_university_bridge",   "sheet_11_federal_university_bridge",   ["fiscal_year"]),
    ("sheet_12_nih_ic_breakdown",            "sheet_12_nih_ic_breakdown",            ["institution_sk", "fiscal_year"]),
]


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parquet_metadata(path: Path) -> dict:
    pf = pq.ParquetFile(path)
    return {
        "rows": pf.metadata.num_rows,
        "size_bytes": path.stat().st_size,
        "sha256": file_sha256(path),
        "columns": [{"name": f.name, "type": str(f.type)} for f in pf.schema_arrow],
    }


def read_csv_robust(src: Path) -> pa.Table:
    """Read a CSV with default type inference. Falls back to all-string if
    pyarrow can't unify column types (some sheets mix numeric/string)."""
    try:
        return pacsv.read_csv(
            src,
            read_options=pacsv.ReadOptions(block_size=1 << 26),  # 64MB blocks
            parse_options=pacsv.ParseOptions(),
            convert_options=pacsv.ConvertOptions(),
        )
    except pa.lib.ArrowInvalid:
        # retry with all columns as strings to survive type mismatches
        with open(src, "rb") as f:
            header = f.readline().decode("utf-8", errors="replace").rstrip("\n").rstrip("\r")
        cols = [c.strip() for c in header.split(",")]
        return pacsv.read_csv(
            src,
            read_options=pacsv.ReadOptions(block_size=1 << 26),
            convert_options=pacsv.ConvertOptions(column_types={c: pa.string() for c in cols}),
        )


def sort_table(table: pa.Table, sort_columns: Optional[list[str]]) -> pa.Table:
    if not sort_columns:
        return table
    keys = [(c, "ascending") for c in sort_columns if c in table.column_names]
    if not keys:
        return table
    indices = pc.sort_indices(table, sort_keys=keys)
    return table.take(indices)


def write_parquet(table: pa.Table, out: Path) -> dict:
    pq.write_table(
        table,
        out,
        compression="zstd",
        compression_level=9,
        row_group_size=50_000,
    )
    return parquet_metadata(out)


def convert_csv(src: Path, out: Path, sort_columns: Optional[list[str]] = None) -> dict:
    table = read_csv_robust(src)
    table = sort_table(table, sort_columns)
    return write_parquet(table, out)


def convert_parquet(src: Path, out: Path) -> dict:
    table = pq.read_table(src)
    return write_parquet(table, out)


def compute_kpis(manifest: dict) -> None:
    """Compute headline KPIs from the freshly-built parquet files.

    Counts are intentionally meaningful, not raw dim_* totals:
      - n_universities: distinct institutions in HERD (sheet_01)
      - n_agencies: distinct top-level federal agencies funding R&D (sheet_04)
    """
    sheet_01 = OUT_DIR / "sheet_01_institution_funding_panel.parquet"
    sheet_04 = OUT_DIR / "sheet_04_federal_rd_by_agency.parquet"
    sheet_07 = OUT_DIR / "sheet_07_cross_source_reconciliation.parquet"

    if not sheet_04.exists():
        print("  (skipping KPIs — sheet_04 missing)")
        return

    s4 = pq.read_table(sheet_04)

    # FY2024 federal obligations
    fy24 = None
    fy_min = fy_max = None
    if "fiscal_year" in s4.column_names and "total_obligations_usd_nominal" in s4.column_names:
        mask = pc.equal(s4["fiscal_year"], 2024)
        fy24 = pc.sum(s4["total_obligations_usd_nominal"].filter(mask)).as_py()
        fy_min = pc.min(s4["fiscal_year"]).as_py()
        fy_max = pc.max(s4["fiscal_year"]).as_py()

    # Distinct federal agencies in sheet_04 (this is the universe of funders)
    n_agencies = pc.count_distinct(s4["agency_sk"]).as_py() if "agency_sk" in s4.column_names else None

    # Distinct universities in HERD panel (sheet_01)
    n_universities = None
    if sheet_01.exists():
        s1 = pq.read_table(sheet_01, columns=["institution_sk"])
        n_universities = pc.count_distinct(s1["institution_sk"]).as_py()

    # Total bottom-up federal R&D FY2024 (for context)
    fy24_bottom_up = None
    if sheet_07.exists():
        s7 = pq.read_table(sheet_07, columns=["fiscal_year", "bottom_up_sum_usd_nominal"])
        mask = pc.equal(s7["fiscal_year"], 2024)
        fy24_bottom_up = pc.sum(s7["bottom_up_sum_usd_nominal"].filter(mask)).as_py()

    manifest["kpis"] = {
        "fy2024_federal_obligations_usd": float(fy24) if fy24 is not None else None,
        "fy2024_bottom_up_usd": float(fy24_bottom_up) if fy24_bottom_up is not None else None,
        "n_universities": int(n_universities) if n_universities is not None else None,
        "n_agencies": int(n_agencies) if n_agencies is not None else None,
        "fy_min": int(fy_min) if fy_min is not None else None,
        "fy_max": int(fy_max) if fy_max is not None else None,
    }
    for k, v in manifest["kpis"].items():
        print(f"  • {k}: {v}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest: dict = {
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(DATA_LAKE),
        "files": {},
    }

    print("Sheets:")
    for src_name, out_name, sort_cols in SHEET_MAP:
        src = SHEETS_DIR / f"{src_name}.csv"
        if not src.exists():
            print(f"  ⚠️  skip {src_name}: not found at {src}")
            continue
        out = OUT_DIR / f"{out_name}.parquet"
        try:
            info = convert_csv(src, out, sort_columns=sort_cols)
            manifest["files"][out_name] = info
            print(f"  ✓ {out_name}: {info['rows']:,} rows, {info['size_bytes']/1024:.0f} KB")
        except Exception as e:
            print(f"  ✗ {out_name}: {e}")

    print("\nDimensions:")
    for src_name in ["dim_institution", "dim_agency"]:
        src = DATA_LAKE / f"{src_name}.parquet"
        if not src.exists():
            print(f"  ⚠️  skip {src_name}: not found")
            continue
        out = OUT_DIR / f"{src_name}.parquet"
        info = convert_parquet(src, out)
        manifest["files"][src_name] = info
        print(f"  ✓ {src_name}: {info['rows']:,} rows, {info['size_bytes']/1024:.0f} KB")

    if CPI_PATH.exists():
        out = OUT_DIR / "cpi_u_annual.parquet"
        info = convert_csv(CPI_PATH, out)
        manifest["files"]["cpi_u_annual"] = info
        print(f"  ✓ cpi_u_annual: {info['rows']:,} rows, {info['size_bytes']/1024:.0f} KB")

    print("\nKPIs:")
    compute_kpis(manifest)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    total_bytes = sum(v["size_bytes"] for v in manifest["files"].values())
    print(f"\n✓ Manifest written → {MANIFEST_PATH.relative_to(REPO)}")
    print(f"  Total bundle: {total_bytes/1024/1024:.1f} MB across {len(manifest['files'])} files")


if __name__ == "__main__":
    main()
