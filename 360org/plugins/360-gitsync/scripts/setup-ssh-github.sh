#!/usr/bin/env bash
# Script tự động cấu hình lại SSH Key và Config SSH cho GitHub trên máy mới.
# Xưng em, gọi Sếp
set -euo pipefail

SSH_DIR="$HOME/.ssh"
KEY_NAME="github_id_ed25519"
TARGET_KEY="$SSH_DIR/$KEY_NAME"
# Khoá bí mật KHÔNG nằm trong git. Mặc định đọc từ kho ngoài repo;
# đổi được bằng biến môi trường khi Sếp để key ở chỗ khác.
SKILL_SEC_DIR="${AIAC_SECRETS_DIR:-/Volumes/DATA/ENV/aiac-secrets}"

echo "========================================================"
echo "=== CẤU HÌNH TỰ ĐỘNG SSH KEY GITHUB ==="
echo "========================================================"

# 1. Tạo thư mục ~/.ssh nếu chưa có
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# 2. Copy SSH Key vào ~/.ssh
if [ -f "$SKILL_SEC_DIR/github_id_ed25519" ]; then
  echo "--> Copy SSH Private Key cho GitHub..."
  cp "$SKILL_SEC_DIR/github_id_ed25519" "$TARGET_KEY"
  chmod 600 "$TARGET_KEY"

  cp "$SKILL_SEC_DIR/github_id_ed25519.pub" "$TARGET_KEY.pub"
  chmod 644 "$TARGET_KEY.pub"
  echo "  [OK] Đã ghi nhận key: $TARGET_KEY"
else
  echo "🚨 [LỖI] Sếp ơi, không tìm thấy key tại: $SKILL_SEC_DIR"
  echo "   Khoá bí mật cố ý KHÔNG lưu trong git. Sếp làm một trong hai cách:"
  echo "   1) Copy thư mục key từ máy cũ sang $SKILL_SEC_DIR"
  echo "   2) Tạo key mới:  ssh-keygen -t ed25519 -f \$HOME/.ssh/github_id_ed25519"
  echo "      rồi thêm public key vào GitHub > Settings > SSH keys"
  exit 1
fi

# 3. Cập nhật ~/.ssh/config
echo "--> Cập nhật tệp ~/.ssh/config..."
touch "$SSH_DIR/config"
chmod 600 "$SSH_DIR/config"

# Kiểm tra xem cấu hình Host github.com đã tồn tại chưa
if grep -q "Host github.com" "$SSH_DIR/config"; then
  echo "  [Lưu ý] Đã tồn tại cấu hình Host github.com trong ~/.ssh/config."
  echo "  Em sẽ ghi đè hoặc bổ sung nếu cần thiết. Sếp kiểm tra lại tệp config nhé."
elif [ -f "$SKILL_SEC_DIR/ssh_config_snippet" ]; then
  cat "$SKILL_SEC_DIR/ssh_config_snippet" >> "$SSH_DIR/config"
  echo "  [OK] Đã thêm cấu hình SSH github.com thành công."
else
  # Snippet không có sẵn thì tự sinh — nội dung này không phải bí mật.
  printf '\nHost github.com\n  HostName github.com\n  User git\n  IdentityFile %s\n  IdentitiesOnly yes\n' "$TARGET_KEY" >> "$SSH_DIR/config"
  echo "  [OK] Đã tự sinh cấu hình SSH github.com."
fi

# 4. Thêm key vào agent nếu có keychain
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "--> Thêm key vào ssh-agent trên macOS..."
  ssh-add --apple-use-keychain "$TARGET_KEY" 2>/dev/null || ssh-add -K "$TARGET_KEY" 2>/dev/null || ssh-add "$TARGET_KEY"
fi

echo "========================================================"
echo "=== HOÀN TẤT CẤU HÌNH SSH KEY GITHUB ==="
echo "========================================================"
