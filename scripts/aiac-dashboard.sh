#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${AIAC_TELEMETRY_PORT:-3600}"
URL="http://localhost:${PORT}"

NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
  if [ -x "/Volumes/DATA/DEV/vuaassistant/runtime/node/node" ]; then
    NODE_BIN="/Volumes/DATA/DEV/vuaassistant/runtime/node/node"
  fi
fi

if [ -z "$NODE_BIN" ]; then
  echo "Lỗi: Không tìm thấy node binary để chạy AIaC Telemetry Server."
  exit 1
fi

echo "Đang khởi động AIaC Telemetry Dashboard tại ${URL}..."
"$NODE_BIN" "$SCRIPT_DIR/360org/telemetry/server.js" &
sleep 1

if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
else
  echo "$URL"
fi
