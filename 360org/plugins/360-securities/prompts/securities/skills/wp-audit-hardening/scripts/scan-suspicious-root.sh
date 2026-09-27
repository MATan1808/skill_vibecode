#!/bin/bash
# Full fleet scan for suspicious files/dirs in WP root (outside wp-admin, wp-includes, wp-content)
set -uo pipefail

LEGIT_ROOT_FILES="index.php|xmlrpc.php|wp-activate.php|wp-blog-header.php|wp-comments-post.php|wp-config.php|wp-config-sample.php|wp-cron.php|wp-links-opml.php|wp-load.php|wp-login.php|wp-mail.php|wp-settings.php|wp-signup.php|wp-trackback.php|license.txt|readme.html|wp-config.php.bak-*|wp-config.php.*.bak|.htaccess"
LEGIT_ROOT_DIRS="wp-admin|wp-includes|wp-content"

echo "===== SUSPICIOUS ROOT FILES/DIRS SCAN ====="
date

for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue
  USER=$(echo "$DOCROOT" | cut -d/ -f3)
  DOMAIN=$(basename "$DOCROOT")

  # Suspicious dirs
  find "$DOCROOT" -maxdepth 1 -mindepth 1 -type d \
    ! -name "wp-admin" ! -name "wp-includes" ! -name "wp-content" \
    ! -name ".well-known" -printf "DIR\t$DOMAIN\t%s\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

  # Suspicious files (not in legit list)
  find "$DOCROOT" -maxdepth 1 -mindepth 1 -type f \
    ! -regextype posix-extended -iregex ".*/($LEGIT_ROOT_FILES)$" \
    ! -name ".htaccess" -printf "FILE\t$DOMAIN\t%s\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

  # Check wp-content for unexpected dirs
  find "$DOCROOT/wp-content" -maxdepth 1 -mindepth 1 -type d \
    ! -name "plugins" ! -name "themes" ! -name "uploads" ! -name "mu-plugins" \
    ! -name "languages" ! -name "upgrade" ! -name "upgrade-temp-backup" \
    ! -name "aiowps_backups" ! -name "cache" ! -name "maintenance" \
    -printf "WPCONTENT_DIR\t$DOMAIN\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

  # PHP files in uploads (excluding known guards)
  find "$DOCROOT/wp-content/uploads" -type f \( -iname "*.php" -o -iname "*.phtml" -o -iname "*.phar" \) \
    ! -path "*/aios/firewall-rules/*" ! -path "*/cache/wpml/twig/*" \
    -printf "UPLOAD_PHP\t$DOMAIN\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

done | sort

echo
echo "===== SPECIFIC MALWARE PATTERNS ====="
for DOCROOT in /home/*/htdocs/*/; do
  [ -d "$DOCROOT" ] || continue
  DOMAIN=$(basename "$DOCROOT")

  # hrntgm, __MACOSX, random dirs
  find "$DOCROOT" -maxdepth 2 -type d \( -name "hrntgm" -o -name "__MACOSX" -o -name ".[a-z0-9]*" \) -printf "MALWARE_DIR\t$DOMAIN\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

  # SEO doorway patterns
  find "$DOCROOT" -type f -name "*.html" -mtime -30 -print0 2>/dev/null | xargs -0r grep -lE "MAXWIN|PANEN|MAHJONG|galery88\.art|agent2-pemenang" 2>/dev/null | sed "s/^/DOORWAY\t$DOMAIN\t/"

  # shell.php, db.php, wp-fixplugin, etc
  find "$DOCROOT" -type f \( -name "shell.php" -o -name "db.php" -o -name "wp-fixplugin.php" -o -name "*wp2shell*" -o -name "aios-firewall-loader.php" -o -name "PHPLoader.php" \) -printf "IOC_FILE\t$DOMAIN\t%TY-%Tm-%Td %TH:%TM:%TS\t%p\n" 2>/dev/null

  # wp-content/db.php content check
  if [ -f "$DOCROOT/wp-content/db.php" ]; then
    grep -lE "eval\(|base64_decode|shell_exec|wp_insert_user|wp2shell|mamglaqwek|shellcode|lol|_wp_load_compat_layer|class-wp-locale-data" "$DOCROOT/wp-content/db.php" 2>/dev/null && printf "BACKDOOR_DB\t$DOMAIN\t$(date +%Y-%m-%d_%H:%M:%S)\t$DOCROOT/wp-content/db.php\n"
  fi
done