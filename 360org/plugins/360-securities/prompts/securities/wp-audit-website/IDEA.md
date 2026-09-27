# Ý tưởng phát triển: Kỹ năng Audit và Hardening WordPress (wp-audit-website)

## 1. Bối cảnh & Vấn đề
Hệ sinh thái website WordPress của 360 CORP và các đối tác (vanchuyen247.net, esvt.edu.vn, hailuugroup...) chạy trên nền tảng CloudPanel thường xuyên đối mặt với các đợt tấn công khai thác lỗ hổng plugin/theme (điển hình như chiến dịch mã độc tái nhiễm Wpanel / GreenMamba cuối tháng 07/2026).

**Vấn đề gặp phải**:
*   Tin tặc sử dụng nhiều lớp persistence (cấy backdoor vào file functions.php của theme Avada, tự động tạo tài khoản quản trị ẩn `wphiddenbot`, cài cấy mu-plugins độc hại).
*   Mã độc tự nhân bản giả dạng các file PHP hệ thống ra ngoài thư mục log (`/logs/`), tmp (`/tmp/`), logs của PHP-FPM, v.v.
*   Cài cấy cấu hình `.htaccess` độc hại để chặn thực thi file PHP thường và chỉ cho phép thực thi webshell, tạo các thư mục ngụy trang như `image` tại root chứa mã độc.
*   Dev tốn nhiều thời gian xử lý thủ công, dễ bỏ sót lỗ hổng hoặc xóa nhầm tệp tin hệ thống.

---

## 2. Giải pháp Ý tưởng
Xây dựng một bộ skill chuẩn hóa chuyên biệt để kiểm tra (Audit) và gia cố (Harden) bảo mật WordPress trên nền tảng CloudPanel:
1.  **Chỉ kiểm tra, không tự ý sửa đổi (Read-only Audit)**: Toàn bộ quá trình quét bằng script `audit.sh` chỉ ghi nhận báo cáo vào vùng tạm `/audit-work/` trên server và tải về `/Volumes/DATA/WORDPRESS/` của iMac, tuyệt đối không sửa đổi mã nguồn khi chưa được Sếp đồng ý.
2.  **Quét diện rộng và khoanh vùng IOC**: Kiểm tra toàn diện từ checksum của Core/Plugins WordPress.org, sự xuất hiện của file PHP trong uploads, cấu trúc thư mục lạ (`image` ở root), file `.htaccess` trong logs, và tài khoản quản trị mới tạo bất thường.
3.  **Gia cố bảo mật tự động (Harden Playbook)**: Sau khi được duyệt, chạy `harden.sh` để khóa chặt cấu hình bảo mật thông qua AIOWPS, vô hiệu hóa việc quét XML-RPC, loại bỏ các file default lộ phiên bản (`readme.html`, `license.txt`), quarantine các file default themes `twenty*` không sử dụng.
4.  **Dọn dẹp rác tuyệt đối**: Sau khi hoàn tất và tải logs về máy Sếp, script tự động xóa sạch thư mục làm việc `/audit-work` trên server để giữ môi trường sản xuất sạch sẽ.
