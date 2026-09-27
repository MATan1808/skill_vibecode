#!/usr/bin/env bash
# Read-only fleet audit for GreenMamba/Wpanel 2026-07 IOC.
# Run ON cloudpanel as root.
set -u
OUT=${1:-/audit-work/ioc-fleet-audit-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$OUT"
REPORT="$OUT/report.tsv"
printf 'domain\tuser\troot\tadmin_ioc\tfile_ioc\tpayload_ioc\tavada_ioc\twco\twp_fix\tphploader_hash\thttp\thtaccess_ioc\timage_folder_ioc\tlogs_htaccess_ioc\n' > "$REPORT"

bad_admin_sql="user_login REGEXP '^(w2s_|wp2_|wp2s_|Nx_|JLG_|Bunk_|bunk_|bl_|admin_[0-9a-fA-F]|wordpress_[0-9a-fA-F]|wp_admin_|svc_|cron_service$|wphiddenbot$|seomanager2026$|wpchecking$|adminbockup$|upgrades$)' OR user_email REGEXP '(wp2shell|shellcode\\.lol|nx\\.invalid|bunk\\.invalid|bl\\.bl|local\\.invalid|mailtest\\.invalid|local\\.host|wordpress\\.org)'
"

while IFS= read -r cfg; do
  root=${cfg%/wp-config.php}
  user=$(printf '%s' "$root" | cut -d/ -f3)
  domain=$(basename "$root")
  prefix=$(sudo -u "$user" wp --path="$root" --skip-plugins --skip-themes config get table_prefix 2>/dev/null | tail -1 || true)
  admin_ioc=0
  if [ -n "$prefix" ]; then
    admin_ioc=$(sudo -u "$user" wp --path="$root" --skip-plugins --skip-themes db query "SELECT COUNT(*) FROM ${prefix}users WHERE ${bad_admin_sql};" --skip-column-names 2>/dev/null | tail -1 || echo 0)
  fi

  file_ioc=$(find "$root/wp-content" -type f \( \
    -iname 'wp-fixplugin.php' -o -iname 'wp2shell-single-point-mitigation.php' -o -iname 'wp-rewrite-rules.php' -o \
    -iname 'site-compat-layer.php' -o -iname 'wp-compat-layer.php' -o -iname 'sso-loader.php' -o \
    -iname 'class-wp-locale-data.php' -o -iname 'plugins.php' \
  \) 2>/dev/null | grep -E 'wp-fixplugin|wp2shell|wp-rewrite-rules|site-compat-layer|wp-compat-layer|sso-loader|class-wp-locale-data|languages/themes/the/plugins.php' | wc -l | tr -d ' ')
  wco=$(test -d "$root/wp-content/plugins/wordpress-cache-optimizer" && echo 1 || echo 0)
  wp_fix=$(find "$root/wp-content" -type f -name 'wp-fixplugin.php' 2>/dev/null | wc -l | tr -d ' ')
  phploader_hash=$(find "$root/wp-content" -type f -name 'PHPLoader.php' -print0 2>/dev/null | xargs -0 -r sha256sum 2>/dev/null | grep -c '^49e6516d20bff05169e6c97f1f3e6862991bfd548ccbe9204fd7baceea9fdad3' || true)
  payload_ioc=$(grep -RIlE --include='*.php' 'wphiddenbot|mamglaqwek\.com|rod476/files|wp_fixplugin|shellcode\.lol|GhostManSec|WPANEL:BEGIN|_wp_load_compat_layer' "$root/wp-content" 2>/dev/null | grep -vE '/cache/|/uploads/cache/' | wc -l | tr -d ' ')
  avada_ioc=$(grep -RIlE --include='*.php' 'WPANEL:BEGIN|_wp_load_compat_layer|class-wp-locale-data|wp-rewrite-rules|rod476/files|shellcode\.lol|GhostManSec' "$root/wp-content/themes/Avada" 2>/dev/null | wc -l | tr -d ' ')
  http=$(curl -ksS -o /dev/null -w '%{http_code}' -L --max-time 15 "https://$domain/" 2>/dev/null || echo 000)

  # Logic mới: Đếm số lượng file .htaccess chứa whitelist Allow from all độc hại
  htaccess_ioc=0
  while read -r htfile; do
    if grep -qi "Allow from all" "$htfile" && ! grep -qi "Order Deny,Allow" "$htfile"; then
      htaccess_ioc=$((htaccess_ioc + 1))
    fi
  done < <(find "$root" -name ".htaccess" -type f 2>/dev/null)

  # Logic mới: Đếm sự tồn tại của thư mục image bất thường tại root
  image_folder_ioc=0
  if [ -d "$root/image" ]; then
    image_folder_ioc=1
  fi

  # Logic mới: Đếm số lượng file .htaccess độc hại trong thư mục logs của user
  logs_htaccess_ioc=0
  USER_LOGS="/home/$user/logs"
  if [ -d "$USER_LOGS" ]; then
    logs_htaccess_ioc=$(find "$USER_LOGS" -maxdepth 2 -name ".htaccess" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$domain" "$user" "$root" "$admin_ioc" "$file_ioc" "$payload_ioc" "$avada_ioc" "$wco" "$wp_fix" "$phploader_hash" "$http" "$htaccess_ioc" "$image_folder_ioc" "$logs_htaccess_ioc" >> "$REPORT"
done < <(find /home/*/htdocs -mindepth 2 -maxdepth 3 -type f -name wp-config.php -print 2>/dev/null | sort)

printf 'OUT=%s\n' "$OUT"
printf '\nFLAGGED:\n'
awk -F'\t' 'NR==1 || ($4+$5+$6+$7+$8+$9+$10+$12+$13+$14)>0 || $11 !~ /^2|3/ {print}' "$REPORT"
