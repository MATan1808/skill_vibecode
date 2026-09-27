# Kiến trúc và Luồng dữ liệu (ARCH.md)

## 1. Sơ đồ Luồng Hoạt động (Audit & Hardening Pipeline)

```mermaid
graph TD
    A[Bắt đầu Audit site] -->|SCP scripts/audit.sh| B(CloudPanel Server)
    B -->|Thực thi audit.sh| C[Tạo thư mục làm việc /audit-work/]
    C -->|Quét & Ghi logs| D[Báo cáo trung gian tại /audit-work/]
    D -->|SCP/rsync logs về iMac| E[Thư mục local /Volumes/DATA/WORDPRESS/]
    E -->|Xác nhận logs an toàn| F[Xóa sạch /audit-work/ trên Server]
    
    F -->|Nếu phát hiện mã độc| G[Yêu cầu Sếp duyệt phương án xử lý]
    G -->|Sếp đồng ý| H[Chạy harden.sh / dọn dẹp Avada / xóa user fake]
    H -->|Xóa file default| I[Xóa readme.html, license.txt]
    I -->|Cách ly theme| J[Xóa twenty* default themes]
    J -->|Cập nhật DB| K[wp core update-db & chown/chmod]
```

---

## 2. Mô hình An toàn & Phân quyền (Security & Privilege Model)
*   **User thực thi**: Các script quét và WP-CLI phải được chạy dưới quyền của chính **user sở hữu website** (ví dụ: `sudo -u vanchuyen247 wp ...`), tuyệt đối không chạy bằng user `root` để tránh sinh ra các file có owner sai lệch khiến website bị lỗi Permission 500.
*   **Khóa cứng thuộc tính hệ thống**: Sử dụng lệnh `chattr +i` (sau khi khôi phục code sạch) cho các file cấu hình cốt lõi như `.htaccess`, `wp-config.php` để ngăn chặn malware tự ghi đè cấu hình, và mở khóa bằng `chattr -i` khi cần bảo trì/nâng cấp.
