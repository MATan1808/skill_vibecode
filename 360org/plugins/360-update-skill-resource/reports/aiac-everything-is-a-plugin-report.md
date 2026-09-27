# Báo Cáo Phân Tích DeepSeek Harness & Đề Xuất Nâng Cấp AIaC v3.0 (Everything is a Plugin)

- **Thời gian lập báo cáo**: 2026-08-13 11:05:00
- **Tác giả**: AIaC Core Team (360org)
- **Đối tượng**: Sếp Châu (PO / Chief Architect)

---

## Executive Summary (Tóm Tắt Executive)

Báo cáo này phân tích chuyên sâu kiến trúc mã nguồn repository **`deepseek-harness`** (`/Volumes/DATA/DEV/deepseek-harness`) dựa trên framework **Cordis** với triết lý **"Everything is a Plugin"**. Dựa trên các phát hiện kỹ thuật, em đề xuất kế hoạch tái cấu trúc **AIaC (AI Infrastructure as Code)** chuyển từ mô hình "Prompt-driven Skills" hiện tại sang **Mô hình Agentic Plugin/Connector Framework v3.0** can thiệp sâu vào Claude Code.

---

## 1. Phân Tích Chuyên Sâu Repository `deepseek-harness`

`deepseek-harness` (`dsh`) được xây dựng trên **Cordis** — một micro-kernel framework dành cho AI Agent với 5 nguyên tắc nền tảng:

### 1.1. Triết Lý "Everything is a Plugin" & No Privileged Core
- Trong `dsh`, **không có core cố định**. Mọi thành phần từ LLM Adapter (`ctx.llm`), Tool Registry (`ctx.tools`), Session Log (`ctx.sessions`), đến Agent Loop (`ctx.agentLoop`), Subagents, Shell và Terminal đều là các **Cordis Plugins** được mount vào context chung.
- Bất kỳ thành phần nào cũng có thể bị thay thế, override hoặc mở rộng runtime thông qua file cấu hình patch mà không cần sửa mã nguồn gốc.

### 1.2. Cơ Che Kích Hoạt & Reversible Effects (`ctx.effect`)
- Mọi đăng ký (Tools, Prompt Section, Event Listener, Provider) đều được bọc trong `ctx.effect()` hoặc `ctx.on()`.
- Khi một plugin bị unload hoặc disable, toàn bộ các đăng ký của nó tự động **unwind (hoàn nguyên sạch)** mà không để lại tác dụng phụ (side-effects) trên hệ thống.

### 1.3. Chuỗi Sự Kiện Thủy Triều (Waterfall Event Pipelines)
- Chuỗi thực thi hỗ trợ 4 chế độ dispatch: `emit`, `waterfall` (around-middleware), `parallel`, và `serial`.
- **Waterfall around-middleware** cho phép các plugin can thiệp vào luồngAgent:
  + `agent/pre-step`: Can thiệp và sửa đổi prompt/messages trước khi gửi cho LLM (hoặc từ chối turn).
  + `agent/request`: Can thiệp vào payload gửi tới LLM API.
  + `tools/pre-execute` ➔ `tools/execute` ➔ `tools/post-execute`: Can thiệp, chặn, ghi log hoặc biến đổi dữ liệu trước/sau khi Tool chạy.

### 1.4. Mô Hình Capability Seams (Tam Giác Tính Năng)
Mọi tính năng trong `dsh` được thiết kế theo mô hình **Capability Seam** gồm 3 vai trò rõ ràng:
1. **Service Definition**: Khai báo Interface chuẩn (vd: `ShellService`, `FsService`).
2. **Service Provider**: Implementation thực tế (vd: Local Subprocess Provider, E2B Sandbox Provider, SSH Remote Provider).
3. **Consumer**: Công cụ/Agent tương tác với LLM (vd: Tool `bash`, Tool `read_file`).

### 1.5. Self-Modification (Agent Tự Quản Lý Runtime)
- Agent trong `dsh` có khả năng tự soi chiếu (`self-modification`), tự phát hiện các plugin đang active và tự mount/unmount plugin hoặc tool mới vào runtime session của chính nó khi gặp bài toán phức tạp.

---

## 2. Bảng So Sánh Chi Tiết: AIaC Hiện Tại vs DeepSeek Harness vs AIaC v3.0

| Hạng Mục | AIaC Hiện Tại (v2.x) | DeepSeek Harness (`dsh`) | Đề Xuất AIaC v3.0 (Everything is a Plugin) |
|---|---|---|---|
| **Bản chất Skill/Plugin** | Chủ yếu là **Prompt Inject & Markdown Rules** nạp qua `SessionStart` / `.claude/CLAUDE.md`. | **Cordis Executable Plugins** (chạy trực tiếp trong Node/TS runtime). | **Hybrid Agentic Plugin**: Mỗi Plugin chứa Prompt Rules + Native MCP Tools + Event Hooks + CLI Connectors. |
| **Cơ chế Nạp (Loading)** | `360-smart-router.js` đọc tín hiệu project ➔ inject text prompt ngầm vào Session. | Boot theo Profiles/Bundles (`cordis.patch.yml`) ➔ Dependency Injection via `inject: [...]`. | **Dynamic Plugin Registry**: Smart Router nạp đúng Plugin Package (Hook + Tool + Spec + Prompt) vào `.claude/settings.json`. |
| **Can thiệp thực thi (Hooking)** | Chạy Shell command đơn giản ở `PreToolUse`/`PostToolUse` trong `settings.json`. | Multi-stage Waterfall Middleware (`agent/pre-step`, `tools/pre-execute`, `tools/post-execute`). | **Event-Driven Hooks & Connectors**: Chạy Node.js Middleware kiểm soát 100% Tool Input/Output, Security Gating, Auto-Format & Self-Correction. |
| **Tính Năng (Capabilities)** | Các script (`odoo_linter.py`, `git_cleaner.py`, `wp-cli`) đứng độc lập. | **Capability Seams**: Tách biệt rõ Definition, Provider (Local/Docker/SSH) và Consumer (Tool). | **Seam Connectors**: Chuẩn hóa mọi Tool thành Seam (VD: `OdooSeam`, `WordPressSeam`, `DesktopSeam`). |
| **Khả năng Hoàn nguyên (Teardown)** | Symlink tĩnh nằm cố định trong `.claude/360org/skills/`. | `ctx.effect()` tự động unwind khi plugin unload. | **Idempotent Symlink & Overlay Manager**: Nạp/xóa plugin không để lại rác hay xung đột config. |
| **Agent Self-Control** | Agent đọc tài liệu Markdown để biết cách dùng tool. | Agent tự inspect & mount plugin qua `dsh-self-modification`. | **Agentic Self-Mount**: Claude Code qua `360-smart-router` tự bật/tắt Plugin Connector phù hợp với ngữ cảnh task. |

