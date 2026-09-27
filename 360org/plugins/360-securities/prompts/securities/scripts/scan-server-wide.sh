#!/bin/bash
# Fleet-wide server-wide scan for malware persistence (beyond website docroots)
# Run ON cloudpanel as root.
set -uo pipefail

echo "========================================================="
echo "=== SERVER-WIDE MALWARE PERSISTENCE & INTEGRITY SCAN ==="
echo "=== Date: $(date) ==="
echo "========================================================="

echo ""
echo "=== 1. PHP FILES OUTSIDE VALID DOCROOTS ==="
# Find PHP files in /home but outside standard htdocs structures, excluding vendor, node_modules, etc.
find /home -mindepth 2 \
  -path '*/vendor' -prune -o \
  -path '*/node_modules' -prune -o \
  -path '*/.git' -prune -o \
  -path '*/backups' -prune -o \
  -path '*/_security_quarantine_*' -prune -o \
  -path '*/_security_cleanup_*' -prune -o \
  -type f \( -name "*.php" -o -name "*.phtml" \) -print 2>/dev/null | while read -r file; do

  # Check if it is inside htdocs/<domain>/
  if [[ "$file" =~ ^/home/[^/]+/htdocs/[^/]+/ ]]; then
    # Skip if inside typical WP docroot, we scan those separately
    continue
  fi
  # Flag it!
  echo "PHP OUTSIDE DOCROOT: $file"
  stat -c "  Size: %s, Mtime: %y, Owner: %U:%G" "$file" 2>/dev/null || true
  # Print first 2 lines
  echo "  Preview: $(head -n 2 "$file" | tr '\n' ' ' | cut -c1-150)"
done

echo ""
echo "=== 2. SUSPICIOUS FILES IN TEMP DIRECTORIES (/tmp, /var/tmp, /dev/shm) ==="
find /tmp /var/tmp /dev/shm -maxdepth 3 -type f \( -name "*.php" -o -name "*.phtml" -o -name "*.py" -o -name "*.sh" -o -name "*.pl" -o -executable \) 2>/dev/null | while read -r file; do
  # Skip some common clean temp files
  if [[ "$file" =~ \.(lock|sock|pid)$ ]] || [[ "$file" =~ ^/tmp/systemd-private- ]] || [[ "$file" =~ ^/tmp/\. ]]; then
    continue
  fi
  echo "TEMP FILE: $file"
  stat -c "  Size: %s, Mtime: %y, Owner: %U:%G" "$file" 2>/dev/null || true
done

echo ""
echo "=== 3. SERVER-WIDE SIGNATURE SEARCH (hubnode.gamerspe.top, etc.) ==="
SIGNATURES="hubnode\.gamerspe\.top|mamglaqwek\.com|shellcode\.lol|wp2shell|wphiddenbot|rod476/files|_wp_load_compat_layer|class-wp-locale-data|GhostManSec"
echo "Searching /home for signatures: $SIGNATURES"
grep -rnIE --exclude-dir={vendor,node_modules,.git,backups,_security_quarantine_*,_security_cleanup_*} --include="*.php" "$SIGNATURES" /home/ 2>/dev/null | grep -vE '/cache/|/uploads/cache/|/wp-content/uploads/wp-security-audit-log/|/logs/' | head -200 || echo "No signatures found in /home"

echo ""
echo "=== 4. CRON JOBS AUDIT FOR ALL USERS ==="
echo "--- User Crontabs ---"
for crontab in /var/spool/cron/crontabs/*; do
  [ -f "$crontab" ] || continue
  user=$(basename "$crontab")
  echo "Crontab for user: $user"
  cat "$crontab" | grep -v '^#' || true
done

echo "--- System Crontabs & Directories ---"
find /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/ /etc/cron.weekly/ /etc/cron.monthly/ -type f 2>/dev/null | while read -r cronfile; do
  echo "Cron file: $cronfile"
  cat "$cronfile" | grep -v '^#' | grep -vE '^$|SHELL|PATH|MAILTO' || true
done

echo ""
echo "=== 5. RUNNING PROCESSES INSPECTION ==="
echo "--- Processes running as non-root/non-system from unusual places or running interpreter ---"
ps aux | grep -E 'php|python|perl|sh|bash' | grep -vE 'grep|systemd|sbin|usr/bin/zsh|usr/bin/bash|usr/lib|dpkg|fail2ban|clp|/usr/share' | head -50 || true

echo ""
echo "=== 6. SSH AUTHORIZED KEYS INTEGRITY ==="
find /home /root -name "authorized_keys" 2>/dev/null | while read -r keyfile; do
  echo "SSH Keys for: $keyfile"
  stat -c "  Owner: %U:%G, Mode: %A, Mtime: %y" "$keyfile"
  cat "$keyfile" | cut -d' ' -f3- || true
done

echo ""
echo "=== 7. LISTENING PORTS & PROCESSES ==="
ss -tulpn || netstat -tulpn || true

echo ""
echo "=== 8. ABUSED SYSTEMD SERVICES OR PATHS ==="
systemctl list-units --type=service --state=running | grep -vE 'systemd|cron|ssh|nginx|mysql|redis|php|postfix|rsyslog|acpid|dbus|getty|irqbalance|keyboard-setup|lvm2|multipathd|networking|resolvconf|smartmontools|udev|unattended-upgrades|vgauth|vmtoolsd|fail2ban|colima|docker' || true

echo "========================================="
echo "=== SERVER-WIDE SCAN COMPLETED ==="
echo "========================================="
