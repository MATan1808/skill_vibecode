# Client-Side & Browser Hunting — WordPress Context
(adapted from Cloudflare security-audit-skill CLIENT-SIDE.md)

## Khi nào dùng file này
Khi audit WP site có: SPA frontend, Gutenberg editor, plugin admin panels render untrusted content, `postMessage` usage, WebSocket, hoặc CORS config.

## Core discipline
- Client-side taint cần controllable SOURCE và executing SINK trên client path. Source không sink = not finding
- Impact phải cross đến victim hoặc cross origin. XSS trong attacker's own DOM = not finding
- Framework auto-escaping là real mitigation. WP Gutenberg/React escape mặc định — finding là khi code opt OUT
- Missing header/attribute chỉ là finding khi có concrete sensitive action phía sau

## DOM-based XSS trong WordPress

### Sources (input vào client)
- `location.hash` / `location.search` / `location.href` / `location.pathname`
- `document.referrer`
- `window.name`
- `postMessage` data
- `document.cookie`
- URL parameters qua `URLSearchParams` hoặc custom parsing

### Sinks (execution points)
- `innerHTML` / `outerHTML`
- `document.write`
- `eval` / `Function` / `setTimeout(string)` / `setInterval(string)`
- `element.src` / `element.href` set `javascript:` URI
- jQuery `$(...)` / `.html()` / `.append(unsanitized)`
- React `dangerouslySetInnerHTML`
- WP TinyMCE / Gutenberg block `RawHTML`

### WP-specific DOM XSS vectors
- **Gutenberg blocks**: custom blocks render user content — có dùng `RawHTML` hoặc `dangerouslySetInnerHTML`?
- **Plugin admin panels**: settings pages render saved options — sanitize trước render?
- **Customizer preview**: live preview inject user CSS/HTML — escape?
- **Theme JavaScript**: `wp_localize_script` data dùng trong `innerHTML`?
- **WP editor**: TinyMCE plugins thêm unfiltered content?

## postMessage trong WordPress
- Gutenberg iframe preview: check `event.origin`?
- Customizer: parent ↔ preview frame communication origin-checked?
- Plugin embedded iframes (payment gateways, maps): `postMessage(data, '*')` leak data?
- oEmbed preview iframes: handler verify origin?

## Clickjacking WordPress
State-changing actions cần protect:
- **Publish/delete post**: frameable?
- **Plugin activate/deactivate**: frameable?
- **Settings save** (wp-admin/options-general.php): frameable?
- **User role change**: frameable?
- WP core set `X-Frame-Options: SAMEORIGIN` cho admin — plugin pages cũng được cover?

## CORS trong WordPress
- REST API CORS headers: `Access-Control-Allow-Origin` reflect origin?
- `Access-Control-Allow-Credentials: true` với reflected/wildcard origin?
- Plugin REST endpoints CORS config riêng?

## Prototype Pollution (nếu site dùng heavy JS)
- Deep merge trong JS config objects?
- Query string parser build nested objects?
- Tìm recursive write + gadget (property được read cho security decision)

## Validation Rules (Client-side domain)
1. **Confirm controllable source AND executing sink** trên client path — cite cả hai
2. **Prototype pollution**: prove recursive write AND gadget
3. **Messaging/CORS/WebSocket**: show origin check absent hoặc weak, VÀ data drive security-relevant action
4. **UI-redress**: require sensitive action behind missing guard — missing `X-Frame-Options` trên read-only page = hardening note
5. **WP-specific**: verify WP core `wp_kses`, `esc_*` functions không đã handle trước khi report
