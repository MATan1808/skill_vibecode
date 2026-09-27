#!/usr/bin/env bash
# Script gỡ cài đặt hoàn toàn AIaC khỏi các Editor AI.
set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"
GEMINI_DIR="$HOME/.gemini"

log() { printf '\033[34m[AIaC-Uninstall]\033[0m %s\n' "$1"; }
ok() { printf '\033[32m[AIaC-Uninstall]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[AIaC-Uninstall]\033[0m %s\n' "$1"; }

# 1. Xoá các symlink skill AIaC trong các thư mục editor
# Phải đồng bộ với danh sách AIAC_SKILLS trong install-aiac.sh
AIAC_SKILLS="360-odoo 360-vuaassistant 360-hermes 360-openclaw 360-flutter 360-wordpres 360-ponytail 360-caveman 360-superpowers 360-agent-map 360-codegraph 360-airouter 360-gitsync wp-dev-skills wp-audit-website"

clean_skills() {
    local skills_dir="$1"
    if [ -d "$skills_dir" ]; then
        log "Đang dọn dẹp skills tại $skills_dir..."
        for name in $AIAC_SKILLS; do
            if [ -L "$skills_dir/$name" ]; then
                rm -f "$skills_dir/$name"
            fi
        done
    fi
}

clean_skills "$CLAUDE_DIR/skills"
clean_skills "$CODEX_DIR/skills"
clean_skills "$GEMINI_DIR/config/skills"

# 2. Xoá liên kết chỉ dẫn global và khôi phục backup
restore_instruction() {
    local target="$1"
    # Xử lý cả symlink bình thường lẫn broken symlink (trỏ về file không còn tồn tại)
    if [ -L "$target" ]; then
        rm -f "$target"
        log "Đã xoá symlink $target"
        # Tìm file backup gần nhất để khôi phục nếu có
        local backup
        backup=$(ls -t "${target}.bak-aiac-"* 2>/dev/null | head -n 1 || true)
        if [ -n "$backup" ] && [ -f "$backup" ]; then
            mv "$backup" "$target"
            ok "Đã khôi phục file cấu hình cũ từ $backup"
        fi
    fi
}

restore_instruction "$CLAUDE_DIR/CLAUDE.md"
restore_instruction "$CODEX_DIR/AGENTS.md"
restore_instruction "$GEMINI_DIR/AGENTS.md"

# 3. Loại bỏ Hook của AIaC trong settings.json của Claude Code bằng Node.js
if [ -f "$CLAUDE_DIR/settings.json" ] && command -v node >/dev/null 2>&1; then
    log "Đang gỡ bỏ Hook SessionStart của AIaC khỏi settings.json..."
    node -e '
    const fs = require("fs");
    const path = require("path");
    const settingsPath = path.join(process.env.HOME, ".claude", "settings.json");
    try {
        if (!fs.existsSync(settingsPath)) process.exit(0);
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (settings.hooks && settings.hooks.SessionStart) {
            settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
                if (entry.hooks) {
                    entry.hooks = entry.hooks.filter(h => !h.command || !h.command.includes("360-smart-router.js"));
                }
                return entry.hooks && entry.hooks.length > 0;
            });
            if (settings.hooks.SessionStart.length === 0) {
                delete settings.hooks.SessionStart;
            }
            if (Object.keys(settings.hooks).length === 0) {
                delete settings.hooks;
            }
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
            console.log("[AIaC-Uninstall] Đã loại bỏ Hook khỏi settings.json.");
        }
    } catch (e) {
        console.error("[AIaC-Uninstall] Lỗi khi dọn dẹp settings.json:", e.message);
    }
    '
fi

# 4. Xoá thư mục gốc vật lý của AIaC
if [ -d "$CLAUDE_DIR/360org" ]; then
    rm -rf "$CLAUDE_DIR/360org"
    log "Đã xoá thư mục ~/.claude/360org"
fi

# 5. Xoá rules ECC do AIaC cài (nếu có)
if [ -d "$CLAUDE_DIR/rules/ecc" ]; then
    rm -rf "$CLAUDE_DIR/rules/ecc"
    log "Đã xoá ~/.claude/rules/ecc"
fi

ok "Đã gỡ cài đặt hoàn toàn AIaC khỏi thiết bị."
