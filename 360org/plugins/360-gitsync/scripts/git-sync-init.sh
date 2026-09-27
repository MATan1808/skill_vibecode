#!/usr/bin/env bash
# Script tạo repo song song trên cả GitLab và GitHub
# Xưng em, gọi Sếp
set -euo pipefail

REPO_NAME="${1:?Sếp ơi, vui lòng nhập tên Repository! Cú pháp: git-sync-init.sh <tên-repo> [group-gitlab] [org-github]}"
GL_GROUP="${2:-}"
GH_ORG="${3:-}"

echo "========================================================"
echo "=== KHỞI TẠO REPOSITORY SONG SONG GITLAB & GITHUB ==="
echo "========================================================"

# 1. Khởi tạo Git local nếu chưa có
if [ ! -d ".git" ]; then
  echo "--> Khởi tạo git repository cục bộ..."
  git init
  git checkout -b main
fi

# 2. Tạo repository trên GitLab (Mặc định là Private)
echo "--> Đang tạo repository trên GitLab..."
if [ -n "$GL_GROUP" ]; then
  GL_PATH="$GL_GROUP/$REPO_NAME"
else
  # Lấy namespace mặc định của user đang đăng nhập
  GL_USER=$(glab auth status 2>&1 | grep "Logged in to" | awk '{print $NF}' || echo "")
  GL_PATH="$REPO_NAME"
fi

glab repo create "$GL_PATH" --private --description "Private repository (Main Development)" -s || true
GL_SSH_URL="git@gitlab.com:${GL_PATH}.git"

# Cài đặt remote origin trỏ về GitLab
if git remote | grep -q "^origin$"; then
  git remote set-url origin "$GL_SSH_URL"
else
  git remote add origin "$GL_SSH_URL"
fi
echo "  [OK] Đã cấu hình remote 'origin' trỏ về GitLab: $GL_SSH_URL"

# 3. Tạo repository trên GitHub
echo "--> Đang tạo repository trên GitHub..."
if [ -n "$GH_ORG" ]; then
  GH_PATH="$GH_ORG/$REPO_NAME"
  # Tạo repo public thuộc org trên github
  gh repo create "$GH_PATH" --public --description "Public repository (Mirror of $REPO_NAME)" || true
  GH_SSH_URL="git@github.com:${GH_PATH}.git"
else
  # Tạo repo public cá nhân
  gh repo create "$REPO_NAME" --public --description "Public repository (Mirror of $REPO_NAME)" || true
  GH_USER=$(gh api user -q .login 2>/dev/null || echo "")
  GH_SSH_URL="git@github.com:${GH_USER}/${REPO_NAME}.git"
fi

# Cài đặt remote github
if git remote | grep -q "^github$"; then
  git remote set-url github "$GH_SSH_URL"
else
  git remote add github "$GH_SSH_URL"
fi
echo "  [OK] Đã cấu hình remote 'github' trỏ về GitHub: $GH_SSH_URL"

# 4. Khởi tạo file .githubignore mẫu nếu chưa tồn tại
if [ ! -f ".githubignore" ]; then
  echo "--> Tạo file cấu hình .githubignore mẫu..."
  cat <<'EOF' > .githubignore
# .githubignore
# File cấu hình chứa danh sách các file/thư mục CHỈ LƯU TRÊN GITLAB.
# Khi đồng bộ sang GitHub, script sẽ tự động xóa sạch các file này.

# Môi trường và cấu hình bảo mật
.env
.env.*
*.local
credentials/
secrets/
private_keys/
*.pem
*.key

# File dữ liệu, database backup và logs phát sinh
db_backup/
backups/
dumps/
logs/
*.sql
*.tar.gz
*.zip
*.bak

# Các file rác tạm thời của hệ thống dev
.DS_Store
tmp/
temp/
audit-work/
EOF
fi

# 4.5 Cài đặt Git Hook pre-push để phòng ngừa rò rỉ dữ liệu
echo "--> Đang cài đặt Git Hook pre-push để chặn push GitHub trực tiếp..."
mkdir -p .git/hooks
# Template nằm ngay trong skill này; suy ra đường dẫn từ vị trí script để chạy được ở mọi máy.
SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$SKILL_ROOT/templates/pre-push" ".git/hooks/pre-push"
chmod +x ".git/hooks/pre-push"
echo "  [OK] Đã kích hoạt hook bảo mật pre-push."

# 5. Commit lần đầu tiên
if ! git rev-parse --git-dir > /dev/null 2>&1 || [ -z "$(git status --porcelain)" ]; then
  echo "Không có file nào cần commit."
else
  git add .
  git commit -m "feat: init project with dual-remote gitlab and github structure

Co-Authored-By: Claude <noreply@anthropic.com>" || true
  echo "--> Đang đẩy code lên GitLab (origin)..."
  git push -u origin main || true
fi

echo "========================================================"
echo "=== HOÀN TẤT KHỞI TẠO REPO SONG SONG ==="
echo "=== GitLab (Private): $GL_SSH_URL"
echo "=== GitHub (Public) : $GH_SSH_URL"
echo "========================================================"
echo "Sếp hãy chỉnh sửa file .githubignore để thêm các file nhạy cảm cần ẩn trên GitHub,"
echo "sau đó chạy script 'git-sync-publish.sh' để đồng bộ sang GitHub."
