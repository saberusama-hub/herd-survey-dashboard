# Deployment Guide

This dashboard runs entirely on free tiers. First-time setup takes ~15 minutes.

## Accounts you need (all free, no credit card)

1. **GitHub** — you already have this (`saberusama-hub`)
2. **Cloudflare** — sign up at https://dash.cloudflare.com/sign-up
3. **Hugging Face** — sign up at https://huggingface.co/join (only needed for the MCP server, Plan 03)

## Cloudflare Pages setup

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. Workers & Pages → Create → Pages → Connect to Git → Authorize GitHub → pick `saberusama-hub/herd-survey-dashboard`.
3. Build settings:
   - **Framework preset**: Next.js (Static HTML Export)
   - **Build command**: `pnpm install --frozen-lockfile && pnpm build`
   - **Build output directory**: `apps/web/out`
   - **Root directory**: `/` (repo root)
   - **Environment variables**: none required for Phase 1
4. Save and deploy. First build takes 3–4 min. Subsequent builds with cache: ~1 min.
5. **Custom domain (optional)**: Pages project → Custom domains → Add. You can buy a `.com` from Cloudflare for ~$9/yr inside the same dashboard.

After connecting GitHub, every push to `main` auto-deploys. PRs get preview URLs.

## Cloudflare API token (for GitHub Actions deploy step)

Only needed if you want GitHub Actions to deploy (instead of Cloudflare's built-in Git integration):

1. Cloudflare dashboard → My Profile → API Tokens → Create Token
2. Use template "Edit Cloudflare Workers" or create a custom token with `Account → Cloudflare Pages: Edit`.
3. Copy the token.
4. In this repo: Settings → Secrets and variables → Actions → New secret:
   - `CF_API_TOKEN` = (paste token)
   - `CF_ACCOUNT_ID` = (from CF dashboard right sidebar)

The default `deploy.yml` uses these secrets. If you use Cloudflare's Git integration instead, you can delete `deploy.yml`.

## Cloudflare R2 (only needed for Plan 02, the raw fact-table tier)

1. Cloudflare dashboard → R2 → Create bucket → name `herd-survey`.
2. R2 → Manage API tokens → Create token → R2 read+write to bucket `herd-survey`.
3. Copy `Access Key ID` and `Secret Access Key`.
4. Add to GitHub repo secrets:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` = `herd-survey`

Plan 02 will add an upload script that pushes raw fact-table parquet to R2 and registers them with DuckDB-WASM at runtime.

## Data refresh workflow

1. Rebuild data lake (sister repo).
2. In this repo:
   ```bash
   pnpm data:build
   pnpm data:verify
   ```
3. Inspect `apps/web/public/manifest.json` for the new build timestamp and KPI values.
4. Commit + push → Cloudflare Pages auto-deploys.

## Hugging Face Spaces (Plan 03 — MCP server for claude.ai)

1. https://huggingface.co/new-space — choose Docker, name `herd-survey-mcp`, public, free CPU.
2. Get an HF access token: Settings → Access Tokens → New token with `write` scope.
3. In GitHub repo Settings → Secrets:
   - `HF_TOKEN` = (paste token)
4. Push triggers a GitHub Action that mirrors `apps/mcp/` to the Space.
5. In claude.ai → Settings → Connectors → Add → URL = `https://huggingface.co/spaces/saberusama-hub/herd-survey-mcp/` (or the SSE endpoint when ready).

(Details fleshed out in Plan 03.)

## Troubleshooting

- **Build fails with "out of memory"**: Add `--max-old-space-size=4096` to the Next.js build step in CF Pages settings.
- **DuckDB-WASM fails to load in browser**: Open devtools console. Most likely the parquet files aren't being served. Verify `apps/web/out/data/*.parquet` after a local `pnpm build`.
- **GitHub Actions deploy step fails**: Confirm `CF_API_TOKEN` is set and the token has Pages edit permission.