---

## 3. Kiến Trúc Đề Xuất Nâng Cấp AIaC v3.0

Để đạt chuẩn **"Everything is a Plugin"** và tương thích sâu với Claude Code mà không phá vỡ hạ tầng hiện tại của Sếp, AIaC v3.0 sẽ được tổ chức thành **4 Lớp Kiến Trúc**:

```text
/Volumes/DATA/DEV/aiac/
├── 360org/
│   ├── plugins/                      # [THAY THẾ THƯ MỤC SKILLS CŨ]
│   │   ├── 360-wordpress/            # Plugin Package WordPress
│   │   │   ├── plugin.json           # Manifest khai báo Tools, Hooks, Connectors, Prompts
│   │   │   ├── hooks/                # Node.js Event Hooks (PreToolUse/PostToolUse/Stop)
│   │   │   ├── connectors/           # WP-CLI, Plugin Check, Hardening Connectors
│   │   │   └── prompts/              # Rules & Guidelines
│   │   ├── 360-odoo/                 # Plugin Package Odoo
│   │   ├── 360-flutter/              # Plugin Package Flutter
│   │   ├── 360-desktop-app/          # Plugin Package Electron/Tauri
│   │   └── 360-gitsync/              # Plugin Package Git Sync
│   ├── core/                         # AIaC Core Runtime Engine
│   │   ├── plugin-loader.js          # Dynamic Plugin Registry & Loader
│   │   ├── event-bus.js              # Event Lifecycle & Middleware Bus
│   │   └── capability-seams.js       # Seam Abstraction Layer (Local / SSH / Pod)
│   └── scripts/
│       └── hooks/
│           └── 360-smart-router.js   # Master Router nạp Plugin linh hoạt
```

### 3.1. Cấu Trúc Plugin Manifest (`plugin.json`)
Mỗi bộ kỹ năng sẽ trở thành 1 **Plugin Package** hoàn chỉnh:
```json
{
  "name": "360-wordpress",
  "version": "3.0.0",
  "description": "WordPress Plugin & Site Development Engine",
  "inject": ["shell", "mcp", "hooks"],
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "script": "hooks/pre-write-security-check.js" }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "script": "hooks/post-write-wpcs-linter.js" }
    ]
  },
  "connectors": [
    { "name": "wp-cli", "type": "binary", "path": "connectors/wp-cli.phar" },
    { "name": "plugin-check", "type": "phpcs", "ruleset": "connectors/ruleset.xml" }
  ],
  "prompts": ["prompts/wp-plugin-dev.md", "prompts/security.md"]
}
```

---

## 4. Kế Hoạch Triển Khai (Roadmap 4 Giai Đoạn)

- **Giai đoạn 1: Xây dựng AIaC Core Plugin Engine**
  - Xây dựng `aiac/360org/core/plugin-loader.js` và định nghĩa `plugin.json` schema.
  - Cập nhật `360-smart-router.js` để chuyển từ nạp prompt thuần sang nạp Plugin Package.

- **Giai đoạn 2: Chuyển đổi 5 Skill Cốt Lõi Thành Plugin Packages**
  - Chuyển `360-wordpress`, `360-odoo`, `360-flutter`, `360-desktop-app`, `360-gitsync` sang cấu trúc Plugin chuẩn có `plugin.json`, Event Hooks & Connectors.

- **Giai đoạn 3: Tích hợp Connector & Event Hooks Chuyên Sâu**
  - Thêm Hook tự động chạy Linter / Formatter (WPCS cho WordPress, Flake8/Black cho Odoo, `dart analyze` cho Flutter) ngay tại sự kiện `PostToolUse` (sửa code xong tự check syntax).

- **Giai đoạn 4: Kiểm Thử, Đóng Gói & Đồng Bộ**
  - Chạy toàn bộ self-check suites, cập nhật `CHANGELOGS.md`, đẩy mã nguồn lên Remote GitLab và đồng bộ sang `.claude/`.

---

## 5. Đề Xuất Bước Tiếp Theo

Sếp xem xét bản Báo cáo Phân tích & Đề xuất Nâng cấp này. Khi Sếp duyệt phương án, em sẽ lập tức bắt tay vào **Giai đoạn 1** để nâng cấp AIaC Core thành **Everything is a Plugin Engine v3.0** ạ!
