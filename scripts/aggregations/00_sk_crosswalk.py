#!/usr/bin/env python3
"""Build SK crosswalk: HERD survey institution_sk ↔ federal-grants institution_sk.

Both sides are subsets of the same global `dim_institution` from the data lake,
but the SAME institution (e.g. Johns Hopkins) appears under multiple SKs:
  - INST0000079 in NSF/NIH raw (with UEI FTMTDMBR29C7)
  - INST0001086 in HERD survey panel (no UEI, name+state only)
  - INST0007654 for JHU Bayview Medical Center (different entity)
  - …

This script joins HERD-side sks to one fed-side sk per institution, using
priority order:
  1) UEI match (highest confidence)
  2) IPEDS unitid match
  3) Normalized canonical_name + state_code exact match
  4) Self-match (HERD sk itself is in fed universe — common; identity match)

Output: apps/web/public/data/dim_institution_crosswalk.parquet
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import duckdb
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DASH = REPO_ROOT / "apps" / "web" / "public" / "data"
LAKE = Path(
    "/Users/Usama/Documents/Documents - Usama’s MacBook Pro"
    "/Claude Projects/Herd Survey/data/processed"
)


def _norm_name(s: object) -> str:
    if not isinstance(s, str):
        return ""
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(
        r"\b(the|inc|incorporated|university|college|llc|corp|corporation)\b",
        "",
        s,
    )
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    con = duckdb.connect()
    nsf_p = LAKE / "fact_nsf_award.parquet"
    nih_p = LAKE / "fact_nih_project.parquet"
    dim_p = LAKE / "dim_institution.parquet"
    herd_p = DASH / "sheet_01_institution_funding_panel.parquet"
    for p in (nsf_p, nih_p, dim_p, herd_p):
        if not p.exists():
            print(f"ERROR: missing {p}", file=sys.stderr)
            sys.exit(1)

    fed_sks = con.execute(f"""
        WITH all_fed AS (
            SELECT DISTINCT institution_sk FROM read_parquet('{nsf_p}')
              WHERE institution_sk IS NOT NULL
            UNION
            SELECT DISTINCT institution_sk FROM read_parquet('{nih_p}')
              WHERE institution_sk IS NOT NULL
        )
        SELECT a.institution_sk AS fed_sk,
               di.canonical_name,
               di.state_code,
               di.primary_uei,
               di.ipeds_unitid
        FROM all_fed a
        LEFT JOIN read_parquet('{dim_p}') di
          ON a.institution_sk = di.institution_sk
    """).fetchdf()

    herd_sks = con.execute(f"""
        SELECT DISTINCT h.institution_sk AS herd_sk,
               di.canonical_name,
               di.state_code,
               di.primary_uei,
               di.ipeds_unitid
        FROM read_parquet('{herd_p}') h
        LEFT JOIN read_parquet('{dim_p}') di
          ON h.institution_sk = di.institution_sk
    """).fetchdf()

    fed_sks["norm_name"] = fed_sks["canonical_name"].apply(_norm_name)
    herd_sks["norm_name"] = herd_sks["canonical_name"].apply(_norm_name)
    fed_set = set(fed_sks["fed_sk"])

    rows = []
    for _, h in herd_sks.iterrows():
        fed_sk: str | None = None
        method = "unmatched"
        conf = 0.0

        # Identity / self-match (HERD sk IS itself present in fed universe)
        if h.herd_sk in fed_set:
            fed_sk = h.herd_sk
            method = "self_identity"
            conf = 1.0
        # UEI
        if fed_sk is None and isinstance(h.primary_uei, str) and h.primary_uei:
            c = fed_sks[fed_sks["primary_uei"] == h.primary_uei]
            if len(c) > 0:
                fed_sk = str(c.iloc[0]["fed_sk"])
                method = "uei"
                conf = 1.0
        # IPEDS
        if fed_sk is None and isinstance(h.ipeds_unitid, str) and h.ipeds_unitid:
            c = fed_sks[fed_sks["ipeds_unitid"] == h.ipeds_unitid]
            if len(c) > 0:
                fed_sk = str(c.iloc[0]["fed_sk"])
                method = "ipeds"
                conf = 0.95
        # Name + state
        if fed_sk is None and h.norm_name and isinstance(h.state_code, str):
            c = fed_sks[
                (fed_sks["norm_name"] == h.norm_name)
                & (fed_sks["state_code"] == h.state_code)
            ]
            if len(c) > 0:
                fed_sk = str(c.iloc[0]["fed_sk"])
                method = "name_state_exact"
                conf = 0.9

        rows.append({
            "herd_sk": h.herd_sk,
            "fed_sk": fed_sk,
            "match_method": method,
            "match_confidence": conf,
            "canonical_name": h.canonical_name,
            "state_code": h.state_code,
        })

    cw = pd.DataFrame(rows)
    matched = cw[cw["fed_sk"].notna()]
    pct = len(matched) / len(cw) * 100 if len(cw) else 0
    print(f"HERD sks matched: {len(matched)}/{len(cw)} ({pct:.1f}%)")
    print("By method:")
    print(cw["match_method"].value_counts().to_string())

    out_path = DASH / "dim_institution_crosswalk.parquet"
    cw.to_parquet(out_path, compression="zstd")
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"\ndim_institution_crosswalk.parquet: {len(cw):,} rows, {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
