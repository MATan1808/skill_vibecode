#!/usr/bin/env bash
set -euo pipefail

# AIaC Device Doctor
# Kiểm tra toàn diện năng lực điều khiển thiết bị (iOS, Android, macOS)

echo "=== AIaC Agent-Device Environment Doctor ==="

# 1. Binary agent-device
if command -v agent-device >/dev/null 2>&1; then
  VERSION=$(agent-device --version 2>/dev/null || echo "Unknown")
  echo "✓ agent-device CLI : Đã cài đặt (v$VERSION tại $(command -v agent-device))"
else
  echo "✗ agent-device CLI : Chưa tìm thấy trong PATH"
fi

# 2. macOS Accessibility Support
if [ "$(uname)" = "Darwin" ]; then
  echo "✓ macOS Native     : Hỗ trợ tự động qua macOS Accessibility API"
else
  echo "- macOS Native     : Bỏ qua (không phải macOS)"
fi

# 3. iOS Simulator (Xcode / simctl)
if command -v xcrun >/dev/null 2>&1 && xcrun simctl list devices >/dev/null 2>&1; then
  SIM_COUNT=$(xcrun simctl list devices available | grep -c "iPhone" || echo "0")
  echo "✓ iOS Simulator    : Sẵn sàng ($SIM_COUNT thiết bị khả dụng)"
else
  echo "- iOS Simulator    : simctl chưa sẵn sàng (cần Xcode Developer Tools đầy đủ)"
fi

# 4. Android Emulator / ADB
if command -v adb >/dev/null 2>&1; then
  DEVICE_COUNT=$(adb devices | grep -v "List" | grep "device" | wc -l | tr -d ' ' || echo "0")
  echo "✓ Android ADB      : Sẵn sàng ($DEVICE_COUNT thiết bị đang kết nối)"
else
  echo "- Android ADB      : adb chưa có trong PATH"
fi

echo "============================================"
