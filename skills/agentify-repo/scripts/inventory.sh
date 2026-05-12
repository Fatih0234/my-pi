#!/usr/bin/env bash
set -euo pipefail

# inventory.sh — Compatibility wrapper around inventory_repo.py.
# Usage: bash scripts/inventory.sh <repo-path>

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO="${1:?Usage: inventory.sh <repo-path>}"

python3 "$SCRIPT_DIR/inventory_repo.py" "$REPO" --format markdown
