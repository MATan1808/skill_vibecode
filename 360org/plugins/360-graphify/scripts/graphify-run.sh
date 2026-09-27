#!/usr/bin/env bash
# Wrapper CLI to run graphify from inside AIaC
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CORE_DIR="$PLUGIN_ROOT/core"

if command -v uv >/dev/null 2>&1; then
  exec uv run --directory "$CORE_DIR" python -m graphify.cli "$@"
elif command -v python3 >/dev/null 2>&1; then
  PYTHONPATH="$CORE_DIR" exec python3 -m graphify.cli "$@"
else
  echo "[360-graphify] Error: neither 'uv' nor 'python3' found on PATH" >&2
  exit 1
fi
