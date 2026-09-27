#!/bin/bash
# ==============================================================================
# WP Security Watcher - Giám sát & Tự động Phản xạ Chặn (Active Defense)
# Tần suất chạy: 15 phút/lần qua cronjob
# Cơ chế cảnh báo: Gom và gửi báo cáo tổng hợp Telegram 1 giờ/lần
#
# CÁC TÍNH NĂNG TỰ ĐỘNG BẢO VỆ (CHẶN TỨC THÌ MỖI 15 PHÚT):
# 1. Phát hiện & Cách ly ngay lập tức File PHP lạ trong Uploads/Languages
# 2. Giám sát thông minh thư mục Upgrade:
#    - TRẢM NGAY file PHP đứng đơn lẻ trực tiếp tại gốc upgrade/ (WP không bao giờ tạo)
#    - TRẢM NGAY file có chứa chữ ký mã độc / webshell / obfuscation
#    - DỌN DẸP file/thư mục upgrade bị treo quá hạn (> 120 phút)
# 3. Phát hiện & Cách ly ngay lập tức Plugin giả mạo / ngụy trang
# 4. Phát hiện & Xóa tức thì Admin Backdoor (w2s_*, system_updater, msvadmin...)
# 5. Phát hiện & Ban IP tấn công / Dò quét endpoint nhạy cảm qua Fail2ban/UFW
# 6. Tổng hợp các đợt phát hiện/xử lý và báo cáo Telegram 1 tiếng/lần
# ==============================================================================
set -uo pipefail

STATE_DIR="/var/run/wp-security-watcher"
QUARANTINE_DIR="/home/cloudpanel/backups/incident/quarantine"
mkdir -p "$STATE_DIR" "$QUARANTINE_DIR"

LOG_FILE="/var/log/wp-security-watcher.log"
PENDING_ALERTS_FILE="$STATE_DIR/pending_alerts.txt"
LAST_ALERT_TS_FILE="$STATE_DIR/last_alert_ts"
NOTIFY_CONF="/home/cloudpanel/backup_system/notify.conf"

[ -f "$NOTIFY_CONF" ] && source "$NOTIFY_CONF"

# Chữ ký nhận diện mã độc thật
MALWARE_SIG='_wp_cuh_restore|show_advanced_plugins|_site_transient_health_|_nx_p|\[BLOCKED\]disable_functions|<<S>>|Author: WordPress\.org Community|eval\(base64_decode|\$_COOKIE\[.{3,12}\]\s*\(|\$_(GET|POST|REQUEST)\[.{1,12}\]\s*\(\$_|preg_replace_callback\(.*eval|goto\s+[a-zA-Z0-9_]+;'

send_telegram_aggregated() {
  local content="$1"

  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    echo "[$(date '+%F %T')] [ALERT_SUMMARY] $content" >> "$LOG_FILE"
    return 0
  fi

  local msg
  msg="⚡ <b>TỔNG HỢP CẢNH BÁO AN NINH & BẢO VỆ TỰ ĐỘNG (1H)</b>
🖥 <code>$(hostname)</code>   🕒 $(date '+%d/%m/%Y · %H:%M')
━━━━━━━━━━━━━━━━━━
🚨 <b>CÁC ĐỢT TẤN CÔNG ĐÃ TỰ ĐỘNG CHẶN TRONG 1 GIỜ QUA:</b>

${content}

<i>Hệ thống tự động ngăn chặn tức thì mỗi 15 phút và tổng hợp báo cáo mỗi 1 giờ.</i>"

  curl -s --max-time 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "disable_web_page_preview=true" \
    --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
}

detected_issues=""
actions_taken=""
NOW_HUMAN="$(date '+%H:%M')"

# ------------------------------------------------------------------------------
# 1. GIÁM SÁT & TỰ ĐỘNG CÁCH LY FILE PHP TRONG UPLOADS / LANGUAGES
# ------------------------------------------------------------------------------
new_php_files=$(find /home/*/htdocs/*/wp-content/uploads \
  /home/*/htdocs/*/wp-content/languages \
  -type f -name "*.php" -mmin -20 \
  ! -name "*.l10n.php" ! -name "index.php" \
  ! -path "*/uploads/aios/*" ! -path "*/uploads/cache/*" \
  ! -path "*/uploads/elementor/*" ! -path "*/uploads/fusion-builder-avada-pages/*" 2>/dev/null || true)

if [ -n "$new_php_files" ]; then
  count_php=$(printf "%s\n" "$new_php_files" | grep -c . || true)
  detected_issues="${detected_issues}
