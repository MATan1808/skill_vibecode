# Đặc tả Kỹ thuật (SPEC.md)

## 1. Các thành phần Script thực thi
*   `scripts/audit.sh`: Thực hiện quét chi tiết cho 1 tên miền (domain) cụ thể.
*   `scripts/audit-storage.sh`: Quét và phân tích dung lượng ổ đĩa của toàn bộ fleet WordPress.
*   `scripts/audit-ioc-fleet.sh`: Quét nhanh các chỉ số chỉ điểm mã độc (IOC) trên toàn bộ tài khoản user của server.
*   `scripts/scan-server-wide.sh`: Script quét rộng toàn bộ hệ thống file PHP trên CloudPanel.
*   `scripts/harden.sh`: Áp dụng các quy tắc gia cố bảo mật và dọn dẹp file thông tin WordPress mặc định.
*   `scripts/remove-default-themes.sh`: Tìm kiếm, backup và loại bỏ các theme mặc định `twenty*`.
*   `scripts/cleanup-macosx-license-readme.sh`: Script dọn dẹp các tệp `readme.html` và `license.txt` diện rộng từ iMac local hoặc server.

---

## 2. Đặc tả Logic Xử lý Phát hiện & Cách ly (Quarantine Logic)
1.  **Quét Checksum**: Sử dụng WP-CLI để đối chiếu hash core/plugin từ WordPress.org:
    ```bash
    wp core verify-checksums
    wp plugin verify-checksums --all
    ```
2.  **Phát hiện cấu trúc bất thường**:
    *   Sử dụng lệnh `find` để phát hiện file PHP trong thư mục uploads:
        ```bash
        find "$DOCROOT/wp-content/uploads" -type f -name "*.php"
        ```
    *   Phát hiện thư mục `image` ở root:
        ```bash
        if [ -d "$DOCROOT/image" ]; then echo "WARNING: Rogue 'image' directory found!"; fi
        ```
3.  **Khử trùng & Khôi phục (Cleanup & Restoration)**:
    *   Khi phát hiện persistent backdoor trong theme Avada (`WPANEL:BEGIN`):
        *   Tạo bản backup nén của thư mục Avada hiện tại.
        *   Xóa sạch thư mục `wp-content/themes/Avada` và 4 plugin đi kèm (`fusion-core`, `fusion-builder`, `fusion-white-label-branding`, `revslider`).
        *   Sao chép nguồn sạch chuẩn từ website `vuahethong.com` sang.
        *   Chạy cập nhật database: `wp core update-db`.
        *   Cập nhật lại quyền sở hữu (owner) và quyền ghi (permission) tương ứng với user hệ thống.
4.  **Xóa bỏ file thông tin mặc định**:
    *   Tự động tìm kiếm và xóa vật lý các file: `readme.html`, `license.txt`, `licencia.txt` tại thư mục root và `wp-includes/`.

---

## 3. Đặc tả Đường dẫn và Dọn dẹp (Storage Spec)
*   **Vùng làm việc tạm trên CloudPanel**: `/audit-work/`
*   **Vùng lưu trữ logs & backup trên iMac**: `/Volumes/DATA/WORDPRESS/`
*   **Quy trình dọn dẹp**: Sau khi kết thúc quá trình đồng bộ logs qua rsync/scp, script gọi lệnh `rm -rf /audit-work` để đảm bảo sạch sẽ hoàn toàn hệ thống file.
