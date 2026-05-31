#!/usr/bin/env python3
"""P9.3 — Verify facts in scripts/qa/facts.json against the actual parquet data.

Runs each fact's SQL through DuckDB, compares the scalar result against the
expected value within the per-fact tolerance, and exits 0 only if all pass.

Usage:
  /private/tmp/herd_venv/bin/python scripts/qa/verify_facts.py
or:
  python3 scripts/qa/verify_facts.py
(must have duckdb installed)
"""
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FACTS_PATH = REPO / "scripts" / "qa" / "facts.json"

try:
    import duckdb  # type: ignore
except ImportError:
    print(
        "ERROR: duckdb not installed. Use /private/tmp/herd_venv/bin/python or "
        "`pip install duckdb`.",
        file=sys.stderr,
    )
    sys.exit(2)


def main() -> int:
    if not FACTS_PATH.exists():
        print(f"ERROR: facts.json not found at {FACTS_PATH}", file=sys.stderr)
        return 2

    facts = json.loads(FACTS_PATH.read_text())
    # Run from repo root so relative parquet paths in SQL work.
    os.chdir(REPO)

    con = duckdb.connect()
    failures: list[str] = []
    passes = 0

    print(f"Verifying {len(facts)} facts against parquets in {REPO}\n")

    for f in facts:
        fid = f["id"]
        try:
            row = con.execute(f["sql"]).fetchone()
            if row is None or row[0] is None:
                # Treat null as numeric zero (e.g. ARDES SUM that finds no rows).
                actual = 0.0
            else:
                actual = float(row[0])
        except Exception as e:
            print(f"  FAIL {fid}: SQL ERROR — {e}")
            failures.append(fid)
            continue

        expected = float(f["expected"])
        tol = float(f.get("tolerance_pct", 1.0)) / 100.0

        # When expected is zero, compare absolute against a small floor.
        if abs(expected) < 1e-9:
            delta = abs(actual)
            ok = delta < 1.0  # zero means exactly zero (within rounding)
        else:
            delta = abs(actual - expected) / abs(expected)
            ok = delta <= tol

        status = "PASS" if ok else "FAIL"
        # Compact numeric formatting.

        def fmt(n: float) -> str:
            if abs(n) >= 1_000_000_000:
                return f"{n/1e9:,.2f}B"
            if abs(n) >= 1_000_000:
                return f"{n/1e6:,.2f}M"
            if abs(n) >= 1_000:
                return f"{n/1e3:,.2f}K"
            if abs(n) < 1.01 and abs(n) > 0:
                return f"{n*100:,.2f}%"
            return f"{n:,.2f}"

        delta_disp = "exact" if abs(expected) < 1e-9 else f"{delta*100:.2f}%"
        print(
            f"  {status} {fid:38s} actual={fmt(actual):>10s}  expected={fmt(expected):>10s}  "
            f"delta={delta_disp:>8s} tol={tol*100:.0f}%"
        )
        if ok:
            passes += 1
        else:
            failures.append(fid)

    print(f"\nResult: {passes}/{len(facts)} facts passed.")
    if failures:
        print(f"FAIL: {len(failures)} fact(s) failed: {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
