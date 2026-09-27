#!/bin/bash
# ==============================================================================
# WP Security Watcher - Active Defense & Dual-Mode Notification System
# Mode 1: Active Defense & Real-time Emergency Alert (Chạy mỗi 15 phút)
# Mode 2: Daily Report (Chạy định kỳ 08:00 sáng hàng ngày)
# ==============================================================================
set -uo pipefail

STATE_DIR="/var/run/wp-security-watcher"
QUARANTINE_DIR="/home/cloudpanel/backups/incident/quarantine"
mkdir -p "$STATE_DIR" "$QUARANTINE_DIR" "/var/lib/wp-security-watcher"

LOG_FILE="/var/log/wp-security-watcher.log"
NOTIFY_CONF="/home/cloudpanel/backup_system/notify.conf"

[ -f "$NOTIFY_CONF" ] && source "$NOTIFY_CONF"

MALWARE_SIG='_wp_cuh_restore|show_advanced_plugins|_site_transient_health_|_nx_p|\[BLOCKED\]disable_functions|<<S>>|Author: WordPress\.org Community|eval\(base64_decode|\$_COOKIE\[.{3,12}\]\s*\(|\$_(GET|POST|REQUEST)\[.{1,12}\]\s*\(\$_|preg_replace_callback\(.*eval|goto\s+[a-zA-Z0-9_]+;'

