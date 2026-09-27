# OWASP Security Code Review Methodology for WordPress

Tích hợp từ Sentry Security Review & OWASP Top 10, tùy biến cho hệ sinh thái WordPress.

## 1. Nguyên tắc Phân cấp Độ tin cậy (Confidence-Based Reporting)

Khi AI / Dev thực hiện rà soát mã nguồn WordPress:

| Cấp độ (Level) | Tiêu chí (Criteria) | Hành động (Action) |
|---|---|---|
| **HIGH** | Xuất hiện Pattern lỗ hổng + Đầu vào (input) từ bên ngoài được xác nhận (e.g. `$_GET`, `$_POST`, REST param không sanitize). | **Báo cáo & Khắc phục khẩn cấp** |
| **MEDIUM** | Pattern có rủi ro, nhưng nguồn đầu vào chưa rõ ràng hoặc nằm sau gate phân quyền. | **Ghi chú cần xác minh thêm** |
| **LOW** | Lý thuyết, khuyến nghị Best practice, thiếu kiên cố chuyên sâu nhưng chưa khai thác được. | **Bỏ qua**, không làm nhiễu báo cáo |

---

## 2. Quy trình Trace Data Flow (Truy vết Luồng Dữ liệu)

Trước khi kết luận một dòng code bị lỗi:
1. **Source**: Xác định nguồn dữ liệu vào (`$_GET`, `$_POST`, `$_REQUEST`, `$_COOKIE`, REST API `$request->get_param()`, Shortcode attributes).
2. **Sanitization**: Kiểm tra xem dữ liệu có đi qua hàm làm sạch của WP không (`sanitize_text_field()`, `sanitize_email()`, `absint()`, `wp_kses()`).
3. **Sink**: Dữ liệu được đưa vào đâu?
   - SQL Query -> Bắt buộc dùng `$wpdb->prepare()`
   - HTML Output -> Bắt buộc dùng `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`
   - File Operations -> Bắt buộc dùng `validate_file()`, `basename()`
   - Shell/Exec -> Tránh tối đa `exec()`, `system()`, `passthru()`
4. **Auth Gate**: Đã kiểm tra quyền hạn (`current_user_can('manage_options')`) và Nonce (`check_ajax_referer()`, `wp_verify_nonce()`) chưa?

---

## 3. Checklist Lỗi Bảo mật Phổ biến trên WordPress

### A. SQL Injection (SQLi)
- **Sai**: `$wpdb->query("SELECT * FROM {$wpdb->prefix}users WHERE user_login = '" . $_POST['user'] . "'");`
- **Đúng**: `$wpdb->query($wpdb->prepare("SELECT * FROM {$wpdb->prefix}users WHERE user_login = %s", $_POST['user']));`

### B. Cross-Site Scripting (XSS)
- **Reflected / Stored XSS**:
  - **Sai**: `echo $_GET['search'];`
  - **Đúng**: `echo esc_html($_GET['search']);`
- **DOM XSS trong JS / Gutenberg Block**:
  - **Sai**: `element.innerHTML = response.data;`
  - **Đúng**: `element.textContent = response.data;` hoặc dùng WP Element / React components.

### C. Missing Authentication & Authorization (Broken Access Control)
- **AJAX / REST Endpoints**: Quên check `current_user_can()`.
  - **Check**: Mọi `add_action('wp_ajax_nopriv_...', ...)` đều phải coi là public, mọi REST API endpoint trong `permission_callback` phải return `boolean` xác thực rõ ràng thay vì `__return_true`.

### D. Cross-Site Request Forgery (CSRF)
- Mọi action thay đổi trạng thái (Form submit, Action link, AJAX) phải kèm Nonce:
  - Form: `wp_nonce_field('my_action_nonce');`
  - Handler: `check_admin_referer('my_action_nonce');` hoặc `wp_verify_nonce($_POST['_wpnonce'], 'my_action_nonce')`.

### E. Insecure Direct Object References (IDOR)
- Người dùng truyền `id=123` sửa bài viết/tài khoản. Phải check xem người dùng hiện tại (`get_current_user_id()`) có sở hữu hoặc có quyền chỉnh sửa ID đó không trước khi thực thi `UPDATE`/`DELETE`.

### F. Server-Side Request Forgery (SSRF)
- Khi gọi URL bên ngoài qua `wp_remote_get()` từ input user:
  - Phải sanitize URL (`esc_url_raw()`).
  - Hạn chế IP nội bộ (localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x) để tránh bị lợi dụng scan mạng nội bộ.
