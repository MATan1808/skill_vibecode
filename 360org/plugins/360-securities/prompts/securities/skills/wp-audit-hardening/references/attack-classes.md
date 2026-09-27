# Attack Classes cho WordPress Fleet (adapted from Cloudflare security-audit-skill)

Chọn attack class phù hợp theo Phase 1 recon. Không phải class nào cũng áp dụng cho mọi site.

## Core Attack Classes

### 1. Injection
Trace untrusted input từ entry point đến dangerous sink:
- **SQL**: `$wpdb->query()`, `$wpdb->prepare()` thiếu/sai, raw SQL trong plugin
- **XSS/HTML output**: `echo` không escape, thiếu `esc_html()`, `esc_attr()`, `wp_kses()`
- **File path**: `include`/`require` với input chưa validate, path traversal qua `../`
- **Shell command**: `exec()`, `system()`, `shell_exec()`, `passthru()`, `popen()`, `proc_open()`
- **Template injection**: Shortcode render user input trực tiếp
- **Log injection**: Input chưa sanitize vào error_log, audit log

Không chỉ direct path — tìm **indirect injection**: data lưu an toàn nhưng khi đọc lại dùng trong context nguy hiểm bởi code khác. Injection qua field names, keys, headers, metadata — không chỉ values.

### 2. Access Control
Vượt qua authorization, không chỉ kiểm tra permission check có tồn tại:
- Path đến cùng state change check permission yếu hơn?
- Field trong request body override permission system?
- Endpoint gate authentication nhưng quên authorization?
- Cùng resource nhiều access path với check không nhất quán?
- Bulk/batch/export operations có enforce per-item permissions?

**WP-specific**:
- REST API endpoints thiếu `permission_callback`
- AJAX actions thiếu `check_ajax_referer()` hoặc `current_user_can()`
- `admin_init` hooks chạy cho mọi admin page request (kể cả admin-ajax.php)
- `wp_ajax_nopriv_*` expose cho unauthenticated users

### 3. Resource & File Handling
- **Path traversal**: đọc/ghi ngoài intended directories, qua symlinks, encoded sequences, null bytes
- **SSRF**: WP fetch attacker-controlled URLs — `wp_remote_get()`, `wp_safe_remote_get()`
- **Upload bypass**: MIME type check bypass, double extension, PHP trong uploads
- **Race conditions**: TOCTOU giữa check và use trên file operations
- **Archive extraction**: zip slip qua plugin import/restore

### 4. Cryptography & Secrets
- Weak randomness cho security-critical values (nonces, tokens, salts)
- Hardcoded secrets, secrets trong logs, error messages, URLs, client-visible responses
- `wp-config.php` secrets: AUTH_KEY, SECURE_AUTH_KEY, NONCE_KEY — default/weak/shared?
- DB credentials trong backup files accessible từ web
- Plugin API keys hardcoded trong source

### 5. Business Logic
State machine violations, race conditions có business impact, numeric manipulation:
- **WP-specific**: WooCommerce price manipulation, coupon abuse, order state bypass
- **Content**: draft/private post accessible qua REST, preview token scope quá rộng
- **User flow**: registration bypass, role escalation qua profile update
- **Plugin conflict**: two plugins hook cùng action với contradicting logic

### 6. Feature Abuse & Data Leakage
Legitimate features dùng cho mục đích không mong muốn:
- **Export/backup**: WP export XML chứa private posts? DB backup accessible từ web?
- **Search/filter oracle**: Search reveal content tồn tại mà user không access được?
- **Enumeration**: `?author=1`, user enumeration qua REST `/wp-json/wp/v2/users`, login error messages khác nhau
- **Preview/draft leakage**: Preview tokens unlock broader access? Draft discoverable qua search/sitemap/RSS?
- **Webhook/notification SSRF**: Notification URL, pingback, trackback fetch internal URLs?

### 7. Chained Attacks
Individual safe behaviors nguy hiểm khi kết hợp:
- Info disclosure (learn resource ID) + IDOR (access trực tiếp) + missing rate limit
- Open redirect + OAuth callback = token theft
- XSS trong low-value context + CSRF để escalate
- **WP-specific**: user enumeration + weak password + no brute-force protection = account takeover
- Plugin A validate + Plugin B process = validation gap

### 8. Wildcard
Không theo category — tìm thứ không ai nghĩ tới:
- Code lạ nhất codebase? Half-finished features?
- API call possible nhưng frontend không bao giờ gọi?
- Hidden/undocumented endpoints, parameters, headers?
- Mix features không designed cùng nhau: localization + caching + preview
- Git history: reverted security fixes, commented-out auth, secrets committed rồi xóa?
- Test/example/seed credentials chạy được production?

