# Herd Survey Research Dashboard

A modern, free, public dashboard for exploring 20 years (FY2005–FY2024) of federal R&D funding to U.S. universities. Built on the [Herd Survey data lake](../Herd%20Survey/).

**Status**: 🚧 Foundation shipped (Plan 01) — see [design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md). Phase 1 pages next.

## What this is

A research-grade analytics platform that turns the Herd Survey master workbook (12 sheets, 7 federal data sources, 20.5M fact rows) into a browsable, queryable interface. All compute happens in the user's browser via [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html) — no backend, no cost, no login.

Natural-language Q&A is available separately through a Model Context Protocol (MCP) server that connects to [claude.ai](https://claude.ai), powered by your existing Claude subscription. (Plan 03.)

## Tech stack

- **Frontend**: Next.js 14 (App Router, static export) · TypeScript · Tailwind v3 · Geist fonts · Recharts (Plan 02) · Visx (Plan 02)
- **Database**: DuckDB-WASM in the browser over pre-aggregated parquet
- **Hosting**: Cloudflare Pages (free, unlimited bandwidth) + Cloudflare R2 (free 10 GB, Plan 02)
- **MCP server**: Python + FastMCP + DuckDB on Hugging Face Spaces (free, Plan 03)
- **CI/CD**: GitHub Actions
- **Total cost**: $0/month

## Repo layout

```
apps/
  web/                Next.js dashboard frontend
  mcp/                Python MCP server for claude.ai (Plan 03)
packages/
  sql/                Shared SQL views (Plan 02)
data/                 Build artifacts (gitignored except manifest)
scripts/
  build_data.py       data lake CSV/parquet → browser-bundled parquet
  verify_data.py      Smoke tests + KPI invariants
  requirements.txt    pyarrow + pandas
docs/
  superpowers/
    specs/            Design specs
    plans/            Implementation plans
  deployment.md       First-time setup guide
.github/workflows/
  ci.yml              typecheck + lint + test + build on PRs
  deploy.yml          Cloudflare Pages deploy on push to main
```

## Local development

Prereqs: Node 20+, pnpm 9+, Python 3.8+.

```bash
# 1. Install
pnpm install

# 2. Set up data pipeline (one-time)
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# 3. Build the browser-bundled parquet from the data lake
pnpm data:build
pnpm data:verify

# 4. Run the dashboard
pnpm dev
# → http://localhost:3000
```

## Production build

```bash
pnpm build
# Static export → apps/web/out/
```

## Deployment

See [docs/deployment.md](docs/deployment.md). Cloudflare Pages auto-deploys on push to `main`.

## Headline data (current bundle)

| Metric | Value |
|---|---|
| FY2024 federal R&D obligations | $199.5B |
| HERD universities tracked | 1,014 |
| Federal agencies | 32 |
| Bundle size | 16 MB (15 parquet files) |
| Total fact rows | 20.5M (in source data lake) |

## Documentation

- [Design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md) — architecture, all 12 pages, MCP design
- [Foundation plan](docs/superpowers/plans/2026-05-29-herd-dashboard-foundation-plan.md) — Plan 01 (this build)
- [Deployment guide](docs/deployment.md) — first-time Cloudflare + HF Spaces setup
- Sister repo: [Herd Survey](../Herd%20Survey/) — the data lake this dashboard reads from

## License

MIT — see [LICENSE](LICENSE).
