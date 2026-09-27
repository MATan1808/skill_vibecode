#!/bin/bash
# Fleet-wide cleanup: remove __MACOSX and public WordPress readme/license fingerprint files.
set -uo pipefail

echo "===== FLEET CLEANUP: __MACOSX + public WP readme/license files ====="
date

cleaned=0

for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue

  find "$DOCROOT" -type d -name "__MACOSX" -print0 2>/dev/null | while IFS= read -r -d '' dir; do
    echo "REMOVE __MACOSX: $dir"
    rm -rf -- "$dir"
  done

  for rel in \
    readme.html license.txt licencia.txt \
    wp-admin/readme.html wp-admin/license.txt wp-admin/licencia.txt \
    wp-includes/readme.html wp-includes/license.txt wp-includes/licencia.txt \
    wp-includes/ID3/license.txt; do
    f="${DOCROOT%/}/$rel"
    if [ -f "$f" ]; then
      echo "REMOVE FILE: $f"
      rm -f -- "$f" && cleaned=$((cleaned + 1))
    fi
  done

  for f in "$DOCROOT"/wp-config.php.bak* "$DOCROOT"/wp-config.php.*.bak; do
    [ -f "$f" ] && echo "REMOVE BACKUP: $f" && rm -f -- "$f" && cleaned=$((cleaned + 1))
  done
done

echo "TOTAL CLEANED: $cleaned"
echo "===== DONE ====="
