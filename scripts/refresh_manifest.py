"""refresh_manifest.py — regenerate apps/web/public/manifest.json from the
parquet bundle currently in apps/web/public/data/.

The original build_data.py only knows about the 12 sheets + 3 dims it builds
itself. The newer scripts/aggregations/*.py pipeline emits agg_*.parquet
files that are invisible to that script. Run this after any pipeline change
so the /downloads page enumerates every shipped file.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "apps/web/public/data"
MANIFEST_PATH = REPO / "apps/web/public/manifest.json"


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parquet_meta(path: Path) -> dict:
    pf = pq.ParquetFile(path)
    return {
        "rows": pf.metadata.num_rows,
        "size_bytes": path.stat().st_size,
        "sha256": file_sha256(path),
        "columns": [{"name": f.name, "type": str(f.type)} for f in pf.schema_arrow],
    }


def main() -> None:
    existing: dict = {}
    if MANIFEST_PATH.exists():
        try:
            existing = json.loads(MANIFEST_PATH.read_text())
        except Exception:
            existing = {}

    files = {}
    parquets = sorted(DATA_DIR.glob("*.parquet"))
    for p in parquets:
        key = p.stem
        files[key] = parquet_meta(p)

    manifest = {
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_dir": existing.get("source_dir", str(DATA_DIR.relative_to(REPO))),
        "files": files,
        "kpis": existing.get("kpis", {}),
    }

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    total_bytes = sum(f["size_bytes"] for f in files.values())
    print(f"Wrote {MANIFEST_PATH}")
    print(f"  {len(files)} files, {total_bytes / 1024 / 1024:.1f} MB total")


if __name__ == "__main__":
    main()
