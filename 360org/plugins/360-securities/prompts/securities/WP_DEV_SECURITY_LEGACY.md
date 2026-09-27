---
name: wp-dev-skills
description: Bộ kỹ năng WordPress Dev + CloudPanel audit/hardening. Dùng khi phát triển theme/plugin/block/REST API hoặc khi site WordPress bị hack, nhiễm mã độc, 500/down, cần quét virus, clean malware, tìm root cause và bịt lỗ hổng tái nhiễm trên CloudPanel.
---

# WordPress Dev & Audit Skills (CloudPanel fleet)

Phát triển + audit + harden WordPress trên `ssh cloudpanel`. Hai mục tiêu chính: **dev đúng chuẩn WordPress** và **security dứt điểm** (không chỉ xoá file malware, phải truy cửa vào và bịt vector tái nhiễm). Run scripts — không paste multi-line `wp eval`/`grep` qua `ssh '...'` vì quoting dễ vỡ. Interpret với `references/interpreting-results.md`.

## Golden rules
- **Always run via uploaded scripts**, never paste multi-line `wp eval`/`grep` through `ssh '...'` — quoting/parentheses break (`unmatched '`). Pattern: `scp scripts/X.sh cloudpanel:/tmp/ && ssh cloudpanel 'bash /tmp/X.sh <domain>; rm -f /tmp/X.sh'`.
- **Read-only first.** `audit.sh` changes nothing. Only run `harden.sh` after reporting findings and getting the user's go-ahead. Hardening edits production — back up first (the script does).
- **One SSH connection knowledge:** docroot = `/home/<user>/htdocs/<domain>`, logs = `/home/<user>/logs/{nginx,php}/`, wp-cli = `sudo -u <user> wp --path=<docroot>`. The DB table prefix is NOT always `wp_` (e.g. `360_ws`) — scripts auto-detect it. Per-site PHP `memory_limit` lives in the **nginx vhost** `fastcgi_param PHP_VALUE` (~line 132 of `/etc/nginx/sites-enabled/<domain>.conf`), NOT php.ini. See `references/cloudpanel-env.md`.
- **Known-legit:** the admin account `autologin@cloudpages.cloud` is the fleet owner's own auto-login tool. Never flag it.
- **Never use `twenty*` default themes.** The fleet standard is Avada/Fusion (or a custom theme); `twentytwenty*`/`twentyten`/etc. are pure attack surface (idle code, never audited, common malware injection target). Any `twenty*` theme found inactive on a site should be removed. See Step 5.

## Workflow

### Step 1 — Triage (30s)
Confirm the symptom and that SSH works.
```
curl -sS -o /dev/null -w "HTTP %{http_code} %{time_total}s\n" -L --max-time 25 https://<domain>/
ssh cloudpanel 'echo OK; uptime'
```
500 = app error (go to memory/error-log first). 502/504 = PHP-FPM down/timeout. Connection refused/000 = nginx/DNS. 200 = intermittent — keep digging, the storm may have passed.

**BẮT BUỘC lưu trữ kết quả và dọn dẹp hệ thống (Production Hardening & Local Sync):**
1. **Lưu trữ kết quả quét (Audit logs/reports)**: Toàn bộ báo cáo và kết quả quét trung gian phát sinh từ `audit.sh` hay `audit-ioc-fleet.sh` chạy trên máy chủ CloudPanel **BẮT BUỘC chỉ được phép lưu trữ tạm thời trong thư mục `/audit-work/` trên server** (không lưu lung tung trong `/tmp/`, `/root/`, hay `/home/` khác).
2. **Lưu trữ trên máy local iMac**: Sau khi quét xong, toàn bộ các working files, backup, cấu hình và báo cáo đồng bộ về local **phải bắt buộc lưu trữ tại thư mục `/Volumes/DATA/WORDPRESS/` của máy iMac**.
3. **Dọn dẹp sau khi quét (Cleanup server artifacts)**: Ngay sau khi chạy audit xong và đồng bộ file báo cáo về máy local iMac, **phải chạy lệnh dọn dẹp (rm -rf) xóa sạch thư mục `/audit-work` trên cloudpanel**. Tuyệt đối không để lại bất kỳ dữ liệu làm việc (input/output/report/backup) nào trên máy chủ production để giữ môi trường sạch sẽ tuyệt đối.
### Step 2 — Full audit (read-only)
```
scp scripts/audit.sh cloudpanel:/tmp/ && ssh cloudpanel 'bash /tmp/audit.sh <domain>; rm -f /tmp/audit.sh'
```
This prints labelled sections: storage usage, ENV+memory, error-log/OOM, core+plugin checksums, PHP-in-uploads, recent-modified PHP, malware signatures, wp-config, dropins/mu-plugins, users, DB injection, cron, enumeration exposure, login forensics, AIOWPS, fail2ban, software versions. **Interpret every section against `references/interpreting-results.md`.** For a fleet-wide storage report, run `scripts/audit-storage.sh`.

