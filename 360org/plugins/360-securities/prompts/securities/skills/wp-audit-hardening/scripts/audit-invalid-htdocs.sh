#!/bin/bash
# Read-only fleet audit for invalid CloudPanel htdocs trees and SEO doorway files.
# CloudPanel standard: /home/<user>/htdocs/<client-domain.com>
set -uo pipefail

printf '===== INVALID HTDOCS / SEO DOORWAY AUDIT =====\n'
for USERDIR in /home/*; do
  [ -d "$USERDIR/htdocs" ] || continue
  USER=$(basename "$USERDIR")
  for P in "$USERDIR/htdocs/public_html" "$USERDIR/htdocs/public_html/public_html" \
           "$USERDIR/htdocs/wp-content" "$USERDIR/htdocs/wp-contents"; do
    [ -e "$P" ] || continue
    printf '\nPATH=%s\n' "$P"
    du -sh "$P" 2>/dev/null || true
    stat -c 'TYPE=%F OWNER=%U:%G MODE=%A SIZE=%s MTIME=%y CTIME=%z' "$P" 2>/dev/null || true
    find "$P" -xdev -maxdepth 2 -type f -printf '%M %u:%g %s %TY-%Tm-%Td %TH:%TM:%TS %p\n' 2>/dev/null | sort | head -100
    grep -RIl --include='*.php' --include='*.html' -E \
      'MAXWIN|PANEN|MAHJONG|galery88\.art|agent2-pemenang|base64_decode|shell_exec|eval[[:space:]]*\(' \
      "$P" 2>/dev/null | head -30 | sed 's/^/IOC: /'
  done
done

printf '\n===== VHOST ROOTS POINTING TO INVALID TREES =====\n'
grep -RInE 'root[[:space:]]+/home/[^;]*/htdocs/(public_html|wp-content|wp-contents)' \
  /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null || true

printf '\n===== SHELL WEB REQUEST IOC BY SITE =====\n'
for LOG in /home/*/logs/nginx/access.log /home/*/logs/nginx/access.log-*; do
  [ -f "$LOG" ] || continue
  zcat -f "$LOG" 2>/dev/null | grep -E 'POST /shell\.php|_r=%2Fhome%2F|e=%2Fhome%2F' | tail -20
 done

printf '\n===== SEO DOORWAY IOC IN ACTIVE DOCROOTS =====\n'
for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue
  find "$DOCROOT" -xdev -type f -name '*.html' -mtime -30 -print0 2>/dev/null | while IFS= read -r -d '' FILE; do
    grep -qE 'MAXWIN|PANEN|MAHJONG|galery88\.art|agent2-pemenang' "$FILE" 2>/dev/null && printf '%s\n' "$FILE"
  done
 done