send_telegram_msg() {
  local title="$1"
  local content="$2"

  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    echo "[$(date '+%F %T')] [TELEGRAM_LOG] $title: $content" >> "$LOG_FILE"
    return 0
  fi

  local msg="${title}
🖥 <code>$(hostname)</code>   🕒 $(date '+%d/%m/%Y · %H:%M')
━━━━━━━━━━━━━━━━━━
${content}
━━━━━━━━━━━━━━━━━━
<i>WP Security Watcher Active Defense System</i>"

  curl -s --max-time 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "disable_web_page_preview=true" \
    --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# HOẠT ĐỘNG CHÍNH: XỬ LÝ SỰ CỐ AN NINH & BÁO ĐỘNG REAL-TIME
# ------------------------------------------------------------------------------
run_active_defense() {
  local urgent_alerts=""
  local NOW_HUMAN="$(date '+%H:%M')"

  # 1. PHÁT HIỆN & CÁCH LY FILE PHP TRONG UPLOADS / LANGUAGES
  new_php_files=$(find /home/*/htdocs/*/wp-content/uploads \
    /home/*/htdocs/*/wp-content/languages \
    -type f -name "*.php" -mmin -20 \
    ! -name "*.l10n.php" ! -name "index.php" \
    ! -path "*/uploads/aios/*" ! -path "*/uploads/cache/*" \
    ! -path "*/uploads/elementor/*" ! -path "*/uploads/fusion-builder-avada-pages/*" 2>/dev/null || true)

  if [ -n "$new_php_files" ]; then
    count_php=$(printf "%s\n" "$new_php_files" | grep -c . || true)
    urgent_alerts="${urgent_alerts}
🚨 <b>PHÁT HIỆN FILE PHP LẠ TRONG UPLOADS/LANGUAGES (${count_php} file):</b>
<code>$(printf "%s\n" "$new_php_files" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>
<i>Action: Đã đổi chmod 000 và cách ly ngay lập tức.</i>
"
    while IFS= read -r f; do
      [ -z "$f" ] && continue; [ -f "$f" ] || continue
      chmod 000 "$f" 2>/dev/null || true
      mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
      echo "[$(date '+%F %T')] [EMERGENCY] Cách ly file PHP lạ: $f" >> "$LOG_FILE"
    done <<< "$new_php_files"
  fi

  # 2. PHÁT HIỆN MÃ ĐỘC TRONG UPGRADE
  root_upgrade_php=$(find /home/*/htdocs/*/wp-content/upgrade /home/*/htdocs/*/wp-content/upgrade-temp-backup \
    -maxdepth 1 -type f -name "*.php" 2>/dev/null || true)

  if [ -n "$root_upgrade_php" ]; then
    count_root_up=$(printf "%s\n" "$root_upgrade_php" | grep -c . || true)
    urgent_alerts="${urgent_alerts}
🚨 <b>CẤY FILE PHP TRỰC TIẾP Ở GỐC UPGRADE (${count_root_up} file):</b>
<code>$(printf "%s\n" "$root_upgrade_php" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>
<i>Action: Đã cách ly ngay lập tức.</i>
"
    while IFS= read -r f; do
      [ -z "$f" ] && continue; [ -f "$f" ] || continue
      chmod 000 "$f" 2>/dev/null || true
      mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
      echo "[$(date '+%F %T')] [EMERGENCY] Cách ly file PHP ở gốc upgrade: $f" >> "$LOG_FILE"
    done <<< "$root_upgrade_php"
  fi

  upgrade_malware=""
  for up_dir in /home/*/htdocs/*/wp-content/upgrade /home/*/htdocs/*/wp-content/upgrade-temp-backup; do
    [ -d "$up_dir" ] || continue
    hits=$(grep -rlE "$MALWARE_SIG" "$up_dir" --include="*.php" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      upgrade_malware="${upgrade_malware}${hits}
"
    fi
  done

  if [ -n "$upgrade_malware" ]; then
    count_up_malware=$(printf "%s\n" "$upgrade_malware" | grep -c . || true)
    urgent_alerts="${urgent_alerts}
☣️ <b>MÃ ĐỘC PHÁT HIỆN TRONG UPGRADE (${count_up_malware} file):</b>
<code>$(printf "%s\n" "$upgrade_malware" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>
<i>Action: Đã cách ly ngay lập tức.</i>
"
    while IFS= read -r f; do
      [ -z "$f" ] && continue; [ -f "$f" ] || continue
      chmod 000 "$f" 2>/dev/null || true
      mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
      echo "[$(date '+%F %T')] [EMERGENCY] Cách ly mã độc trong upgrade: $f" >> "$LOG_FILE"
    done <<< "$upgrade_malware"
  fi

  # Dọn rác upgrade treo
  stale_upgrade_dirs=$(find /home/*/htdocs/*/wp-content/upgrade /home/*/htdocs/*/wp-content/upgrade-temp-backup \
    -mindepth 1 -maxdepth 2 -mmin +120 2>/dev/null || true)
  if [ -n "$stale_upgrade_dirs" ]; then
    while IFS= read -r item; do
      [ -z "$item" ] && continue; [ -e "$item" ] || continue
      rm -rf "$item" 2>/dev/null || true
    done <<< "$stale_upgrade_dirs"
  fi

  # 3. PHÁT HIỆN PLUGIN GIẢ MẠO
  fake_plugins=$(find /home/*/htdocs/*/wp-content/plugins -maxdepth 1 -type d -regextype posix-extended \
    -regex ".*/(admin-utils|content-tools|site-tweaks|core-helper|cache_).*|.*-[0-9a-f]{6,10}$" 2>/dev/null || true)

  if [ -n "$fake_plugins" ]; then
    count_plugins=$(printf "%s\n" "$fake_plugins" | grep -c . || true)
    urgent_alerts="${urgent_alerts}
🔌 <b>PLUGIN GIẢ MẠO CẤY NGẦM (${count_plugins} plugin):</b>
<code>$(printf "%s\n" "$fake_plugins" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>
<i>Action: Đã di chuyển sang thư mục cách ly.</i>
"
    while IFS= read -r p; do
      [ -z "$p" ] && continue; [ -d "$p" ] || continue
      mv "$p" "$QUARANTINE_DIR/" 2>/dev/null || true
      echo "[$(date '+%F %T')] [EMERGENCY] Cách ly plugin giả mạo: $p" >> "$LOG_FILE"
    done <<< "$fake_plugins"
  fi

  # 4. PHÁT HIỆN ADMIN BACKDOOR TRONG DB
  new_admins=""
  for config in /home/*/htdocs/*/wp-config.php; do
    [ -f "$config" ] || continue
    domain=$(echo "$config" | cut -d'/' -f5)
    DB_NAME=$(grep DB_NAME "$config" | cut -d"'" -f4)
    DB_USER=$(grep DB_USER "$config" | cut -d"'" -f4)
    DB_PASS=$(grep DB_PASSWORD "$config" | cut -d"'" -f4)
    DB_PREFIX=$(grep '\$table_prefix' "$config" | cut -d"'" -f2)

    if [ -n "$DB_NAME" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASS" ]; then
      query="SELECT user_login, user_email, user_registered FROM ${DB_PREFIX}users
             WHERE user_login LIKE 'w2s_%' OR user_login LIKE 'wp2_%'
                OR user_login IN ('system_updater', 'msvadmin', 'wphiddenbot');"
      users=$(mariadb -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e "$query" 2>/dev/null || true)

      if [ -n "$users" ]; then
        while IFS=$'\t' read -r u_login u_email u_reg; do
          [ -z "$u_login" ] && continue
          [ "$u_login" = "autologin@cloudpages.cloud" ] && continue
          new_admins="${new_admins}
• <b>$domain</b>: <code>$u_login</code> ($u_email)"
        done <<< "$users"

        mariadb -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM ${DB_PREFIX}users WHERE user_login LIKE 'w2s_%' OR user_login LIKE 'wp2_%' OR user_login IN ('system_updater', 'msvadmin', 'wphiddenbot');" 2>/dev/null || true
        mariadb -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DELETE FROM ${DB_PREFIX}usermeta WHERE user_id NOT IN (SELECT ID FROM ${DB_PREFIX}users);" 2>/dev/null || true
        echo "[$(date '+%F %T')] [EMERGENCY] Xóa backdoor admin trên DB $DB_NAME ($domain)" >> "$LOG_FILE"
      fi
    fi
  done

  if [ -n "$new_admins" ]; then
    urgent_alerts="${urgent_alerts}
👤 <b>TÀI KHOẢN ADMIN BACKDOOR TRONG DATABASE:</b>${new_admins}
<i>Action: Đã xóa ngay lập tức khỏi DB.</i>
"
  fi

  # 5. ĐỒNG BỘ LOG & TỰ ĐỘNG BLOCK IP QUA ANALYZER
  /usr/local/bin/wp-security-analyzer.py sync >/dev/null 2>&1 || true

  # NẾU CÓ SỰ CỐ NGIÊM TRỌNG TRÊN (FILE MA ĐỘC / BACKDOOR) ➔ GỬI TELEGRAM EMERGENCY NGAY LẬP TỨC
  if [ -n "$urgent_alerts" ]; then
    send_telegram_msg "🚨 <b>CẢNH BÁO AN NINH KHẨN CẤP (REAL-TIME ALERT)</b>" "$urgent_alerts"
  fi
}

# ------------------------------------------------------------------------------
# BÁO CÁO DAILY (GỬI VÀO 08:00 SÁNG HÀNG NGÀY)
# ------------------------------------------------------------------------------
run_daily_report() {
  /usr/local/bin/wp-security-analyzer.py sync >/dev/null 2>&1 || true
  daily_report=$(/usr/local/bin/wp-security-analyzer.py report 24 2>/dev/null || true)

  if [ -n "$daily_report" ]; then
    send_telegram_msg "☀️ <b>BÁO CÁO TỔNG HỢP AN NINH HÀNG NGÀY (DAILY REPORT)</b>" "$daily_report"
    echo "[$(date '+%F %T')] [DAILY] Đã gửi báo cáo Daily thành công lúc 08:00 sáng." >> "$LOG_FILE"
  fi
}

if [ "${1:-}" = "--daily" ]; then
  run_daily_report
else
  run_active_defense
fi
