# Interpreting audit.sh output

Read each section as PASS (benign) vs FLAG (investigate/act).

| Section | PASS / benign | FLAG = investigate |
|---|---|---|
| Storage | docroot below 10 GiB and below 3x fleet median | docroot > 10 GiB or >3x fleet median; inspect uploads, backups, cache, logs, and large database exports before deleting anything |
|---|---|---|
| 0 HTTP | 200 | 500 (app/OOM), 502/504 (FPM down/timeout), 000 (nginx/DNS) |
| Wpanel/GreenMamba IOC | No Avada persistence, no fake admin plugin, no dropin/webshell/admin backdoor, no mu-plugins folder outside wp-content/mu-plugins | Any confirmed IOC = **compromised**: Avada `WPANEL:BEGIN`/`_wp_load_compat_layer`, `wordpress-cache-optimizer` creating `wphiddenbot`, `wp-fixplugin.php`/`mamglaqwek.com`, `PHPLoader.php` hash `49e651...dad3`, `db.php`, `wp-admin/images/T04s1/wp-load.php`, `languages/themes/the/plugins.php`, `wp-compat` 1.3.3, mu-plugins `site-compat-layer.php`/`wp-compat-layer.php`/`sso-loader.php`/`wp-rewrite-rules.php`, any mu-plugins folder outside wp-content/mu-plugins, or admin pattern `w2s_`/`wp2_`/`Nx_`/`JLG_`/`svc_`/`wphiddenbot`/`shellcode.lol`/`wp2shell` |
| 1 ENV memory | 256–512M for heavy stack | 128M on Avada/Woo = will OOM |
| 2 error log | 0 fatals, flat history | `Allowed memory size … exhausted`; a day where OOM count jumps from 0 → thousands = regression onset; admin-context files (`wc-admin-settings`, `theme-json`) crashing = bot/cron load |
| 3 core checksum | "verifies against checksums" | ANY "should be X but is Y" / "doesn't verify" = core tampered → compromised |
| 4 plugin checksum | "Verified N of N" | mismatch in a .org plugin = injected code. (Premium plugins like fusion-*/rank-math-pro/AIOWPS-premium can't be checksum-verified — that's normal, not a flag.) Updates available = patch them. |
| 5 PHP in uploads | only `mailpoet/*/index.php`, `aios/firewall-rules/settings.php` | ANY other `.php`/`.phtml` = webshell/backdoor → compromised |
| 6 recent .php | core/plugin files (if checksums passed) | loose `.php` in uploads, root, or odd folders; random-named files; recently-changed core files when checksums FAIL |
| 7 malware sig | empty | any non-vendor file with eval/base64_decode/gzinflate/shell_exec/FilesMan/`$_POST[..]()` = backdoor |
| 8 wp-config | "(clean)", no dropins or only legit ones | eval/base64/remote includes; an unexpected `object-cache.php`/`advanced-cache.php`/`db.php` dropin or mu-plugin you can't account for = inspect it |
| 9 admin users | known owner + `autologin@cloudpages.cloud` | unknown admin, esp. registered around an incident date; DB row count > `user list` (hidden user) |
| 10 DB injection | empty; autoload < ~1MB | `<script>`/`base64_decode`/`eval(` in options or posts = injected; autoload > a few MB = perf bloat (not security) |
| 11 cron | "(none)" | unknown hook firing code = persistence/backdoor |
| 12 enumeration | 403 on all three | 200/redirect on `?author=1` or `wp-json/wp/v2/users` = username leak; xmlrpc 200 = brute/DDoS vector → harden |
| 13 login forensics | 302s explained as failed by §14; backdoor probes all 404; admin-200 only from owner IPs | a hostile IP reaching wp-admin 200; a backdoor probe returning 200 (file exists!) |
| 14 AIOWPS | only `failed_login` events, 0 success, no surprise logged-in users | a success/login event from a hostile IP; `invalid_username` lockout OFF = weak (harden) |
| 15 fail2ban | jails active, IPs banned | jail missing/empty while logs show heavy brute-force |

## Verdict logic
- **Healthy + clean:** all PASS → report "not breached", explain any outage as memory/config, recommend memory bump + minor hardening.
- **Under attack, not breached** (the common case): heavy failed logins + backdoor probes all 404 + everything else PASS → say so plainly; attempts ≠ breach. Tighten lockdown.
- **Wpanel/GreenMamba campaign active (confirmed 2026-07-31):** any of Avada `WPANEL:BEGIN`/`_wp_load_compat_layer`, fake plugin `wordpress-cache-optimizer` creating `wphiddenbot`, fake mu-plugin `wp-fixplugin.php`/`mamglaqwek.com`, `PHPLoader.php` exact hash `49e6516d20bff05169e6c97f1f3e6862991bfd548ccbe9204fd7baceea9fdad3`, `db.php` dropin, `wp-admin/images/T04s1/wp-load.php`, `languages/themes/the/plugins.php`, `wp-compat` 1.3.3, any mu-plugins folder outside wp-content/mu-plugins, or admin backdoor pattern (`w2s_`, `wp2_`, `Nx_`, `JLG_`, `svc_`, `wphiddenbot`, `wp2shell`, `shellcode.lol`) → **compromised**, go to `malware-cleanup.md`. Do NOT treat as clean just because batch/log probes returned 403/404 — file/user IOC is decisive.
- **Compromised:** any FLAG in §3/5/7/9/10/11 or Wpanel IOC above (tampered core, webshell, malware sig, hidden admin, DB/cron injection, a successful hostile login, or confirmed backdoor file) → go to `malware-cleanup.md`. Don't half-clean.

## The 302-on-wp-login trap
Many distinct IPs POSTing to wp-login and getting **302** looks like mass successful logins but usually is NOT — security plugins 302-redirect *failed/blocked* attempts. Confirm against §14 AIOWPS audit (`failed_login` vs success) and §13 (did those IPs then load wp-admin 200?). Only call it a breach if a login success event exists or the IP reached wp-admin.

## Memory OOM at a number below the configured limit
If fatals say e.g. 128M but the vhost says more, the requests are hitting an older/different effective value — re-check the vhost PHP_VALUE (§1) and whether nginx was reloaded after a change. Real per-request limit = what a phpinfo fetched over HTTP reports, not `cgi-fcgi` to the FPM port.
