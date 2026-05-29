# Herd Survey Research Dashboard — Design Spec

**Date**: 2026-05-29
**Author**: samsiddy (usama.afzal@nyu.edu)
**Status**: Approved by user, in implementation
**Repo**: `samsiddy/herd-survey-dashboard` (new, public)
**Sister repo**: Herd Survey data lake (source of parquet artifacts)

---

## 1. Goal

Ship a free, public, modern research-data-analytics dashboard that turns the Herd Survey master workbook (10 sheets, FY2005–FY2024 federal R&D across 7 sources) into a browsable, queryable, comparable interface — with natural-language Q&A available through a separate MCP server connected to claude.ai.

The dashboard prioritizes **insight density** (lots of data per pixel, but never cluttered), **highly customizable analysis** (every chart filterable, sliceable, comparable), and **minimalist elegance** (restrained chrome, deliberate typography, charts speak).

## 2. Non-goals (Phase 1 + 2)

- No user accounts, login, or subscription tier
- No write operations on data (read-only dashboard)
- No real-time data ingestion (annual rebuild from data lake)
- No embedded LLM chat in the dashboard (NL chat lives in claude.ai via MCP)
- No mobile-app-grade responsive design (desktop-first; tablet works; phone is best-effort)
- No multi-tenancy, no public API beyond MCP

## 3. Users & use cases

**Primary user**: Usama (the researcher) — needs to slice/dice federal R&D data 20 ways for analysis and dissemination.

**Secondary users**: Higher-ed researchers, NIH/NSF policy analysts, journalists, university research administrators.

**Top use cases (drives page priority)**:
1. "Show me institution X's federal R&D portrait" → Institution Profile
2. "Which institutions are gaining/losing federal R&D over the last 5/10/20 years?" → Trends Explorer
3. "How does HERD-reported federal R&D compare to what we can trace bottom-up?" → Reconciliation page
4. "Where does each agency's money go?" → Agency Profile + Federal Flow
5. "What's the geography of federal R&D?" → State Map
6. "What's the correlation between X and Y?" → Correlation Builder
7. "Ask an open question about the data" → claude.ai + MCP

## 4. Architecture overview

```
Browser (Next.js static export + Tailwind + DuckDB-WASM)
   ├─ Pre-aggregated parquet (~30MB, bundled)  ← 80% of queries answered here
   └─ Range-request parquet from R2 (~2.6GB)   ← 20% of queries (ad-hoc, deep dives)

Cloudflare Pages  ← serves the static site + bundled parquet
Cloudflare R2     ← serves raw fact-table parquet (10GB free tier)
GitHub Actions    ← builds on push to main
GitHub Pages      ← fallback option

MCP server (Python, FastMCP)  ← separate process
   ├─ DuckDB query tools exposed to claude.ai
   ├─ Hosted on Hugging Face Spaces (free Docker)
   └─ Connected via remote MCP URL to claude.ai

User's claude.ai Pro subscription handles all NL chat (zero marginal cost)
```

**Key architectural decision: no Phase 1 backend.** DuckDB-WASM in the browser handles all dashboard queries. The MCP server is a separate concern — it's for the chat experience in claude.ai, not for the dashboard.

## 5. Data pipeline

### 5.1 Source artifacts (from data lake)
- `data/processed/master_workbook.xlsx` (10 sheets, 26MB)
- `data/processed/fact_*.parquet` (16 fact tables, 2.6GB)
- `data/processed/dim_*.parquet` (5 dim tables)
- `csv_export/*.csv` (10 sheets as CSV)

### 5.2 Browser-bundled parquet (`apps/web/public/data/`)
Pre-aggregated, ~30MB total, gzip-compressed served by Cloudflare Pages. Loaded into DuckDB-WASM on first page load (cached).

Files (one per sheet, plus dims):
- `sheet_01_overview.parquet`
- `sheet_02_top_recipients.parquet`
- `sheet_03_rd_by_field.parquet`
- `sheet_04_federal_obligations.parquet`
- `sheet_05_state_geography.parquet`
- `sheet_06_sbir_sttr.parquet`
- `sheet_07_cross_source_reconciliation.parquet`
- `sheet_08_pi_cross_agency.parquet`
- `sheet_09_caveats_and_methodology.parquet`
- `sheet_10_federal_rd_flow.parquet`
- `sheet_11_bridge_reconciliation.parquet`
- `sheet_12_nih_ic_breakdown.parquet`
- `dim_institution.parquet` (slim: sk, canonical_name, state, herd_carnegie_class, ipeds_id)
- `dim_agency.parquet`
- `cpi_index.parquet`
- `manifest.json` (file paths, row counts, schema versions, build timestamp)

