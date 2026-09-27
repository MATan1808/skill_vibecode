#!/usr/bin/env python3
import sys
import os
import re
import glob
import sqlite3
import subprocess
import urllib.request
import json
from datetime import datetime, timezone, timedelta

DB_PATH = "/var/lib/wp-security-watcher/security_tracker.db"
MALWARE_SIG = re.compile(
    r'_wp_cuh_restore|show_advanced_plugins|_site_transient_health_|_nx_p|\[BLOCKED\]disable_functions|<<S>>|Author: WordPress\.org Community|eval\(base64_decode|\$_COOKIE\[.{3,12}\]\s*\(|\$_(GET|POST|REQUEST)\[.{1,12}\]\s*\(\$_|preg_replace_callback\(.*eval|goto\s+[a-zA-Z0-9_]+;'
)
SCAN_SIGNATURES = re.compile(
    r'batch/v1|/shell\.php|/\.env|wp-config\.php\.bak|wp-includes/ID3/|wp-content/plugins/|xmlrpc\.php|\.git/config|setup\.php|phpinfo\.php|eval-stdin\.php'
)

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ip_history (
            ip TEXT PRIMARY KEY,
            first_seen TEXT,
            last_seen TEXT,
            total_hits INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            last_reason TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ip_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT,
            ts TEXT,
            day_date TEXT,
            hour_str TEXT,
            uri TEXT,
            domain TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ip_geo_cache (
            ip TEXT PRIMARY KEY,
            country_code TEXT,
            flag_emoji TEXT,
            updated_at TEXT
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_events_ip ON ip_events(ip);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_events_ts ON ip_events(ts);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_events_day ON ip_events(day_date);")
    conn.commit()
    return conn

def country_code_to_flag(code):
    if not code or len(code) != 2 or code == "--":
        return "🌐"
    try:
        return "".join(chr(127397 + ord(c)) for c in code.upper())
    except Exception:
        return "🌐"

def get_country_for_ip(conn, ip):
    cur = conn.cursor()
    cur.execute("SELECT country_code, flag_emoji FROM ip_geo_cache WHERE ip = ?", (ip,))
    row = cur.fetchone()
    if row and row[0]:
        return row[0], row[1]

    # Tra cứu online qua ip-api.com với timeout cực ngắn 1.5s
    cc = "--"
    flag = "🌐"
    try:
        url = f"http://ip-api.com/json/{ip}?fields=countryCode"
        req = urllib.request.Request(url, headers={'User-Agent': 'wp-security-watcher/1.0'})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and "countryCode" in data and data["countryCode"]:
                cc = data["countryCode"].upper()
                flag = country_code_to_flag(cc)
    except Exception:
        pass

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cur.execute("""
        INSERT OR REPLACE INTO ip_geo_cache (ip, country_code, flag_emoji, updated_at)
        VALUES (?, ?, ?, ?)
    """, (ip, cc, flag, now_str))
    conn.commit()
    return cc, flag

def is_private_ip(ip):
    if not ip or ':' in ip:
        return False
    parts = ip.split('.')
    if len(parts) == 4:
        try:
            p0, p1 = int(parts[0]), int(parts[1])
            if p0 == 127 or p0 == 10:
                return True
            if p0 == 192 and p1 == 168:
                return True
            if p0 == 172 and (16 <= p1 <= 31):
                return True
        except ValueError:
            pass
    return False

def ip_sort_key(ip_str):
    try:
        if ':' in ip_str:
            return (2, ip_str)
        parts = [int(p) for p in ip_str.strip().split('.')]
        return (1, parts)
    except Exception:
        return (3, ip_str)

def get_banned_ips():
    banned = set()
    try:
        out = subprocess.check_output(['ufw', 'status'], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            if 'DENY' in line:
                m = re.search(r'([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', line)
                if m:
                    banned.add(m.group(1))
    except Exception:
        pass

    try:
        out = subprocess.check_output(['fail2ban-client', 'status', 'wp-scan'], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            if 'Banned IP list:' in line:
                ips = line.split('Banned IP list:')[-1].strip().split()
                banned.update(ips)
    except Exception:
        pass
    return banned

def block_ip(ip):
    try:
        subprocess.run(['fail2ban-client', 'set', 'wp-scan', 'banip', ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
    try:
        subprocess.run(['ufw', 'insert', '1', 'deny', 'from', ip, 'to', 'any', 'comment', 'Auto-blocked by wp-security-watcher'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def parse_and_sync_nginx_logs(conn):
    vn_tz = timezone(timedelta(hours=7))
    now = datetime.now(vn_tz)
    cutoff = now - timedelta(hours=1, minutes=5)

    cur = conn.cursor()
    log_files = glob.glob('/home/*/logs/nginx/*access.log')
    log_pattern = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*"')

    events_to_insert = []
    ip_stats_1h = {}

    for log_path in log_files:
        try:
            p = subprocess.Popen(['tail', '-n', '2000', log_path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            lines = p.stdout.readlines() if p.stdout else []
        except Exception:
            continue

        domain = log_path.split('/')[2] if len(log_path.split('/')) > 2 else 'unknown'

        for line in lines:
            if not SCAN_SIGNATURES.search(line):
                continue
            m = log_pattern.match(line)
            if not m:
                continue
            ip, time_str, method, uri = m.groups()
            if is_private_ip(ip):
                continue

            try:
                dt = datetime.strptime(time_str.split()[0], '%d/%b/%Y:%H:%M:%S').replace(tzinfo=vn_tz)
            except Exception:
                continue

            if dt < cutoff:
                continue

            iso_ts = dt.strftime('%Y-%m-%d %H:%M:%S')
            day_date = dt.strftime('%Y-%m-%d')
            hour_str = dt.strftime('%H:%M')

            ip_stats_1h[ip] = ip_stats_1h.get(ip, 0) + 1
            events_to_insert.append((ip, iso_ts, day_date, hour_str, uri[:100], domain))

    for ev in events_to_insert:
        cur.execute("""
            SELECT id FROM ip_events
            WHERE ip = ? AND ts = ? AND uri = ? AND domain = ?
            LIMIT 1
        """, (ev[0], ev[1], ev[4], ev[5]))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO ip_events (ip, ts, day_date, hour_str, uri, domain)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ev)

    banned_ips = get_banned_ips()

    for ip, count in ip_stats_1h.items():
        if count >= 10 and ip not in banned_ips:
            block_ip(ip)
            banned_ips.add(ip)

        cur.execute("SELECT ip, first_seen, total_hits FROM ip_history WHERE ip = ?", (ip,))
        row = cur.fetchone()
        status = "BLOCKED" if ip in banned_ips else "MONITORING"
        now_ts = now.strftime('%Y-%m-%d %H:%M:%S')

        if row:
            cur.execute("""
                UPDATE ip_history
                SET last_seen = ?, total_hits = total_hits + ?, status = ?
                WHERE ip = ?
            """, (now_ts, count, status, ip))
        else:
            cur.execute("""
                INSERT INTO ip_history (ip, first_seen, last_seen, total_hits, status, last_reason)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (ip, now_ts, now_ts, count, status, 'Web probe / vulnerability scan'))

    conn.commit()

def generate_report(conn, hours_lookback=24):
    cur = conn.cursor()
    vn_tz = timezone(timedelta(hours=7))
    now = datetime.now(vn_tz)
    lookback_time = now - timedelta(hours=hours_lookback)
    lookback_ts = lookback_time.strftime('%Y-%m-%d %H:%M:%S')

    cur.execute("""
        SELECT DISTINCT ip FROM ip_events
        WHERE ts >= ?
    """, (lookback_ts,))
    active_ips = [r[0] for r in cur.fetchall()]

    if not active_ips:
        return ""

    banned_ips = get_banned_ips()
    ip_data = []

    for ip in active_ips:
        cur.execute("""
            SELECT COUNT(*), GROUP_CONCAT(DISTINCT hour_str)
            FROM ip_events
            WHERE ip = ? AND ts >= ?
        """, (ip, lookback_ts))
        r1 = cur.fetchone()
        h_count = r1[0] if r1 else 0
        raw_hours = r1[1].split(',') if (r1 and r1[1]) else []
        sorted_hours = sorted(set(raw_hours))

        latest_time = sorted_hours[-1] if sorted_hours else "--:--"

        cur.execute("""
            SELECT COUNT(DISTINCT day_date), COUNT(*)
            FROM ip_events
            WHERE ip = ?
        """, (ip,))
        r2 = cur.fetchone()
        days_count = max(1, r2[0]) if r2 else 1
        total_all_hits = r2[1] if r2 else h_count

        # Lọc trạng thái: Chỉ giữ Block (🔴) và Theo dõi (🟡)
        is_banned = (ip in banned_ips)
        if is_banned:
            status_icon = "🔴"
        elif h_count >= 5 or total_all_hits >= 15:
            status_icon = "🟡"
        else:
            continue

        cc, flag = get_country_for_ip(conn, ip)
        country_display = f"{flag} {cc}"

        ip_data.append({
            'ip': ip,
            'status': status_icon,
            'country': country_display,
            'days': f"{days_count}d",
            'unit': str(h_count),
            'total': str(total_all_hits),
            'time': latest_time,
            'hits_period': h_count
        })

    if not ip_data:
        return ""

    # Top 25 IP vi phạm nhiều nhất
    top_ips = sorted(ip_data, key=lambda x: x['hits_period'], reverse=True)[:25]
    top_ips.sort(key=lambda x: ip_sort_key(x['ip']))

    unit_header = "24h" if hours_lookback >= 24 else " 1h"
    # Format bảng với Country (Cờ + Code 2 ký tự)
    header = f"{'IP':<15} {'St':<1} {'CC':<5} {'Day':>3} {unit_header:>3} {'Tot':>4} {'Time':>5}"
    divider = "─" * 40
    table_rows = [header, divider]

    for item in top_ips:
        row = f"{item['ip']:<15} {item['status']} {item['country']:<5} {item['days']:>3} {item['unit']:>3} {item['total']:>4} {item['time']:>5}"
        table_rows.append(row)

    table_content = "\n".join(table_rows)

    title_text = "24H QUA" if hours_lookback >= 24 else "1H QUA"
    report = f"🛡 <b>DANH SÁCH IP VI PHẠM ({title_text}):</b>\n<pre>{table_content}</pre>"
    if len(ip_data) > 25:
        report += f"\n<i>... và {len(ip_data) - 25} IP vi phạm khác.</i>"

    return report

if __name__ == "__main__":
    conn = init_db()
    hours = 24
    if len(sys.argv) > 2:
        try:
            hours = int(sys.argv[2])
        except ValueError:
            hours = 24

    if len(sys.argv) > 1 and sys.argv[1] == "sync":
        parse_and_sync_nginx_logs(conn)
    elif len(sys.argv) > 1 and sys.argv[1] == "report":
        parse_and_sync_nginx_logs(conn)
        rep = generate_report(conn, hours_lookback=hours)
        print(rep)
    else:
        parse_and_sync_nginx_logs(conn)
