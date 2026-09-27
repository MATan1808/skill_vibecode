#!/usr/bin/env bash
# Cài CodeGraph như dependency tùy chọn do AIaC quản lý; không gọi installer upstream.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$SCRIPT_DIR/config/codegraph/release.json"
ENV_ROOT="${AIAC_ENV_ROOT:-}"
[ -z "$ENV_ROOT" ] && [ -d /Volumes/DATA/ENV ] && ENV_ROOT="/Volumes/DATA/ENV"
INSTALL_ROOT="${AIAC_TOOLS_DIR:-${ENV_ROOT:-$HOME}/.claude/360org/tools}/codegraph"
BIN_DIR="$HOME/.local/bin"

fail() { printf '[AIaC] %s\n' "$1" >&2; exit 1; }
log() { printf '[AIaC] %s\n' "$1"; }

[ -f "$CONFIG" ] || fail "Không tìm thấy cấu hình CodeGraph: $CONFIG"
command -v curl >/dev/null || fail "Cần curl để tải release CodeGraph."
if ! command -v shasum >/dev/null && ! command -v sha256sum >/dev/null; then
  fail "Cần shasum hoặc sha256sum để kiểm tra checksum."
fi

os="$(uname -s)"
arch="$(uname -m)"
case "$os:$arch" in
  Darwin:arm64) key='Darwin-arm64' ;;
  Darwin:x86_64) key='Darwin-x86_64' ;;
  Linux:arm64|Linux:aarch64) key='Linux-arm64' ;;
  Linux:x86_64) key='Linux-x86_64' ;;
  *) fail "CodeGraph chưa có asset AIaC cho $os/$arch." ;;
esac

read_release_value() {
  python3 - "$CONFIG" "$1" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as handle:
    value = json.load(handle)
for part in sys.argv[2].split('.'):
    value = value[part]
print(value, end='')
PY
}

if command -v python3 >/dev/null; then
  version="$(read_release_value version)"
  archive="$(read_release_value "assets.$key.archive")"
  checksum="$(read_release_value "assets.$key.sha256")"
else
  fail "Cần python3 để đọc config/codegraph/release.json."
fi
url="https://github.com/colbymchenry/codegraph/releases/download/v$version/$archive"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

log "Tải CodeGraph $version ($key) và kiểm tra checksum..."
curl --fail --location --silent --show-error "$url" --output "$temporary/$archive"
if command -v shasum >/dev/null; then
  echo "$checksum  $temporary/$archive" | shasum -a 256 -c - >/dev/null || fail "Checksum CodeGraph không khớp; không cài đặt."
else
  echo "$checksum  $temporary/$archive" | sha256sum -c - >/dev/null || fail "Checksum CodeGraph không khớp; không cài đặt."
fi
tar -xzf "$temporary/$archive" -C "$temporary"
source_bin="$(find "$temporary" -type f -path '*/bin/codegraph' -perm -u+x -print -quit)"
[ -n "$source_bin" ] || fail "Release CodeGraph không có binary mong đợi."

mkdir -p "$INSTALL_ROOT" "$BIN_DIR"
if [ -e "$INSTALL_ROOT/current" ] && [ ! -f "$INSTALL_ROOT/current/.aiac-managed" ]; then
  fail "Từ chối thay CodeGraph không do AIaC quản lý tại $INSTALL_ROOT/current."
fi
rm -rf "$INSTALL_ROOT/current"
cp -R "$(dirname "$(dirname "$source_bin")")" "$INSTALL_ROOT/current"
printf '%s\n' "AIaC CodeGraph $version" > "$INSTALL_ROOT/current/.aiac-managed"
ln -sfn "$INSTALL_ROOT/current/bin/codegraph" "$BIN_DIR/codegraph"

log "Đã cài CodeGraph $version tại $INSTALL_ROOT/current."
log "Chưa thêm MCP, permission hoặc prompt hook. AIaC chỉ kích hoạt theo từng project qua skill 360-codegraph."