### Step 3 — Decide verdict
- **Health:** OOM `Allowed memory size of N bytes exhausted` → memory_limit too low for the stack. A heavy stack (Avada + WooCommerce + Rank Math + AIOWPS) needs ~130MB just to boot; 128M crashes, set **512M**. Cross-check effective limit from the vhost, not php.ini.
- **Compromise:** any of — core/plugin checksum MISMATCH, PHP files in `uploads/`, malware signatures in non-vendor files, hidden admin users, `<script>`/`base64_decode` in options/posts, rogue cron hooks, successful logins from hostile IPs, **Wpanel/GreenMarca IOC patterns** (see `references/interpreting-results.md` §Wpanel campaign) → **treat as hacked**, go to `references/malware-cleanup.md`. If all clean + only *failed* logins → not breached, just normal attack noise.

### Step 4 — Act (only with user approval)
- Memory fix: edit `memory_limit=` in the vhost, `nginx -t && systemctl reload nginx`.
- Hardening: `scp scripts/harden.sh cloudpanel:/tmp/ && ssh cloudpanel 'bash /tmp/harden.sh <domain>; rm -f /tmp/harden.sh'` — tightens AIOWPS login lockdown (enables invalid-username lockout, lowers attempts, raises lockout time) with a config backup. Reversible.
- Cleanup (if hacked): follow `references/malware-cleanup.md` — reinstall core/plugins from checksums, remove injected files, reset all admin passwords + salts, force-logout, then re-run `audit.sh` to confirm clean.

### Step 5 — Remove unused `twenty*` default themes (fleet housekeeping)
The fleet never uses WordPress default themes (`twentytwenty*`, `twentyten`, …) — they only sit there as unaudited attack surface. Run fleet-wide or per-site:
```
scp scripts/remove-default-themes.sh cloudpanel:/tmp/ && ssh cloudpanel 'bash /tmp/remove-default-themes.sh; rm -f /tmp/remove-default-themes.sh'
```
Backs up every removed theme dir to `/home/cloudpanel/backups/incident/removed-default-themes-<ts>/<domain>/` before deleting (never a hard delete). If a `twenty*` theme is the **active** theme on a site, the script skips it and flags it — report that to the user instead of removing (means the site was actually using it; confirm before touching).

## Step 6 — Phân tích nội dung site dung lượng lớn (read-only)
Sau `scripts/audit-storage.sh`, không được xóa chỉ vì site vượt ngưỡng. Chạy `scripts/audit.sh <domain>` cho từng site bị đánh dấu và kiểm tra theo thứ tự:

