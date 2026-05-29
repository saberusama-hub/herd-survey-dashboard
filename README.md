# Research Data Platform

A modern, free, public analytics platform exploring 20 years (FY2005–FY2024) of federal R&D funding to U.S. universities. Maintained by the Policy and Strategy team.

**Status**: 🚀 Live. Phase 2 + design uplift in progress.

- **Live dashboard**: https://herd-survey-dashboard.saber-usama.workers.dev/
- **MCP server (for claude.ai chat)**: https://samsiddy-herd-survey-mcp.hf.space/sse

## What this is

A research-grade analytics platform that turns 7 federal data sources into a browsable, queryable interface. All compute happens in the user's browser via [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html) — no backend, no cost, no login.

Natural-language Q&A is available separately through a Model Context Protocol (MCP) server that connects to any MCP-compatible client (claude.ai, Claude Desktop, Claude Code).

## Data sources

| Source | Agency | Role |
|---|---|---|
| HERD | NCSES | Top-down R&D expenditures (universities self-report) |
| USAspending | Treasury/OMB | Federal contracts + assistance awards |
| NIH ExPORTER | NIH | NIH project-level awards by FY |
| NSF Awards | NSF | NSF award-level obligations by FY |
| SBIR.gov | SBA | SBIR + STTR awards |
| Federal Funds | NCSES | Agency-reported R&D obligations + outlays |
| BLS CPI-U | BLS | Inflation adjustment to FY2024 dollars |

## Headline data (current bundle)

| Metric | Value |
|---|---|
| FY2024 federal R&D obligations | $199.5B |
| HERD universities tracked | 1,014 |
| Federal agencies | 32 |
| Total fact rows (source data lake) | 20.5M |
| Browser bundle size | 16 MB (15 parquet files) |

## Tech stack

- **Frontend**: Next.js 14 (App Router, static export) · TypeScript · Tailwind · Geist fonts · Recharts · Visx · react-simple-maps
- **Database**: DuckDB-WASM (in-browser) over pre-aggregated parquet
- **Hosting**: Cloudflare Workers Static Assets (free) + Cloudflare R2 (free 10 GB tier)
- **MCP server**: Python + FastMCP + DuckDB on Hugging Face Spaces (free)
- **CI/CD**: GitHub Actions
- **Total cost**: $0/month

## Repo layout

```
apps/
  web/                Next.js dashboard frontend
  mcp/                Python MCP server (for claude.ai / Claude Desktop / Claude Code)
data/                 Build artifacts (gitignored)
scripts/
  build_data.py       source data lake → browser-bundled parquet
  verify_data.py      smoke tests + KPI invariants
docs/
  superpowers/
    specs/            Design specs
    plans/            Implementation plans
    research/         Design + data + architecture research
  deployment.md       First-time Cloudflare + HF Spaces setup
.github/workflows/
  ci.yml              typecheck + lint + test + build on PRs
  deploy.yml          Cloudflare Workers Static Assets deploy on push to main
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

# 3. Build the browser-bundled parquet from the source data lake
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

See [docs/deployment.md](docs/deployment.md). Cloudflare Workers Static Assets auto-deploys on push to `main` via GitHub Actions.

## Documentation

- [Design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md) — architecture, all 12 pages, MCP design
- [Foundation plan](docs/superpowers/plans/2026-05-29-herd-dashboard-foundation-plan.md) — Plan 01
- [Deployment guide](docs/deployment.md) — first-time Cloudflare + HF Spaces setup
- [Design research](docs/superpowers/research/) — uplift planning materials

## Citation

> Policy and Strategy team (2026). *Research Data Platform: A longitudinal database of federal R&D funding to U.S. universities, FY2005–FY2024.*

## License

MIT — see [LICENSE](LICENSE).
