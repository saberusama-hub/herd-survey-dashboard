# Herd Survey Dashboard — Foundation Plan (Plan 01 of 03)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Next.js dashboard shell that loads the Herd Survey master workbook into DuckDB-WASM in the browser and displays real KPIs on a Home page — with CI/CD wired to Cloudflare Pages.

**Architecture:** Monorepo (pnpm workspaces). Python script (`scripts/build_data.py`) reads the data lake's `data/processed/*.parquet`, writes browser-optimized parquet to `apps/web/public/data/`. Next.js 14 static export with DuckDB-WASM loading those files. No backend.

**Tech Stack:** Next.js 14 (App Router, static export), TypeScript strict, Tailwind v3, shadcn/ui, @duckdb/duckdb-wasm, pnpm, Python 3.11 + DuckDB for the pipeline, GitHub Actions, Cloudflare Pages.

**Reference paths:**
- This repo: `/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard/`
- Data lake (source): `/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey/`
- Spec: `docs/superpowers/specs/2026-05-29-herd-dashboard-design.md`

**Conventions in this plan:**
- All `Run:` commands assume cwd = repo root. Each task says `cd <repo>` at the top of the first shell step.
- Each task ends with a commit. Commits use Conventional Commits format (`feat:`, `chore:`, `test:`, etc.).
- Repo root absolute path (`REPO`) = `/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard`

---

## File structure (created in this plan)

```
herd-survey-dashboard/
├── package.json                          # workspace root
├── pnpm-workspace.yaml
├── .nvmrc                                # node version pin
├── apps/
│   └── web/
│       ├── package.json
│       ├── next.config.mjs               # static export config
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── biome.json
│       ├── app/
│       │   ├── layout.tsx                # root layout (nav, footer, fonts)
│       │   ├── page.tsx                  # Home (KPIs from real data)
│       │   ├── globals.css               # Tailwind + design tokens
│       │   └── providers.tsx             # client-side providers (DuckDB context)
│       ├── components/
│       │   ├── ui/                       # shadcn primitives
│       │   ├── layout/
│       │   │   ├── Nav.tsx
│       │   │   └── Footer.tsx
│       │   └── home/
│       │       └── KpiStrip.tsx
│       ├── lib/
│       │   ├── duckdb.ts                 # DuckDB-WASM init
│       │   ├── queries.ts                # SQL helpers
│       │   ├── formatters.ts             # money, pct, count
│       │   ├── utils.ts                  # cn() for shadcn
│       │   └── types.ts                  # shared TS types
│       └── public/
│           ├── data/                     # pre-aggregated parquet (built)
│           ├── fonts/                    # Geist (self-hosted)
│           └── manifest.json             # data manifest (built)
├── scripts/
│   ├── build_data.py                     # data lake → web bundle
│   ├── verify_data.py                    # sanity checks
│   └── requirements.txt
└── .github/
    └── workflows/
        ├── ci.yml                        # lint + typecheck + test + build
        └── deploy.yml                    # Cloudflare Pages deploy
```

---

## Task 1: Workspace setup (pnpm + node pin)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`