1. Phân rã `docroot`, `wp-content`, `uploads`, `plugins`, `themes`, cache và các thư mục theo năm.
2. Tìm archive/backup/dump nằm trong docroot (`*.sql`, `*.zip`, `*.tar.gz`, `*.bak`, `*.old`) — đây là rác tiềm năng nhưng phải xác nhận trước khi xóa.
3. Tìm PHP/PHTML/PHAR trong `uploads`. Chấp nhận các guard đã biết của AIOS/BackupBuddy/iThemes và cache WPML chỉ sau khi đọc/đối chiếu đường dẫn; mọi file PHP khác phải điều tra.
4. Chạy `core verify-checksums` và `plugin verify-checksums --all`; plugin premium/nội bộ không có checksum WordPress.org thì đọc header + mã nguồn, không force-reinstall mù quáng.
5. Liệt kê admin mới, user đăng ký gần thời điểm incident và role/caps. Không xóa user chỉ vì ngày đăng ký mới; xác minh hoạt động nội dung và hỏi chủ site nếu chưa chắc.
6. Kiểm tra options/posts/cron có dấu hiệu chèn mã. `fusion_options`, `widget_text`, `wpcode_snippets`, cron của Wordfence/SEO/Redis/Avada/WPML thường là dữ liệu hợp lệ — đọc ngữ cảnh trước khi gắn nhãn.
7. Nếu public trả `403/000` nhưng upstream `127.0.0.1:8080` trả `200`, phân loại là lỗi lớp nginx/Cloudflare trước; không đổ lỗi cho WordPress hoặc thao tác dọn file.

### Quy tắc phân loại false-positive
Tên có `shell`, `locale`, `charmap`, `crypto`, `upload` hoặc `base64` không tự chứng minh malware. Cần kết hợp: vị trí file, checksum, mtime, nội dung thực thi, quyền truy cập, log request và persistence. Các PHP thường hợp lệ gồm `uploads/**/index.php` guard của plugin bảo mật/backup và cache PHP của WPML.

### Wpanel / GreenMamba campaign IOC (xác nhận trên fleet 2026-07-31)
Chiến dịch mã độc tái nhiễm fleet bằng **3 lớp persistence**: theme Avada bị cấy, plugin giả tự tạo admin, và admin backdoor hàng loạt. Quy tắc:
- **Avada persistence**: nếu `wp-content/themes/Avada/functions.php` có `WPANEL:BEGIN`, `_wp_load_compat_layer`, `class-wp-locale-data`, `wp-rewrite-rules`, `rod476/files`, `mamglaqwek.com`, `shellcode.lol` → coi là compromised. Nguồn thay thế chuẩn của fleet là `/home/vuahethong/htdocs/vuahethong.com/wp-content/themes/Avada` trên server `vuahethong`.
- **Quy trình thay Avada/plugin từ nguồn chuẩn `vuahethong.com`**: trước tiên audit source và target, kiểm tra core/plugin/theme version, checksum/hash và IOC; nếu source có IOC thì không được dùng làm nguồn. Tạo backup file + DB của target trước khi đụng production. Chỉ thay đúng `themes/Avada` và trọn bộ 4 plugin đi kèm mặc định của Avada theme (`fusion-core` - Avada Core, `fusion-builder` - Avada Builder, `fusion-white-label-branding` - Avada Branding, và `revslider` - Slider Revolution) từ source sang target, giữ nguyên `wp-config.php`, `uploads/`, database, custom child theme và dữ liệu riêng của site. Không copy toàn bộ `wp-content` hoặc cả docroot.
  
  Sau khi copy theme và plugin, bắt buộc chạy lệnh cập nhật database của WordPress và Avada (nếu có) thông qua WP-CLI:
  ```
  sudo -u <user> wp --path=<docroot> core update-db
  ```
  Tiếp tục kiểm tra tính toàn vẹn và cấu hình, sửa owner/permission theo user site, xóa OPcache/reload PHP-FPM nếu cần. Cuối cùng, chạy `core verify-checksums`/plugin checksum, quét IOC lần nữa và thực hiện kiểm tra HTTP 200 đảm bảo website hoạt động ổn định và không bị lỗi 500 hay lỗi kết nối. Nếu phiên bản source khác target, ưu tiên bản cùng phiên bản; nếu không có, ghi rõ thay đổi phiên bản và kiểm tra tương thích trước khi reload.
