#!/usr/bin/env bash
# AIaC Desktop App Quick Inspector Helper
# Tự động nhận diện cấu trúc Desktop App (.app bundle, .asar, binary)

set -e

TARGET="$1"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <path_to_app_or_binary>"
  exit 1
fi

echo "=== [AIaC Desktop Reverse Inspector] ==="
echo "Target: $TARGET"

if [ -d "$TARGET" ] && [[ "$TARGET" == *.app ]]; then
  echo "[+] Detected macOS .app Bundle"
  PLIST="$TARGET/Contents/Info.plist"
  if [ -f "$PLIST" ]; then
    echo "--- Bundle Info ---"
    plutil -p "$PLIST" 2>/dev/null | grep -E "CFBundleIdentifier|CFBundleName|CFBundleShortVersionString" || true
  fi

  ASAR="$TARGET/Contents/Resources/app.asar"
  if [ -f "$ASAR" ]; then
    echo "[+] Found Electron ASAR archive: $ASAR"
    echo "To extract: npx asar extract \"$ASAR\" ./extracted_app"
  fi

  MACOS_DIR="$TARGET/Contents/MacOS"
  if [ -d "$MACOS_DIR" ]; then
    echo "--- Executable Binaries ---"
    ls -lh "$MACOS_DIR"
  fi
elif [ -f "$TARGET" ]; then
  echo "[+] File Analysis:"
  file "$TARGET"
  if [[ "$TARGET" == *.asar ]]; then
    echo "[+] Electron ASAR package detected."
  fi
else
  echo "[!] Unknown target format: $TARGET"
fi
