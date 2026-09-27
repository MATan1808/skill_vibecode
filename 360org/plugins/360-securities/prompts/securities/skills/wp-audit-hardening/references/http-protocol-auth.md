# HTTP Protocol & Auth Hunting — WordPress Context
(adapted from Cloudflare security-audit-skill WEB-PROTOCOL-AND-AUTH.md)

## Khi nào dùng file này
Khi audit WP site có: REST API, JWT plugins, OAuth/social login, custom auth, reverse proxy, Cloudflare/CDN, hoặc bất kỳ thành phần nào parse/forward HTTP requests.

## Core discipline
- Framing bugs sống trong DISAGREEMENT giữa 2 component, không phải 1 parser đơn lẻ
- Signature không verify = trang trí. Tìm exact line verify signature VÀ claims
- Mọi use của `Host`, `X-Forwarded-*`, `Forwarded`, request-derived URL = trust decision
- Reflected input trong security-relevant response field → trace cross-user impact

## WP-Specific Protocol Checks

### Cache Poisoning (unkeyed input)
WP với Cloudflare/Varnish/nginx cache:
- `X-Forwarded-Host` ảnh hưởng response nhưng không nằm trong cache key?
- Custom headers, cookies stripped from key?
- Query param mà cache normalize away?
- WP REST responses có `Vary` header đúng không?

### Cache Deception
- `/wp-json/wp/v2/users/me.css` — dynamic per-user page cached as static?
- Path extension confusion: `/account;.js`, path-parameter tricks
- WP preview URLs cacheable?

### Host Header Trust
- Password reset link: `Host` header control reset URL → victim click → leak token
- `WP_HOME` / `WP_SITEURL` derive từ `Host` trong setup/multisite?
- wp-login.php redirect_to + Host manipulation?

### Cookie & Session (WordPress-specific)
- `wordpress_logged_in_*`: HttpOnly? Secure? SameSite?
- `wordpress_sec_*`: scope phù hợp?
- Session rotate sau login? Sau password change?
- Nonce expiry: WP nonces valid 24h mặc định — có đủ cho context?

### Password Reset
- Reset token (`$key` trong `wp_password_change_notification`) — cryptographically bound to user?
- Single-use? Expiry?
- Leak qua `Host` header (email chứa link với attacker domain)?
- Leak qua `Referer` header khi user click link từ email rồi navigate?

### REST API Auth
- Cookie auth + nonce: `X-WP-Nonce` validate đúng?
- Application Passwords: scope appropriate?
- Basic Auth plugins: credentials over HTTP (not HTTPS)?
- JWT plugins: `alg` pinned server-side? `exp`/`aud`/`iss` checked? `kid` injection?

## Validation Rules (HTTP/Auth domain)
1. **Source-visibility gate**: nếu confirm cần component/config ngoài repo → "requires deployment testing", KHÔNG report confirmed
2. **Cache findings**: name both components và divergent parse cụ thể
3. **Token findings**: cite verification line và missing check cụ thể
4. **Prove cross-user impact**: payload reach victim's response/session/inbox
5. **Verify framework default**: WP core/library đã handle chưa? Confirm specific defense absent trước khi report
