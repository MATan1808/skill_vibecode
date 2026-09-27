#!/bin/bash
# WP hardening — tighten AIOWPS login lockdown. Reversible (backs up config first).
# Usage: bash harden.sh <domain>
# Run ON cloudpanel server. Only run AFTER reporting findings + user approval.
DOMAIN="${1:?Usage: harden.sh <domain>}"
DOCROOT=$(ls -d /home/*/htdocs/"$DOMAIN" 2>/dev/null | head -1)
[ -z "$DOCROOT" ] && { echo "FATAL: docroot not found"; exit 1; }
SUSER=$(echo "$DOCROOT" | cut -d/ -f3)
WP(){ sudo -u "$SUSER" wp --path="$DOCROOT" "$@" 2>&1 | grep -v 'ssl-verify'; }

echo "===== BACKUP current AIOWPS config ====="
BK="/home/$SUSER/aiowps_config_backup_$(date +%Y%m%d_%H%M).json"
sudo -u "$SUSER" wp --path="$DOCROOT" option get aio_wp_security_configs --format=json 2>/dev/null | sudo -u "$SUSER" tee "$BK" >/dev/null
echo "  saved: $BK ($(wc -c <"$BK") bytes)"

echo "===== APPLY tighter login lockdown ====="
# invalid-username lockout is the big win: attackers use fake usernames -> ban on 1st try.
WP option patch update aio_wp_security_configs aiowps_enable_login_lockdown 1            && echo "  + login lockdown ON"
WP option patch update aio_wp_security_configs aiowps_enable_invalid_username_lockdown 1 && echo "  + invalid-username lockout ON"
WP option patch update aio_wp_security_configs aiowps_max_login_attempts 3               && echo "  + max attempts = 3"
WP option patch update aio_wp_security_configs aiowps_retry_time_period 5                && echo "  + retry window = 5 min"
WP option patch update aio_wp_security_configs aiowps_lockout_time_length 60             && echo "  + lockout = 60 min"

echo "===== CLEANUP readme.html AND license.txt ====="
find "$DOCROOT" -maxdepth 2 -type f \( -name "readme.html" -o -name "license.txt" -o -name "licencia.txt" \) -exec rm -f {} \; -print
echo "  readme.html & license.txt removed if existed."

echo "===== VERIFY ====="
sudo -u "$SUSER" wp --path="$DOCROOT" option get aio_wp_security_configs --format=json 2>/dev/null \
 | tr ',' '\n' | grep -iE "login_lockdown|invalid_username|max_login_attempts|lockout_time|retry_time" | sed 's/^/  /'

echo "===== HEALTH CHECK after change ====="
curl -sS -o /dev/null -w "  homepage: %{http_code} | wp-login: " --max-time 25 "https://$DOMAIN/"
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 25 "https://$DOMAIN/wp-login.php"
echo "  To revert: wp option update aio_wp_security_configs \"\$(cat $BK)\" --format=json"