### 5.3 R2-hosted parquet (`r2://herd-survey/raw/`)
Full fact tables for deep ad-hoc queries:
- `fact_herd_expenditures.parquet`
- `fact_nih_project.parquet`
- `fact_nih_project_pi_bridge.parquet`
- `fact_nsf_award.parquet`
- `fact_usaspending_prime.parquet`
- `fact_usaspending_sub.parquet`
- `fact_federal_funds.parquet`
- `fact_sbir.parquet`
- (etc.)

Accessed via DuckDB-WASM `read_parquet('https://r2.cdn.url/...')` with range-request streaming.

### 5.4 Build pipeline (`scripts/build_data.py`)
1. Read from data lake's `data/processed/`
2. Apply browser-friendly transformations:
   - Cast int64 → int32 where safe
   - Strip diagnostic columns we don't expose (e.g., `share_of_parent_pct_raw`)
   - Sort by likely query columns (institution_sk, fiscal_year)
   - ZSTD compression
3. Write to `apps/web/public/data/` (bundled) and `data/raw/` (for R2 upload)
4. Generate `manifest.json` with schema + row counts

## 6. Pages inventory

### 6.1 Phase 1 — Core dashboard (7 pages)

#### Home (`/`)
Hero: FY2024 total federal R&D figure animated counter ($199.5B). KPI strip below: # institutions, # agencies, # PIs, FY range. Top-15 R1 leaderboard with 20-year sparkline. Agency mix donut. CTA cards to other pages. "Last data refresh: 2026-05-29" footer.

#### Institution Profile (`/institution/[sk]`)
Header: canonical name + Carnegie class + state + total HERD federal R&D (FY2024 + 20-year sum).
Sections:
- **Top-down (HERD)**: line chart, federal R&D over 20 years, real vs nominal toggle
- **Bottom-up (USAS+NIH+NSF+SBIR)**: stacked bar by source, same FY range
- **Reconciliation row**: gap visualization with explanation tooltip
- **By-agency**: stacked area chart of federal contracts/grants by agency over time
- **NIH IC breakdown** (if applicable): top-12 ICs as stacked bars
- **PI cross-agency**: count of PIs active in multiple federal agencies
- **Quick links**: similar-size institutions, same-state institutions
- **Methodology footnote**: which data sources are populated, any caveats specific to this institution

Filter chips at top: FY range slider (2005–2024), nominal/real CPI toggle, "exclude FFRDC" toggle (for institutions like JHU with APL).

#### Agency Profile (`/agency/[sk]`)
Header: agency name + total FY2024 federal R&D + 20-year sum.
Sections:
- **Total obligations over time** (line, with real/nominal toggle)
- **Top recipient institutions** (ranked table, FY range filterable)
- **Geographic distribution** (state choropleth or top-states bar)
- **Performer-type breakdown** (universities vs FFRDC vs industry vs other)
- **Mission area mix** (where data permits)
- **Sub-agency drilldown** (e.g., HHS → NIH/CDC/AHRQ etc; DOD → service branches)

#### Trends Explorer (`/trends`)
The "data playground" page. Highly customizable.
Controls:
- **Metric**: federal R&D total, NIH-only, NSF-only, USAS contracts, USAS assistance, HERD federal, gap (top-down − bottom-up), # PIs
- **Cohort**: top-N R1s (toggle 5/10/20/50/100), single institution picker (up to 5), state, Carnegie class, custom set saved by user (LocalStorage)
- **FY range**: 2005–2024 slider
- **Display**: nominal / real-CPI / indexed-to-FY2005 / YoY-pct-change
- **Chart**: multi-line, stacked area, small-multiples grid, table

Output: chart + downloadable CSV + permalink with state encoded in URL params.

#### State Map (`/states`)
US choropleth of FY2024 federal R&D received by state. Color scale: log-binned $ amount. Click state → side panel with ranked institutions in that state + state-level totals over 20 years. Toggle to switch metric (HERD federal, NIH only, NSF only, USAS contracts, etc) and FY.

