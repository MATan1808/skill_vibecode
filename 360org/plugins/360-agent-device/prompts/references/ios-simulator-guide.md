# Hướng Dẫn Kiểm Thử Trên iOS Simulator (iOS Simulator Guide)

> Áp dụng cho các dự án mobile Flutter (`vcloud`), Swift, React Native và Web Safari trên iOS Simulator.

---

## 1. Yêu Cầu & Kiểm Tra Môi Trường

1. **Kiểm tra Xcode Developer Tools**:
   ```bash
   xcode-select -p
   xcrun simctl list devices available
   ```
2. **Khởi động Simulator**:
   ```bash
   # Mở Simulator GUI
   open -a Simulator
   
   # Hoặc boot trực tiếp một thiết bị
   xcrun simctl boot "iPhone 16 Pro"
   ```

---

## 2. Quy Trình Vận Hành Với Agent-Device

```bash
# 1. Cài đặt app vào simulator (nếu chưa cài)
xcrun simctl install booted /path/to/App.app

# 2. Mở app qua agent-device
agent-device open com.360org.vcloud --platform ios --foreground

# 3. Quét phần tử & thực thi kịch bản
agent-device snapshot -i
agent-device press @e5 --settle
agent-device fill @e6 "User Test" --settle

# 4. Thu thập bằng chứng
agent-device screenshot /Volumes/DATA/DEV/vcloud/reports/ios_test_evidence.png

# 5. Đóng app
agent-device close
```

---

## 3. Các Lệnh Hỗ Trợ Chuyên Sâu

- **Đổi hướng màn hình (Rotate)**:
  ```bash
  agent-device rotate landscape
  ```
- **Xử lý Permission Dialog (Alert)**:
  ```bash
  # Tự động đồng ý quyền thông báo/camera
  agent-device alert accept
  ```
- **Mở Deep Link / URL**:
  ```bash
  agent-device open-url "vcloud://app/orders/12345"
  ```
- **Xem log hệ thống iOS (Syslog)**:
  ```bash
  agent-device logs --filter "vcloud" --lines 50
  ```
