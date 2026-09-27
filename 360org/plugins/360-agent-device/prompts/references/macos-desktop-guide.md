# Hướng Dẫn Kiểm Thử App Desktop macOS Native (macOS Desktop Guide)

> Áp dụng cho các ứng dụng macOS: VuaOffice (Electron), V-Assistant (Tauri), Native macOS App.

---

## 1. Cơ Chế Hoạt Động Trên macOS

`agent-device` sử dụng macOS Accessibility API để giao tiếp trực tiếp với cửa sổ app mà không cần can thiệp mã nguồn:
- Tự động bắt tọa độ cửa sổ window-space.
- Trích xuất menu bar, status item, dialog modal, context menu.
- Hỗ trợ click chuột trái, chuột phải (secondary click), double click, hotkey bàn phím.

---

## 2. Quy Trình Vận Hành

### Bước 1: Mở app macOS
```bash
# Mở app theo tên trong /Applications
agent-device open "V Assistant" --platform macos

# Hoặc mở theo bundle ID
agent-device open com.vuaoffice.desktop --platform macos
```

### Bước 2: Quét giao diện & thao tác
```bash
# Lấy snapshot tương tác
agent-device snapshot -i --platform macos

# Bấm chuột trái
agent-device press @e10 --settle

# Bấm chuột phải (mở Context Menu)
agent-device click @e10 --button secondary --platform macos
agent-device snapshot -i --platform macos
agent-device press @e15 --settle  # Bấm vào item trong menu ngữ cảnh

# Nhập văn bản
agent-device fill @e20 "Nội dung tìm kiếm" --settle
```

### Bước 3: Menu Bar Extras & Tương Tác Thanh Tiêu Đề
Đối với các app chạy nền trên thanh menu (menu bar apps như V-Assistant Status Bar):
```bash
agent-device open "V Assistant" --platform macos --surface menubar
agent-device snapshot -i --platform macos
```

### Bước 4: Chụp ảnh bằng chứng
```bash
agent-device screenshot /Volumes/DATA/DEV/vuaoffice/reports/macos_desktop_test.png
agent-device close
```
