#!/bin/bash
# Fleet-wide cleanup: remove __MACOSX, license.txt, readme.html from all WP sites
set -uo pipefail

echo "===== FLEET CLEANUP: __MACOSX, license.txt, readme.html ====="
date

cleaned=0

for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue
  DOMAIN=$(basename "$DOCROOT")

  # 1. Remove __MACOSX directories
  find "$DOCROOT" -type d -name "__MACOSX" -print0 2>/dev/null | while IFS= read -r -d '' dir; do
    echo "REMOVE __MACOSX: $dir"
    rm -rf -- "$dir"
    cleaned=$((cleaned+1))
  done

  # 2. Remove license.txt and readme.html from WP root
  for f in "$DOCROOT/license.txt" "$DOCROOT/readme.html"; do
    if [ -f "$f" ]; then
      echo "REMOVE FILE: $f"
      rm -f -- "$f"
      cleaned=$((cleaned+1))
    fi
  done

  # 3. Remove any stray wp-config.php.backup or similar
  for f in "$DOCROOT"/wp-config.php.bak* "$DOCROOT"/wp-config.php.*.bak; do
    [ -f "$f" ] && echo "REMOVE BACKUP: $f" && rm -f -- "$f" && cleaned=$((cleaned+1))
  done
done

echo "TOTAL CLEANED: $cleaned"
echo "===== DONE ====="