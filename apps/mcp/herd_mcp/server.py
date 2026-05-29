"""MCP server entrypoint.

Runs in two transports:
  - stdio (default): for local Claude Desktop / Claude Code integration
  - sse: for Hugging Face Spaces / claude.ai remote connector
        $ uvicorn herd_mcp.server:asgi --host 0.0.0.0 --port 7860

Connect from claude.ai:
  Settings → Connectors → Custom MCP → URL = https://<space>.hf.space/sse
"""

from __future__ import annotations

import argparse
import logging

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .data import open_connection
from .tools import describe_table, get_methodology, list_tables, query_duckdb, search_institutions

logger = logging.getLogger("herd_mcp")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


# DNS rebinding protection is intended for localhost-bound MCP servers.
# We're publicly accessible over HTTPS behind HF Spaces' reverse proxy, so
# disable it here — the threat model it protects against doesn't apply.
mcp = FastMCP(
    name="research-data-platform",
    instructions=(
        "Research Data Platform · Federal R&D funding to U.S. universities, FY2005–FY2024.\n"
        "Maintained by the Policy and Strategy team.\n\n"
        "Use `list_tables` to discover the 15 registered views. Use `describe_table` "
        "before writing SQL to confirm column names and types. Use `query_duckdb` for "
        "ad-hoc analysis (SELECT-only, single-statement, ≤50k rows). Use "
        "`search_institutions` to resolve fuzzy university names to institution_sk. "
        "Use `get_methodology` for source attribution and caveats — always reference "
        "these when discussing reconciliation gaps or tiny anchors."
    ),
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)

# Single shared connection (DuckDB connection is thread-safe for read).
_con = open_connection()
logger.info("DuckDB connection opened, %d views registered", len(list_tables(_con)["tables"]))


@mcp.tool()
def tool_query_duckdb(sql: str) -> dict:
    """Run a read-only DuckDB SQL query over the Herd Survey views.

    Args:
      sql: A single SELECT/WITH/DESCRIBE/SHOW/PRAGMA statement. Forbidden: INSERT,
        UPDATE, DELETE, DROP, CREATE, ATTACH, COPY, IMPORT, SET, etc. The query is
        automatically capped at 50,000 rows.

    Returns:
      { row_count, row_cap_hit, columns: [{name, type}], rows: [{...}] }
    """
    return query_duckdb(_con, sql)


@mcp.tool()
def tool_list_tables() -> dict:
    """List all registered views (sheets + dims) with row counts and column lists."""
    return list_tables(_con)


@mcp.tool()
def tool_describe_table(table: str) -> dict:
    """Describe one view: full schema + 5 sample rows.

    Use this BEFORE writing SQL to confirm exact column names and types.
    """
    return describe_table(_con, table)


@mcp.tool()
def tool_search_institutions(q: str, limit: int = 25) -> dict:
    """Fuzzy-search universities by canonical name or state.

    Returns institution_sk for each match — pass into `query_duckdb` to filter
    by specific universities.
    """
    return search_institutions(_con, q, limit)


@mcp.tool()
def tool_get_methodology() -> dict:
    """Returns sources, FY range, university count, documented caveats, QA summary, citation.

    ALWAYS call this if the user asks about how the data was built, what caveats apply,
    or how to cite. Reference the specific caveats in your response.
    """
    return get_methodology()


# Expose ASGI app for SSE deployment (Hugging Face Spaces uses this).
asgi = mcp.sse_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="Herd Survey MCP server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="MCP transport (default: stdio for Claude Desktop)",
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=7860)
    args = parser.parse_args()

    if args.transport == "stdio":
        mcp.run(transport="stdio")
    else:
        import uvicorn

        uvicorn.run(asgi, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
