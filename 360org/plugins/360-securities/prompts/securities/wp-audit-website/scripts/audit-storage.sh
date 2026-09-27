#!/bin/bash
# Read-only fleet storage audit for WordPress sites on CloudPanel.
# Flags docroots > 10 GiB or > 3x the fleet median.
# Usage: bash audit-storage.sh
set -uo pipefail
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue
  # Chi nhan docroot WordPress that, bo qua thu muc app/public_html/wp-content roi.
  [ -f "${DOCROOT}wp-config.php" ] || continue
  [ -d "${DOCROOT}wp-content" ] || continue
  domain=$(basename "$DOCROOT")
  bytes=$(du -sxB1 "$DOCROOT" 2>/dev/null | awk '{print $1}')
  [ -n "$bytes" ] && printf '%s\t%s\n' "$bytes" "$domain"
done | sort -n > "$TMP"

count=$(wc -l < "$TMP" | tr -d ' ')
[ "$count" -gt 0 ] || { echo 'Khong tim thay site'; exit 1; }
median_line=$(( (count + 1) / 2 ))
median=$(sed -n "${median_line}p" "$TMP" | cut -f1)
threshold=$((median * 3))
absolute=$((10 * 1024 * 1024 * 1024))

printf '%-38s %12s %s\n' 'DOMAIN' 'DOCROOT' 'DANH GIA'
printf '%-38s %12s %s\n' '------' '-------' '--------'
while IFS=$'\t' read -r bytes domain; do
  if [ "$bytes" -gt "$absolute" ] || [ "$bytes" -gt "$threshold" ]; then
    verdict='BAT THUONG - CAN REVIEW'
  else
    verdict='binh thuong'
  fi
  size=$(numfmt --to=iec-i --suffix=B "$bytes" 2>/dev/null || printf '%sB' "$bytes")
  printf '%-38s %12s %s\n' "$domain" "$size" "$verdict"
done < "$TMP"

echo
echo "Tong site: $count"
echo "Median docroot: $(numfmt --to=iec-i --suffix=B "$median" 2>/dev/null || printf '%sB' "$median")"
echo "Nguong review: >10GiB HOAC >3x median ($(numfmt --to=iec-i --suffix=B "$threshold" 2>/dev/null || printf '%sB' "$threshold"))"
echo
echo 'Top 10 site lon nhat:'
sort -nr "$TMP" | head -10 | while IFS=$'\t' read -r bytes domain; do
  size=$(numfmt --to=iec-i --suffix=B "$bytes" 2>/dev/null || printf '%sB' "$bytes")
  printf '  %-38s %s\n' "$domain" "$size"
done
