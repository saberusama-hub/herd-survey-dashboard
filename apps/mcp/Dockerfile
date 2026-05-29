# Herd Survey MCP server — Hugging Face Spaces Docker image.
#
# Build:  docker build -t herd-mcp apps/mcp/
# Run:    docker run -p 7860:7860 -e HERD_DATA_URL=https://herd-survey-dashboard.pages.dev herd-mcp
#
# On HF Spaces, set the secret HERD_DATA_URL via the Settings UI.

FROM python:3.11-slim

# system deps for DuckDB (none needed currently; placeholder for future curl/ca-certs if SSL issues arise)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching
COPY pyproject.toml /app/
RUN pip install --no-cache-dir \
    "mcp>=1.2.0" \
    "duckdb>=1.1.0" \
    "pydantic>=2.5.0" \
    "starlette>=0.40.0" \
    "uvicorn>=0.30.0" \
    "httpx>=0.27.0"

COPY herd_mcp/ /app/herd_mcp/

# HF Spaces routes to $PORT (or 7860 by default)
ENV PORT=7860
EXPOSE 7860

# Default to remote data source (Cloudflare Pages). Override with HERD_DATA_DIR for local-bound testing.
ENV HERD_DATA_URL=https://herd-survey-dashboard.pages.dev

CMD ["uvicorn", "herd_mcp.server:asgi", "--host", "0.0.0.0", "--port", "7860", "--log-level", "info"]
