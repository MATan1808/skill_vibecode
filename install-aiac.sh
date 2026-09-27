#!/usr/bin/env bash
# Cài AIaC cho Claude Code theo mô hình overlay: chỉ thêm phần AIaC sở hữu.
# Không thay thế settings, permissions, hooks, MCP, plugin hay skills đã có.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="${AIAC_ENV_ROOT:-}"
[ -z "$ENV_ROOT" ] && [ -d /Volumes/DATA/ENV ] && ENV_ROOT="/Volumes/DATA/ENV"
home_path() { printf '%s/%s\n' "${ENV_ROOT:-$HOME}" "$1"; }
CLAUDE_DIR="$(home_path .claude)"
CODEX_DIR="$(home_path .codex)"
GEMINI_DIR="$(home_path .gemini)"
ANTIGRAVITY_DIR="$(home_path .antigravity-ide)"

log() { printf '\033[34m[AIaC]\033[0m %s\n' "$1"; }
ok() { printf '\033[32m[AIaC]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[AIaC]\033[0m %s\n' "$1"; }

# Dò editor AI đang cài trên máy đích và trả về danh sách "tên|thư mục skills".
# Sếp dùng iMac thì AIAC_ENV_ROOT mặc định là /Volumes/DATA/ENV; máy khác fallback về $HOME.
# Antigravity, Antigravity IDE và Gemini CLI dùng CHUNG kho .gemini/config/skills
# nên chỉ link một lần cho cả ba, tránh tạo bản trùng.
detect_editors() {
    [ -d "$CLAUDE_DIR" ] && echo "Claude Code|$CLAUDE_DIR/skills"
    [ -d "$CODEX_DIR" ] && echo "Codex|$CODEX_DIR/skills"
    # AIAC_APP_DIR cho phép test cách ly; mặc định là /Applications của macOS.
    if [ -d "$GEMINI_DIR" ] || [ -d "$ANTIGRAVITY_DIR" ] || [ -d "${AIAC_APP_DIR:-/Applications}/Antigravity.app" ]; then
        echo "Gemini/Antigravity|$GEMINI_DIR/config/skills"
    fi
    return 0
}

link_skill() {
    local source="$1"
    local name="$2"
    local destination="$SKILLS_DIR/$name"

    if [ -L "$destination" ]; then
        local current
        current="$(readlink "$destination")"
        if [ "$current" = "$source" ]; then
            return
        fi
        if [ "$(realpath "$destination" 2>/dev/null || true)" = "$(realpath "$source" 2>/dev/null || true)" ]; then
            ln -sfn "$source" "$destination"
            return
        fi
        warn "Giữ nguyên skill symlink '$name'; AIaC không thay thế liên kết không sở hữu."
        return
    elif [ -e "$destination" ]; then
        warn "Giữ nguyên skill đã có '$name'; AIaC không ghi đè nội dung không sở hữu."
        return
    fi

    ln -s "$source" "$destination"
}

log "Bắt đầu cài đặt AIaC theo mô hình merge kế thừa..."

# ECC tự quản lý các file thuộc core.
# KHÔNG gọi --profile full: ~/.claude/skills là symlink farm riêng của người dùng;
# ECC installer fail-closed nếu phát hiện symlink trỏ ngoài containment root (đúng thiết kế).
# AIaC chỉ overlay phần 360org/** bên trên ECC đã cài sẵn; không chạy lại ECC installer.
if [ -d "$CLAUDE_DIR" ] && [ ! -d "$CLAUDE_DIR/skills" ]; then
    warn "Chưa có $CLAUDE_DIR/skills — chạy ECC installer thủ công trước: bash install.sh --target claude --profile full"
fi

# Skills riêng tư nằm ở submodule repo private; máy không có quyền truy cập sẽ bỏ qua,
# phần còn lại của AIaC vẫn cài bình thường (fail-open, không chặn cả installer).
PRIVATE_SKILLS=""
if [ -f "$SCRIPT_DIR/.gitmodules" ] && command -v git >/dev/null 2>&1; then
    log "Đồng bộ submodule skills riêng tư..."
    if git -C "$SCRIPT_DIR" submodule update --init --recursive 2>/dev/null; then
        ok "Đã pull submodule riêng tư."
    else
        warn "Không pull được submodule riêng tư (thiếu quyền repo private?) — bỏ qua, các skill công khai vẫn cài bình thường."
    fi
    # Chỉ đăng ký submodule đã thực sự có nội dung; thư mục rỗng nghĩa là không có quyền.
    while read -r path; do
        [ -n "$(ls -A "$SCRIPT_DIR/$path" 2>/dev/null)" ] || continue
        PRIVATE_SKILLS="$PRIVATE_SKILLS $(basename "$path")"
    done < <(git -C "$SCRIPT_DIR" config -f .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}')
fi

# 360org Symlink Architecture: Thư mục $CLAUDE_DIR/360org liên kết trực tiếp về $SCRIPT_DIR/360org trong repo AIaC gốc
log "Thiết lập symlink trực tiếp từ $CLAUDE_DIR/360org ➜ $SCRIPT_DIR/360org..."
if [ -L "$CLAUDE_DIR/360org" ]; then
    rm -f "$CLAUDE_DIR/360org"
