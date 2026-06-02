# Deployment Guide

Free-tier deployment to Cloudflare Workers Static Assets + Hugging Face Spaces.

## Architecture

```
GitHub (saberusama-hub/herd-survey-dashboard)
  ├─ push → main
  │       ├─ CI workflow:    typecheck + lint + test + build
  │       └─ Deploy workflow: pnpm dlx wrangler@4.95.0 deploy
  │                           → Cloudflare Workers Static Assets
  │                           → https://herd-survey-dashboard.saber-usama.workers.dev/
  │
  └─ HF Space mirror (apps/mcp/)
          → docker build on push
          → samsiddy/herd-survey-mcp (HF Spaces)
          → https://samsiddy-herd-survey-mcp.hf.space/sse
```

Both auto-deploy on push to `main`. Typical cycle: **~1m15s** for the dashboard, ~3min for the MCP space.

## Accounts (all free)

- **GitHub** — `saberusama-hub`
- **Cloudflare** — https://dash.cloudflare.com/sign-up (no credit card)
- **Hugging Face** — https://huggingface.co/join (only for the MCP server)

## Cloudflare Workers Static Assets — one-time setup

This project uses **Workers Static Assets**, not Cloudflare Pages. The deploy is driven by a `wrangler.toml` (in repo root) + the `pnpm dlx wrangler@4.95.0 deploy` step in `.github/workflows/deploy.yml`.

The legacy `cloudflare/wrangler-action@v3` had a recurring `Cannot read properties of null (reading 'matches')` crash on this project; the direct `pnpm dlx wrangler` invocation is reliable.

1. Cloudflare dashboard → My Profile → API Tokens → Create Token.
2. Use the **Edit Cloudflare Workers** template (or build a custom token with `Account → Workers Scripts: Edit` + `Workers R2 Storage: Edit` if you plan to add R2).
3. Copy the token.
4. In this repo: Settings → Secrets and variables → Actions → New secret:
   - `CF_API_TOKEN` = (paste token)
   - `CF_ACCOUNT_ID` = (from the right sidebar of the CF dashboard home)

The deploy workflow reads both from the environment.

## Deploy workflow

`.github/workflows/deploy.yml`:

```yaml
- name: Build web (static export)
  run: pnpm build
- name: Publish to Cloudflare Workers (Static Assets)
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
  run: pnpm dlx wrangler@4.95.0 deploy
```

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` is set at the workflow level so we run on the Node 24 actions runtime ahead of GitHub's forced migration on 2026-06-16.

## CI workflow

`.github/workflows/ci.yml` runs on every push + PR. Five checks:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` — TypeScript correctness
3. `pnpm lint` — biome (0 errors gate)
4. `pnpm test` — vitest unit tests
5. `pnpm build` — Next.js static export

All five must pass.

## Data refresh workflow

The parquet bundle in `apps/web/public/data/` is committed to git (CI does not rebuild it — the source data lake isn't reachable from the GitHub runner). To refresh:

```bash
# 1. Rebuild the source data lake (sister repo: /Users/Usama/Documents/Claude Projects/Herd Survey/)
# ...

# 2. In this repo, rebuild the pre-aggregations:
bash scripts/aggregations/run_all.sh
# (runs 31 aggregation scripts in dependency order, then refresh_manifest.py)

# 3. Verify
/private/tmp/herd_venv/bin/python scripts/qa/verify_facts.py    # 30/30 facts
bash scripts/qa/run_all.sh                                       # full QA harness

# 4. Commit + push → auto-deploy
git add apps/web/public/data/ apps/web/public/manifest.json
git commit -m "data: refresh parquet bundle"
git push
```

## Hugging Face Space — MCP server

The MCP server lives at `apps/mcp/` and is mirrored to `samsiddy/herd-survey-mcp` on HF Spaces (Docker SDK, cpu-basic).

1. https://huggingface.co/new-space — Docker, name `herd-survey-mcp`, public, free CPU.
2. Get an HF access token: Settings → Access Tokens → New token with `write` scope.
3. In GitHub repo Settings → Secrets:
   - `HF_TOKEN` = (paste token)
4. Push triggers the mirror workflow.
5. In a Claude client, add the SSE endpoint: `https://samsiddy-herd-survey-mcp.hf.space/sse`

To verify the space is alive:

```bash
curl https://huggingface.co/api/spaces/samsiddy/herd-survey-mcp \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['runtime']['stage'])"
# → RUNNING
```

## Local DNS gotcha

If `curl https://herd-survey-dashboard.saber-usama.workers.dev/` returns "Could not resolve host", the local DNS resolver is filtering `*.workers.dev`. Bypass:

```bash
URL="https://herd-survey-dashboard.saber-usama.workers.dev"
HOST="${URL#https://}"
IP=$(dig @1.1.1.1 +short "$HOST" | head -1)
curl --resolve "$HOST:443:$IP" "$URL/"
```

## Troubleshooting

- **CI lint failure**: `pnpm --filter @herd/web lint:fix` to auto-fix what biome can; the rest are accessibility/structural fixes (see `apps/web/biome.json` ruleset).
- **CI build out-of-memory**: rare; add `--max-old-space-size=4096` to the build step.
- **Deploy fails with `null.matches`**: that's the legacy `cloudflare/wrangler-action@v3` crash — confirm the workflow uses the direct `pnpm dlx wrangler@4.95.0 deploy` invocation.
- **Local `pnpm build` hangs at 0% CPU**: known SWC worker deadlock on this filesystem (curly-apostrophe `Documents - Usama's MacBook Pro/` path). Skip local build and rely on CI. Vitest hits the same deadlock; use CI for unit-test verification.
- **Puppeteer probe hangs on DuckDB-WASM init**: chrome sandbox issue. The QA scripts pass `--no-sandbox --disable-dev-shm-usage --disable-gpu` and use `waitUntil: 'domcontentloaded'` (DuckDB-WASM streams parquets continuously so `networkidle0` never fires).
- **DuckDB-WASM fails to load in browser**: open devtools network tab. Most likely a parquet file 404'd. Verify the file exists in `apps/web/out/data/` after a build, and that `manifest.json` enumerates it.