#### Methodology (`/methodology`)
Long-form scrollable page covering:
- Data sources (HERD, USAS, NIH ExPORTER, NSF Awards, SBIR.gov, Federal Funds, BLS CPI) with links
- The 6 documented caveats from Sheet 9
- Entity resolution methodology (Phase C v4)
- QA results summary (Phase 13.5 + 13.6, link to qa_value_summary.md)
- Limitations (NSF pi_sk gap, USAS pre-2008, SBIR duplicates, FF dedup, etc.)
- Citation block ("Cite as: ...")
- Data freshness / next refresh date

#### Downloads (`/downloads`)
Per-sheet download buttons (CSV + parquet), full master workbook (Excel), full data dictionary (PDF), QA reports (markdown). Each download has size, row count, and last-rebuilt date.

### 6.2 Phase 2 — Analytics tier (5 pages)

#### Federal R&D Flow (`/flow`)
Sheet 10 as an interactive Sankey diagram: Federal total → Agency (15 cols) → Performer type → (optional) top institutions. Hover for $ amount + share of parent. Click to filter. FY slider on top. Real/nominal toggle. Synthetic-remainder rows shown in muted grey with explanation tooltip ("absorbs documented Federal Funds source inconsistency").

#### Cross-Source Reconciliation (`/reconciliation`)
Sheet 7 + Sheet 11 unified. Two main views:
- **Per-institution**: pick one → see top-down (HERD) vs bottom-up (USAS+NIH+NSF) over 20 years with gap explained
- **National bridge** (Sheet 11): the three legitimate FY values for federal R&D — FF-explicit, FF-with-allocation, HERD-reported — with prose explanation (Option 3 Hybrid range card per `project_bridge_reconciliation_methodology` memory)

#### NIH IC Deep Dive (`/nih`)
Sheet 12 page. Pick an IC (NCI, NIAID, NIGMS, NHLBI, ...) → see top recipient institutions, time trends, IC share of NIH total over time. MD Anderson NCI 73.7% as a callout. "Cancer-focused" / "Heart-focused" / etc. institution archetypes surfaced.

#### Compare Institutions (`/compare`)
Pick up to 4 institutions → see them side-by-side: bars (FY2024 federal R&D), trends (20-year line, indexed to FY2005), agency mix (small-multiples), reconciliation gap, NIH/NSF/USAS shares.

#### Correlation Builder (`/correlations`)
Pick metric X (e.g., NSF awards) + metric Y (e.g., HERD federal R&D). Pick cohort + FY. Output: scatter with regression line, Pearson r, Spearman ρ, per-institution table sortable by residual. "Surprises" panel auto-flags institutions with largest residuals. Saved-correlation gallery with curated examples.

### 6.3 Deferred / not built (Phase 3+, future)
- User accounts & saved dashboards
- Public REST API
- Mobile-optimized layouts
- Email digest / subscriptions
- Custom-citation generator
- Embeddable iframes

## 7. Visual design system

### 7.1 Tone (user's brief)
> "Modern Research Data Analytics tool with simple, minimalist elegant look but insane amount of insights and data that are highly customizable."

Translation: dense when needed, restrained chrome, beautiful typography, charts as the hero. References: Our World in Data (insight density), Linear (minimalism + interaction design), Stripe (refinement), Observable (data-first).

### 7.2 Tokens

**Palette** (default, light mode):
- Surface: `#FAFAF9` (warm off-white)
- Surface elevated: `#FFFFFF`
- Border: `#E7E5E4`
- Text primary: `#0C0A09` (warm near-black)
- Text secondary: `#57534E`
- Text tertiary: `#A8A29E`
- Accent: `#0F766E` (deep teal — sophisticated, not corporate-blue) — single accent color
- Accent muted: `#CCFBF1`
- Chart sequence (7 categorical): `#0F766E #1E40AF #B45309 #BE185D #4D7C0F #6D28D9 #475569` — desaturated, accessible
- Positive: `#15803D`
- Negative: `#B91C1C`
- Warning: `#A16207`

Dark mode mirror (`#0A0A09` surface, `#FAFAF9` text, accent `#2DD4BF`).