### 9. Obvious Things
Kiểm tra những thứ "ai cũng tưởng đã check":
- Hardcoded passwords, API keys, tokens trong source (`grep -r 'password\|secret\|apikey\|token\|Bearer'`)
- TODO/FIXME/HACK comments liên quan security
- Debug mode gate đúng? `WP_DEBUG` + `WP_DEBUG_DISPLAY` + `WP_DEBUG_LOG` production?
- `.env`, `wp-config.php.bak`, `*.sql`, `*.sql.gz` accessible từ web?
- CORS `*` hoặc overly permissive?
- Cookies thiếu `HttpOnly`, `Secure`, `SameSite`?
- Open redirects? (`redirect_to`, `_wp_http_referer`, `return`)
- Error responses production trả stack traces, internal paths, SQL errors?

## WP REST API & Auth Protocol Checks

### JWT/Session defects (nếu site dùng JWT plugin)
- `alg: none` accepted?
- Decode without verify?
- Missing `exp`, `aud`, `iss` checks?
- `kid` header injection (file path traversal, SQL injection)?

### Cookie & Session
- Session ID không rotate sau login/privilege change?
- Session còn valid sau logout/password change?
- Cookie `Domain` quá rộng leak sang sibling subdomain?
- `wordpress_logged_in_*` và `wordpress_sec_*` cookie security flags?

### Password Reset
- Token not cryptographically bound to user?
- Predictable/short token?
- No single-use hoặc expiry?
- Token leaked qua `Host` header hoặc `Referer`?

## Client-Side Checks

### DOM XSS
Trace client sources (`location.hash`, `document.referrer`, `window.name`) đến sinks (`innerHTML`, `document.write`, `eval`, jQuery `$()/.html()`). Đặc biệt trong:
- Theme JavaScript
- Plugin admin panels
- WP editor (Gutenberg blocks)
- Customizer preview

### postMessage
`message` handler không check `event.origin`? `postMessage(data, '*')` leak data?

### Clickjacking
State-changing action (publish, delete, settings change) frameable không có `X-Frame-Options` hoặc `frame-ancestors` CSP?

## Validation Rules Chung

1. **Name the boundary crossed** — ai là attacker, session/identity nào bị ảnh hưởng, được gì mà trực tiếp không được?
2. **Cite trusting line + prove taint reaches it** — chỉ ra sink cụ thể với dữ liệu tainted
3. **Prove cross-user impact** — payload reach victim's response/session/inbox?
4. **Verify framework default doesn't handle it** — WP core có escape/sanitize sẵn không?
5. **Source-visibility gate** — nếu cần component/config ngoài repo để confirm → "requires deployment testing", KHÔNG report confirmed

## Quy định Cấm Plugin File Manager (High Risk RCE Attack Vector)

- **Các Plugin Bị Cấm**: `wp-file-manager`, `fileorganizer`, `wp-file-manager-pro` và các biến thể tương tự.
- **Rủi ro**: Các plugin này thường xuyên bị khai thác lỗ hổng Arbitrary File Upload / Unauthenticated RCE để cấy webshell và dropper vào hệ thống.
- **Quy tắc Kiểm soát**:
  1. Quét và diệt lập tức bất kỳ plugin File Manager nào trong `/wp-content/plugins/`.
  2. Bắt buộc quản lý file qua SSH / SFTP / CloudPanel File Manager chính thức thay vì plugin WordPress.

## Quy định Cấm Plugin Giả mạo Hệ thống (Fake Cache / Health Monitor Droppers)

- **Các Plugin Bị Cấm**: `wp-cache-*`, `wp-site-health-monitor-*`, `<slug>-[0-9a-f]{6,8}`.
- **Rủi ro**: Đây là các plugin do hacker tự tạo ra bằng tên giả danh tính năng hệ thống WordPress nhằm mục đích duy trì Backdoor/RCE.
- **Quy tắc Kiểm soát**: Quét regex phát hiện và lập tức cách ly/xóa sạch toàn bộ plugin khớp pattern này.

## Quy định Cấm Plugin Tiền tố wp-file*

- **Các Plugin Bị Cấm**: Tất cả plugin có tên bắt đầu bằng `wp-file*` (như `wp-file-manager`, `wp-file-manager-pro`, `wp-file-download`, `wp-file-upload`...).
- **Lý do**: Toàn bộ plugin thuộc pattern này không nằm trong danh mục plugin hệ thống được phê duyệt và là vector tấn công cấy backdoor chính.
- **Quy tắc Kiểm soát**: Quét và tự động diệt/cách ly lập tức bất kỳ plugin nào khớp tiền tố `wp-file*`.