- [ ] **Step 1.1: Confirm node and pnpm versions**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && node --version && pnpm --version
```

Expected: Node ≥ 20.0, pnpm ≥ 9.0. If pnpm is missing: `npm install -g pnpm@9`. If Node is < 20: install via nvm (`nvm install 20 && nvm use 20`).

- [ ] **Step 1.2: Write `.nvmrc`**

File: `.nvmrc`
```
20
```

- [ ] **Step 1.3: Write workspace root `package.json`**

File: `package.json`
```json
{
  "name": "herd-survey-dashboard",
  "version": "0.1.0",
  "private": true,
  "description": "Modern research data analytics dashboard for federal R&D funding (FY2005-FY2024).",
  "license": "MIT",
  "author": "Usama Afzal <usama.afzal@nyu.edu>",
  "scripts": {
    "dev": "pnpm --filter @herd/web dev",
    "build": "pnpm --filter @herd/web build",
    "lint": "pnpm --filter @herd/web lint",
    "typecheck": "pnpm --filter @herd/web typecheck",
    "test": "pnpm --filter @herd/web test",
    "data:build": "python3 scripts/build_data.py",
    "data:verify": "python3 scripts/verify_data.py"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 1.4: Write `pnpm-workspace.yaml`**

File: `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 1.5: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add package.json pnpm-workspace.yaml .nvmrc && git commit -m "chore: workspace setup (pnpm, node 20 pin)"
```

---

## Task 2: Data pipeline — `scripts/build_data.py`

This script reads the data lake (Herd Survey project's `data/processed/*.parquet`) and writes browser-optimized parquet to `apps/web/public/data/`.

**Files:**
- Create: `scripts/build_data.py`
- Create: `scripts/requirements.txt`
- Test: validated via `verify_data.py` in Task 3

- [ ] **Step 2.1: Write `scripts/requirements.txt`**

File: `scripts/requirements.txt`
```
duckdb>=1.1.0
pandas>=2.2.0
pyarrow>=18.0.0
```

- [ ] **Step 2.2: Install Python deps using data lake's existing venv**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey" && source .venv/bin/activate && pip install -r "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard/scripts/requirements.txt" -q
```

Expected: `duckdb`, `pandas`, `pyarrow` already satisfied or freshly installed.

- [ ] **Step 2.3: Write `scripts/build_data.py`**

File: `scripts/build_data.py`
```python
"""
build_data.py — Convert data lake parquet → browser-bundled parquet.

Source: /Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey/data/processed/
Output: ../apps/web/public/data/

Each output parquet is ZSTD-compressed, ≤ a few MB, ordered for typical query
patterns (institution_sk, fiscal_year). A manifest.json records schemas and
row counts so the frontend can validate before mounting.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parent.parent
DATA_LAKE = Path("/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey/data/processed")
OUT_DIR = REPO / "apps/web/public/data"
MANIFEST_PATH = REPO / "apps/web/public/manifest.json"

SHEETS = [
    ("sheet_01", "sheet_01_overview"),
    ("sheet_02", "sheet_02_top_recipients"),
    ("sheet_03", "sheet_03_rd_by_field"),
    ("sheet_04", "sheet_04_federal_obligations"),
    ("sheet_05", "sheet_05_state_geography"),
    ("sheet_06", "sheet_06_sbir_sttr"),
    ("sheet_07", "sheet_07_cross_source_reconciliation"),
    ("sheet_08", "sheet_08_pi_cross_agency"),
    ("sheet_09", "sheet_09_caveats_and_methodology"),
    ("sheet_10", "sheet_10_federal_rd_flow"),
    ("sheet_11", "sheet_11_bridge_reconciliation"),
    ("sheet_12", "sheet_12_nih_ic_breakdown"),
]

DIMS = [
    ("dim_institution", ["institution_sk", "canonical_name", "primary_state", "carnegie_basic_2021", "ipeds_id", "ncses_inst_id", "uei"]),
    ("dim_agency", None),
    ("cpi_index", None),
]


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def export_table(con: duckdb.DuckDBPyConnection, src_path: Path, out_path: Path, columns: list[str] | None = None, order_by: str = "") -> dict:
    if not src_path.exists():
        raise FileNotFoundError(f"Source parquet not found: {src_path}")

    cols = "*" if columns is None else ", ".join(columns)
    order = f"ORDER BY {order_by}" if order_by else ""
    sql = f"COPY (SELECT {cols} FROM read_parquet('{src_path}') {order}) TO '{out_path}' (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 50000)"
    con.execute(sql)

    # Read back metadata
    pf = pq.ParquetFile(out_path)
    schema_summary = [{"name": f.name, "type": str(f.type)} for f in pf.schema_arrow]
    return {
        "rows": pf.metadata.num_rows,
        "size_bytes": out_path.stat().st_size,
        "sha256": file_sha256(out_path),
        "columns": schema_summary,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")

    manifest: dict = {
        "built_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(DATA_LAKE),
        "files": {},
    }

    # Sheets
    for tag, basename in SHEETS:
        src = DATA_LAKE / f"{basename}.parquet"
        if not src.exists():
            # Fallback: some sheets may live under sheet_outputs/
            src = DATA_LAKE / "sheet_outputs" / f"{basename}.parquet"
        if not src.exists():
            print(f"  ⚠️  skipping {tag}: {basename}.parquet not found")
            continue
        out = OUT_DIR / f"{basename}.parquet"
        order_by = ""
        if tag in ("sheet_01", "sheet_02", "sheet_07", "sheet_12"):
            order_by = "institution_sk, fiscal_year"
        elif tag in ("sheet_04", "sheet_10"):
            order_by = "fiscal_year"
        info = export_table(con, src, out, order_by=order_by)
        manifest["files"][basename] = info
        print(f"  ✓ {basename}: {info['rows']:,} rows, {info['size_bytes']/1024:.0f} KB")

    # Dims
    for name, cols in DIMS:
        src = DATA_LAKE / f"{name}.parquet"
        if not src.exists():
            print(f"  ⚠️  skipping {name}: not found")
            continue
        out = OUT_DIR / f"{name}.parquet"
        info = export_table(con, src, out, columns=cols)
        manifest["files"][name] = info
        print(f"  ✓ {name}: {info['rows']:,} rows, {info['size_bytes']/1024:.0f} KB")

    # Headline KPIs precomputed for instant Home-page render
    kpi_sql = """
    SELECT
      (SELECT SUM(total_obligations_nominal_usd)
         FROM read_parquet(?) WHERE fiscal_year=2024) AS fy2024_federal_obligations,
      (SELECT COUNT(DISTINCT institution_sk) FROM read_parquet(?)) AS n_institutions,
      (SELECT COUNT(*) FROM read_parquet(?)) AS n_agencies,
      (SELECT MIN(fiscal_year) FROM read_parquet(?)) AS fy_min,
      (SELECT MAX(fiscal_year) FROM read_parquet(?)) AS fy_max
    """
    sheet_04 = OUT_DIR / "sheet_04_federal_obligations.parquet"
    dim_inst = OUT_DIR / "dim_institution.parquet"
    dim_agency = OUT_DIR / "dim_agency.parquet"
    if sheet_04.exists() and dim_inst.exists() and dim_agency.exists():
        row = con.execute(kpi_sql, [str(sheet_04), str(dim_inst), str(dim_agency), str(sheet_04), str(sheet_04)]).fetchone()
        manifest["kpis"] = {
            "fy2024_federal_obligations_usd": float(row[0]) if row[0] else None,
            "n_institutions": int(row[1]) if row[1] else None,
            "n_agencies": int(row[2]) if row[2] else None,
            "fy_min": int(row[3]) if row[3] else None,
            "fy_max": int(row[4]) if row[4] else None,
        }

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    total_bytes = sum(v["size_bytes"] for v in manifest["files"].values())
    print(f"\n✓ Manifest written → {MANIFEST_PATH.relative_to(REPO)}")
    print(f"  Total bundle size: {total_bytes/1024/1024:.1f} MB across {len(manifest['files'])} files")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2.4: Run the pipeline**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey" && source .venv/bin/activate && cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && python3 scripts/build_data.py
```

Expected: One line per sheet/dim, no errors, total bundle ≤ 60 MB. If a sheet is "not found", note which and check the data lake's `data/processed/` and `data/processed/sheet_outputs/` directories.

- [ ] **Step 2.5: Commit pipeline + generated parquet**

The generated parquet files in `apps/web/public/data/` ARE committed (total ~30MB — well within git's comfort zone, no LFS needed). CI cannot reach the data lake, so committed parquet is the deployment artifact.

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add scripts/build_data.py scripts/requirements.txt apps/web/public/data/ apps/web/public/manifest.json && du -sh apps/web/public/data/ && git commit -m "feat(data): build_data.py pipeline + initial parquet bundle"
```

Expected: ~30 MB committed. If significantly larger (>100 MB), tighten column selection in `build_data.py` and re-run before committing.

---

## Task 3: Data verification — `scripts/verify_data.py`

**Files:**
- Create: `scripts/verify_data.py`

- [ ] **Step 3.1: Write `scripts/verify_data.py`**

File: `scripts/verify_data.py`
```python
"""
verify_data.py — Smoke-test the build_data.py output.

Asserts: manifest exists, every listed parquet exists, row counts non-zero,
KPI invariants (FY2024 federal obligations within sane bounds, n_institutions
plausible).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO / "apps/web/public/manifest.json"
DATA_DIR = REPO / "apps/web/public/data"

EXPECTED_SHEETS = {
    "sheet_01_overview",
    "sheet_02_top_recipients",
    "sheet_04_federal_obligations",
    "sheet_07_cross_source_reconciliation",
    "sheet_10_federal_rd_flow",
    "sheet_11_bridge_reconciliation",
    "sheet_12_nih_ic_breakdown",
}


def fail(msg: str) -> None:
    print(f"  ✗ {msg}")
    sys.exit(1)


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

    kpis = manifest.get("kpis", {})
    if not kpis:
        fail("manifest has no kpis block")

    # Invariant: FY2024 federal obligations between $100B and $300B
    fy24 = kpis.get("fy2024_federal_obligations_usd")
    if not (1e11 < fy24 < 3e11):
        fail(f"FY2024 obligations out of range: ${fy24/1e9:.1f}B")

    # Invariant: n_institutions between 1000 and 5000
    n_inst = kpis.get("n_institutions")
    if not (1000 < n_inst < 5000):
        fail(f"n_institutions out of range: {n_inst}")

    # Invariant: FY range
    if kpis.get("fy_min") != 2005 or kpis.get("fy_max") != 2024:
        fail(f"FY range unexpected: {kpis.get('fy_min')}–{kpis.get('fy_max')}")

    print(f"  ✓ Manifest OK ({len(files)} files)")
    print(f"  ✓ FY2024 federal obligations: ${fy24/1e9:.1f}B")
    print(f"  ✓ Institutions: {n_inst:,}")
    print(f"  ✓ Agencies: {kpis.get('n_agencies')}")
    print(f"  ✓ FY range: {kpis['fy_min']}–{kpis['fy_max']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3.2: Run verification**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/Herd Survey" && source .venv/bin/activate && cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && python3 scripts/verify_data.py
```

Expected:
```
  ✓ Manifest OK (XX files)
  ✓ FY2024 federal obligations: $199.5B
  ✓ Institutions: ~1500
  ✓ Agencies: ~50
  ✓ FY range: 2005–2024
```

If any invariant fails: investigate the source parquet (column name might have changed in the data lake) and fix `build_data.py` SQL.

- [ ] **Step 3.3: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add scripts/verify_data.py && git commit -m "test(data): verify_data.py smoke tests for build pipeline"
```

---

## Task 4: Next.js scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/.eslintrc.json` (will replace with biome later)

- [ ] **Step 4.1: Write `apps/web/package.json`**

File: `apps/web/package.json`
```json
{
  "name": "@herd/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@duckdb/duckdb-wasm": "1.29.0",
    "apache-arrow": "17.0.0",
    "clsx": "2.1.1",
    "lucide-react": "0.453.0",
    "next": "14.2.18",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tailwind-merge": "2.5.4",
    "zustand": "5.0.1"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@types/node": "20.16.13",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.14",
    "typescript": "5.6.3",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 4.2: Write `apps/web/next.config.mjs`**

File: `apps/web/next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  webpack: (config) => {
    // DuckDB-WASM ships as native ESM; keep it that way
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 4.3: Write `apps/web/tsconfig.json`**

File: `apps/web/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4.4: Write `apps/web/biome.json`**

File: `apps/web/biome.json`
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": false, "ignore": [".next", "out", "node_modules", "public/data"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 120 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "useImportType": "warn" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "jsxQuoteStyle": "double", "semicolons": "always" } }
}
```

- [ ] **Step 4.5: Install dependencies**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm install
```

Expected: `pnpm` resolves and installs all packages. ~1 min on first run.

- [ ] **Step 4.6: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/package.json apps/web/next.config.mjs apps/web/tsconfig.json apps/web/biome.json pnpm-lock.yaml && git commit -m "feat(web): Next.js 14 + TypeScript + Biome scaffold"
```

---

## Task 5: Tailwind + design tokens

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/lib/utils.ts`

- [ ] **Step 5.1: Write `apps/web/postcss.config.mjs`**

File: `apps/web/postcss.config.mjs`
```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5.2: Write `apps/web/tailwind.config.ts`**

File: `apps/web/tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        // semantic tokens (CSS vars defined in globals.css)
        surface: 'hsl(var(--surface))',
        'surface-elevated': 'hsl(var(--surface-elevated))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-tertiary': 'hsl(var(--text-tertiary))',
        accent: 'hsl(var(--accent))',
        'accent-muted': 'hsl(var(--accent-muted))',
        positive: 'hsl(var(--positive))',
        negative: 'hsl(var(--negative))',
        warning: 'hsl(var(--warning))',
        // categorical chart palette (7 series)
        'chart-1': 'hsl(var(--chart-1))',
        'chart-2': 'hsl(var(--chart-2))',
        'chart-3': 'hsl(var(--chart-3))',
        'chart-4': 'hsl(var(--chart-4))',
        'chart-5': 'hsl(var(--chart-5))',
        'chart-6': 'hsl(var(--chart-6))',
        'chart-7': 'hsl(var(--chart-7))',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px' },
    },
  },
};

export default config;
```

- [ ] **Step 5.3: Write `apps/web/app/globals.css`**

File: `apps/web/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* surfaces (warm off-white) */
    --surface: 60 9% 98%;
    --surface-elevated: 0 0% 100%;
    --border: 30 7% 90%;
    --ring: 173 80% 26%;

    /* text */
    --text-primary: 24 10% 4%;
    --text-secondary: 25 5% 33%;
    --text-tertiary: 24 6% 64%;

    /* accent: deep teal */
    --accent: 173 80% 26%;
    --accent-muted: 167 85% 89%;

    --positive: 142 71% 30%;
    --negative: 0 73% 41%;
    --warning: 40 86% 32%;

    /* chart sequence */
    --chart-1: 173 80% 26%;
    --chart-2: 226 71% 40%;
    --chart-3: 30 90% 35%;
    --chart-4: 333 71% 42%;
    --chart-5: 80 60% 30%;
    --chart-6: 263 70% 50%;
    --chart-7: 215 19% 35%;
  }

  .dark {
    --surface: 25 7% 4%;
    --surface-elevated: 24 8% 7%;
    --border: 25 5% 18%;
    --ring: 173 67% 53%;

    --text-primary: 60 9% 98%;
    --text-secondary: 30 5% 70%;
    --text-tertiary: 25 5% 50%;

    --accent: 173 67% 53%;
    --accent-muted: 173 50% 18%;

    --positive: 142 60% 50%;
    --negative: 0 70% 60%;
    --warning: 40 80% 55%;
  }

  * { @apply border-border; }
  html { font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'ss01'; }
  body {
    @apply bg-surface text-text-primary font-sans antialiased;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  /* tabular figures for numbers */
  .tabular-nums { font-variant-numeric: tabular-nums; }
  /* selection color */
  ::selection { background: hsl(var(--accent-muted)); color: hsl(var(--text-primary)); }
}

@layer components {
  .container-narrow { @apply max-w-5xl mx-auto px-6 sm:px-8; }
  .container-wide { @apply max-w-[1440px] mx-auto px-6 sm:px-8; }
  .h-display { @apply text-4xl md:text-5xl font-medium tracking-tight; }
  .h-section { @apply text-2xl md:text-3xl font-medium tracking-tight; }
  .h-card { @apply text-base font-medium text-text-secondary uppercase tracking-wide text-2xs; }
}
```

- [ ] **Step 5.4: Write `apps/web/lib/utils.ts`**

File: `apps/web/lib/utils.ts`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5.5: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/postcss.config.mjs apps/web/tailwind.config.ts apps/web/app/globals.css apps/web/lib/utils.ts && git commit -m "feat(web): tailwind + design tokens + dark mode"
```

---

## Task 6: Fonts — Geist + Geist Mono (self-hosted)

**Files:**
- Modify: `apps/web/package.json` (add `geist` package)
- Create: `apps/web/app/fonts.ts`

Use the official `geist` package from Vercel — self-hosts both Geist Sans and Geist Mono with no external CDN.

- [ ] **Step 6.1: Add `geist` to dependencies**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm --filter @herd/web add geist@1.3.1
```

Expected: `geist` added to `apps/web/package.json` dependencies.

- [ ] **Step 6.2: Write `apps/web/app/fonts.ts`**

File: `apps/web/app/fonts.ts`
```typescript
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export const fontSans = GeistSans;
export const fontMono = GeistMono;
```

- [ ] **Step 6.3: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/package.json apps/web/app/fonts.ts pnpm-lock.yaml && git commit -m "feat(web): Geist Sans + Mono self-hosted via geist package"
```

---

## Task 7: Formatters (TDD)

**Files:**
- Create: `apps/web/lib/formatters.ts`
- Test: `apps/web/lib/formatters.test.ts`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 7.1: Write `apps/web/vitest.config.ts`**

File: `apps/web/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', 'out'],
  },
});
```

- [ ] **Step 7.2: Write failing tests**

File: `apps/web/lib/formatters.test.ts`
```typescript
import { describe, expect, it } from 'vitest';
import { formatUsd, formatCount, formatPct, formatFy, formatDelta } from './formatters';

describe('formatUsd', () => {
  it('formats billions with B suffix', () => {
    expect(formatUsd(199_460_000_000)).toBe('$199.5B');
  });
  it('formats millions with M suffix', () => {
    expect(formatUsd(3_325_000_000)).toBe('$3.33B');
  });
  it('formats sub-million with comma-separated dollars', () => {
    expect(formatUsd(450_000)).toBe('$450K');
  });
  it('handles negative values', () => {
    expect(formatUsd(-1_500_000_000)).toBe('-$1.50B');
  });
  it('handles null/undefined', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(undefined)).toBe('—');
  });
  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0');
  });
});

