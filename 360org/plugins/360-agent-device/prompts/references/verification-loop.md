# Quy Trình Vòng Lặp Kiểm Thử Ứng Dụng (Verification Loop Reference)

> Tài liệu hướng dẫn Agent thực hiện chu trình kiểm thử tự động trên app thật, trích xuất mã ref tương tác và lưu vết bằng chứng.

---

## 1. Chu Trình 5 Bước Hoàn Chỉnh

### Bước 1: Khởi động Ứng dụng & Bật Foreground
```bash
# Đối với iOS
agent-device open com.example.vcloud --platform ios --foreground

# Đối với Android
agent-device open com.example.vcloud --platform android --foreground

# Đối với macOS Native
agent-device open "V Assistant" --platform macos
```
*Lưu ý: Cờ `--foreground` đảm bảo app được kích hoạt lên màn hình chính và trả về snapshot ban đầu.*

### Bước 2: Quét phần tử tương tác (Accessibility Snapshot)
```bash
agent-device snapshot -i
```
Kết quả trả về danh sách các node có thể tương tác:
```text
@e1 [button] "Đăng nhập"
@e2 [text-field] "Tên đăng nhập hoặc Email"
@e3 [text-field] "Mật khẩu"
@e4 [link] "Quên mật khẩu?"
```

### Bước 3: Tương tác & Nhận Diff Trạng Thái
Khi nhập liệu hoặc bấm nút, luôn truyền cờ `--settle`:
```bash
# Điền email
agent-device fill @e2 "admin@360.org.vn" --settle

# Điền mật khẩu
agent-device fill @e3 "MatKhauBaoMat123!" --settle

# Bấm nút đăng nhập
agent-device press @e1 --settle
```
Sau khi bấm, giao diện tự động in ra diff trạng thái:
```text
- @e1 [button] "Đăng nhập"
+ @e10 [text] "Chào mừng Sếp Châu trở lại"
+ @e11 [button] "Vào bảng điều khiển"
```
Agent đọc trực tiếp mã `@e11` từ diff để tiếp tục tương tác mà không cần gọi lại lệnh `snapshot`.

### Bước 4: Cuộn thông minh tìm kiếm phần tử ngoài màn hình
Tuyệt đối không chạy vòng lặp `scroll down` lặp đi lặp lại nhiều lần. Dùng cú pháp tìm kiếm 1 lệnh:
```bash
agent-device scroll down --until "Cài đặt nâng cao"
# Hoặc cuộn thẳng xuống đáy
agent-device scroll bottom
```

### Bước 5: Chụp Bằng Chứng & Kết Thúc Phiên
```bash
# Chụp ảnh bằng chứng
agent-device screenshot /Volumes/DATA/DEV/vcloud/reports/evidence_login_success.png

# Đóng phiên làm việc an toàn
agent-device close
```

---

## 2. Xử Lý Khi Gặp Lỗi / Sự Cố

1. **Snapshot báo `sparse/AX-unavailable`**:
   - Khi cây Accessibility bị thiếu (thường gặp ở custom canvas hoặc game), chụp ảnh màn hình để xác định toạ độ:
     ```bash
     agent-device screenshot /tmp/inspect.png
     agent-device click 150 320
     ```
2. **Nút bị đè / Animated**:
   - Tăng thời gian chờ settle nếu animation chuyển cảnh lâu:
     ```bash
     agent-device press @e1 --settle 2000
     ```
3. **Assert kiểm tra trạng thái**:
   ```bash
   agent-device wait text "Bảng điều khiển" --timeout 5000
   ```
