#!/usr/bin/env bash
set -euo pipefail

# AIaC Agent Device Runner Wrapper
# Kiểm tra binary agent-device và thực thi với tham số truyền vào

if command -v agent-device >/dev/null 2>&1; then
  exec agent-device "$@"
elif [ -f "/usr/local/bin/agent-device" ]; then
  exec /usr/local/bin/agent-device "$@"
elif [ -f "$HOME/.npm-global/bin/agent-device" ]; then
  exec "$HOME/.npm-global/bin/agent-device" "$@"
else
  echo "[AIaC Agent-Device] Cảnh báo: Binary agent-device chưa được cài đặt." >&2
  echo "➔ Hướng dẫn cài đặt nhanh: npm install -g agent-device@latest" >&2
  exit 1
fi
