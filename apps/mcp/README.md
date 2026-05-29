# Herd Survey MCP Server

Exposes the Herd Survey dataset to [claude.ai](https://claude.ai) (and any MCP-compatible client) so users can ask natural-language questions about 20 years of federal R&D funding — using their existing Claude subscription. No API key, no API costs.

## How it works

```
[claude.ai or Claude Desktop]
        ↓  MCP protocol (SSE over HTTPS)
[This server]  ← Hugging Face Spaces (free Docker container)
        ↓  DuckDB queries
[Parquet bundle on Cloudflare Pages or local files]
```

## Tools exposed

| Tool | Purpose |
|---|---|
| `tool_list_tables` | Lists 15 views (12 sheets + 3 dim/lookup tables) with row counts + columns |
| `tool_describe_table(table)` | Full schema for one view + 5 sample rows. Use before writing SQL |
| `tool_query_duckdb(sql)` | Run a read-only SQL query (SELECT/WITH/DESCRIBE only, 50k row cap) |
| `tool_search_institutions(q, limit)` | Fuzzy search universities by name or state. Returns institution_sk |
| `tool_get_methodology()` | Sources, caveats, QA summary, citation |

All tools are **read-only**. SQL is parsed to forbid `INSERT/UPDATE/DELETE/DROP/CREATE/ATTACH/COPY/IMPORT/SET`. Single-statement only. Memory + thread caps.

## Local dev

```bash
cd apps/mcp
uv venv  # or python -m venv .venv
source .venv/bin/activate
pip install -e .

# Point at the dashboard repo's bundled parquet
export HERD_DATA_DIR="$(pwd)/../web/public/data"

# Run with stdio (for Claude Desktop)
python -m herd_mcp.server --transport stdio
```

### Connecting from Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "herd-survey": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["-m", "herd_mcp.server", "--transport", "stdio"],
      "env": {
        "HERD_DATA_DIR": "/absolute/path/to/herd-survey-dashboard/apps/web/public/data"
      }
    }
  }
}
```

Restart Claude Desktop. The server appears in the connectors list.

## Deploy to Hugging Face Spaces

1. Create a new Space at https://huggingface.co/new-space:
   - SDK: **Docker**
   - Name: `herd-survey-mcp`
   - Hardware: **CPU basic (free)**
   - Visibility: Public
2. Mirror this directory to the Space repo:
   ```bash
   cd apps/mcp
   git remote add hf https://huggingface.co/spaces/<your-username>/herd-survey-mcp
   git push hf main
   ```
   Or use the HF Hub UI to drag-and-drop the files.
3. Set the `HERD_DATA_URL` env var in the Space settings to your dashboard URL (e.g., `https://herd-survey-dashboard.pages.dev`).
4. Wait ~3 min for the build.
5. Verify: `curl https://<your-username>-herd-survey-mcp.hf.space/sse` should respond.

### Connecting from claude.ai

1. claude.ai → Settings → Connectors → "Add custom connector"
2. Name: `Herd Survey`
3. URL: `https://<your-username>-herd-survey-mcp.hf.space/sse`
4. Save. The connector appears in your conversation tools.

Try asking:
> "Which 10 universities have the largest gap between HERD-reported federal R&D and bottom-up summed federal R&D in FY2024? Show me the SQL you ran."

> "How does Johns Hopkins' NIH IC mix compare to MD Anderson's?"

> "Plot HERD federal R&D for the top-5 California universities over the last 10 years."

## Env vars

| Variable | Default | Purpose |
|---|---|---|
| `HERD_DATA_DIR` | — | Local directory of parquet files. Takes precedence if set |
| `HERD_DATA_URL` | `https://herd-survey-dashboard.pages.dev` | Remote site to fetch parquet from |
| `PORT` | `7860` | HTTP port (SSE transport) |

## Safety notes

- Connection is opened read-only — no writes possible
- SQL is validated against a regex allowlist (SELECT/WITH/DESCRIBE/SHOW/PRAGMA only)
- Forbidden keywords blocked: INSERT/UPDATE/DELETE/DROP/CREATE/ATTACH/COPY/IMPORT/SET
- Row cap: 50,000 rows per query
- Memory limit: 512MB per query
- Thread limit: 2 per query
- Only one SQL statement per request
- All tools are stateless; no per-user data; no logging of query content