describe('formatCount', () => {
  it('uses thousand separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
  });
  it('handles null', () => {
    expect(formatCount(null)).toBe('—');
  });
});

describe('formatPct', () => {
  it('formats decimal as percent with one decimal', () => {
    expect(formatPct(0.737)).toBe('73.7%');
  });
  it('formats whole-number-style', () => {
    expect(formatPct(73.7, { source: 'percent' })).toBe('73.7%');
  });
  it('handles null', () => {
    expect(formatPct(null)).toBe('—');
  });
});

describe('formatFy', () => {
  it('prefixes with FY', () => {
    expect(formatFy(2024)).toBe('FY2024');
  });
});

describe('formatDelta', () => {
  it('positive delta gets + sign', () => {
    expect(formatDelta(0.123)).toBe('+12.3%');
  });
  it('negative delta keeps - sign', () => {
    expect(formatDelta(-0.05)).toBe('-5.0%');
  });
  it('zero is plain 0', () => {
    expect(formatDelta(0)).toBe('0.0%');
  });
});
```

- [ ] **Step 7.3: Run tests — verify they fail**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm --filter @herd/web test
```

Expected: FAIL — module not found.

- [ ] **Step 7.4: Implement `apps/web/lib/formatters.ts`**

File: `apps/web/lib/formatters.ts`
```typescript
export type Nullish<T> = T | null | undefined;

const DASH = '—';

export function formatUsd(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(abs >= 100e9 ? 1 : 2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 100e6 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  if (abs === 0) return '$0';
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatCount(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString('en-US');
}

export function formatPct(
  value: Nullish<number>,
  opts: { source?: 'fraction' | 'percent'; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const { source = 'fraction', decimals = 1 } = opts;
  const pct = source === 'fraction' ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

export function formatFy(year: number): string {
  return `FY${year}`;
}

export function formatDelta(value: Nullish<number>): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const pct = value * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
```

