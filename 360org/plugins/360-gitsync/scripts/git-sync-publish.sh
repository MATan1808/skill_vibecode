#!/usr/bin/env bash
# Script đồng bộ an toàn từ GitLab (private) sang GitHub (public)
# Cơ chế: Copy toàn bộ code ra thư mục tạm -> lọc bỏ các file khớp với .githubignore -> commit/push lên GitHub
# Xưng em, gọi Sếp
set -euo pipefail

echo "========================================================"
echo "=== ĐỒNG BỘ AN TOÀN SANG GITHUB (PUBLIC MIRROR) ==="
echo "========================================================"

# 1. Kiểm tra môi trường git và remote github
if [ ! -d ".git" ]; then
  echo "FATAL: Không tìm thấy thư mục .git. Vui lòng chạy trong thư mục dự án!"
  exit 1
fi

if ! git remote | grep -q "^github$"; then
  echo "FATAL: Chưa cấu hình remote 'github'. Vui lòng chạy git-sync-init.sh trước!"
  exit 1
fi

# 2. Đảm bảo nhánh hiện tại đã được push đầy đủ lên GitLab (origin)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "--> Kiểm tra trạng thái git local..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Warning: Sếp ơi, có thay đổi chưa commit. Vui lòng commit và push lên GitLab trước!"
  exit 1
fi

echo "--> Đang đẩy thay đổi mới nhất lên GitLab..."
git push origin "$CURRENT_BRANCH"

# Lấy URL của remote github
GITHUB_URL=$(git remote get-url github)

# 3. Tạo thư mục tạm thời để xử lý lọc file sạch
TEMP_DIR=$(mktemp -d -t "git-sync-XXXXXXXXXX")
echo "--> Tạo không gian làm việc tạm thời tại: $TEMP_DIR"

# Clone repo hiện tại sang thư mục tạm (để giữ nguyên lịch sử commit)
echo "--> Clone repo cục bộ vào không gian tạm..."
# Loại bỏ flag --local để tránh lỗi Cross-device link khi làm việc trên các phân vùng đĩa khác nhau
git clone --branch "$CURRENT_BRANCH" . "$TEMP_DIR"

cd "$TEMP_DIR"

# Kiểm tra nếu file .githubignore tồn tại, tiến hành xóa các file private
if [ -f ".githubignore" ]; then
  echo "--> Đang lọc bỏ các file nhạy cảm theo danh sách .githubignore..."

  # Đọc từng dòng trong .githubignore
  while IFS= read -r pattern || [ -n "$pattern" ]; do
    # Bỏ qua dòng trống hoặc comment
    [[ "$pattern" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${pattern//[[:space:]]/}" ]] && continue

    echo "    Xóa file khớp với pattern: $pattern"

    # `/path` chỉ áp dụng tại root. Không dùng find -name cho nó: `AGENTS.md`
    # phải lọc file nội bộ ở root mà vẫn giữ docs/AGENTS.md trên public mirror.
    if [[ "$pattern" == /* ]]; then
      rm -rf ".${pattern}"
      continue
    fi

    # Tìm và xóa các file khớp với pattern trong thư mục tạm.
    find . -path "./.git" -prune -o -path "$pattern" -exec rm -rf {} + 2>/dev/null || true

    # Nếu pattern có dạng thư mục (vd: dir/), tìm và xóa theo tên ở mọi cấp.
    clean_pat="${pattern%/}"
    find . -path "./.git" -prune -o -name "$clean_pat" -exec rm -rf {} + 2>/dev/null || true
  done < ".githubignore"

  # Chạy git status trong thư mục tạm để add thay đổi xóa file
  git add -A

  # Chỉ commit nếu có sự thay đổi (các file private bị xóa)
  if ! git diff-index --quiet HEAD --; then
    echo "--> Tạo commit dọn dẹp các file private..."
    git commit -m "chore: sync public release and filter private files

Authored-By: 360org <support@360.org.vn>"
  fi
else
  echo "[WARNING] Không tìm thấy file .githubignore. Push toàn bộ code lên GitHub."
fi

# 4. Đẩy code lên GitHub
echo "--> Đang đẩy bản sạch lên GitHub..."
# Thêm remote github vào thư mục tạm và push
git remote remove origin || true
git remote add github "$GITHUB_URL"
git push -f github "$CURRENT_BRANCH"

# 5. Dọn dẹp thư mục tạm
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "========================================================"
echo "=== ĐỒNG BỘ SANG GITHUB HOÀN TẤT AN TOÀN ==="
echo "========================================================"
echo "Đã đẩy bản sạch (lọc theo .githubignore) lên GitHub remote: $GITHUB_URL"