📂 <b>File PHP lạ trong Uploads/Languages:</b> (${count_php})
<code>$(printf "%s\n" "$new_php_files" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    chmod 000 "$f" 2>/dev/null || true
    mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
    echo "[$(date '+%F %T')] [ACTION] Đã cách ly file PHP lạ: $f" >> "$LOG_FILE"
  done <<< "$new_php_files"

  actions_taken="${actions_taken}
• Đã cách ly ${count_php} file PHP lạ trong thư mục dữ liệu."
fi

# ------------------------------------------------------------------------------
# 1B. GIÁM SÁT UPGRADE (Chặn file đơn lẻ ở gốc, chặn chữ ký độc hại, dọn rác treo)
# ------------------------------------------------------------------------------
# 1B.1 File PHP đứng trực tiếp ở gốc upgrade (WordPress KHÔNG BAO GIỜ để file .php trực tiếp ở gốc upgrade/)
root_upgrade_php=$(find /home/*/htdocs/*/wp-content/upgrade /home/*/htdocs/*/wp-content/upgrade-temp-backup \
  -maxdepth 1 -type f -name "*.php" 2>/dev/null || true)

if [ -n "$root_upgrade_php" ]; then
  count_root_up=$(printf "%s\n" "$root_upgrade_php" | grep -c . || true)
  detected_issues="${detected_issues}
🚨 <b>File PHP cấy trực tiếp ở gốc Upgrade:</b> (${count_root_up})
<code>$(printf "%s\n" "$root_upgrade_php" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    chmod 000 "$f" 2>/dev/null || true
    mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
    echo "[$(date '+%F %T')] [ACTION] Đã cách ly file PHP ở gốc upgrade: $f" >> "$LOG_FILE"
  done <<< "$root_upgrade_php"

  actions_taken="${actions_taken}
• Đã cách ly ${count_root_up} file PHP cấy trực tiếp ở gốc upgrade."
fi

# 1B.2 Quét mã độc thật / webshell trong các thư mục con của upgrade
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
  detected_issues="${detected_issues}
☣️ <b>Mã độc trong thư mục Upgrade:</b> (${count_up_malware})
<code>$(printf "%s\n" "$upgrade_malware" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    chmod 000 "$f" 2>/dev/null || true
    mv "$f" "$QUARANTINE_DIR/" 2>/dev/null || true
    echo "[$(date '+%F %T')] [ACTION] Đã cách ly mã độc trong upgrade: $f" >> "$LOG_FILE"
  done <<< "$upgrade_malware"

  actions_taken="${actions_taken}
• Đã cách ly ${count_up_malware} file mã độc phát hiện trong upgrade."
fi

# 1B.3 Dọn dẹp tự động các thư mục upgrade tạm bị bỏ rơi/treo > 120 phút
stale_upgrade_dirs=$(find /home/*/htdocs/*/wp-content/upgrade /home/*/htdocs/*/wp-content/upgrade-temp-backup \
  -mindepth 1 -maxdepth 2 -mmin +120 2>/dev/null || true)
if [ -n "$stale_upgrade_dirs" ]; then
  while IFS= read -r item; do
    [ -z "$item" ] && continue
    [ -e "$item" ] || continue
    rm -rf "$item" 2>/dev/null || true
    echo "[$(date '+%F %T')] [CLEANUP] Đã dọn thư mục upgrade tạm quá hạn: $item" >> "$LOG_FILE"
  done <<< "$stale_upgrade_dirs"
fi

# ------------------------------------------------------------------------------
# 2. GIÁM SÁT & TỰ ĐỘNG CÁCH LY PLUGIN GIẢ MẠO / NGỤY TRANG
# ------------------------------------------------------------------------------
fake_plugins=$(find /home/*/htdocs/*/wp-content/plugins -maxdepth 1 -type d -regextype posix-extended \
  -regex ".*/(admin-utils|content-tools|site-tweaks|core-helper|cache_).*|.*-[0-9a-f]{6,10}$" 2>/dev/null || true)

if [ -n "$fake_plugins" ]; then
  count_plugins=$(printf "%s\n" "$fake_plugins" | grep -c . || true)
  detected_issues="${detected_issues}
🔌 <b>Plugin giả mạo cấy ngầm:</b> (${count_plugins})
<code>$(printf "%s\n" "$fake_plugins" | head -5 | sed 's@/home/[^/]*/htdocs/@@')</code>"

  while IFS= read -r p; do
    [ -z "$p" ] && continue
    [ -d "$p" ] || continue
    mv "$p" "$QUARANTINE_DIR/" 2>/dev/null || true
    echo "[$(date '+%F %T')] [ACTION] Đã cách ly plugin giả mạo: $p" >> "$LOG_FILE"
  done <<< "$fake_plugins"

  actions_taken="${actions_taken}
• Đã cách ly ${count_plugins} thư mục plugin giả mạo."
fi

# ------------------------------------------------------------------------------
# 3. GIÁM SÁT & TỰ ĐỘNG XÓA ADMIN BACKDOOR TRONG DATABASE
# ------------------------------------------------------------------------------
new_admins=""
deleted_admins_count=0

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
      deleted_admins_count=$((deleted_admins_count+1))
      echo "[$(date '+%F %T')] [ACTION] Đã xóa backdoor admin trên DB $DB_NAME ($domain)" >> "$LOG_FILE"
    fi
  fi
done

if [ -n "$new_admins" ]; then
  detected_issues="${detected_issues}
👤 <b>Tài khoản Backdoor trong DB:</b>${new_admins}"
  actions_taken="${actions_taken}
• Đã xóa sạch tài khoản backdoor khỏi Database của ${deleted_admins_count} website."
fi

# ------------------------------------------------------------------------------
# 4. GIÁM SÁT TRAFFIC DÒ QUÉT & TỰ ĐỘNG BLOCK IP QUA FAIL2BAN / UFW
# ------------------------------------------------------------------------------
hostile_ips=$(grep -h -E 'batch/v1|/shell\.php|/\.env|wp-config\.php\.bak' /home/*/logs/nginx/*access.log 2>/dev/null \
  | tail -n 500 \
  | awk '{print $1}' \
  | sort \
  | uniq -c \
  | sort -nr \
  | awk '$1 >= 15 {print $2}' \
  | head -3 || true)

if [ -n "$hostile_ips" ]; then
  banned_list=""
  while IFS= read -r ip; do
    [ -z "$ip" ] && continue
    [[ "$ip" =~ ^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.) ]] && continue

    if which fail2ban-client &>/dev/null; then
      fail2ban-client set wp-scan banip "$ip" 2>/dev/null || fail2ban-client set sshd banip "$ip" 2>/dev/null || true
    fi
    if which ufw &>/dev/null; then
      ufw insert 1 deny from "$ip" to any comment "Auto-blocked by wp-security-watcher" 2>/dev/null || true
    fi
    banned_list="${banned_list} <code>$ip</code>"
    echo "[$(date '+%F %T')] [ACTION] Đã block IP tấn công: $ip" >> "$LOG_FILE"
  done <<< "$hostile_ips"

  if [ -n "$banned_list" ]; then
    detected_issues="${detected_issues}
🌐 <b>IP tấn công dò quét liên tục:</b>${banned_list}"
    actions_taken="${actions_taken}
• Đã cấm kết nối (Block Firewall) các IP vi phạm trên toàn server."
  fi
fi

# ------------------------------------------------------------------------------
# 5. GHI NHẬN SỰ CỐ VÀO HÀNG ĐỢI TỔNG HỢP (BUFFER)
# ------------------------------------------------------------------------------
if [ -n "$detected_issues" ]; then
  batch_entry="━━━━━━━━━━━━━━━━━━
⏱ <i>Đợt chặn lúc ${NOW_HUMAN}:</i>
${detected_issues}

🛠 <b>Hành động xử lý:</b>${actions_taken}
"
  printf "%s\n" "$batch_entry" >> "$PENDING_ALERTS_FILE"
fi

# ------------------------------------------------------------------------------
# 6. GOM & GỬI BÁO CÁO TELEGRAM ĐỊNH KỲ 1 TIẾNG / LẦN
# ------------------------------------------------------------------------------
NOW_EPOCH=$(date +%s)
LAST_ALERT_EPOCH=$(cat "$LAST_ALERT_TS_FILE" 2>/dev/null || echo 0)
TIME_DIFF=$((NOW_EPOCH - LAST_ALERT_EPOCH))

# Chỉ gửi khi: Có sự cố trong hàng đợi VÀ đã cách lần gửi trước >= 3600 giây (1 giờ)
if [ -s "$PENDING_ALERTS_FILE" ] && [ "$TIME_DIFF" -ge 3600 ]; then
  aggregated_body=$(cat "$PENDING_ALERTS_FILE")
  send_telegram_aggregated "$aggregated_body"

  # Cập nhật mốc thời gian gửi và dọn sạch hàng đợi
  echo "$NOW_EPOCH" > "$LAST_ALERT_TS_FILE"
  > "$PENDING_ALERTS_FILE"
  echo "[$(date '+%F %T')] [NOTIFY] Đã gửi báo cáo tổng hợp Telegram định kỳ 1 giờ" >> "$LOG_FILE"
elif [ ! -f "$LAST_ALERT_TS_FILE" ]; then
  # Khởi tạo mốc ban đầu nếu chưa từng có
  echo "$NOW_EPOCH" > "$LAST_ALERT_TS_FILE"
fi