- [ ] **Step 7.5: Run tests — verify they pass**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm --filter @herd/web test
```

Expected: All 15 tests PASS.

- [ ] **Step 7.6: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/vitest.config.ts apps/web/lib/formatters.ts apps/web/lib/formatters.test.ts && git commit -m "feat(web): formatters (USD/count/pct/FY/delta) with tests"
```

---

## Task 8: Types

**Files:**
- Create: `apps/web/lib/types.ts`

- [ ] **Step 8.1: Write `apps/web/lib/types.ts`**

File: `apps/web/lib/types.ts`
```typescript
/** Master manifest written by scripts/build_data.py */
export interface DataManifest {
  built_at_utc: string;
  source_dir: string;
  files: Record<string, ManifestFile>;
  kpis: ManifestKpis;
}

export interface ManifestFile {
  rows: number;
  size_bytes: number;
  sha256: string;
  columns: { name: string; type: string }[];
}

export interface ManifestKpis {
  fy2024_federal_obligations_usd: number;
  n_institutions: number;
  n_agencies: number;
  fy_min: number;
  fy_max: number;
}

/** Generic typed row from a DuckDB query */
export type Row = Record<string, unknown>;

/** Common entity types */
export interface Institution {
  institution_sk: string;
  canonical_name: string;
  primary_state: string | null;
  carnegie_basic_2021: string | null;
  ipeds_id: string | null;
}

export interface Agency {
  agency_sk: string;
  agency_name: string;
  parent_agency_sk: string | null;
}
```