**Typography**:
- Display / headings: `Geist` (variable, sans-serif) — modern, neutral, sharp at all sizes
- Body: `Geist` (same family for unity)
- Numbers / data: `Geist Mono` — tabular figures for column alignment
- Optional serif accent for hero headlines: `Source Serif 4` (only on Home + Methodology)

**Spacing**: 4px grid. Generous: page gutters 64–96px on desktop. Card padding 24px.

**Borders & shadows**: 1px borders, no shadows by default. Use shadow only on hover/active. `rounded-md` (6px) for cards, `rounded-sm` (2px) for inputs.

### 7.3 Layout

- Top nav (sticky): logo + nav (Home, Trends, Institutions, Agencies, Map, Flow, Reconciliation, Compare, Correlations, Methodology, Downloads). Mobile: hamburger.
- Max width: 1440px content, full-bleed for maps and Sankey.
- No persistent sidebar. Filter controls live in a `<FilterBar>` strip below the page header on each page.
- Page header pattern: H1 + subtitle + filter chips + (optional) "data-source" indicator on right.

### 7.4 Components (shadcn/ui base + custom)
Standard: Button, Input, Select, Slider, Tabs, Card, Table, Tooltip, Popover, Dialog, Sheet, Badge.
Custom:
- `<MetricCard>` (KPI tile with value + delta + sparkline)
- `<ChartCard>` (chart with title + filters + export button + source footnote)
- `<InstitutionPicker>` (typeahead with thousands of institutions, fuzzy search via DuckDB)
- `<AgencyPicker>`, `<FYRangeSlider>`, `<MetricSelect>`
- `<DataTable>` (TanStack-backed, sticky header, sortable, exportable)
- `<Sparkline>` (inline, 20-year)
- `<USStateMap>` (react-simple-maps with topojson)
- `<Sankey>` (visx-based)
- `<ScatterCorrelation>` (visx-based)
- `<NotesBlock>` (callout for caveats / methodology notes)

### 7.5 Interactivity
- Every chart has: hover tooltip, click-to-filter, export PNG + CSV, "explain this" tooltip linking to methodology
- Every filter persists in URL params (shareable links)
- LocalStorage saves last-used filter state per page

## 8. MCP server design

### 8.1 Purpose
Expose the Herd Survey dataset to claude.ai (and any MCP-compatible client) so the user can ask natural-language questions and have Claude run real SQL queries and explain results — all powered by their existing Claude Pro/Max subscription.

### 8.2 Stack
- **FastMCP** (Python framework for MCP servers)
- **DuckDB** (read-only connection over parquet files)
- **Pydantic** for tool argument validation
- **Hugging Face Spaces** (free Docker hosting, public, persistent for active projects)

### 8.3 Exposed tools

| Tool | Purpose | Inputs | Outputs |
|---|---|---|---|
| `query_duckdb` | Run a read-only DuckDB SQL query | `sql: str` (validated against SELECT-only regex) | JSON rows (max 50k) + column types |
| `list_tables` | List all tables/views | none | array of `{name, row_count, columns, description}` |
| `describe_table` | Schema for one table | `table: str` | column list with types + sample values |
| `search_institutions` | Fuzzy search dim_institution | `q: str, limit?: int` | array of `{sk, canonical_name, state, hcc}` |
| `get_institution_summary` | Pre-computed summary | `sk: str` | totals, top agencies, gap, sparkline data |
| `list_agencies` | Returns dim_agency | none | array |
| `get_methodology` | Returns Sheet 9 caveats as structured text | `topic?: str` | markdown |
| `get_qa_summary` | Returns latest QA results | none | structured summary of Phase 13.5/6 |

All tools are **read-only**. SQL is validated to forbid `INSERT/UPDATE/DELETE/DROP/ATTACH/COPY/IMPORT`. Query timeout 30s. Row cap 50k.

### 8.4 Connection model
- Hosted at `https://samsiddy-herd-survey-mcp.hf.space/sse` (HF Space URL)
- Registered in user's claude.ai via Settings → Connectors → Custom MCP
- Authentication: anonymous (data is public), but rate-limited per-IP
- HF Space sleeps after 48h inactivity; cron job pings every 24h to keep warm

### 8.5 What it doesn't do
- No write operations
- No multi-user state
- No streaming results > 50k rows (use Downloads page for that)

