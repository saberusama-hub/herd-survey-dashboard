# Research Data Platform

A free, public dashboard for **20 years of federal R&D funding to U.S. universities** (FY2005–FY2024). All compute runs in the browser — no backend, no login, no telemetry, no cost.

**Status:** Live · v1.0 (Phase S5 — analytical views shipped 2026-06-02)

- **Dashboard:** https://herd-survey-dashboard.saber-usama.workers.dev/
- **MCP server (natural-language Q&A for Claude / Claude Desktop / Claude Code):** https://samsiddy-herd-survey-mcp.hf.space/sse

## What this is

A research-grade analytics platform that turns seven federal data sources into a browsable, queryable interface. The frontend ships pre-aggregated parquet files and runs SQL in [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html) directly in the user's browser. Natural-language Q&A is available separately through a Model Context Protocol (MCP) server.

## Headline data (FY2024, real $2024)

| Metric | Value |
|---|---|
| Total US university R&D | **$117.66B** |
| Federal share | **$64.70B** (55.0%) |
| HERD universities tracked | **1,014** |
| HHS / DOD / NSF / DOE / NASA / USDA / Other | $35.5B / $10.2B / $7.2B / $2.9B / $2.4B / $2.0B / $4.5B |
| Top 5: JHU / Penn / UCSF / Michigan / Wisconsin | $4.1B / $2.2B / $2.1B / $2.1B / $1.9B |
| Research topics tracked | 30 (hand-curated regex taxonomy) |
| NIH Institutes / Centers (active FY24) | 40 |
| Browser parquet bundle | 29.6 MB (41 files, 1.73M aggregated rows) |
| Source data lake (pre-aggregation) | 20.5M fact rows across 16 tables |

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

## What you can do

- **Browse 1,014 university profiles** — each with 9 editorial sections: hero KPIs, 20-yr R&D timeline, source mix, federal-agency split (with NIH-IC drill-down), HERD↔FederalFunds reconciliation, PI metrics, discipline mix, concentration & volatility, state context & peers
- **Sort 1,014 universities** by 16 metrics including 5-year growth CAGR
- **Cross-university dashboard** with 7 anchored sections including state-topic specialization, top climbers/fallers, and the 27-IC NIH breakdown
- **Compare up to 4 universities** side-by-side over any year range with table view + CSV export
- **Specialization scores** — surface where each university over-indexes vs the national topic mix
- **Methodology page** — full documentation of every aggregation, every landmine (FY05/FY16 entity-resolution breaks, NSF co-PI gaps, agency-bucket mapping), and the raw-source verification trail

## Tech stack

- **Frontend:** Next.js 14 (App Router, static export) · TypeScript · Tailwind · **Calibri** (via `@fontsource/carlito`) · Recharts · Visx · react-simple-maps
- **Database:** DuckDB-WASM in-browser over pre-aggregated parquet
- **Hosting:** Cloudflare Workers Static Assets (free) + GitHub Actions CI/CD
- **MCP server:** Python + FastMCP + DuckDB on Hugging Face Spaces (free)
- **Total cost:** $0/month

## Repo layout

```
apps/
  web/                        Next.js dashboard frontend
    app/                      App Router pages (/, /universities, /national, /compare, /methodology, /downloads)
    components/               ChartFrame, KpiStrip, StackedBar, GroupedBar, profile sections, editorial primitives
    lib/queries.ts            DuckDB query helpers (one per UI surface)
    public/data/              41 parquet files served to the browser
  mcp/                        Python MCP server for claude.ai / Claude Desktop / Claude Code
scripts/
  aggregations/               31 Python scripts that build the parquet bundle from the source data lake
    _lib.py                   Shared helpers (CPI adjustment, SK joins, FY parsing)
    _topics.py                30-topic regex taxonomy
    01..25_*.py               Aggregation scripts (national, university, topic, agency, NIH IC, growth, specialization)
    run_all.sh                Build the full parquet bundle end-to-end
  qa/                         QA harness (probe_pages.js · verify_facts.py · check_links.js · axe_audit.js · lighthouse.sh)
    facts.json                30 known-true facts verified against parquets every QA run
    run_all.sh                QA orchestrator → writes docs/qa/qa-report-YYYY-MM-DD.md
  build_data.py               Convenience wrapper invoked by `pnpm data:build`
  verify_data.py              Smoke tests + KPI invariants
docs/
  superpowers/
    specs/                    Design specs (latest: 2026-05-31-research-data-platform-restructure-design.md)
    plans/                    Implementation plans (latest: 2026-05-31-research-data-platform-restructure-plan.md)
    research/                 Design + data + architecture research
  qa/                         QA run outputs (latest: qa-report-2026-06-02.md)
  deployment.md               First-time Cloudflare + HF Spaces setup
.github/workflows/
  ci.yml                      typecheck + lint + test on PRs
  deploy.yml                  Cloudflare Workers Static Assets deploy on push to main
```

## Local development

Prereqs: Node 20+, pnpm 9+, Python 3.10+ with DuckDB.

```bash
# 1. Install JS deps
pnpm install

# 2. Set up the Python data-pipeline venv (one-time)
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt duckdb

# 3. Build the browser-bundled parquet (reads from the source data lake)
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

Cloudflare Workers Static Assets auto-deploys on push to `main` via GitHub Actions. See [docs/deployment.md](docs/deployment.md) for first-time setup. The deploy step uses `pnpm dlx wrangler deploy` directly (the legacy `wrangler-action@v3` had a recurring `null.matches` crash).

## QA

The QA harness lives in `scripts/qa/`:

```bash
# Start a static server, then run all probes
python3 -m http.server -d apps/web/out 3000 &
bash scripts/qa/run_all.sh   # writes docs/qa/qa-report-YYYY-MM-DD.md
```

Coverage:

| Dimension | Tool | Status |
|---|---|---|
| Page probe (errors, overflow, screenshots — 11 routes × 4 viewports) | Puppeteer | 44/44 PASS |
| Fact verification (30 known-true assertions against parquets) | DuckDB | 30/30 PASS |
| Link integrity | Puppeteer | PASS |
| Accessibility (axe-core, 6 routes) | axe + Puppeteer | 0 serious/critical |
| Lighthouse | Lighthouse CLI | manual on demand |
| Manual dimensions (cross-browser, screen-reader, real-device, print, editorial voice) | — | user-gated |

The 30-fact baseline is recalibrated whenever the data pipeline materially changes (most recently 2026-06-02 after the S5.5 v3 raw-source rebuild). See [docs/qa/qa-report-2026-06-01.md](docs/qa/qa-report-2026-06-01.md) for the latest run.

## Documentation

- [Latest design spec](docs/superpowers/specs/2026-05-31-research-data-platform-restructure-design.md) — university-centric IA, 9-section editorial profile, 18 metrics
- [Latest implementation plan](docs/superpowers/plans/2026-05-31-research-data-platform-restructure-plan.md) — phases P0–P10
- [Deployment guide](docs/deployment.md) — Cloudflare + HF Spaces setup
- [QA report](docs/qa/qa-report-2026-06-01.md) — full QA + post-S5 verification

## Citation

> Afzal, U. (2026). *Research Data Platform: A longitudinal database of federal R&D funding to U.S. universities, FY2005–FY2024.* https://herd-survey-dashboard.saber-usama.workers.dev/

## License

MIT — see [LICENSE](LICENSE).
