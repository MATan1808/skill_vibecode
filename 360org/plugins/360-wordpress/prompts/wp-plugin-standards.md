# WordPress Plugin Development & Security Standards (360org)

1. **Bootstrap & ABSPATH**:
   - Mọi file PHP phải có: `defined('ABSPATH') || exit;`

2. **WordPress Coding Standards & PCP**:
   - Sử dụng Nonce & Capability checks: `check_ajax_referer()`, `current_user_can()`.
   - Sanitization & Escaping: `sanitize_text_field()`, `esc_html()`, `esc_attr()`, `esc_url()`.
   - Bắt buộc `permission_callback` cho REST API routes.

3. **12 Lớp Bảo Mật Mặc Định**:
   - Header security (CSP, HSTS, X-Frame-Options), Login throttling, Disable XML-RPC khi không cần thiết, Block direct upload execution.