## 9. Tech stack (final)

| Concern | Choice |
|---|---|
| Frontend framework | Next.js 14 (App Router, static export with `output: 'export'`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Charts (standard) | Recharts |
| Charts (custom: Sankey, scatter, treemap) | Visx (low-level d3 wrappers) |
| Map | react-simple-maps + us-atlas topojson |
| Tables | TanStack Table v8 |
| Client SQL | @duckdb/duckdb-wasm |
| State | URL params (primary) + Zustand (component-local) + LocalStorage (persistence) |
| Forms | react-hook-form + zod |
| Icons | Lucide React |
| Fonts | Geist + Geist Mono (self-hosted, no CDN dependency) |
| Lint/format | Biome (faster than ESLint+Prettier combo) |
| Tests (web) | Vitest + Playwright (smoke + visual regression) |
| MCP backend | Python 3.11 + FastMCP + DuckDB + Pydantic |
| Tests (mcp) | pytest |
| Container | Docker (for HF Space) |
| Hosting (frontend) | Cloudflare Pages (free, unlimited bandwidth) |
| Hosting (data, raw) | Cloudflare R2 (10GB free tier) |
| Hosting (MCP) | Hugging Face Spaces (Docker, free) |
| CI/CD | GitHub Actions |
| Domain | `<project>.pages.dev` free default |

## 10. Repo layout

```
herd-survey-dashboard/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── (root)/
│   │   │   │   ├── page.tsx           # Home
│   │   │   │   └── layout.tsx
│   │   │   ├── institution/[sk]/page.tsx
│   │   │   ├── agency/[sk]/page.tsx
│   │   │   ├── trends/page.tsx
│   │   │   ├── states/page.tsx
│   │   │   ├── flow/page.tsx
│   │   │   ├── reconciliation/page.tsx
│   │   │   ├── nih/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   ├── correlations/page.tsx
│   │   │   ├── methodology/page.tsx
│   │   │   └── downloads/page.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn primitives
│   │   │   ├── charts/                # chart components
│   │   │   ├── filters/               # filter UI
│   │   │   └── layout/                # nav, footer
│   │   ├── lib/
│   │   │   ├── duckdb.ts              # DuckDB-WASM init + query helpers
│   │   │   ├── queries.ts             # canned SQL queries
│   │   │   ├── formatters.ts          # money, pct, dates
│   │   │   └── url-state.ts           # URL param sync
│   │   ├── public/
│   │   │   ├── data/                  # bundled parquet
│   │   │   └── fonts/                 # Geist files
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── next.config.mjs
│   │   └── tsconfig.json
│   └── mcp/                  # Python MCP server
│       ├── server.py
│       ├── tools/
│       │   ├── query.py
│       │   ├── search.py
│       │   ├── methodology.py
│       │   └── summary.py
│       ├── tests/
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── README.md
├── packages/
│   └── sql/                  # shared SQL views (text files; both apps consume)
│       ├── views.sql
│       └── schema.md
├── data/
│   ├── aggregates/           # build artifacts (parquet for web bundle)
│   ├── raw/                  # build artifacts (parquet for R2 upload)
│   └── manifest.json
├── scripts/
│   ├── build_data.py         # Reads data lake, writes aggregates + raw
│   ├── upload_r2.sh          # Uploads data/raw to R2 via wrangler
│   └── verify_data.py        # Sanity checks before deploy
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   │   └── 2026-05-29-herd-dashboard-design.md  (this doc)
│   │   └── plans/
│   │       └── 2026-05-29-herd-dashboard-plan.md    (next, from writing-plans)
│   └── deployment.md         # User-facing setup guide for CF/HF accounts
├── .github/
│   └── workflows/
│       ├── ci.yml            # lint, typecheck, test, build
│       └── deploy.yml        # CF Pages deploy on push to main
├── .gitignore
├── README.md
├── LICENSE                   # MIT
└── package.json              # workspace root
```

## 11. Deployment model

### 11.1 First-time setup (user actions)
1. Create empty public repo `samsiddy/herd-survey-dashboard` on GitHub
2. Sign up for Cloudflare (free, no card)
3. In Cloudflare dashboard: enable R2, create bucket `herd-survey`, get API token
4. In Cloudflare dashboard: enable Pages, connect to GitHub repo
5. Sign up for Hugging Face (free, no card)
6. Create new Space, type Docker, name `herd-survey-mcp`
7. Add secrets to GitHub repo settings:
   - `CF_API_TOKEN`
   - `CF_ACCOUNT_ID`
   - `R2_BUCKET_NAME`
   - `HF_TOKEN` (for pushing to Space)
8. In claude.ai: Settings → Connectors → Add MCP server → paste HF Space URL

### 11.2 Build & deploy flow
- Push to `main` → GitHub Actions:
  1. Build `apps/web` (`pnpm build`) → static export in `apps/web/out/`
  2. Run `scripts/build_data.py` → produces aggregates + raw parquet
  3. Push raw parquet to R2 (if changed)
  4. Push web to Cloudflare Pages
  5. (separately) Push `apps/mcp/` to HF Space via HF API

### 11.3 Operational notes
- Data refresh = re-run `scripts/build_data.py` against latest data lake, push
- HF Space wakes on first request after sleep (~30s cold start). Cron action wakes it every 24h
- Cloudflare Pages preview deploys on every PR (free)
- Custom domain optional: register at Cloudflare for ~$9/yr, point to Pages

## 12. Performance targets

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s on 3G |
| Time to Interactive | < 3s on 3G |
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Largest Contentful Paint | < 2.5s |
| DuckDB-WASM init | < 1s on broadband (cached after first) |
| First query response | < 200ms after init |
| Bundle size (JS) | < 500KB initial; chart libs lazy-loaded |
| Bundle size (data) | < 30MB total bundled parquet |

## 13. Accessibility & SEO

- All charts have aria-labels and accessible data tables (visual + screen reader)
- Color contrast WCAG AA minimum on all text
- Keyboard navigation through filters and charts
- Page metadata for SEO (Open Graph, Twitter cards on every page)
- Sitemap.xml auto-generated
- Per-page meta descriptions with key data points

## 14. Phasing

**Phase 1** (MVP, this build):
- Frontend foundation
- Pre-aggregated data pipeline
- Pages: Home, Institution, Agency, Trends, State Map, Methodology, Downloads
- Basic deployment

**Phase 2** (this build, after Phase 1):
- Pages: Federal Flow, Reconciliation, NIH IC, Compare, Correlations
- MCP server
- Polished deployment

**Phase 3** (future, not built now):
- Auth + saved dashboards
- Public REST API
- Mobile layouts
- Email digests

User said: "build the entire thing no matter how long it takes" → Phases 1 + 2 are in scope for this build.

## 15. Open questions / deferred decisions

None blocking. Decisions deferred until later in build:

- **Exact accent color**: defaulting to teal `#0F766E`; user can swap when reviewing visual prototype
- **Domain name**: defaulting to `herd-survey-dashboard.pages.dev`; custom optional
- **Light/dark mode toggle**: default light, but ship dark mode toggle in nav (cheap to add)
- **Citation format**: defaulting to APA + BibTeX; can add more later

## 16. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 2.6GB parquet egress exceeds 10GB R2 free | Aggressive column pruning; range-request streaming; bundle aggregates so most pages never hit R2 |
| DuckDB-WASM init perceived as slow | Show skeleton UI immediately; init runs in worker; first paint < 1.5s |
| HF Space cold start | Cron ping every 24h; first-time-of-day chat may take 30s but rare |
| Chart library bundle bloat | Lazy-load chart libs per page; Recharts as default + Visx only where needed |
| Browser memory on big queries | DuckDB-WASM caps at 4GB; query row caps in canned queries |
| Schema drift from data lake | `manifest.json` versioning + smoke tests in CI; build fails if schema diverges |

## 17. Definition of done

- All 12 pages built and functional
- All pages pass Lighthouse ≥ 90 perf, ≥ 95 a11y
- All charts have a11y tables + export + tooltips
- MCP server deployed to HF Space, registered, tested against claude.ai
- Data pipeline runs end-to-end (`scripts/build_data.py` → bundled parquet + R2 upload)
- GitHub Actions deploys to Cloudflare Pages on push to main
- README explains: what this is, how to run locally, how to redeploy, how to connect MCP to claude.ai
- Deployment guide (`docs/deployment.md`) walks Usama through first-time CF + HF setup
- Sister-repo README points to this repo

---

**End of spec.**
