# Hướng Dẫn Kiểm Thử Trên Android Emulator (Android Emulator Guide)

> Áp dụng cho các ứng dụng Flutter (`vcloud`), Android Native, React Native trên Android Virtual Device (AVD) hoặc thiết bị Android vật lý cắm qua ADB.

---

## 1. Yêu Cầu & Kiểm Tra Môi Trường

1. **Kiểm tra Android SDK & ADB**:
   ```bash
   adb devices
   emulator -list-avds
   ```
2. **Khởi động Android Emulator**:
   ```bash
   emulator -avd Pixel_7_API_34 -netdelay none -netspeed full &
   adb wait-for-device
   ```

---

## 2. Quy Trình Vận Hành Với Agent-Device

```bash
# 1. Mở app qua package id
agent-device open vn.vcloud.mobile --platform android --foreground

# 2. Quét cây Accessibility tương tác
agent-device snapshot -i

# 3. Tương tác UI
agent-device fill @e3 "admin" --settle
agent-device fill @e4 "123456" --settle
agent-device press @e5 --settle

# 4. Phím chức năng Android Native
agent-device back --settle
agent-device home

# 5. Lưu bằng chứng
agent-device screenshot /Volumes/DATA/DEV/vcloud/reports/android_test_evidence.png
agent-device close
```

---

## 3. Các Lệnh Tiện Ích ADB Nhanh

- **Gửi phím phần cứng**:
  ```bash
  agent-device keycode KEYCODE_ENTER
  agent-device keycode KEYCODE_BACK
  ```
- **Xoá dữ liệu app (Clear Data) để test lại từ đầu**:
  ```bash
  adb shell pm clear vn.vcloud.mobile
  ```
- **Xem logcat**:
  ```bash
  agent-device logs --filter "Flutter" --lines 100
  ```
