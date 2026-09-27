---
name: 360-desktop-app
description: |
  Bộ kỹ năng & quy chuẩn kiến trúc chuẩn hóa phát triển ứng dụng Desktop App (Electron & Tauri v2) của hệ sinh thái 360org.
  Bao gồm hai module nền tảng đồng nhất:
  1. electron/ (VuaOffice & Electron Suite): Cấu trúc 17 modules, IPC channels, whitelabel branding, security baseline, electron-builder artifacts naming (.dmg, .exe, .deb, .AppImage) & release tag protocol.
  2. tauri/ (V-Assistant & Tauri Rust Apps): Cấu trúc 18 modules (Rust Core, Commands, Events, State, IPC, Plugins, Permissions, Capabilities ACL, Filesystem, Window, Tray, Security, Sidecar, Updater, Release, macOS, Windows, Linux, Visual QA) & Zero-Docker native testing.
  MUST be loaded khi task liên quan tới: phát triển, debug, UI/UX design, whitelabel, hoặc build release cho ứng dụng Desktop (Electron hoặc Tauri).
---

# 360org — Desktop App Architecture & Development Guidelines (`360-desktop-app`)

Quy chuẩn kiến trúc module đồng nhất, IPC, bảo mật, đóng gói artifact release và kiểm thử tự động cho ứng dụng Desktop trên 3 hệ điều hành (macOS, Windows, Linux) của **360org**.

---

## 🏗️ Tổng quan Module Architecture

| Platform | Thư mục | Số Module | Khung công nghệ | Dự án tiêu biểu |
|---|---|---|---|---|
| **Electron** | `electron/` | 17 Modules | Node.js + Electron + React 19 + Electron-builder | **VuaOffice Suite** (Docs, Sheets, Slides, PDF, Markdown, Shell) |
| **Tauri** | `tauri/` | 18 Modules | Rust Core + Tauri v2 + Webview + React 19 / Next.js SSG | **V-Assistant App** |

---

## ⚡ 1. Electron Suite (`electron/`)

- **Cấu trúc 17 Modules**: `electron-core`, `electron-react`, `electron-ipc`, `electron-security`, `desktop-ux`, `design-system`, `tailwind`, `desktop-window`, `native-integration`, `whitelabel`, `sidecar`, `updater`, `release`, `macos`, `windows`, `linux`, `visual-qa`.
- **Security Baseline**: `contextIsolation: true`, `nodeIntegration: false`, CSP headers.
- **IPC Protocol**: `contextBridge.exposeInMainWorld('electronAPI', {...})` trong `preload.ts`.
- **Whitelabel Protocol**: Dynamic asset swap (`npm run whitelabel:apply`).
- Đọc chi tiết tại [electron/README.md](electron/README.md) và [electron/references/electron_architecture_matrix.md](electron/references/electron_architecture_matrix.md).

---

## 🦀 2. Tauri v2 Suite (`tauri/`)

- **Cấu trúc 18 Modules**: `tauri-core`, `tauri-react`, `tauri-rust`, `tauri-security`, `desktop-ux`, `design-system`, `tailwind`, `desktop-window`, `native-integration`, `sidecar`, `updater`, `release`, `tauri-mobile`, `macos`, `windows`, `linux`, `visual-qa`.
- **Capabilities (v2 ACL)**: Cấu hình `src-tauri/capabilities/default.json` giới hạn quyền hạt mịn.
- **Zero-Docker Testing Protocol**: Bắt buộc test app macOS thật qua `npm run tauri dev` và `npm run build:local` -> mở `/Applications/V Assistant.app`.
- Đọc chi tiết tại [tauri/README.md](tauri/README.md) và [tauri/references/tauri_v2_15_modules_architecture.md](tauri/references/tauri_v2_15_modules_architecture.md).

---

## 🚀 Quy Trình 9 Bước (Kế thừa từ dev-workflow-skills)

```
/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship
```