elif [ -d "$CLAUDE_DIR/360org" ]; then
    rm -rf "$CLAUDE_DIR/360org"
fi
ln -sfn "$SCRIPT_DIR/360org" "$CLAUDE_DIR/360org"
printf '{\n  "repoRoot": "%s"\n}\n' "$SCRIPT_DIR" > "$SCRIPT_DIR/360org/aiac-runtime.json"

# Skills công khai và Plugin Packages v3.0 do 360org quản lý
AIAC_PLUGINS="360-odoo 360-desktop-app 360-desktop-reverse 360-agent-browser 360-vuaoffice 360-vuaassistant 360-hermes 360-openclaw 360-flutter 360-wordpress 360-dev-workflow 360-payload-website 360-marketing 360-designer 360-ponytail 360-caveman 360-superpowers 360-agent-map 360-codegraph 360-airouter 360-gitsync 360-graphify 360-harness 360-update-skill-resource 360-securities 360-rancher 360-token-killer 360-vcloud"

editors="$(detect_editors)"
if [ -z "$editors" ]; then
    warn "Không phát hiện editor AI nào trên máy này; bỏ qua bước đăng ký plugins."
else
    while IFS='|' read -r editor_name SKILLS_DIR; do
        [ -n "$editor_name" ] || continue
        log "Phát hiện $editor_name ➜ đăng ký plugins vào $SKILLS_DIR"
        mkdir -p "$SKILLS_DIR"
        for name in $AIAC_PLUGINS; do
            if [ -d "$CLAUDE_DIR/360org/plugins/$name" ]; then
                link_skill "$CLAUDE_DIR/360org/plugins/$name" "$name"
            fi
        done
    done <<< "$editors"
    ok "Đã đăng ký 100% Plugin Packages AIaC cho các editor phát hiện được."
fi

# CodeGraph là binary local-first được AIaC ghim release/checksum; không chạy installer upstream vì nó sửa MCP/permission/instructions.
if [ "${AIAC_SKIP_CODEGRAPH:-0}" = "1" ]; then
    warn "Bỏ qua cài CodeGraph do AIAC_SKIP_CODEGRAPH=1."
elif [ -x "$SCRIPT_DIR/scripts/aiac/install-codegraph.sh" ]; then
    log "Cài CodeGraph local-first do AIaC quản lý..."
    if ! bash "$SCRIPT_DIR/scripts/aiac/install-codegraph.sh"; then
        warn "Chưa cài được CodeGraph; các skill/config hiện có vẫn hoạt động. Chạy lại installer khi có mạng."
    fi
fi

# File chỉ dẫn global do AIaC quản lý. Chỉ backup khi file hiện tại không phải liên kết AIaC.
# Claude đọc CLAUDE.md, Codex/Gemini/Antigravity đọc AGENTS.md — cùng trỏ về một nguồn trong repo.
link_instructions() {
    local target="$1"
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$SCRIPT_DIR/CLAUDE.md" ]; then
        return
    elif [ -e "$target" ] || [ -L "$target" ]; then
        local backup="$target.bak-aiac-$(date +%Y%m%d%H%M%S)"
        mv "$target" "$backup"
        warn "Đã backup $(basename "$target") trước AIaC tại $backup"
    fi
    ln -sfn "$SCRIPT_DIR/CLAUDE.md" "$target"
}

[ -d "$CLAUDE_DIR" ] && link_instructions "$CLAUDE_DIR/CLAUDE.md"
[ -d "$CODEX_DIR" ] && link_instructions "$CODEX_DIR/AGENTS.md"
[ -d "$GEMINI_DIR" ] && link_instructions "$GEMINI_DIR/AGENTS.md"
ok "Đã liên kết file chỉ dẫn global với repo AIaC."

# Merge idempotent: chỉ append hook AIaC nếu chưa có; giữ nguyên toàn bộ key/array hiện hữu.
# Bước này chỉ áp dụng cho Claude Code; các editor khác không dùng settings.json của Claude.
if [ -d "$CLAUDE_DIR" ] && command -v node >/dev/null 2>&1; then
    log "Merge cấu hình Claude Code hiện có với AIaC overlay..."
    node "$SCRIPT_DIR/scripts/aiac/merge-claude-settings.js" --target "$CLAUDE_DIR/settings.json"
    node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const required=['SessionStart','PreToolUse','PostToolUse','PreCompact','Stop'];const missing=required.filter(k=>!Array.isArray(s.hooks&&s.hooks[k])||!s.hooks[k].length);if(missing.length){console.error('[AIaC] Thiếu hook sau merge: '+missing.join(', '));process.exit(1)}" "$CLAUDE_DIR/settings.json"
    ok "Đã giữ nguyên settings, permissions, hooks, MCP và plugin hiện hữu; verify đủ 5 hook."
fi

ok "Cài đặt hoàn tất. AIaC chạy như lớp bổ sung, không thay thế cấu hình cũ."
