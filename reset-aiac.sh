#!/usr/bin/env bash
# AIaC Reset & Clean Installer Engine
# Xoá dọn sạch toàn bộ skills/plugins cũ và tái cài đặt 100% Plugin Packages v3.x
# Hỗ trợ 3 nhóm AI Clients: Claude Code, Codex CLI, Antigravity IDE / Gemini CLI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_ROOT="${AIAC_ENV_ROOT:-}"
[ -z "$ENV_ROOT" ] && [ -d /Volumes/DATA/ENV ] && ENV_ROOT="/Volumes/DATA/ENV"
home_path() { printf '%s/%s\n' "${ENV_ROOT:-$HOME}" "$1"; }

CLAUDE_DIR="$(home_path .claude)"
CODEX_DIR="$(home_path .codex)"
GEMINI_DIR="$(home_path .gemini)"
ANTIGRAVITY_DIR="$(home_path .antigravity-ide)"

RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
BOLD='\033[1m'
NC='\033[0m'

log() { printf "${BLUE}[AIaC Reset]${NC} %s\n" "$1"; }
ok() { printf "${GREEN}[AIaC Reset]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[AIaC Reset]${NC} %s\n" "$1"; }
err() { printf "${RED}[AIaC Reset]${NC} %s\n" "$1"; }

# 28 Plugin Packages v3.x chuẩn do 360org quản lý
AIAC_PLUGINS=(
    "360-agent-browser"
    "360-agent-map"
    "360-airouter"
    "360-caveman"
    "360-codegraph"
    "360-designer"
    "360-desktop-app"
    "360-desktop-reverse"
    "360-dev-workflow"
    "360-flutter"
    "360-gitsync"
    "360-graphify"
    "360-harness"
    "360-hermes"
    "360-marketing"
    "360-odoo"
    "360-openclaw"
    "360-payload-website"
    "360-ponytail"
    "360-rancher"
    "360-securities"
    "360-superpowers"
    "360-token-killer"
    "360-update-skill-resource"
    "360-vcloud"
    "360-vuaassistant"
    "360-vuaoffice"
    "360-wordpress"
)

# Danh sách editor đích
detect_target_editors() {
    [ -d "$CLAUDE_DIR" ] && echo "Claude Code|$CLAUDE_DIR/skills"
    [ -d "$CODEX_DIR" ] && echo "Codex CLI|$CODEX_DIR/skills"
    if [ -d "$GEMINI_DIR" ] || [ -d "$ANTIGRAVITY_DIR" ] || [ -d "${AIAC_APP_DIR:-/Applications}/Antigravity.app" ]; then
        echo "Antigravity/Gemini|$GEMINI_DIR/config/skills"
    fi
    return 0
}

# Xử lý cờ xác nhận bỏ qua tương tác (-y / --yes / --force)
FORCE_CONFIRM=0
for arg in "$@"; do
    case "$arg" in
        -y|--yes|--force)
            FORCE_CONFIRM=1
            ;;
    esac
done

printf "\n"
printf "${BOLD}======================================================================${NC}\n"
printf "${BOLD}         TIEN TRINH RESET & CAI DAT SACH AIAC PLUGINS V3.X            ${NC}\n"
printf "${BOLD}======================================================================${NC}\n\n"

printf "${YELLOW}${BOLD}CANH BAO:${NC}\n"
printf "  Thao tac nay se:\n"
printf "  1. Xoa toan bo cac symlink skill/plugin cu tai cac thu muc AI Client:\n"
printf "     - Claude Code:       %s/skills\n" "$CLAUDE_DIR"
printf "     - Codex CLI:         %s/skills\n" "$CODEX_DIR"
printf "     - Antigravity/Gemini:%s/config/skills\n" "$GEMINI_DIR"
printf "  2. Don dep thu muc cuc bo %s/360org/\n" "$CLAUDE_DIR"
printf "  3. Dong bo lai 100%% Plugin Packages v3.x tu repo %s\n" "$SCRIPT_DIR"
printf "  4. Dang ky lai chinh xac %d Plugin Packages v3.x cho tat ca cac client.\n\n" "${#AIAC_PLUGINS[@]}"

# BƯỚC CONFIRMATION BẮT BUỘC
if [ "$FORCE_CONFIRM" -ne 1 ]; then
    printf "${BOLD}Sep co chac chan muon tien hanh RESET va CAI DAT LAI toan bo khong?${NC}\n"
    read -r -p "Nhap 'y' hoac 'yes' de xac nhan (moi phim khac se huy): " confirm_input
    case "$confirm_input" in
        [yY]|[yY][eE][sS])
            log "Da nhan duoc xac nhan tu Sep. Bat dau thuc hien reset..."
            ;;
        *)
            warn "Tien trinh reset da duoc HUY BO theo yeu cau cua Sep. Khong co thay doi nao duoc ap dung."
            exit 0
            ;;
    esac
else
    log "Co --yes/--force duoc kich hoat. Tu dong bo qua buoc hoi xac nhan."
fi