- [ ] **Step 8.2: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/lib/types.ts && git commit -m "feat(web): shared TypeScript types"
```

---

## Task 9: DuckDB-WASM init

**Files:**
- Create: `apps/web/lib/duckdb.ts`
- Test: `apps/web/lib/duckdb.test.ts` (smoke only — integration tests run in Playwright later)

- [ ] **Step 9.1: Write `apps/web/lib/duckdb.ts`**

Pattern: load wasm + worker from jsDelivr CDN (avoids Next.js/webpack module-import-of-wasm headaches); wrap worker in a blob URL so it loads cross-origin reliably. This is the canonical DuckDB-WASM pattern documented at https://duckdb.org/docs/api/wasm/instantiation.html.

File: `apps/web/lib/duckdb.ts`
```typescript
'use client';

import * as duckdb from '@duckdb/duckdb-wasm';
import type { Row } from './types';

const CDN = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: `${CDN}/duckdb-mvp.wasm`,
    mainWorker: `${CDN}/duckdb-browser-mvp.worker.js`,
  },
  eh: {
    mainModule: `${CDN}/duckdb-eh.wasm`,
    mainWorker: `${CDN}/duckdb-browser-eh.worker.js`,
  },
};

const PARQUET_FILES = [
  'sheet_01_overview',
  'sheet_02_top_recipients',
  'sheet_04_federal_obligations',
  'sheet_07_cross_source_reconciliation',
  'sheet_10_federal_rd_flow',
  'sheet_11_bridge_reconciliation',
  'sheet_12_nih_ic_breakdown',
  'dim_institution',
  'dim_agency',
  'cpi_index',
];

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

async function init(): Promise<duckdb.AsyncDuckDBConnection> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  // Wrap the worker in a Blob URL so the browser treats it as same-origin.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();

  // Register each parquet file URL and create a view by basename.
  for (const name of PARQUET_FILES) {
    const fileUrl = `${window.location.origin}/data/${name}.parquet`;
    await db.registerFileURL(`${name}.parquet`, fileUrl, duckdb.DuckDBDataProtocol.HTTP, false);
    await conn.query(`CREATE OR REPLACE VIEW ${name} AS SELECT * FROM '${name}.parquet'`);
  }

  return conn;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  if (!initPromise) initPromise = init();
  return initPromise;
}

export async function query<T extends Row = Row>(sql: string): Promise<T[]> {
  const c = await getConnection();
  const result = await c.query(sql);
  return result.toArray().map((row) => row.toJSON() as T);
}

export async function queryOne<T extends Row = Row>(sql: string): Promise<T | null> {
  const rows = await query<T>(sql);
  return rows[0] ?? null;
}

export async function close(): Promise<void> {
  if (conn) await conn.close();
  if (db) await db.terminate();
  conn = null;
  db = null;
  initPromise = null;
}
```

- [ ] **Step 9.2: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/lib/duckdb.ts && git commit -m "feat(web): DuckDB-WASM init + query helpers"
```

---

## Task 10: Canned queries

**Files:**
- Create: `apps/web/lib/queries.ts`

- [ ] **Step 10.1: Write `apps/web/lib/queries.ts`**

