#!/usr/bin/env bash
# Script tự động cập nhật và lọc các skills cho VuaOffice Suite (gensoffice origin) từ npm @genspark/cli
# Không cài đặt trên máy host.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIAC_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_DIR="$AIAC_ROOT/360org/skills/360-vuaoffice"

log() { printf '\033[34m[VuaOffice Skills Updater]\033[0m %s\n' "$1"; }
ok() { printf '\033[32m[VuaOffice Skills Updater]\033[0m %s\n' "$1"; }

log "Tải bản mới nhất của @genspark/cli từ npm..."
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

npm pack @genspark/cli

TARBALL=$(ls genspark-cli-*.tgz | head -n 1)
log "Đang giải nén $TARBALL..."
tar -xzf "$TARBALL"
rm -f "$TARBALL"

if [ -d "package" ]; then
    cp -r package/* .
    rm -rf package
fi

# Xóa script updater cũ nếu trùng
rm -f "$AIAC_ROOT/scripts/aiac/update-genspark-cli.sh"

ok "Cập nhật VuaOffice skills hoàn tất tại: $TARGET_DIR"
