# Nhật ký thay đổi — wp-dev-skills

## [1.3.0] - 2026-08-12

### Thêm mới

- Chuẩn hoá thành `wp-dev-skills`, chứa trực tiếp trong repo AIaC.
- Bổ sung bài học production từ `apds-vn.com` và `namtienmc.com`: muốn hết tái nhiễm phải tìm cửa vào, không chỉ xoá `wp-site-health-monitor-*`.
- Thêm IOC fake-plugin/webshell:
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
- Thêm hardening bắt buộc: chặn REST batch, XML-RPC, PHP trực tiếp dưới `wp-content`, bật `DISALLOW_FILE_MODS`, khoá ghi plugins/themes sau cleanup.

## [1.2.0] - 2026-08-07

- Thêm quy tắc phát hiện `.htaccess` độc hại trong thư mục logs.
- Thêm quy tắc phát hiện file PHP độc hại ngoài docroot.
- Thêm quy tắc cô lập thư mục `image/` bất thường tại root website.
- Bổ sung 7 tài liệu chuẩn hóa workflow.

## [1.1.0] - 2026-07-31

- Tích hợp IOC Wpanel / GreenMamba.
- Thêm xử lý theme default `twenty*` không sử dụng.
- Thêm quy trình thay Avada sạch từ nguồn chuẩn.

## [1.0.0] - 2026-07-15

- Phát hành skill audit/hardening WordPress CloudPanel đầu tiên.
