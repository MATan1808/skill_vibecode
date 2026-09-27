#!/usr/bin/env bash
# Script tự động cập nhật gói @genspark/cli từ npm registry cho AIaC 360org skills
# Không cài đặt trên máy host, chỉ download tarball và giải nén.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIAC_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_DIR="$AIAC_ROOT/360org/skills/360-genspark-cli"

log() { printf '\033[34m[Genspark Updater]\033[0m %s\n' "$1"; }
ok() { printf '\033[32m[Genspark Updater]\033[0m %s\n' "$1"; }

log "Tải bản mới nhất của @genspark/cli từ npm..."
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# Tải tarball
npm pack @genspark/cli

TARBALL=$(ls genspark-cli-*.tgz | head -n 1)
log "Đang giải nén $TARBALL..."
tar -xzf "$TARBALL"

# Xoá file tarball và chuyển nội dung package ra root skill
rm -f "$TARBALL"
if [ -d "package" ]; then
    cp -r package/* .
    rm -rf package
fi

ok "Cập nhật @genspark/cli hoàn tất tại: $TARGET_DIR"
