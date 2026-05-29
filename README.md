# Herd Survey Research Dashboard

A modern, free, public dashboard for exploring 20 years (FY2005–FY2024) of federal R&D funding to U.S. universities, built on the [Herd Survey data lake](../Herd%20Survey/).

**Status**: 🚧 Under construction — see [design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md).

## What this is

A research-grade analytics platform that turns the Herd Survey master workbook (10 sheets, 7 federal data sources, 20.5M fact rows) into a browsable, queryable interface. All compute happens in the user's browser via DuckDB-WASM — no backend, no cost, no login.

Natural-language Q&A is available separately through a Model Context Protocol (MCP) server that connects to [claude.ai](https://claude.ai), powered by your existing Claude subscription.

## Tech stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui + Recharts + Visx
- **Database**: DuckDB-WASM (in-browser) over pre-aggregated parquet
- **Maps**: react-simple-maps + us-atlas topojson
- **Hosting**: Cloudflare Pages (free) + Cloudflare R2 (free 10GB)
- **MCP server**: Python + FastMCP + DuckDB, deployed on Hugging Face Spaces (free)
- **CI/CD**: GitHub Actions
- **Total cost**: $0/month

## Repo layout

```
apps/web/    Next.js dashboard frontend
apps/mcp/    Python MCP server for claude.ai
packages/sql Shared SQL views
data/        Build artifacts (parquet)
scripts/     Data pipeline + deploy helpers
docs/        Design specs, deployment guide
```

## Local dev (once scaffolded)

```bash
# Frontend
cd apps/web
pnpm install
pnpm dev

# MCP server
cd apps/mcp
uv sync
uv run python server.py
```

## Documentation

- [Design spec](docs/superpowers/specs/2026-05-29-herd-dashboard-design.md) — architecture, pages, components
- [Deployment guide](docs/deployment.md) — Cloudflare + HF Spaces setup (coming soon)
- Sister repo: [Herd Survey](../Herd%20Survey/) — the data lake this dashboard reads from

## License

MIT — see [LICENSE](LICENSE).