- **Plugin giả tạo admin**: `wp-content/plugins/wordpress-cache-optimizer/wordpress-cache-optimizer.php` là root-cause đã xác nhận. Nó tự tạo/ẩn/chống xóa admin `wphiddenbot` (`wphiddenbot@gmail.com`) bằng `wp_insert_user`, `pre_user_query`, `delete_user`. Khi thấy file này: backup DB + quarantine plugin trước, rồi xóa đúng user `wphiddenbot` bằng SQL chính xác; không dùng `wp user delete --user_login=...` vì WP-CLI không filter như mong đợi.
- **Fake remote-payload plugin**: `wp-content/mu-plugins/wp-fixplugin.php` tự inject JavaScript từ `mamglaqwek.com` và expose REST route công khai để đổi payload. Hash đã gặp: `5fc9c8ad0dc156ec505f498c1ddde259fe413a115dbd1f12bb8e6d188d37eca6`.
- **AIOWPS/theme language inject**: mọi `PHPLoader.php` có hash `49e6516d20bff05169e6c97f1f3e6862991bfd548ccbe9204fd7baceea9fdad3` là backdoor Wpanel, kể cả nằm dưới AIOWPS `languages/`, Avada `languages/`, `licensing/`, `tribe/`, hoặc `wp-content/maintenance/assets/`. File `.htaccess` kèm trong `languages/` cũng phải quarantine.
- **Dropin/webshell/persistence cũ**: `wp-content/db.php`, `wp-admin/images/T04s1/wp-load.php` (`GhostManSec`), `wp-content/languages/themes/the/plugins.php`, `wp-content/plugins/wp-compat` 1.3.3, `mu-plugins/site-compat-layer.php`, `wp-compat-layer.php`, `sso-loader.php`, `wp-rewrite-rules.php`, `mu-plugins/index.php` có `eval()` đều là compromised.
- **Disguised mu-plugins directory (MANDATORY REMOVAL)**: Thư mục `mu-plugins` CHỈ ĐƯỢC PHÉP tồn tại duy nhất ở đường dẫn chuẩn là `/wp-content/mu-plugins/`. Bất kỳ thư mục nào khác có tên là `mu-plugins` ở bất kỳ vị trí nào khác trong website (ví dụ `wp-content/plugins/mu-plugins`, `wp-admin/mu-plugins`, `wp-includes/mu-plugins`, thư mục `/mu-plugins/` ngay tại root website, v.v.) đều là ngụy trang độc hại của virus. Phải cô lập và xóa bỏ hoàn toàn mà không cần giữ lại.
- **`upgrade-temp-backup` folder (WP Rollback feature)**: Đây là thư mục hợp lệ do WordPress sinh ra khi cập nhật lỗi/gián đoạn. Không cần xóa cả thư mục nếu nó trống, nhưng nếu chứa file `.php` lạ mà không có hoạt động cập nhật gần đây thì phải điều tra và dọn dẹp các file php đó.
- **`wp2shell-single-point-mitigation.php`**: nội dung có thể giống rule chặn REST batch, nhưng theo chính sách fleet của chủ server, tên file này vẫn là IOC cần quarantine trừ khi có xác nhận rõ là do đội vận hành cài.
- **Admin backdoor pattern chắc chắn**: user/email có `w2s_`, `wp2_`, `wp2s_`, `Nx_`, `JLG_`, `Bunk_`, `bunk_`, `bl_`, `svc_`, `wordpress_<hex>`, `wp_admin_`, `wphiddenbot`, `seomanager2026`, `cron_service`, `wpchecking`, `adminbockup`, `upgrades`, hoặc domain email `wp2shell`, `shellcode.lol`, `nx.invalid`, `bunk.invalid`, `bl.bl`, `mailtest.invalid`, `local.invalid`, `local.host` → backup DB rồi xóa. `autologin@cloudpages.cloud` là hợp lệ, không flag.
- **Log pattern**: batch REST API (`wp-json/batch/v1`, `rest_route=/batch/v1`) trả 200/207/301 với payload lớn, `shell` probe (`alfa`, `wso`, `filemanager`, `cmd.php`) trả 200, admin mới quanh 2026-07-19..31 là dấu hiệu cần truy root-cause. 403/404 chỉ là attempted scan, không đủ kết luận nhiễm nếu không có file/user/DB IOC.
- **Bài học 2026-07-31**: xóa file mà không xóa root-cause (`wordpress-cache-optimizer` hoặc Avada persistence) sẽ làm admin/file tự mọc lại trong vài giây. Luôn quarantine root-cause trước, rồi mới xóa user/file.
- **Bài học 2026-08-07 (Mã độc rải rác ngoài docroot)**: malware có thể nhân bản các file PHP độc hại giả danh core (như `wp-blog-header.php` hoặc `wp-cron.php`) ra toàn bộ các thư mục của user ngoài docroot (`/home/<user>/backups/`, `/home/<user>/logs/`, `/home/<user>/tmp/`, `/home/<user>/htdocs/`). Đây là backdoor RCE kết nối C2 (`hubnode.gamerspe.top`). Bắt buộc tìm và xóa sạch các file này ngoài docroot chuẩn.
- **Theme level .htaccess injection (2026-08-07)**: malware cài cấy file `.htaccess` độc hại vào `/wp-content/themes/.htaccess` để chặn thực thi mọi file PHP ngoại trừ webshell duy nhất của chúng (ví dụ: `ttvoTifYBj.php`). Bắt buộc xóa bỏ các file `.htaccess` nằm trong thư mục themes.
- **Rogue .htaccess Whitelist (2026-08-07)**: malware chèn cấu hình `Allow from all` cho các file PHP độc hại/fake core (`wp-logln.php`, `wp-admnn.php`, `wp-conffq.php`, `reviall.php`, v.v.) trong file `.htaccess` tại root hoặc `/wp-content/.htaccess` để tự bảo vệ webshell. Bắt buộc khôi phục `.htaccess` chuẩn, xóa whitelist độc hại và đặt thuộc tính bảo mật `chattr +i` cho file `.htaccess` ở root.
- **Rogue .htaccess in User Logs Directory (2026-08-07)**: malware cấy file `.htaccess` có cấu hình WordPress URL rewrite giả lập vào thư mục logs của hệ thống (`/home/<user>/logs/`, `/home/<user>/logs/php/`, v.v.) để hijack hoặc đánh lừa hệ thống. Thư mục logs mặc định không bao giờ chứa file `.htaccess`. Phải tìm và xóa bỏ hoàn toàn.
- **Remove Default WordPress Info Files (updated 2026-08-13)**: Bắt buộc xóa bỏ file fingerprint public của WordPress: `readme.html`, `license.txt`, `licencia.txt` ở docroot, `wp-admin/`, `wp-includes/` và `wp-includes/ID3/license.txt`. Không xoá `license.txt` trong `wp-content/plugins/**`, `wp-content/themes/**` hoặc `vendor/**` nếu không có IOC riêng, vì xoá nhầm sẽ làm checksum plugin/theme lệch.
- **Legitimate uploads `.htaccess` (2026-08-13)**: Không xoá `.htaccess` do WPForms/Contact Form 7/Really Simple CAPTCHA sinh ra nếu nội dung chỉ deny access hoặc chỉ allow ảnh captcha (`BEGIN WPForms`, `wpcf7_uploads`, `wpcf7_captcha`, `Deny from all`, `Require all denied`, `Order deny,allow`, `Options -Indexes`). Chỉ flag/xoá `.htaccess` trong uploads khi có directive mở quyền hoặc bật PHP như `Require all granted`, `Allow from all`, `FilesMatch` nhắm PHP/PHTML/PHAR/INC, `SetHandler`, `AddHandler`, `AddType`, `auto_prepend_file`, `php_value`, `php_flag`.
- **Unauthorized folder 'image' (2026-08-07)**: cấu trúc thư mục WordPress chuẩn tuyệt đối không được phép có thư mục nào tên là `image` (hoặc `images`) nằm ngay tại thư mục root website. Sự tồn tại của thư mục này là bất thường, do malware tạo ra để lưu trữ webshell/tàn dư code php độc hại (`app.php.bak`, `.b26_sed_bak/`). Phải cô lập và xóa bỏ hoàn toàn thư mục này.
- **WordPress Fleet Custom 7.0 (2026-08-07)**: fleet có thể chạy bản dựng nội bộ được đánh dấu là `7.0` (tích hợp API custom như `abilities.php`, `ai-client.php`, `class-wp-connector-registry.php`). Hãy xác minh phiên bản WordPress trước khi kết luận các file này là mã độc; không force-download core WordPress từ wordpress.org nếu nó ghi đè mất code custom của fleet.
- **DB Password Rotation (CloudPanel v2)**: lệnh `clpctl db:update:password` không khả dụng. Để đổi mật khẩu database, dùng MySQL root thực thi SQL `ALTER USER 'username'@'%' IDENTIFIED BY 'new_password'; FLUSH PRIVILEGES;` (sau khi dò host của user trong `mysql.user`), rồi cập nhật file `wp-config.php` (lưu ý chạy `sudo chattr -i` trước và `sudo chattr +i` sau khi đổi).