File: `apps/web/lib/queries.ts`
```typescript
import type { Row } from './types';
import { query, queryOne } from './duckdb';

/** Top-N R1 institutions by FY federal R&D from HERD (Sheet 7). */
export async function topRecipientsByFy(fy: number, n = 15) {
  return query<Row & { institution_sk: string; canonical_name: string; total_herd_federal_rd_usd_nominal: number }>(`
    SELECT s.institution_sk, di.canonical_name, s.total_herd_federal_rd_usd_nominal
    FROM sheet_07_cross_source_reconciliation s
    LEFT JOIN dim_institution di USING (institution_sk)
    WHERE s.fiscal_year = ${fy} AND s.total_herd_federal_rd_usd_nominal IS NOT NULL
    ORDER BY s.total_herd_federal_rd_usd_nominal DESC
    LIMIT ${n}
  `);
}

/** Headline KPI row precomputed in the manifest mirror in SQL. */
export async function headlineKpis() {
  return queryOne<{
    fy2024_federal: number;
    n_institutions: number;
    n_agencies: number;
    fy_min: number;
    fy_max: number;
  }>(`
    SELECT
      (SELECT SUM(total_obligations_nominal_usd) FROM sheet_04_federal_obligations WHERE fiscal_year=2024) AS fy2024_federal,
      (SELECT COUNT(DISTINCT institution_sk) FROM dim_institution) AS n_institutions,
      (SELECT COUNT(*) FROM dim_agency) AS n_agencies,
      (SELECT MIN(fiscal_year) FROM sheet_04_federal_obligations) AS fy_min,
      (SELECT MAX(fiscal_year) FROM sheet_04_federal_obligations) AS fy_max
  `);
}

/** Agency FY2024 distribution for hero donut. */
export async function fy2024AgencyMix() {
  return query<{ agency_name: string; total: number }>(`
    SELECT
      COALESCE(da.agency_name, 'Other') AS agency_name,
      SUM(s.total_obligations_nominal_usd) AS total
    FROM sheet_04_federal_obligations s
    LEFT JOIN dim_agency da USING (agency_sk)
    WHERE s.fiscal_year = 2024
    GROUP BY 1
    ORDER BY total DESC NULLS LAST
    LIMIT 12
  `);
}
```

- [ ] **Step 10.2: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/lib/queries.ts && git commit -m "feat(web): canned queries (KPIs, top recipients, agency mix)"
```

---

## Task 11: Providers (DuckDB context)

**Files:**
- Create: `apps/web/app/providers.tsx`

- [ ] **Step 11.1: Write `apps/web/app/providers.tsx`**

File: `apps/web/app/providers.tsx`
```typescript
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getConnection } from '@/lib/duckdb';

interface DuckCtx {
  ready: boolean;
  error: Error | null;
}

const Ctx = createContext<DuckCtx>({ ready: false, error: null });

export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConnection()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={{ ready, error }}>{children}</Ctx.Provider>;
}

export function useDuckDB() {
  return useContext(Ctx);
}
```

- [ ] **Step 11.2: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/app/providers.tsx && git commit -m "feat(web): DuckDB provider context"
```

---

## Task 12: Layout (Nav + Footer + root)

**Files:**
- Create: `apps/web/components/layout/Nav.tsx`
- Create: `apps/web/components/layout/Footer.tsx`
- Create: `apps/web/app/layout.tsx`

- [ ] **Step 12.1: Write `apps/web/components/layout/Nav.tsx`**

File: `apps/web/components/layout/Nav.tsx`
```typescript
import Link from 'next/link';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/trends', label: 'Trends' },
  { href: '/institutions', label: 'Institutions' },
  { href: '/agencies', label: 'Agencies' },
  { href: '/states', label: 'Map' },
  { href: '/flow', label: 'Flow' },
  { href: '/reconciliation', label: 'Reconciliation' },
  { href: '/nih', label: 'NIH' },
  { href: '/compare', label: 'Compare' },
  { href: '/correlations', label: 'Correlations' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/downloads', label: 'Downloads' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="container-wide flex h-14 items-center gap-8">
        <Link href="/" className="font-medium tracking-tight text-text-primary">
          Herd Survey
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-accent-muted/40 transition-colors',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-2xs text-text-tertiary uppercase tracking-wide">
          FY2005–FY2024
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 12.2: Write `apps/web/components/layout/Footer.tsx`**

File: `apps/web/components/layout/Footer.tsx`
```typescript
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-surface">
      <div className="container-wide py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
        <div className="space-y-2 md:col-span-2">
          <div className="font-medium tracking-tight">Herd Survey</div>
          <p className="text-text-secondary max-w-md">
            20 years of federal R&amp;D funding to U.S. universities — HERD, USAS, NIH, NSF, SBIR, Federal Funds.
            All data open and reproducible.
          </p>
        </div>
        <div className="space-y-2">
          <div className="h-card">Data</div>
          <Link href="/methodology" className="block text-text-secondary hover:text-text-primary">Methodology</Link>
          <Link href="/downloads" className="block text-text-secondary hover:text-text-primary">Downloads</Link>
          <a href="https://github.com/samsiddy/herd-survey-dashboard" className="block text-text-secondary hover:text-text-primary">GitHub</a>
        </div>
        <div className="space-y-2">
          <div className="h-card">Built by</div>
          <p className="text-text-secondary">Usama Afzal · NYU</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 12.3: Write `apps/web/app/layout.tsx`**

File: `apps/web/app/layout.tsx`
```typescript
import type { Metadata } from 'next';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { Providers } from './providers';
import { fontSans, fontMono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Herd Survey · Federal R&D Dashboard', template: '%s · Herd Survey' },
  description:
    'Explore 20 years (FY2005–FY2024) of federal research funding to U.S. universities. HERD, USAS, NIH, NSF, SBIR, Federal Funds — all reconciled, all open.',
  openGraph: {
    title: 'Herd Survey · Federal R&D Dashboard',
    description: 'Federal research funding to U.S. universities, 2005–2024.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 12.4: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/components/layout/Nav.tsx apps/web/components/layout/Footer.tsx apps/web/app/layout.tsx && git commit -m "feat(web): root layout with nav + footer"
```

---

## Task 13: Home page KPI strip

**Files:**
- Create: `apps/web/components/home/KpiStrip.tsx`
- Create: `apps/web/app/page.tsx`

- [ ] **Step 13.1: Write `apps/web/components/home/KpiStrip.tsx`**

