#!/bin/bash
# WP Security + Health Audit for CloudPanel fleet. READ-ONLY (changes nothing).
# Usage: bash audit.sh <domain>
# Run ON the cloudpanel server (as root).
DOMAIN="${1:?Usage: audit.sh <domain>}"
DOCROOT=$(ls -d /home/*/htdocs/"$DOMAIN" 2>/dev/null | head -1)
[ -z "$DOCROOT" ] && { echo "FATAL: docroot for $DOMAIN not found under /home/*/htdocs/"; exit 1; }
SUSER=$(echo "$DOCROOT" | cut -d/ -f3)
LOGN="/home/$SUSER/logs/nginx"; LOGP="/home/$SUSER/logs/php"
VHOST="/etc/nginx/sites-enabled/$DOMAIN.conf"
WP(){ sudo -u "$SUSER" wp --path="$DOCROOT" "$@" 2>&1 | grep -v 'ssl-verify'; }
DBQ(){ sudo -u "$SUSER" wp --path="$DOCROOT" db query "$1" --skip-column-names 2>&1 | grep -v 'ssl-verify'; }
PREFIX=$(sudo -u "$SUSER" wp --path="$DOCROOT" config get table_prefix 2>/dev/null)
P="$PREFIX"
H(){ echo; echo "===== $1 ====="; }

echo "######## WP AUDIT: $DOMAIN ########  user=$SUSER  prefix=$P"
echo "docroot=$DOCROOT"

H "0. HTTP status (public)"
curl -sS -o /dev/null -w "  homepage: HTTP %{http_code} %{time_total}s -> %{redirect_url}\n" -L --max-time 25 "https://$DOMAIN/" 2>&1

echo "  --- checking typical image availability ---"
# Lấy ra 2 file ảnh trong uploads để test HTTP status
IMG_FILES=$(find "$DOCROOT/wp-content/uploads" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) 2>/dev/null | grep -vE "/fusion-|/aios-|/rank-math" | head -n 2)
if [ -n "$IMG_FILES" ]; then
  while read -r img_file; do
    rel_path=${img_file#$DOCROOT/}
    curl -sS -o /dev/null -w "  /$rel_path: HTTP %{http_code} (size: $(stat -c %s "$img_file" 2>/dev/null || stat -f %z "$img_file" 2>/dev/null) bytes)\n" -L --max-time 10 "https://$DOMAIN/$rel_path"
  done <<< "$IMG_FILES"
else
  echo "  [WARNING] No media images found in uploads directory to test!"
fi

H "1. STORAGE: website disk usage (read-only)"
if command -v du >/dev/null 2>&1; then
  du -sxh "$DOCROOT" 2>/dev/null | awk '{print "  docroot: " $1}'
  du -sxh "$DOCROOT/wp-content" 2>/dev/null | awk '{print "  wp-content: " $1}'
  du -sxh "$DOCROOT/wp-content/uploads" 2>/dev/null | awk '{print "  uploads: " $1}' || true
  echo "  file count: $(find "$DOCROOT" -xdev -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "  top 5 files:"
  find "$DOCROOT" -xdev -type f -printf '%s %p\n' 2>/dev/null | sort -nr | head -5 | numfmt --field=1 --to=iec-i --suffix=B 2>/dev/null | sed 's/^/    /'
fi

echo "  fleet outlier rule: review if docroot > 10 GiB or > 3x fleet median (see audit-storage.sh)"

H "2. ENV: effective memory_limit (from nginx vhost, NOT php.ini)"
grep -nE "memory_limit|max_execution" "$VHOST" 2>/dev/null || echo "  (no PHP_VALUE override in vhost -> uses php.ini)"
echo "  php.ini global:"; grep -h "^memory_limit" /etc/php/*/fpm/php.ini 2>/dev/null | sort -u
WP core version | sed 's/^/  WP /'

H "2. ERROR LOG: OOM + fatals (today + per-day history)"
TODAY=$(date "+%d-%b-%Y")
echo "  Fatal OOM today: $(grep -c 'Allowed memory size' $LOGP/error.log 2>/dev/null)"
echo "  Total fatals today: $(grep -c "$TODAY" $LOGP/error.log 2>/dev/null)"
echo "  --- OOM per day (regression onset?) ---"
for f in $LOGP/error.log-* $LOGP/error.log; do [ -f "$f" ] && echo "   $(basename $f): $(grep -c 'Allowed memory size' $f 2>/dev/null) OOM"; done | tail -10
echo "  --- top files throwing fatals today ---"
grep "$TODAY" $LOGP/error.log 2>/dev/null | grep -oE 'in /home[^ ]+' | sort | uniq -c | sort -rn | head -6
echo "  --- last 3 fatals ---"
grep -E "Fatal error" $LOGP/error.log 2>/dev/null | tail -3 | sed 's/^/   /'
echo "  --- checking logs/php/error.log* for exploit/malware signatures ---"
zgrep -iE "fatal error|uncaught error|require_once|include_once|eval|T04s1|wp2shell|class-wp-locale-data|wp-fixplugin|wordpress-cache-optimizer|db.php|cobainsini.shop|hubnode.gamerspe.top" $LOGP/error.log* 2>/dev/null | tail -n 20 | sed 's/^/    /'

H "3. CORE INTEGRITY (official checksums)"
WP core verify-checksums 2>&1 | tail -15

H "4. PLUGIN INTEGRITY (.org checksums) + list"
ACTIVE=$(WP plugin list --status=active --field=name 2>/dev/null | tr '\n' ' ')
echo "  active: $ACTIVE"
WP plugin verify-checksums $ACTIVE 2>&1 | grep -viE "Warning: Could not retrieve|premium|not in the WordPress.org" | tail -20
echo "  --- versions / updates ---"
WP plugin list --fields=name,status,version,update --format=csv 2>&1 | grep -v "available" >/dev/null; WP plugin list --fields=name,version,update 2>&1 | grep -iE "available" && echo "  ^ UPDATES AVAILABLE" || echo "  all up to date"

H "5. RED FLAG: PHP files inside uploads/ (should be ZERO real code)"
find "$DOCROOT/wp-content/uploads" -type f \( -name '*.php' -o -name '*.phtml' -o -name '*.php?' -o -name '*.pHp*' \) 2>/dev/null | head -40
echo "  (only mailpoet/aios index.php guards are OK; anything else = backdoor)"

H "6. RECENT-MODIFIED .php (last 30 days, outside core/known vendors)"
# Extended from 14 → 30 days: Wpanel can lay dormant before reactivating
find "$DOCROOT" -name '*.php' -mtime -30 2>/dev/null \
 | grep -vE "/wp-admin/|/wp-includes/|/woocommerce/|/Avada/|/fusion-|/seo-by-rank-math|/all-in-one-wp-security|/mailpoet/|/jetpack/|/cache/|/wp-content/upgrade" \
 | grep -vE "/languages/" | head -60
echo "  (core/plugin files here are fine if checksums passed; loose files in odd places = suspect; languages/ excluded because Wpanel plants files there)"

H "7. MALWARE SIGNATURES in .php only (high-signal, non-vendor)"
grep -rIlE --include='*.php' "eval[[:space:]]*\(|base64_decode[[:space:]]*\(|gzinflate[[:space:]]*\(|str_rot13[[:space:]]*\(|gzuncompress[[:space:]]*\(|assert[[:space:]]*\(|shell_exec|passthru[[:space:]]*\(|\bsystem[[:space:]]*\(|FilesMan|\bWSO\b|\\\$_(POST|GET|REQUEST|COOKIE)[[:space:]]*\[[^]]*\][[:space:]]*\(|move_uploaded_file|preg_replace[[:space:]]*\([^,]*/e" \
  "$DOCROOT/wp-content/" 2>/dev/null \
 | grep -vE "/woocommerce/|/Avada/|/seo-by-rank-math/|/fusion-|/all-in-one-wp-security/|/mailpoet/|/jetpack/|/action-scheduler/" | head -40
echo "  NOTE: Do NOT exclude /languages/ this time — Wpanel injects PHPLoader.php there."
echo "  (empty = clean. Listed .php files = read each before judging.)"

H "7b. HTACCESS INTEGRITY & ROGUE FOLDERS (/image/)"
echo "  --- checking all .htaccess files for malware whitelist rules ---"
find "$DOCROOT" -name ".htaccess" -type f 2>/dev/null | while read -r htfile; do
  # Dò tìm "Allow from all" được malware dùng để whitelist cho webshell
  if grep -qi "Allow from all" "$htfile" && ! grep -qi "Order Deny,Allow" "$htfile"; then
    echo "  [SUSPECT] Whitelist pattern in .htaccess: $htfile"
    grep -n -E "Allow from all|wp-logln\.php|wp-admnn\.php|wp-conffq\.php|wp-lock\.php|wp-temp\.php|wp-headre\.php|reviall\.php" "$htfile" | sed 's/^/    /'
  fi
done
echo "  --- checking for rogue .htaccess in user logs directory ---"
# Phát hiện .htaccess chèn vào thư mục logs của user
USER_LOGS_DIR=$(dirname "$LOGN")
if [ -d "$USER_LOGS_DIR" ]; then
  find "$USER_LOGS_DIR" -maxdepth 2 -name ".htaccess" -type f 2>/dev/null | while read -r htfile; do
    echo "  [SUSPECT] Rogue .htaccess found in user logs folder: $htfile"
    cat "$htfile" | sed 's/^/    /'
  done
fi
echo "  --- checking for unauthorized folder names (/image/) at root ---"
# Thư mục /image/ nằm ngay tại root của WordPress là bất thường (không được tạo thư mục name "image" ở root)
if [ -d "$DOCROOT/image" ]; then
  echo "  [SUSPECT] Unauthorized folder 'image' exists at root: $DOCROOT/image"
  ls -la "$DOCROOT/image" | sed 's/^/    /'
fi

H "8. wp-config.php — injected code?"
grep -nE "eval|base64|gzinflate|create_function|wp_remote|file_get_contents\(|\\\$_(GET|POST|REQUEST|COOKIE)" "$DOCROOT/wp-config.php" || echo "  (clean)"
echo "  dropins:"; ls -la "$DOCROOT"/wp-content/{object-cache,advanced-cache,db}.php 2>/dev/null || echo "   none"
echo "  mu-plugins:"; ls -A "$DOCROOT/wp-content/mu-plugins" 2>/dev/null || echo "   none"

H "8b. WPANEL/GREENMARCA IOC — backdoor files"
# Backdoor loader that reappears after cleanup
find "$DOCROOT/wp-content" -maxdepth 1 -name 'db.php' -printf '%m %u:%g %s %p\n' 2>/dev/null
# wp2shell webshell mu-plugin (same campaign across fleet)
find "$DOCROOT/wp-content/mu-plugins" -maxdepth 1 -name '*wp2shell*' -o -name '*aios-firewall-loader*' 2>/dev/null -printf '%m %u:%g %s %p\n'
# Backdoor hidden in wp-admin/images/T04s1/ (Wpanel pattern)
find "$DOCROOT/wp-admin/images" -path '*/T04s1/*' -type f -printf '%m %u:%g %s %p\n' 2>/dev/null
# File planted inside wp-content/languages/themes/ (unusual path)
find "$DOCROOT/wp-content/languages" -path '*themes/the/plugins*' -type f -printf '%m %u:%g %s %p\n' 2>/dev/null
# AIOWPS language file inject (PHPLoader.php + .htaccess in plugin languages/)
find "$DOCROOT/wp-content/plugins/all-in-one-wp-security-and-firewall/languages" -name 'PHPLoader.php' -o -name '.htaccess' 2>/dev/null -printf '%m %u:%g %s %p\n'
# Mu-plugins with eval() — any mu-plugin calling eval is suspicious
for f in "$DOCROOT"/wp-content/mu-plugins/*.php; do [ -f "$f" ] || continue; grep -lE 'eval[[:space:]]*\(' "$f" 2>/dev/null && printf '  ^^^ EVAL in mu-plugin: %s\n' "$f"; done
# Fake plugin check: wp-compat/wp-fix variants that do not exist in .org registry
find "$DOCROOT/wp-content/plugins" "$DOCROOT/wp-content/mu-plugins" -type f \( -path '*/wp-compat/*.php' -o -path '*/wp-fix*/*.php' -o -name 'wp-fix*.php' \) -printf '%p\n' 2>/dev/null

H "8c. MU-PLUGIN deep scan — every file name, size, mtime"
find "$DOCROOT/wp-content/mu-plugins" -maxdepth 1 -type f -printf '%TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null | sort

H "8d. ROOT-CAUSE IOC — GreenMamba/Wpanel 2026-07-31"
echo "  --- wordpress-cache-optimizer (creates hidden admin wphiddenbot) ---"
find "$DOCROOT/wp-content/plugins/wordpress-cache-optimizer" -type f -printf '%TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null | sort
if [ -f "$DOCROOT/wp-content/plugins/wordpress-cache-optimizer/wordpress-cache-optimizer.php" ]; then
  grep -nE 'wphiddenbot|wp_insert_user|pre_user_query|delete_user|administrator|hide_user|block_profile|prevent_deletion' "$DOCROOT/wp-content/plugins/wordpress-cache-optimizer/wordpress-cache-optimizer.php" 2>/dev/null | head -40
fi
echo "  --- disguised mu-plugins directories in unauthorized locations ---"
find "$DOCROOT" -type d -name "mu-plugins" | grep -v "wp-content/mu-plugins$" | while read -r d; do
  echo "  [FLAGGED] Unauthorized mu-plugins folder: $d"
  find "$d" -maxdepth 2 -type f -printf '    %TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null
done
echo "  --- upgrade-temp-backup directory check ---"
if [ -d "$DOCROOT/wp-content/upgrade-temp-backup" ]; then
  find "$DOCROOT/wp-content/upgrade-temp-backup" -maxdepth 3 -type f -printf '    %TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null
fi
echo "  --- wp-fixplugin / remote JS payload ---"
find "$DOCROOT/wp-content/mu-plugins" "$DOCROOT/wp-content/plugins" -type f \( -name 'wp-fixplugin.php' -o -path '*/wp-fix*/**/*.php' \) -printf '%TY-%Tm-%Td %TH:%TM:%TS %m %u:%g %s %p\n' 2>/dev/null | sort
if grep -RIlE --include='*.php' 'mamglaqwek\.com|wp_fixplugin|register_rest_route.*wp-fixplugin' "$DOCROOT/wp-content" 2>/dev/null | head -20; then :; fi
echo "  --- Avada/theme persistence strings ---"
grep -RIlE --include='*.php' 'WPANEL:BEGIN|_wp_load_compat_layer|class-wp-locale-data|wp-rewrite-rules|rod476/files|shellcode\.lol|GhostManSec' "$DOCROOT/wp-content/themes" 2>/dev/null | head -40
echo "  --- PHPLoader exact hash backdoor ---"
find "$DOCROOT/wp-content" -type f -name 'PHPLoader.php' -print0 2>/dev/null | xargs -0 -r sha256sum 2>/dev/null | grep -E '49e6516d20bff05169e6c97f1f3e6862991bfd548ccbe9204fd7baceea9fdad3|.' | head -40
echo "  --- payload/admin strings anywhere in wp-content (high signal) ---"
grep -RIlE --include='*.php' 'wphiddenbot|mamglaqwek\.com|rod476/files|wp_fixplugin|shellcode\.lol|GhostManSec|WPANEL:BEGIN|_wp_load_compat_layer' "$DOCROOT/wp-content" 2>/dev/null | grep -vE '/cache/|/uploads/cache/' | head -80

H "9. ADMIN USERS (hidden/rogue admin?)"
WP user list --role=administrator --fields=ID,user_login,user_email,user_registered 2>&1
echo "  --- suspected backdoor admins (2026-07 campaign patterns) ---"
DBQ "SELECT ID,user_login,user_email,user_registered FROM ${P}users WHERE user_login REGEXP '^(w2s_|wp2_|wp2s_|Nx_|JLG_|Bunk_|bunk_|bl_|admin_[0-9a-fA-F]|wordpress_[0-9a-fA-F]|wp_admin_|svc_|cron_service$|wphiddenbot$|seomanager2026$|wpchecking$|adminbockup$|upgrades$)' OR user_email REGEXP '(wp2shell|shellcode\\.lol|nx\\.invalid|bunk\\.invalid|bl\\.bl|local\\.invalid|mailtest\\.invalid|local\\.host|wordpress\\.org)';"
echo "  --- all user IDs (DB cross-check) ---"
DBQ "SELECT ID,user_login,user_registered FROM ${P}users ORDER BY ID;"

H "10. DB INJECTION (options/posts)"
echo "  bad options:"; DBQ "SELECT option_name FROM ${P}options WHERE option_value LIKE '%<script%' OR option_value LIKE '%base64_decode%' OR option_value LIKE '%eval(%' LIMIT 10;"
echo "  infected posts:"; DBQ "SELECT ID FROM ${P}posts WHERE post_content LIKE '%base64_decode%' OR post_content LIKE '%<script%document.write%' LIMIT 10;"
echo "  autoload size (bloat => perf): $(DBQ "SELECT ROUND(SUM(LENGTH(option_value))/1048576,2) FROM ${P}options WHERE autoload IN ('yes','on','auto','auto-on');") MB"

H "11. ROGUE CRON hooks"
WP cron event list --fields=hook --format=csv 2>&1 | grep -ivE '^hook$|wp_|action_scheduler|rank_math|aiowp|aios|woocommerce|wc_|jetpack|recovery_mode|delete_expired|fusion|mailpoet' || echo "  (none)"

H "12. ENUMERATION EXPOSURE (should be 403/blocked)"
for u in "wp-json/wp/v2/users" "?author=1" "xmlrpc.php"; do
  curl -sS -o /dev/null -w "  /$u => %{http_code}\n" --max-time 15 "https://$DOMAIN/$u"; done

H "13. LOGIN FORENSICS (did any brute-force SUCCEED?)"
echo "  --- successful login redirects (POST wp-login => 302) by IP ---"
for f in $LOGN/access.log $LOGN/access.log-*; do zcat -f "$f" 2>/dev/null; done \
 | awk '/POST .*wp-login\.php/ && $9==302 {print $1}' | sort | uniq -c | sort -rn | head -8
echo "  (302 may just be AIOWPS blocking failed logins — confirm against AIOWPS audit below)"
echo "  --- IPs that reached wp-admin with 200 ---"
for f in $LOGN/access.log $LOGN/access.log-*; do zcat -f "$f" 2>/dev/null; done \
 | awk '$7 ~ /wp-admin/ && $9==200 {print $1}' | sort | uniq -c | sort -rn | head -8
echo "  --- backdoor probes (should all be 404) ---"
for f in $LOGN/access.log $LOGN/access.log-*; do zcat -f "$f" 2>/dev/null; done \
 | awk '$9==404 {print $7}' | grep -iE '\.php|shell|cmd|alfa|wso|filemanager|\.env|wp-config|\.sql' | sort | uniq -c | sort -rn | head -12
echo "  --- top request IPs (attackers/bots) ---"
for f in $LOGN/access.log $LOGN/access.log-*; do zcat -f "$f" 2>/dev/null; done | awk '{print $1}' | sort | uniq -c | sort -rn | head -6

H "14. AIOWPS audit (login outcomes — failed vs success)"
DBQ "SELECT event_type, COUNT(*) FROM ${P}aiowps_audit_log GROUP BY event_type ORDER BY 2 DESC LIMIT 10;" 2>/dev/null || echo "  (AIOWPS audit table absent)"
echo "  currently logged-in (AIOWPS):"; DBQ "SELECT user_id, ip_address, FROM_UNIXTIME(created) FROM ${P}aiowps_logged_in_users;" 2>/dev/null
echo "  login-lockdown config:"
sudo -u "$SUSER" wp --path="$DOCROOT" option get aio_wp_security_configs --format=json 2>/dev/null \
 | tr ',' '\n' | grep -iE "login_lockdown|invalid_username|max_login_attempts|lockout_time|retry_time" | sed 's/^/    /'

H "15. fail2ban (server-level brute-force defense)"
for j in wp-login wp-scan sshd; do
  echo "  [$j] $(fail2ban-client status $j 2>/dev/null | grep -iE 'Currently banned' | tr -s ' ')"
done
grep -hE 'maxretry|findtime|bantime' /etc/fail2ban/jail.d/wordpress.local 2>/dev/null | sed 's/^/    /'

echo; echo "######## END AUDIT $DOMAIN ########"