### Step 7 — Bịt lỗ tái nhiễm WP2Shell / fake plugin (fleet hardening)

Bài học production 2026-08-12 trên `apds-vn.com` và `namtienmc.com`: `wp-site-health-monitor-*` không phải plugin hợp lệ; đó chỉ là payload cuối. Nếu chỉ xoá file scanner báo, site vẫn nhiễm lại.

**Root cause cần truy:**
- REST batch còn mở: `/wp-json/batch/v1` hoặc `?rest_route=/batch/v1` trả `200/207/301/400` trong log POST.
- XML-RPC còn mở cho brute force/RPC abuse.
- PHP trực tiếp dưới `/wp-content/` còn gọi được.
- `wp-content/plugins` và `wp-content/themes` còn writable bởi PHP-FPM user.
- Webshell/fake-plugin từng thấy:
  - `security-headers-manager-*`
  - `database-repair-assistant-*`
  - `site-performance-toolkit-*`
  - `admin-utils-*`
  - `core-helper-*`
  - `content-tools-*`
  - `wp-cache-*`
  - `wp-site-health-monitor-*`
  - `wp-content/ajax.php`
  - `wp-content/class-wp.php`

**IOC DB/persistence:**
- Admin backdoor: `wp2_*`, `w2s_*`, `wp_admin_*`, `wp_service_*`, `wpsvc_*`, `*_midia*`, `*_web*`, `*_tic*`, `*_ops*` khi sinh gần incident và có role `administrator`.
- Cron malware: `wp_cache_health_*`, `wp_site_health_monitor_*`, `content_tools_*`, `core_helper_*`, `admin_utils_*`.
- Option `active_plugins` còn chứa plugin giả đã quarantine.