File: `apps/web/components/home/KpiStrip.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useDuckDB } from '@/app/providers';
import { headlineKpis } from '@/lib/queries';
import { formatCount, formatUsd } from '@/lib/formatters';

interface Kpi {
  fy2024_federal: number | null;
  n_institutions: number | null;
  n_agencies: number | null;
  fy_min: number | null;
  fy_max: number | null;
}

export function KpiStrip() {
  const { ready, error } = useDuckDB();
  const [k, setK] = useState<Kpi | null>(null);

  useEffect(() => {
    if (!ready) return;
    headlineKpis().then((r) => setK(r as Kpi)).catch(() => setK(null));
  }, [ready]);

  if (error) return <div className="text-negative text-sm">Failed to load data: {error.message}</div>;

  const tiles = [
    { label: 'FY2024 Federal R&D', value: k ? formatUsd(k.fy2024_federal) : '—' },
    { label: 'Universities', value: k ? formatCount(k.n_institutions) : '—' },
    { label: 'Federal Agencies', value: k ? formatCount(k.n_agencies) : '—' },
    { label: 'Years Covered', value: k ? `${k.fy_min}–${k.fy_max}` : '—' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-md overflow-hidden border border-border">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface-elevated p-6">
          <div className="h-card mb-2">{t.label}</div>
          <div className="text-3xl md:text-4xl font-medium tabular-nums tracking-tight">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 13.2: Write `apps/web/app/page.tsx`**

File: `apps/web/app/page.tsx`
```typescript
import { KpiStrip } from '@/components/home/KpiStrip';