# 1. DỌN DẸP SYMLINKS CŨ TRÊN CÁC AI CLIENTS
editors="$(detect_target_editors)"
if [ -n "$editors" ]; then
    while IFS='|' read -r editor_name SKILLS_DIR; do
        [ -n "$editor_name" ] || continue
        log "Dang don sach skills/plugins cu tren $editor_name ($SKILLS_DIR)..."
        if [ -d "$SKILLS_DIR" ]; then
            # Xoá tất cả symlinks trong thư mục skills (giữ lại các thư mục đặc biệt như .system nếu có)
            find "$SKILLS_DIR" -maxdepth 1 -type l -exec rm -f {} +
            # Xoá các link trỏ sai hoặc plugin cũ không còn trong danh sách v3
            for item in "$SKILLS_DIR"/*; do
                if [ -L "$item" ]; then
                    rm -f "$item"
                fi
            done
            ok "Da don sach symlinks cu tren $editor_name."
        else
            mkdir -p "$SKILLS_DIR"
        fi
    done <<< "$editors"
fi

# 2. THIẾT LẬP SYMLINK TRỰC TIẾP $CLAUDE_DIR/360org ➜ $SCRIPT_DIR/360org
log "Thiet lap symlink truc tiep tu $CLAUDE_DIR/360org ➜ $SCRIPT_DIR/360org..."
if [ -L "$CLAUDE_DIR/360org" ]; then
    rm -f "$CLAUDE_DIR/360org"
elif [ -d "$CLAUDE_DIR/360org" ]; then
    rm -rf "$CLAUDE_DIR/360org"
fi
ln -sfn "$SCRIPT_DIR/360org" "$CLAUDE_DIR/360org"
printf '{\n  "repoRoot": "%s"\n}\n' "$SCRIPT_DIR" > "$SCRIPT_DIR/360org/aiac-runtime.json"
ok "Da thiet lap symlink $CLAUDE_DIR/360org tro ve repo AIaC goc."

# 3. TÁI ĐĂNG KÝ PLUGIN PACKAGES V3.X
log "Dang ky ${#AIAC_PLUGINS[@]} Plugin Packages v3.x cho cac AI Clients..."
if [ -n "$editors" ]; then
    while IFS='|' read -r editor_name SKILLS_DIR; do
        [ -n "$editor_name" ] || continue
        mkdir -p "$SKILLS_DIR"
        count=0
        for plugin in "${AIAC_PLUGINS[@]}"; do
            target_source="$CLAUDE_DIR/360org/plugins/$plugin"
            if [ -d "$target_source" ]; then
                ln -sfn "$target_source" "$SKILLS_DIR/$plugin"
                ((count++))
            else
                warn "Khong tim thay plugin package $plugin tai $target_source"
            fi
        done
        ok "[$editor_name] Da tao moi $count/${#AIAC_PLUGINS[@]} Plugin symlinks tai $SKILLS_DIR"
    done <<< "$editors"
fi

# 4. LIÊN KẾT FILE CHỈ DẪN GLOBAL (CLAUDE.md & AGENTS.md)
log "Lien ket file chi dan global..."
link_instructions() {
    local target="$1"
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$SCRIPT_DIR/CLAUDE.md" ]; then
        return
    elif [ -e "$target" ] || [ -L "$target" ]; then
        local backup="$target.bak-aiac-$(date +%Y%m%d%H%M%S)"
        mv "$target" "$backup"
    fi
    ln -sfn "$SCRIPT_DIR/CLAUDE.md" "$target"
}

[ -d "$CLAUDE_DIR" ] && link_instructions "$CLAUDE_DIR/CLAUDE.md"
[ -d "$CODEX_DIR" ] && link_instructions "$CODEX_DIR/AGENTS.md"
[ -d "$GEMINI_DIR" ] && link_instructions "$GEMINI_DIR/AGENTS.md"
ok "Da lien ket file chi dan global voi $SCRIPT_DIR/CLAUDE.md"

# 5. MERGE CẤU HÌNH CLAUDE SETTINGS
if [ -d "$CLAUDE_DIR" ] && command -v node >/dev/null 2>&1; then
    log "Merge cau hinh Claude Code overlay..."
    node "$SCRIPT_DIR/scripts/aiac/merge-claude-settings.js" --target "$CLAUDE_DIR/settings.json"
    ok "Da cap nhat hooks va permission rules cho Claude Code."
fi

printf "\n"
printf "${GREEN}${BOLD}======================================================================${NC}\n"
printf "${GREEN}${BOLD}   DA RESET VA CAI DAT THANH CONG 100%% AIAC V3.X CHO MOI AI CLIENTS   ${NC}\n"
printf "${GREEN}${BOLD}======================================================================${NC}\n\n"
printf "Danh sach %d Plugin Packages v3.x da duoc dang ky:\n" "${#AIAC_PLUGINS[@]}"
for i in "${!AIAC_PLUGINS[@]}"; do
    printf "  %2d. %s\n" "$((i+1))" "${AIAC_PLUGINS[$i]}"
done
printf "\n"
