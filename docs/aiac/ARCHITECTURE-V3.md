# AIaC Architecture v3.x — Micro-Kernel & Plugin-First Engine

> **Phiên bản**: v3.3.0
> **Tác giả**: 360 CORP Architecture Team
> **Trạng thái**: Stable Production

---

## 1. Tổng quan Kiến trúc (Overview)

AIaC (AI Infrastructure as Code) v3.x chuyển đổi từ mô hình script phân tán sang kiến trúc **Micro-Kernel** lấy cảm hứng từ Cordis framework (`deepseek-harness`). Mọi tính năng, công cụ, prompt và linter trong hệ sinh thái 360 CORP được đóng gói dưới dạng **Plugin Packages độc lập 100%**.

```
+-----------------------------------------------------------------------------+
|                            AI Clients Layer                                 |
|      Claude Code       |     Codex CLI     |    Gemini / Antigravity        |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                          AIaC Hook Bridge                                   |
|       PreToolUse (Security)        │        PostToolUse (Linting/Audit)     |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                      AIaC Micro-Kernel Engine                               |
|  ┌─────────────────────┐  ┌───────────────────────┐  ┌───────────────────┐  |
|  │  EventBus Lifecycle │  │ Capability Seam Reg   │  │  Plugin Loader    │  |
|  │  (emit/waterfall/   │  │ (Service Definition  │  │  (Dependency Graph│  |
|  │   parallel/serial)  │  │  Provider  Consumer) │  │   & Hot-Reload)   │  |
|  └─────────────────────┘  └───────────────────────┘  └───────────────────┘  |
+-----------------------------------------------------------------------------+
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
+------------------------------------+  +------------------------------------+
|     Sandbox Execution Layer        |  |    Autonomous Multi-Agent Pipeline |
|  - LocalSubprocessProvider         |  |  - SDD Roles (Architect/Gen/Review)|
|  - SshRemoteProvider (local/vua..) |  |  - Self-Healing 3-Step Loop        |
|  - K8sPodRemoteProvider (saas)     |  |    (Obs ➔ Hypothesis ➔ Verify)     |
|  - SandboxDispatcher               |  |                                    |
+------------------------------------+  +------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                   23 Plugin Packages (`360org/plugins/*`)                   |
| 360-odoo | 360-wordpress | 360-flutter | 360-gitsync | 360-superpowers...    |
+-----------------------------------------------------------------------------+
```

---

## 2. Các Thành Phần Cốt Lõi (`360org/core/`)

### 2.1. EventBus Lifecycle (`event-bus.js`)
Điều phối luồng sự kiện đa hình với 4 cơ chế dispatch:
1. **`emit(event, payload)`**: Quan sát thụ động, không chặn tiến trình.
2. **`waterfall(event, payload)`**: Middleware pipeline tuần tự có khả năng biến đổi payload qua `next()`.
3. **`parallel(event, payload)`**: Kích hoạt đồng thời toàn bộ listeners qua `Promise.all`.
4. **`serial(event, payload)`**: Kích hoạt tuần tự từng listener có `await`.
- **Reversible Clean Disposers**: Khi plugin unload, các disposers (`ctx.effect()`) tự động hoàn nguyên sạch sẽ tài nguyên đã chiếm dụng.

### 2.2. Capability Seam Registry (`capability-seams.js`)
Mô hình hóa Tam giác Tính năng:
- **Service Definition**: Khai báo giao diện và hợp đồng dịch vụ (`define()`).
- **Service Provider**: Plugin đăng ký triển khai cụ thể (`provide()`).
- **Consumer**: Sử dụng dịch vụ thông qua `get()`, `getAll()`, hoặc `invoke()`.

### 2.3. Multi-Host Execution Sandbox (`sandbox-seam.js`)
Trừu tượng hóa môi trường thực thi:
- **`LocalSubprocessProvider`**: Chạy lệnh local trên macOS / Linux host.
- **`SshRemoteProvider`**: Thực thi từ xa qua SSH alias (`local` - `root@360-Corp`, `vuahethong`, `cloudpanel`).
- **`K8sPodRemoteProvider`**: Chạy lệnh trực tiếp bên trong Kubernetes Pod (cluster `saas`) qua `kubectl exec`.
- **`SandboxDispatcher`**: Tự động nhận diện ngữ cảnh thư mục (Odoo, WP, Payload, Hermes) để dispatch lệnh về đúng Provider.

### 2.4. Plugin Loader & Dependency Graph (`plugin-loader.js`)
- Quản lý vòng đời Plugin (`loadPlugin`, `unloadPlugin`, `reloadPlugin`).
- **Dependency Resolution Graph**: Phân tích đệ quy `dependencies` trong `plugin.json` và nạp theo thứ tự topology.
- **Hot-Reload Watcher**: Tự động unmount và reload plugin khi có thay đổi file mà không cần khởi động lại session AI.

### 2.5. Autonomous Agent Pipeline (`agent-pipeline.js`)
- Điều phối Multi-Agent theo mô hình SDD (Subagent-Driven Development).
- **Self-Healing Loop 3 Bước**: Tự động phát hiện lỗi kiểm thử/linter, đưa ra giả thuyết sửa đổi theo triết lý Ponytail và áp dụng bản vá tự động.
