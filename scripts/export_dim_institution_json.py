"""Export dim_institution.json for Next.js generateStaticParams.

Filters to the ~1,014 institutions present in sheet_01 (funding panel) — i.e.
the universe of universities with R&D data, which is what the /universities/[sk]
profile route needs to enumerate.

Schema written: [{ sk, name, state }, ...]

Run from repo root:
    .venv/bin/python3 scripts/export_dim_institution_json.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pyarrow.parquet as pq
import pyarrow.compute as pc


REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "apps" / "web" / "public" / "data"
DIM = DATA / "dim_institution.parquet"
PANEL = DATA / "sheet_01_institution_funding_panel.parquet"
OUT = DATA / "dim_institution.json"


def main() -> None:
    dim = pq.read_table(DIM, columns=["institution_sk", "canonical_name", "state_code"])
    panel = pq.read_table(PANEL, columns=["institution_sk"])

    valid_sks = set(pc.unique(panel["institution_sk"]).to_pylist())

    rows = []
    for rec in dim.to_pylist():
        sk = rec["institution_sk"]
        if sk in valid_sks:
            rows.append(
                {
                    "sk": sk,
                    "name": rec["canonical_name"],
                    "state": rec["state_code"],
                }
            )

    rows.sort(key=lambda r: r["sk"])

    OUT.write_text(json.dumps(rows))
    print(f"Wrote {len(rows)} institutions -> {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