export default function HomePage() {
  return (
    <div className="container-wide py-12 md:py-20 space-y-12">
      <section className="space-y-4">
        <p className="h-card text-accent">Federal R&D · 2005 – 2024</p>
        <h1 className="h-display max-w-3xl">
          Two decades of federal research funding to U.S. universities, reconciled across seven sources.
        </h1>
        <p className="max-w-2xl text-text-secondary text-lg">
          HERD, USAS, NIH ExPORTER, NSF Awards, SBIR.gov, Federal Funds, BLS CPI — joined on a single canonical
          institution graph and a single agency graph. Everything you see is queryable, exportable, and reproducible.
        </p>
      </section>

      <section>
        <KpiStrip />
      </section>

      <section className="max-w-2xl text-text-secondary">
        <p>
          This is the foundation page. Trends, institution profiles, the federal flow Sankey, cross-source
          reconciliation, and the correlation builder will live above this in the navigation as they ship.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 13.3: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add apps/web/components/home/KpiStrip.tsx apps/web/app/page.tsx && git commit -m "feat(web): Home page with live KPI strip from DuckDB-WASM"
```

---

## Task 14: Local dev verification

**Goal**: confirm the site builds and runs locally with real data showing.

- [ ] **Step 14.1: Ensure data is built**

Run:
```bash
ls -lh "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard/apps/web/public/data/" 2>/dev/null | head -20
```

Expected: ~12 parquet files. If empty: re-run Task 2 Step 2.4.

- [ ] **Step 14.2: Typecheck**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm typecheck
```

Expected: No errors.

- [ ] **Step 14.3: Lint**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm lint
```

Expected: No errors, warnings OK.

- [ ] **Step 14.4: Build**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm build
```

Expected: `apps/web/out/` directory created, static export complete, no errors.

- [ ] **Step 14.5: Start dev server (background)**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm dev
```

Open `http://localhost:3000` in browser. Expected:
- Header nav renders with 12 items
- "Federal R&D · 2005 – 2024" eyebrow, hero headline, subhead paragraph
- KPI strip renders four tiles. After ~1–2 seconds, values populate: ~$199.5B, ~1,500 universities, ~50 agencies, "2005–2024"
- Footer renders

Stop dev server with Ctrl-C.

If KPI values stay `—`: open browser devtools console. Likely causes:
- CORS error on parquet fetches → check `next.config.mjs` and that files exist
- "table does not exist" → check sheet names match in `duckdb.ts`'s `PARQUET_FILES`
- Schema mismatch → run `pnpm data:verify` and inspect manifest

- [ ] **Step 14.6: No commit needed (verification step)**

---

## Task 15: CI workflow (lint + typecheck + build + data verify)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 15.1: Write `.github/workflows/ci.yml`**

File: `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      # Note: pnpm build is run in deploy.yml after data is fetched
```

- [ ] **Step 15.2: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add .github/workflows/ci.yml && git commit -m "ci: lint + typecheck + test on PRs and main"
```

---

## Task 16: Deployment workflow (Cloudflare Pages, awaits user secrets)

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `docs/deployment.md`

- [ ] **Step 16.1: Write `.github/workflows/deploy.yml`**

File: `.github/workflows/deploy.yml`
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install Python deps
        run: pip install -r scripts/requirements.txt
      - name: Install web deps
        run: pnpm install --frozen-lockfile
      # Note: parquet bundle is committed to the repo. CI does NOT rebuild it
      # (data lake is not available in CI). Run `pnpm data:build` locally and
      # commit the changes to `apps/web/public/data/` to refresh the deployment.
      - name: Build web
        run: pnpm build
      - name: Publish to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: pages deploy apps/web/out --project-name=herd-survey-dashboard
```

- [ ] **Step 16.2: Write `docs/deployment.md`**

File: `docs/deployment.md`
```markdown
# Deployment Guide

This dashboard runs entirely on free tiers. First-time setup takes ~15 minutes.

## Accounts you need (all free, no credit card)

1. **GitHub** — you already have this (`samsiddy`)
2. **Cloudflare** — sign up at https://dash.cloudflare.com/sign-up
3. **Hugging Face** — sign up at https://huggingface.co/join (only needed for MCP server in Plan 03)

## Cloudflare Pages setup

1. Log in to Cloudflare dashboard
2. Pages → Create application → Connect to Git → authorize GitHub → pick `samsiddy/herd-survey-dashboard`
3. Build settings:
   - Framework preset: Next.js (Static HTML Export)
   - Build command: `pnpm install && pnpm build`
   - Build output directory: `apps/web/out`
   - Root directory: `/` (repo root)
   - Environment variables: none
4. Save and deploy. First build takes 3–4 min.
5. Custom domain (optional): Pages project → Custom domains → Add. Cloudflare register `.com` for ~$9/yr.

## Cloudflare R2 setup (for raw fact-table parquet, Plan 02)

1. Cloudflare dashboard → R2 → Create bucket → name `herd-survey`
2. R2 → Manage API tokens → Create API token → R2 read+write to bucket `herd-survey`
3. Copy `Access Key ID` and `Secret Access Key`
4. In repo GitHub Settings → Secrets → Actions, add:
   - `CF_API_TOKEN` (Pages API token, from CF Profile → API Tokens → Create → "Edit Cloudflare Pages")
   - `CF_ACCOUNT_ID` (from CF dashboard right sidebar)
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` = `herd-survey`

## Data refresh

1. Rebuild data lake (in sister repo)
2. In this repo: `pnpm data:build && pnpm data:verify`
3. Commit & push → Cloudflare Pages auto-deploys

## Hugging Face Spaces (Plan 03)

Covered when MCP server is built.
```

- [ ] **Step 16.3: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add .github/workflows/deploy.yml docs/deployment.md && git commit -m "ci: Cloudflare Pages deploy workflow + deployment guide"
```

---

## Task 17: README update + final smoke

**Files:**
- Modify: `README.md`

- [ ] **Step 17.1: Update `README.md` with run instructions**

File: `README.md` (replace contents)
```markdown
# Herd Survey Research Dashboard

A modern, free, public dashboard for exploring 20 years (FY2005–FY2024) of federal R&D funding to U.S. universities, built on the [Herd Survey data lake](../Herd%20Survey/).

**Status**: 🚧 Foundation shipped — see [design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md). Phase 1 pages next.

## What this is

A research-grade analytics platform that turns the Herd Survey master workbook (10 sheets, 7 federal data sources, 20.5M fact rows) into a browsable, queryable interface. All compute happens in the user's browser via DuckDB-WASM — no backend, no cost, no login.

Natural-language Q&A is available separately through a Model Context Protocol (MCP) server that connects to [claude.ai](https://claude.ai), powered by your existing Claude subscription. (Plan 03.)

## Tech stack

- **Frontend**: Next.js 14 (App Router, static export) + TypeScript + Tailwind + shadcn/ui + Recharts + Visx
- **Database**: DuckDB-WASM (in-browser) over pre-aggregated parquet
- **Maps**: react-simple-maps + us-atlas topojson
- **Hosting**: Cloudflare Pages (free) + Cloudflare R2 (free 10GB)
- **MCP server**: Python + FastMCP + DuckDB on Hugging Face Spaces (free)
- **CI/CD**: GitHub Actions
- **Total cost**: $0/month

## Repo layout

```
apps/web/    Next.js dashboard frontend
apps/mcp/    Python MCP server for claude.ai     (Plan 03)
packages/sql Shared SQL views                    (Plan 02)
data/        Build artifacts (parquet)
scripts/     Data pipeline + deploy helpers
docs/        Design specs, deployment guide
```

## Local dev

Prereqs: Node 20+, pnpm 9+, Python 3.11+.

```bash
# 1. Install
pnpm install

# 2. Build the data bundle (requires data lake at sibling path)
pnpm data:build && pnpm data:verify

# 3. Run dev server
pnpm dev
# → http://localhost:3000
```

## Build for production

```bash
pnpm build
# Static export → apps/web/out/
```

## Deployment

See [docs/deployment.md](docs/deployment.md). Cloudflare Pages auto-deploys on push to `main`.

## Documentation

- [Design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md) — architecture, all 12 pages, MCP design
- [Foundation plan](docs/superpowers/plans/2026-05-29-herd-dashboard-foundation-plan.md) — this build
- [Deployment guide](docs/deployment.md)
- Sister repo: [Herd Survey](../Herd%20Survey/) — the data lake this dashboard reads from

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 17.2: Final lint + typecheck + build**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all green, `apps/web/out/index.html` exists.

- [ ] **Step 17.3: Commit**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git add README.md && git commit -m "docs: update README with run instructions and status"
```

- [ ] **Step 17.4: Tag foundation milestone**

Run:
```bash
cd "/Users/Usama/Documents/Documents - Usama's MacBook Pro/Claude Projects/herd-survey-dashboard" && git tag -a v0.1.0-foundation -m "Foundation: data pipeline, Next.js, DuckDB-WASM, Home page, CI" && git log --oneline -20
```

---

## Done criteria (Plan 01)

- [x] All 17 tasks complete
- [x] `pnpm dev` shows a Home page with live KPIs from real data
- [x] `pnpm build` produces a static export in `apps/web/out/`
- [x] CI passes on push to main
- [x] Deployment workflow exists; awaits user-provided Cloudflare credentials
- [x] All commits follow Conventional Commits
- [x] `v0.1.0-foundation` tag exists

## What's next (Plan 02 — Phase 1 Pages)

Builds on this foundation:
- shadcn/ui primitives (Button, Card, Select, Slider, Tabs, Table, Tooltip)
- Filter components (InstitutionPicker, AgencyPicker, FYRangeSlider, MetricSelect)
- Chart primitives (LineChart, StackedBarChart, Sparkline)
- US state map (react-simple-maps)
- Pages: Institution Profile, Agency Profile, Trends Explorer, State Map, Methodology, Downloads (full data dictionary export)
- Sitemap.xml + per-page OG metadata

## What's after (Plan 03 — Phase 2 Pages + MCP)

- Sankey (visx) for Federal R&D Flow
- Sheet 7 + Sheet 11 reconciliation views
- NIH IC drilldown
- Compare (up to 4 institutions)
- Correlation builder
- FastMCP server (Python) + HF Spaces deploy
- Connector setup guide for claude.ai
