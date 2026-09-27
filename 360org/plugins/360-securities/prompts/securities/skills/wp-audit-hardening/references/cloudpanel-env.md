# CloudPanel fleet environment

Access: `ssh cloudpanel` (root). ~50 WordPress sites.

## Layout per site
- Docroot: `/home/<user>/htdocs/<domain>` (user = site slug, often domain-derived, not the domain).
- Logs: `/home/<user>/logs/nginx/access.log` (+ rotated `access.log-YYYY-MM-DD`), `/home/<user>/logs/php/error.log` (+ rotated). Also `logs/varnish-cache/`.
- nginx vhost: `/etc/nginx/sites-enabled/<domain>.conf`.
- PHP-FPM pool: `/etc/php/<ver>/fpm/pool.d/<domain>.conf` (listen on a 127.0.0.1:<port>). Usually PHP 8.4.
- wp-cli: `sudo -u <user> wp --path=/home/<user>/htdocs/<domain> ...` (running as root errors). Suppress the noisy `ssl-verify` warning with `| grep -v ssl-verify`.

## Gotchas (learned the hard way)
- **DB table prefix is NOT always `wp_`** (seen `360_ws`). Get it: `wp config get table_prefix`. Raw `db query` against `wp_*` tables will 1146-error otherwise.
- **Per-site `memory_limit` is set in the nginx vhost**, not php.ini: `fastcgi_param PHP_VALUE "...memory_limit=XXXM;..."` (~line 130-137). Global `/etc/php/*/fpm/php.ini` may say 768M but the vhost PHP_VALUE wins per-request. Measuring via `cgi-fcgi` straight to the FPM port BYPASSES nginx and shows the misleading php.ini value — always measure via real HTTP. Change it in the vhost (or CloudPanel UI → Site → PHP Settings → memory_limit) then `nginx -t && systemctl reload nginx`.
- Sites use **Varnish** in front (port 8080 backend). Cached hits never reach PHP, so OOM storms cluster on uncached/overnight bot traffic.
- **fail2ban** runs fleet-wide (`/etc/fail2ban/jail.d/wordpress.local`) watching `/home/*/logs/nginx/access.log`: jails `wp-login` (maxretry 10 / 300s / ban 1d) and `wp-scan` (maxretry 2 / 600s / ban 7d), plus `sshd`. Check: `fail2ban-client status wp-login`.
- App-layer login defense per site = **All-In-One WP Security (AIOWPS)**. Audit log table `<prefix>aiowps_audit_log` (event_type `failed_login` vs success). Config in option `aio_wp_security_configs` (serialized — edit safely with `wp option patch update`).

## Heavy-stack memory baseline
A single page render of **Avada + WooCommerce + Rank Math (Pro) + AIOWPS** peaks ~130MB regardless of how small the content is — it's the code loaded per request, not the DB size. So 128M crashes (500), 256M is borderline, **512M is the fleet norm** for Woo/Avada sites. Lighter sites run 256M. Watch for sites still on 128M.

## Known-legit accounts
- `autologin@cloudpages.cloud` (admin) = fleet owner's own auto-login tool. Present on multiple sites. **Never flag or remove it.**

## Phân quyền Siết chặt Chống Cấy Plugin Giả Mạo (Anti-Dropper Security)

Để ngăn chặn triệt để lỗ hổng webshell/dropper tự tạo thư mục plugin rác (dạng `<slug>-[0-9a-f]{6,8}`):
1. Thư mục `wp-content/plugins` và `wp-content/themes` phải đặt quyền `550` (`dr-xr-x---`).
2. Việc này ngăn PHP-FPM (User chạy web) có quyền ghi/tạo thư mục mới trong `plugins/` & `themes/`.
3. Khi cần cài/nâng cấp plugin chính danh, tạm thời đổi về `750`, nâng cấp xong lập tức siết lại `550`.
