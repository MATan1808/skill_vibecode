# Yêu cầu Chi tiết (REQUIREMENTS.md)

## 1. Yêu cầu Chức năng (Functional Requirements)
*   **R-1**: Hỗ trợ phân tích trạng thái hoạt động nhanh (HTTP Status Code, Tốc độ phản hồi, Tình trạng PHP-FPM/Nginx).
*   **R-2**: Quét phát hiện thay đổi hoặc tệp lỗi trong Core và Plugins của WordPress bằng WP-CLI (`verify-checksums`).
*   **R-3**: Quét phát hiện tệp tin PHP thực thi trái phép trong thư mục `wp-content/uploads/` (ngoại trừ các whitelist đã xác định của plugin backup/cấu hình).
*   **R-4**: Kiểm tra phát hiện các thư mục độc hại ngụy trang như thư mục `image/` hoặc `images/` nằm ngay tại root của website.
*   **R-5**: Quét phát hiện các file cấu hình `.htaccess` độc hại (chứa whitelist webshell, cấy trong thư mục theme, cấy bất thường trong thư mục logs hệ thống của user).
*   **R-6**: Quét phát hiện tài khoản admin mới tạo bất thường (chứa pattern như `w2s_`, `wp2_`, `wphiddenbot`, `cron_service`...) hoặc email domain bất hợp pháp.
*   **R-7**: Hỗ trợ tự động xóa bỏ các file info mặc định của WordPress (`readme.html`, `license.txt`, `licencia.txt`).
*   **R-8**: Tự động dọn dẹp các theme mặc định `twenty*` không sử dụng (sau khi backup vào thư mục incident).
*   **R-9**: Chỉ lưu vết quét tạm thời vào `/audit-work/` trên server và bắt buộc xóa bỏ vật lý thư mục này sau khi đồng bộ về `/Volumes/DATA/WORDPRESS/` trên iMac.

## 2. Yêu cầu Phi chức năng (Non-Functional Requirements)
*   **N-1: An toàn (Safety)**: Quá trình audit không được làm gián đoạn dịch vụ của website (Zero Downtime).
*   **N-2: Bảo mật (Security)**: Kết quả logs quét chứa nhiều thông tin nhạy cảm của khách hàng, tuyệt đối không được đẩy lên các kênh lưu trữ công khai.
*   **N-3: Hiệu năng (Performance)**: Script quét tối ưu hóa tài nguyên CPU/RAM, tránh gây OOM trên các VPS có cấu hình thấp.
*   **N-4: Quy chuẩn xưng hô (Neo Persona)**: Hệ thống log và Claude phản hồi phải xưng "em", gọi "Sếp" hoặc "anh".