**Quy trình xử lý dứt điểm:**
1. Backup DB trước mỗi site, đảm bảo file backup size > 0 và sync về `/Volumes/DATA/WORDPRESS/`.
2. Quarantine fake-plugin/theme/file endpoint, không hard delete khi chưa sync evidence.
3. Xoá admin backdoor và cron malware sau khi backup DB thành công.
4. Clean `active_plugins` khỏi plugin giả.
5. Bật trong `wp-config.php`:
   ```php
   define( 'DISALLOW_FILE_EDIT', true );
   define( 'DISALLOW_FILE_MODS', true );
   ```
6. Khoá write code runtime sau cleanup:
   - `wp-content/plugins`: directory `550`, file `440`
   - `wp-content/themes`: directory `550`, file `440`
7. Patch Nginx đúng **server block chính** và **backend `listen 8080`**, không chèn nhầm vào block redirect `www.*`:
   ```nginx
   location = /xmlrpc.php { return 403; }
   location = /wp-json/batch/v1 { return 403; }
   if ($args ~* "(^|&)rest_route=/batch/v1") { return 403; }
   location ~* ^/wp-content/.*\.(php|phtml|php[0-9]|phar|inc)$ { return 403; }
   ```
8. Verify bắt buộc:
   ```bash
   curl -k -sS -o /dev/null -w "HOME %{http_code}\n" -L https://<domain>/
   curl -k -sS -o /dev/null -w "BATCH_PATH %{http_code}\n" -X POST https://<domain>/wp-json/batch/v1
   curl -k -sS -o /dev/null -w "BATCH_QUERY %{http_code}\n" -X POST 'https://<domain>/?rest_route=/batch/v1'
   curl -k -sS -o /dev/null -w "XMLRPC %{http_code}\n" -X POST https://<domain>/xmlrpc.php
   curl -k -sS -o /dev/null -w "WPCONTENT_PHP %{http_code}\n" https://<domain>/wp-content/ajax.php
   ```
   Kết quả đạt: `HOME 200`, các endpoint còn lại `403`.

