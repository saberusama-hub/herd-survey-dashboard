#!/usr/bin/env bash
# P9.5 — Lighthouse mobile audit runner.
#
# Pre-requisite: `lighthouse` installed globally (npm install -g lighthouse).
# Writes JSON + HTML reports per route to qa-lighthouse/.
#
# Usage:
#   ./scripts/qa/lighthouse.sh
#   PORT=4000 ./scripts/qa/lighthouse.sh    # override port

set -euo pipefail

PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"
OUTDIR="qa-lighthouse"

if ! command -v lighthouse >/dev/null 2>&1; then
  echo "GAP: lighthouse not installed globally. Install with:"
  echo "  npm install -g lighthouse"
  echo "Skipping P9.5; documenting as a gap in the QA report."
  exit 2
fi

mkdir -p "$OUTDIR"

ROUTES=(
  "/"
  "/universities/"
  "/national/"
  "/compare/"
  "/methodology/"
  "/downloads/"
)

# Append one sampled profile.
SAMPLE_SK=$(node -e "const i = require('./apps/web/public/data/dim_institution.json'); console.log(i[0].sk);" 2>/dev/null || echo "")
if [ -n "$SAMPLE_SK" ]; then
  ROUTES+=("/universities/${SAMPLE_SK}/")
fi

for r in "${ROUTES[@]}"; do
  safe=$(echo "$r" | sed 's|/|_|g')
  safe="${safe#_}"; safe="${safe%_}"
  safe="${safe:-root}"
  echo "Lighthouse: $r → $OUTDIR/$safe"
  lighthouse "${BASE}${r}" \
    --emulated-form-factor=mobile \
    --throttling-method=simulate \
    --output=json --output=html \
    --output-path="$OUTDIR/$safe" \
    --chrome-flags="--headless" \
    --quiet || echo "  (lighthouse exit non-zero — see $OUTDIR/$safe)"
done

echo "Lighthouse reports: $OUTDIR/"
