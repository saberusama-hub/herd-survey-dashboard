"""
verify_data.py — Smoke-test the build_data.py output.

Asserts:
  - manifest.json exists and is well-formed
  - every listed parquet exists on disk with matching SHA-256
  - row counts are non-zero
  - KPI invariants are within sane bounds (FY2024 obligations, n_universities, FY range)
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO / "apps/web/public/manifest.json"
DATA_DIR = REPO / "apps/web/public/data"

EXPECTED_SHEETS = {
    "sheet_01_institution_funding_panel",
    "sheet_02_institution_agency",
    "sheet_04_federal_rd_by_agency",
    "sheet_07_cross_source_reconciliation",
    "sheet_10_federal_rd_flow",
    "sheet_11_federal_university_bridge",
    "sheet_12_nih_ic_breakdown",
}


def fail(msg: str) -> None:
    print(f"  ✗ {msg}")
    sys.exit(1)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    if not MANIFEST_PATH.exists():
        fail(f"manifest missing: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text())

    files = manifest.get("files", {})
    missing = EXPECTED_SHEETS - set(files.keys())
    if missing:
        fail(f"missing expected sheets in manifest: {sorted(missing)}")

    for name, info in files.items():
        path = DATA_DIR / f"{name}.parquet"
        if not path.exists():
            fail(f"parquet file missing on disk: {path}")
        if info["rows"] == 0:
            fail(f"empty parquet: {name}")
        if info["size_bytes"] == 0:
            fail(f"zero-byte parquet: {name}")
        # SHA verify
        actual_sha = file_sha256(path)
        if actual_sha != info["sha256"]:
            fail(f"sha256 mismatch for {name}: manifest={info['sha256'][:12]}…, disk={actual_sha[:12]}…")

    kpis = manifest.get("kpis", {})
    if not kpis:
        fail("manifest has no kpis block")

    # Invariant: FY2024 federal obligations between $100B and $300B
    fy24 = kpis.get("fy2024_federal_obligations_usd")
    if fy24 is None or not (1e11 < fy24 < 3e11):
        fail(f"FY2024 obligations out of range: ${(fy24 or 0)/1e9:.1f}B")

    # Invariant: n_universities between 500 and 5000 (HERD reports ~1000 institutions)
    n_uni = kpis.get("n_universities")
    if n_uni is None or not (500 <= n_uni <= 5000):
        fail(f"n_universities out of range: {n_uni}")

    # Invariant: n_agencies between 10 and 200 (Sheet 04 has top-level + sub-agencies in some FYs)
    n_ag = kpis.get("n_agencies")
    if n_ag is None or not (10 <= n_ag <= 200):
        fail(f"n_agencies out of range: {n_ag}")

    # Invariant: FY range exactly 2005–2024
    if kpis.get("fy_min") != 2005 or kpis.get("fy_max") != 2024:
        fail(f"FY range unexpected: {kpis.get('fy_min')}–{kpis.get('fy_max')}")

    total_bytes = sum(v["size_bytes"] for v in files.values())
    print(f"  ✓ Manifest OK ({len(files)} files, {total_bytes/1024/1024:.1f} MB total)")
    print(f"  ✓ FY2024 federal obligations: ${fy24/1e9:.1f}B")
    print(f"  ✓ Universities (HERD): {n_uni:,}")
    print(f"  ✓ Federal agencies (sheet_04): {n_ag}")
    print(f"  ✓ FY range: {kpis['fy_min']}–{kpis['fy_max']}")


if __name__ == "__main__":
    main()