Nếu sau các chặn này vẫn tái nhiễm, nguồn khả năng không còn nằm trong 1 site WordPress mà là credential/server-level hoặc site khác cùng CloudPanel.

### Step 8 — Kiểm tra cây `htdocs` và SEO doorway (fleet hardening)
CloudPanel chuẩn dùng duy nhất `/home/<user>/htdocs/<client-domain.com>` làm docroot. Các cây sau là bất thường, không được coi là website hợp lệ nếu không có vhost xác nhận rõ ràng:

- `/home/<user>/htdocs/public_html`
- `/home/<user>/htdocs/public_html/public_html`
- `/home/<user>/htdocs/wp-content`
- `/home/<user>/htdocs/wp-contents`
- `/home/<user>/htdocs/app` (chỉ hợp lệ với site ứng dụng đã biết)

Đối chiếu `root` trong `/etc/nginx/sites-enabled/*.conf` và `root` trong PHP-FPM pool trước khi xử lý. Nếu cây không được vhost tham chiếu, quarantine cả cây sau khi ghi nhận `stat`, hash và mốc thời gian; không xóa mù. Chạy audit fleet bằng `scripts/audit-invalid-htdocs.sh`.

Tìm doorway HTML mới sinh ngoài WordPress, đặc biệt các thư mục chứa `index.html` khoảng vài trăm KB, title/URL kiểu cờ bạc hoặc nội dung không liên quan site (`MAXWIN`, `PANEN`, `MAHJONG`, `galery88.art`, `agent2-pemenang.pages.dev`). Đối chiếu mtime với access log.

`POST /shell.php` kèm tham số `_r=<đường dẫn docroot>` hoặc `e=<đường dẫn file đích>` là bằng chứng webshell đã ghi file, không phải request WordPress bình thường. Khi thấy pattern này:

1. Cô lập endpoint/root-cause trước.
2. Lưu log và hash làm evidence.
3. Quarantine doorway HTML, sitemap giả, verification file và cây `public_html` không hợp lệ.
4. Kiểm tra user/admin, cron, mu-plugin, drop-in, core/plugin checksum và scan lại sau cleanup.
5. Không xóa `wp-includes/Text/Diff/Engine/shell.php` chỉ vì tên `shell.php`; đó là file core hợp lệ nếu checksum PASS. Phân biệt theo đường dẫn, nội dung và log.

### Dấu hiệu cần ưu tiên xử lý
- Core checksum fail ngoài các file tài liệu bị thiếu có chủ ý.
- Plugin `.org` checksum fail; plugin nội bộ checksum fail phải đọc mã trước khi quyết định.
- PHP/PHTML/PHAR lạ trong `uploads`, mu-plugin/drop-in không giải thích được.
- Admin mới không xác định được chủ sở hữu, đặc biệt kèm bài viết/nội dung hoặc login bất thường.
- Public 403/502/000 nhưng upstream khác trạng thái.
- WP-CLI fatal, PHP error liên tục, hoặc site đang chạy core/plugin quá cũ.
- `root` của vhost không khớp `/home/<user>/htdocs/<domain>` hoặc có cây `public_html` ngoài vhost.
- `POST /shell.php` có `_r`/`e`, doorway HTML hàng loạt, title spam hoặc link domain lạ.

## Deliverable
Report in Markdown (user prefers .md): symptom → root cause → evidence table (checks passed/failed) → storage breakdown → attack summary (attempted vs succeeded) → actions taken → remaining recommendations. Be direct; quote the decisive log lines and state explicitly when a finding is only a review flag, not proof of compromise.
Report in Markdown (user prefers .md): symptom → root cause → evidence table (checks passed/failed) → storage breakdown → attack summary (attempted vs succeeded) → actions taken → remaining recommendations. Be direct; quote the decisive log lines and state explicitly when a finding is only a review flag, not proof of compromise.
