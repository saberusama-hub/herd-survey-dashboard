#!/usr/bin/env bash
#
# P1.17 — Run all 15 aggregation scripts in dependency order.
# Each script reads from apps/web/public/data and writes agg_*.parquet there.
#
# Notes
#   * Python 3.14 venv with duckdb installed lives at /private/tmp/herd_venv.
#     Override with PYTHON env var if you have a different venv on hand.
#   * Scripts 09-15 depend on outputs from 01-08, so order matters.

set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-/private/tmp/herd_venv/bin/python3}"

if [ ! -x "$PY" ]; then
  echo "Python interpreter not found at $PY"
  echo "Set PYTHON env var to a python3 with duckdb installed."
  exit 1
fi

echo "Running 15 aggregations using $($PY --version)..."
for script in 01_*.py 02_*.py 03_*.py 04_*.py 05_*.py 06_*.py 07_*.py 08_*.py \
              09_*.py 10_*.py 11_*.py 12_*.py 13_*.py 14_*.py 15_*.py; do
  echo ""
  echo "> $script"
  "$PY" "$script"
done

echo ""
echo "Total agg_*.parquet size:"
du -ch ../../apps/web/public/data/agg_*.parquet | tail -1
