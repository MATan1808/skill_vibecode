# Nhật ký Thay đổi (CHANGELOGS.md)

Tất cả các cập nhật và thay đổi của bộ công cụ `wp-audit-website` được lưu trữ tại đây.

---

## [1.3.0] - 2026-08-13

### Thêm mới (Added)
*   Thêm scanner production chuẩn `scripts/wp-malware-scan.sh` vào AIaC để server không drift khỏi skill.
*   Thêm điều kiện phân loại `.htaccess` trong uploads: giữ file deny-only do WPForms/Contact Form 7 sinh ra; chỉ xoá file có directive mở quyền hoặc bật PHP/handler/prepend.
*   Mở rộng cleanup file fingerprint WordPress: `readme.html`, `license.txt`, `licencia.txt` ở docroot, `wp-admin/`, `wp-includes/`, `wp-includes/ID3/license.txt`.

### Sửa đổi (Changed)
*   Không xoá `license.txt` trong plugin/theme/vendor nếu không có IOC riêng, để tránh làm checksum plugin/theme lệch.

---

## [1.2.0] - 2026-08-07

### Thêm mới (Added)
*   Thêm quy tắc phát hiện cấu trúc `.htaccess` độc hại giả mạo cấy trong thư mục logs hệ thống của user (`/home/<user>/logs/`).
*   Thêm quy tắc phát hiện các file PHP độc hại nhân bản giả danh core WordPress ngoài thư mục docroot (như trong `/home/<user>/backups/`, `/home/<user>/tmp/`).
*   Thêm quy tắc phát hiện và cô lập thư mục ngụy trang bất hợp pháp `image/` nằm tại root website.
*   Bổ sung đầy đủ bộ 7 tài liệu chuẩn hóa 8 bước phát triển: `IDEA.md`, `REQUIREMENTS.md`, `SPEC.md`, `ARCH.md`, `README.md`, `DEPLOY_GUIDE.md` và `CHANGELOGS.md`.

### Sửa đổi (Changed)
*   Tối ưu hóa script `harden.sh` để tự động hóa việc xóa sạch các file `readme.html` và `license.txt` trên toàn fleet site WordPress.

---

## [1.1.0] - 2026-07-31

### Thêm mới (Added)
*   Tích hợp bộ chỉ điểm (IOC) của chiến dịch mã độc Wpanel / GreenMamba.
*   Thêm script `remove-default-themes.sh` tự động quarantine và xóa bỏ các theme default `twenty*` không sử dụng.
*   Thêm hướng dẫn chi tiết quy trình đè theme Avada sạch từ nguồn chuẩn `vuahethong.com` và update database bằng WP-CLI.

---

## [1.0.0] - 2026-07-15

### Thêm mới (Added)
*   Phát hành phiên bản đầu tiên của skill `wp-audit-website`.
*   Tạo script `audit.sh` thực thi quét các tệp tin PHP độc hại, OOM memory, lỗi core/plugin checksum.
*   Tạo script `harden.sh` gia cố bảo mật site và cấu hình lại AIOWPS lock down.
