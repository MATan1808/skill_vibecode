---
name: 360-agent-device
description: "Quy chuẩn điều khiển, tự động hoá và kiểm thử ứng dụng trên thiết bị thực tế (iOS Simulator, Android Emulator, macOS Desktop, Physical Devices) cho AI Agent bằng agent-device. Kích hoạt khi cần khởi chạy app, kiểm tra UI sống, click/tap, nhập liệu, cuộn trang, trích xuất accessibility tree (@refs), thu thập bằng chứng screenshot/video và xác minh tính năng (verification loop)."
author: 360 CORP (Sếp Châu)
version: 1.0.0
triggers:
  - "agent-device"
  - "device test"
  - "test trên simulator"
  - "test trên emulator"
  - "test trên device"
  - "ios simulator"
  - "android emulator"
  - "mobile test"
  - "app automation"
  - "kiểm thử device"
  - "chạy app trên device"
  - "dùng device test"
---

# 360-Agent-Device: Bộ Công Cụ Tự Động Hoá & Kiểm Thử Thiết Bị Cho AI Agent

> **Triết lý Cốt lõi**: *"Code is only done when verified on a running device."*
> - Không suy diễn hay đoán mò kết quả kiểm thử qua việc đọc code đơn lẻ.
> - Agent phải trực tiếp tương tác với app sống trên thiết bị (iOS Simulator, Android Emulator, macOS Desktop App) bằng vòng lặp phản hồi trực tiếp (**Live App Feedback Loop**).
> - Ưu tiên đọc cây trợ năng (**Accessibility Snapshot `@refs`**) siêu tiết kiệm token thay vì phân tích ảnh chụp màn hình thuần túy.

---

## 1. Vòng Lặp Kiểm Thử 4 Bước Chuẩn Của Agent (The Live Verification Loop)

```
[1. KHỞI CHẠY APP]  agent-device open <app> --platform <ios|android|macos> --foreground
       │
       ▼
[2. QUÉT GIAO DIỆN] agent-device snapshot -i  ➔ Trả về các toạ độ ref: @e1, @e2...
       │
       ▼
[3. TƯƠNG TÁC UI]   agent-device press @e1 --settle
                    agent-device fill @e2 "Nội dung" --settle
                    agent-device scroll down --until <selector>
       │
       ▼
[4. XÁC MINH & BẰNG CHỨNG]
                    agent-device assert visible "Thành công"
                    agent-device screenshot /Volumes/DATA/.../evidence.png
                    agent-device close
```

---

## 2. Bảng Tra Cứu Lệnh Nhanh (CLI Cheat Sheet)

| Lệnh / Thao tác | Cú pháp thực thi | Mục đích sử dụng |
|---|---|---|
| **Kiểm tra môi trường** | `agent-device doctor` | Kiểm tra trạng thái kết nối thiết bị, emulator, simulator |
| **Liệt kê thiết bị** | `agent-device devices` | Quét danh sách simulator / emulator / physical devices đang mở |
| **Mở app iOS** | `agent-device open <bundle-id> --platform ios --foreground` | Mở ứng dụng trên iOS Simulator và lấy snapshot ban đầu |
| **Mở app Android** | `agent-device open <package-id> --platform android --foreground` | Mở ứng dụng trên Android Emulator và lấy snapshot ban đầu |
| **Mở app macOS** | `agent-device open <App-Name> --platform macos` | Mở và gắn session vào app desktop macOS native |
| **Chụp cây Accessibility** | `agent-device snapshot -i` | Trích xuất các element tương tác kèm mã ref (`@e1`, `@e2`...) |
| **Nhấp / Chạm nút** | `agent-device press @ref --settle` | Tap/Click vào phần tử và chờ giao diện ổn định |
| **Nhập văn bản** | `agent-device fill @ref "Văn bản" --settle` | Điền dữ liệu vào ô input text field |
| **Cuộn tới phần tử** | `agent-device scroll down --until <selector>` | Cuộn thông minh 1 lệnh tới khi phần tử xuất hiện |
| **Chụp ảnh bằng chứng** | `agent-device screenshot <duong_dan_tuyet_doi.png>` | Lưu ảnh chụp màn hình làm evidence bàn giao cho Sếp |
| **Quay video luồng test** | `agent-device record start <file.mp4>` / `stop` | Quay video quá trình thực thi test |
| **Đóng phiên làm việc** | `agent-device close` | Giải phóng phiên làm việc và đóng app an toàn |

---

## 3. 4 Nguyên Tắc Vàng Khi Agent Dùng Thiết Bị Kiểm Thử

### Nguyên tắc 1: Bắt đầu tức thì, không thăm dò thừa thãi
- Khi nhận nhiệm vụ test app, bắt đầu ngay bằng `agent-device open <app> --foreground`.
- **Tuyệt đối KHÔNG** chạy các lệnh thăm dò tốn turn như `--help`, `--version`, `devices`, `appstate` trừ khi gặp lỗi kết nối.

### Nguyên tắc 2: Token-Efficient Accessibility Snapshot (Tiết kiệm Token)
- Thay vì chụp ảnh screenshot độ phân giải cao gửi vào context làm tiêu tốn hàng nghìn token thị giác, `agent-device` chuyển đổi giao diện thành cây Text Accessibility:
  ```text
  @e1 [button] "Đăng nhập"
  @e2 [text-field] "Số điện thoại"
  @e3 [checkbox] "Ghi nhớ đăng nhập"
  ```
- Agent chỉ cần gọi `agent-device press @e1 --settle` theo đúng mã ref `@e1`.
- Chỉ chụp `screenshot` khi cần lưu bằng chứng bàn giao báo cáo cho Sếp hoặc khi app không hỗ trợ Accessibility.

### Nguyên tắc 3: Tận dụng Diff tự động từ cờ `--settle`
- Sau khi gõ lệnh có cờ `--settle`, `agent-device` tự động in ra phần thay đổi (Diff):
  ```text
  - @e2 [text-field] "Số điện thoại"
  + @e2 [text-field] "0988123456"
  + @e10 [text] "Mã xác thực OTP đã được gửi"
  ```
- Agent tiếp tục tương tác ngay từ mã ref trong Diff mà không cần phải gõ lại lệnh `snapshot -i`.

### Nguyên tắc 4: Bằng chứng tuyệt đối (Evidence-First Reporting)
- Mọi nhiệm vụ kiểm thử ứng dụng mobile (Flutter, VCloud, iOS, Android) hoặc macOS Native (V-Assistant, Electron VuaOffice) **BẮT BUỘC** phải để lại bằng chứng:
  1. Exit code = 0 của chuỗi test.
  2. File ảnh screenshot minh chứng lưu tại đường dẫn tuyệt đối đầy đủ.
  3. Báo cáo ngắn gọn các case đã test theo quy chuẩn 10 case kiểm thử của AIaC.

---

## 4. Tài Liệu Hướng Dẫn Chuyên Sâu (References)

- [Quy trình Vòng lặp Kiểm thử Tự động](references/verification-loop.md)
- [Hướng dẫn Kiểm thử trên iOS Simulator](references/ios-simulator-guide.md)
- [Hướng dẫn Kiểm thử trên Android Emulator](references/android-emulator-guide.md)
- [Hướng dẫn Kiểm thử App Desktop macOS Native](references/macos-desktop-guide.md)
- [Export kịch bản Replay .ad & Maestro CI/CD](references/maestro-and-scripting.md)
