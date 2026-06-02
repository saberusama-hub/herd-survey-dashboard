#!/usr/bin/env bash
# One-time setup: point git at the repo's tracked hooks dir.
# Run this once per clone.

set -e
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
echo "✓ git core.hooksPath → .githooks"
echo "  pre-commit hook will run on every commit; bypass with --no-verify"
