# Hunting Methodology (adapted from Cloudflare security-audit-skill)

Phương pháp tư duy tấn công — áp dụng khi phân tích kết quả audit hoặc hunt thủ công trên WP fleet.

## 12 góc tấn công

### 1. Happy path đã được bảo vệ — tấn công sad path
Error handlers, fallback branches, catch blocks, default cases, timeout paths, retry logic, cleanup routines. Khi WP plugin xử lý lỗi, có giữ cùng mức bảo mật như khi thành công không? Validation thất bại có để state nửa chừng không?

### 2. Điều gì xảy ra ở ranh giới?
Empty input, max-length, null vs undefined vs missing, zero, negative numbers, Unicode edge cases. Đặc biệt với WP: post title/slug quá dài, meta value trống, taxonomy term chứa ký tự đặc biệt.

### 3. Các component giả định gì về nhau?
Database layer giả định API layer đã validate? Renderer giả định content đã sanitize khi lưu? Auth middleware giả định routes tự đăng ký đúng? Trong WP: plugin giả định core đã escape, theme giả định plugin đã validate.

### 4. Nếu thao tác xảy ra sai thứ tự?
Gọi step 3 trước step 1. Delete trong khi create. Gửi callback trước request. Hit confirmation endpoint mà chưa start flow. Replay completed flow. WP context: activate plugin trước khi chạy migration, access REST endpoint trước khi setup xong.

### 5. Nếu hai thứ xảy ra đồng thời?
Hai request đến cùng resource. Modify while reading. Delete while iterating. Publish trong khi edit. Hai user claim cùng unique resource. WP: concurrent post saves, simultaneous plugin updates.

### 6. Hai parser/validator bất đồng ở đâu?
Input schema chấp nhận nhưng DB reject. URL router parse khác application code. Content-type header nói một đằng, body một nẻo. Filename extension vs MIME type vs magic bytes. WP: `wp_kses` vs browser rendering, REST schema vs actual DB constraints.

### 7. Cái gì sống sót qua round trip?
Data lưu rồi đọc lại — có giống nhau? Encoding thay đổi? Escaping double-up? Relative path resolve khác nhau khi read vs write? Serialization mất type info? WP: `update_option` → `get_option`, `wp_insert_post` → `get_post`.

### 8. Configuration kiểm soát những gì?
Config thiếu hoặc default thì sao? Environment variable override security control? Feature flag tắt validation? Security posture khi setup/first-run chưa xong config? WP: `WP_DEBUG`, `DISALLOW_FILE_EDIT`, `FORCE_SSL_ADMIN`.

### 9. Theo dấu privilege
Mỗi operation thay đổi state → ai authorize? Trace ngược permission check. Có check đúng permission? Đúng resource? Có path song song đến cùng state change mà check khác hoặc không check? WP: `current_user_can()`, `check_ajax_referer()`, REST permission_callback.

### 10. Context bị rò rỉ
Error messages lộ internal paths. Stack traces production. Timing differences lộ record tồn tại hay không. Response size khác nhau. HTTP headers lộ version. Debug endpoints sống sót production. WP: `WP_DEBUG_DISPLAY`, phpinfo, server-status.

### 11. Parameter nào override security-relevant defaults?
Input user-supplied thay đổi giá trị bảo mật mặc định? Override có được gate bởi permission phù hợp không? WP: `_wpnonce` bypass, custom capability checks thiếu.

### 12. Claim chưa xác minh dẫn dắt trust decision ở đâu?
Self-declared identity, capability, hoặc metadata ảnh hưởng access/trust decision mà không có independent verification? WP: `X-Forwarded-For` trust, plugin self-reporting version.

## Validation rules — áp dụng TRƯỚC KHI báo cáo bất kỳ finding nào

1. **PHẢI** construct concrete attack (exact inputs, requests, action sequence)
2. Attack **PHẢI** đạt meaningful impact (không chỉ "learn field names" hay "cause error")
3. Kiểm tra layer khác đã prevent exploitation chưa — nếu có → hardening note, không phải finding
4. Nếu exploit phụ thuộc parser/runtime behavior → verify với spec hoặc implementation, không đoán
5. Trả về CHỈ confirmed findings hoặc "No exploitable vulnerabilities found"

## Quy trình Rà soát Log & .htaccess Bắt buộc (Server-Wide Log & .htaccess Audit)

### 1. Rà soát File `.htaccess` Độc hại trong UPLOADS/THEMES/PLUGINS
- **Mục đích**: Kẻ tấn công hay cấy `.htaccess` trong `wp-content/uploads/` chứa `Require all granted`, `FilesMatch` hoặc `SetHandler` để kích hoạt quyền thực thi PHP vượt rào cản Nginx/LiteSpeed.
- **Lệnh kiểm tra & dọn dẹp**:
  ```bash
  find /home/*/htdocs/*/wp-content/uploads/ -name '.htaccess' -exec grep -lE 'Require all granted|FilesMatch|auto_prepend_file' {} \; | xargs rm -f
  ```

### 2. Rà soát Server Logs & Access Logs Fleet
- **Server Authentication Log**: Check `/var/log/auth.log` để phát hiện SSH Brute force.
- **Fleet Access Log (Nginx/Apache)**: Quét POST request vào các đường dẫn PHP bất thường trong `wp-content/`:
  ```bash
  zgrep -hE 'POST .*/wp-content/.*\.php' /home/*/logs/nginx/access.log* 2>/dev/null
  ```
- **Hành động khi phát hiện IP Attacker**: Khóa ngay lập tức qua Firewall:
  ```bash
  ufw insert 1 deny from <ATTACKER_IP> to any comment 'Block Attacker IP'
  ```
