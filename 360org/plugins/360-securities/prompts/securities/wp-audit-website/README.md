# Hướng dẫn Kiểm tra và Triển khai WordPress (README.md)

Bộ skill hỗ trợ Sếp Châu và 360 CORP tự động hóa việc quét, dọn dẹp malware và bảo mật hệ thống WordPress trên máy chủ CloudPanel.

---

## 🛠️ Quy trình Quét và Hardening chuẩn 6 bước

### Bước 1: Kiểm tra kết nối nhanh (Triage)
```bash
curl -sS -o /dev/null -w "HTTP %{http_code} %{time_total}s\n" -L --max-time 25 https://<domain>/
```

### Bước 2: Thực hiện quét Read-Only (Audit)
Đẩy script `audit.sh` lên và chạy phân tích site:
```bash
scp /Volumes/DATA/DEV/SKILLS/wp-audit-website/scripts/audit.sh cloudpanel:/tmp/
ssh cloudpanel 'bash /tmp/audit.sh <domain>; rm -f /tmp/audit.sh'
```

### Bước 3: Đồng bộ logs về máy iMac local của Sếp
Tải báo cáo quét về máy iMac của Sếp để lưu trữ và phân tích sâu:
```bash
rsync -avz cloudpanel:/audit-work/ /Volumes/DATA/WORDPRESS/
```

### Bước 4: Dọn dẹp không gian tạm trên Server
Xóa bỏ thư mục làm việc tạm thời trên máy chủ để đảm bảo an toàn:
```bash
ssh cloudpanel 'rm -rf /audit-work/'
```

### Bước 5: Đưa ra phán quyết và Xử lý (Harden)
Khi Sếp đã phê duyệt phương án xử lý, chạy script gia cố và dọn dẹp các tệp mặc định:
```bash
scp /Volumes/DATA/DEV/SKILLS/wp-audit-website/scripts/harden.sh cloudpanel:/tmp/
ssh cloudpanel 'bash /tmp/harden.sh <domain>; rm -f /tmp/harden.sh'
```

### Bước 6: Dọn dẹp theme mặc định `twenty*` không dùng
```bash
scp /Volumes/DATA/DEV/SKILLS/wp-audit-website/scripts/remove-default-themes.sh cloudpanel:/tmp/
ssh cloudpanel 'bash /tmp/remove-default-themes.sh; rm -f /tmp/remove-default-themes.sh'
```
