---
name: 360-desktop-reverse
description: "Kỹ năng phân tích, giải nén và dịch ngược cấu trúc desktop apps (Electron asar, Tauri binary, macOS .app bundle, Mach-O, thick client) an toàn theo chuẩn AIaC để học hỏi, tái hiện tính năng hoặc audit kiến trúc."
---

# Kỹ năng Dịch Ngược & Tái Hiện Tính Năng Desktop App (360-desktop-reverse)

## 1. Nguyên tắc Kích Hoạt & Phạm Vi (Trigger Condition)
Khi Sếp gửi đường dẫn ứng dụng máy tính (ví dụ: `/Applications/GenMail.app`, `/Applications/[Target].app` hoặc file cài `.dmg`, `.pkg`, `.asar`) kèm yêu cầu:
- **"học từ [App]"**, **"dịch ngược [App]"**, **"xem code/logic [App]"**
- **"viết lại tính năng abc, xyz tương tự như [App]"**

Agent **BẮT BUỘC** tự động áp dụng quy trình Reverse Engineering (dịch ngược) để bóc tách mã nguồn, trích xuất data models, API schema, IPC events và logic xử lý cốt lõi, sau đó chuyển đổi thành thiết kế chuẩn để viết lại sang dự án của Sếp.

## 2. Quy trình 4 Bước Chuẩn (Reverse -> Learn -> Spec -> Re-implement)

### Bước 1 — Khảo Sát & Nhận Diện Cấu Trúc Gói Bundle (Triage)
```bash
# 1. Kiểm tra loại ứng dụng và Info.plist
plutil -p "/Applications/[Target].app/Contents/Info.plist" | grep -E "CFBundleIdentifier|CFBundleName|CFBundleExecutable"

# 2. Kiểm tra gói Electron asar (nếu là Electron App)
ls -la "/Applications/[Target].app/Contents/Resources/"
```

### Bước 2 — Trích Xuất & Giải Nén Tài Nguyên Mã Nguồn (Extract & Decompile)
- **Nếu là Electron App (GenMail, Slack, VS Code, Discord...)**:
  ```bash
  # Giải nén toàn bộ mã nguồn JS/HTML/CSS từ file app.asar
  npx asar extract "/Applications/[Target].app/Contents/Resources/app.asar" "./reverse_analysis/[Target]_src"
  ```
- **Nếu là Tauri / Rust App**:
  - Phân tích resource frontend bundle tại thư mục Resources/assets.
  - Phân tích binary native Mach-O bằng `nm`, `otool`, `strings`.
- **Nếu là macOS Native (.app / Mach-O / Objective-C / Swift)**:
  ```bash
  # Kiểm tra dylib & Frameworks liên kết
  otool -L "/Applications/[Target].app/Contents/MacOS/[BinaryName]"
  # Trích xuất strings, endpoints, class names
  strings "/Applications/[Target].app/Contents/MacOS/[BinaryName]" | grep -E "https?://|api|auth"
  ```

### Bước 3 — Học & Trích Xuất Logic Tính Năng Cần Viết Lại (Deep Logic Extraction)
1. **Tìm kiếm các điểm chạm (Entrypoints) của tính năng Sếp yêu cầu**:
   - Grep từ khóa tính năng trong thư mục mã nguồn đã giải nén:
     ```bash
     grep -rn -i "feature_keyword" ./reverse_analysis/[Target]_src/
     ```
2. **Bóc tách 4 thành phần then chốt**:
   - **Data Models / State**: Cấu trúc dữ liệu, Redux/Zustand store, local SQLite schema.
   - **IPC Communication**: Các kênh gửi nhận sự kiện (`ipcRenderer.send`, `ipcRenderer.invoke`, `ipcMain.handle`).
   - **Network & API**: Headers, format request/response, token auth flow.
   - **Business Logic / Algorithms**: Hàm xử lý, parser, transformer dữ liệu.

### Bước 4 — Tổng Hợp Báo Cáo & Viết Lại (Re-implementation Cleanroom)
- Ghi nhận tài liệu phân tích và kế hoạch triển khai:
  - `docs/SPEC.md`: Đặc tả Data models và API contracts học được từ app gốc.
  - `docs/ARCH.md`: Sơ đồ luồng dữ liệu và thiết kế module mới.
- Áp dụng nguyên tắc **Ponytail** (Tối giản, YAGNI, native, zero-redundancy) để viết lại tính năng hoàn toàn sạch, hiện đại và chuẩn xác vào dự án hiện tại của Sếp.
