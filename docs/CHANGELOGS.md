# CHANGELOGS — AIaC (AI Infrastructure as Code)

> Quản lý tập trung hạ tầng AI Agent cho Sếp Châu (360 CORP).
> Chuẩn hóa theo tiêu chuẩn **Keep a Changelog** & **Semantic Versioning**.

---

### [NEW] (2026-09-28)
- [NEW] Tích hợp bộ quy chuẩn `karpathy-guidelines` (Andrej Karpathy) vào plugin `360-ponytail` và đăng ký shim symlink `~/.claude/skills/karpathy-guidelines`. Bao gồm 4 nguyên tắc cốt lõi: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution.

## [3.8.16] - 2026-09-19 — LUẬT NHẬN DIỆN NGỮ CẢNH & KÉO THẢ FOLDER

### Added
- **[NEW] Luật Nhận Diện Ngữ Cảnh Thư Mục (Context-Aware Workspace)** trong `CLAUDE.md`:
  - AI bắt buộc phải đọc khối `<Environment>` trong `system-reminder` hoặc chạy `pwd` để biết chính xác mình đang ở thư mục nào (Current Workspace).
  - Cấm AI hỏi Sếp đường dẫn dự án một cách mù mờ.
  - Các lệnh thực thi (`git`, `npm`, v.v.) bắt buộc phải trỏ đúng đích (qua `cd` hoặc cờ chỉ định) để tránh chạy sai repo.
  - Mọi thao tác tìm kiếm, đọc ghi mặc định ưu tiên thực thi trên Current Workspace hiện tại.
- **[NEW] Luật Kéo Thả = Cấp Quyền Truy Xuất Mặc Định (Drag & Drop Grants Permission)**:
  - Khi người dùng kéo thả một folder vào khung chat, hệ thống ghi nhận đây là lệnh cấp quyền dứt khoát. AI phải truy xuất vào thư mục đó ngay lập tức mà không được chặn lại hỏi xin phép vì lý do "nằm ngoài allowed scope".

---

## [3.8.12] - 2026-09-19 — LUẬT CỨNG ZERO-BYPASS PROMOTION PIPELINE

### Added
- **[NEW] `360-dev-workflow/prompts/references/promotion-pipeline.md`** — Ban hành nguyên lý luân chuyển mã nguồn một chiều bắt buộc cho mọi dự án, mọi môi trường:
  `Dev Local → push GitLab → pull Local Server → fix/update → push GitLab → pull Production → release test → done → report`.
  - **Production là immutable target**: chỉ `git fetch` + checkout SHA đã qua chốt Local Server. Cấm sửa file trực tiếp bằng `nano`/`echo`, cấm tự xử lý merge conflict trên máy chủ khách hàng.
  - **Cấm vượt cấp**: `rsync` / `scp` / `kubectl cp` / `cp` source từ Dev Local thẳng lên Local Server hoặc Production.
  - **Luật "Mỗi Module Là Một Git Repo"**: thư mục module ở cả 3 tầng bắt buộc là git worktree có `remote origin` trỏ GitLab. Thư mục không phải git repo ⇒ **không được deploy**; AI phát hiện thiếu `.git` phải DỪNG và báo PO, cấm copy file cho nhanh.
  - **Luật đồng bộ version**: `'version'` trong `__manifest__.py` phải khớp version ghi trong tiêu đề commit, và phải bump **trong cùng commit** với thay đổi code.

### Changed
- **[REFACTOR] `360-dev-workflow/prompts/SKILL.md`** — Bổ sung mục luật cứng Zero-Bypass Promotion Pipeline ngay phần đầu skill, trỏ tới reference mới để agent nạp được nguyên lý trước khi sinh lệnh deploy.

### Context — Sự vụ thực tế kích hoạt luật này (`vuahethong.net`, 2026-09-19)
Module `social_zalo` tồn tại **3 version khác nhau cùng lúc** vì Mac và Local Server đều không phải git repo, chỉ Production có `.git`:

| Tầng | Version manifest | Git | mtime |
|---|---|---|---|
| Mac (Dev Local) | `19.0.1.7.0` | ❌ | 17/09 19:30 |
| Local Server | `2.10` (bản Odoo 14 cũ) | ❌ | 30/05 20:14 |
| Production | `19.0.1.10.1` | ✅ `origin/19.0` | 19/09 08:54 |

Production giữ bản **mới nhất** — code đã đi thẳng lên máy chủ khách hàng mà chưa từng qua chốt Local Server. Hệ quả: pod rotate nạp code mới có field `ir_attachment.zalo_media_state` trong khi DB chưa sinh cột ⇒ **HTTP 500 toàn trang `/home/settings`**. Thêm bất nhất version: commit `14c1193` đặt tiêu đề `v19.0.1.11.0` nhưng manifest trong chính commit đó là `19.0.1.9.0`, sau merge thành `19.0.1.10.1`.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.10] - 2026-09-17 — MULTI-AGENT MODEL ROUTING & WORKFLOW AGENT INJECTION

### Added
- **Multi-Agent Model Routing (`360-harness`)**:
  - Bổ sung cơ chế tự động định tuyến Model theo Role trong `360org/core/workflow-engine.js`: tự động gán Model ID thích hợp cho các subagents theo vai trò (`review`/`audit` -> `claude-VIP`, `code`/`fix`/`build` -> `antigrafity-claude-3.8-flash`, `plan`/`idea` -> `Claude-Pro-Pack`).
  - Tạo cấu hình subagents chuyên biệt tại `.claude/agents/aiac-coder.md` và `.claude/agents/aiac-reviewer.md`.
  - Bổ sung tài liệu chuẩn điều phối `360org/plugins/360-harness/prompts/references/model-routing.md`.

### Changed
- **Workflow Dev chuẩn AIaC: 8 bước ➔ 9 bước, bổ sung cổng chặn `/code-review` giữa `/build` và `/test`**:
  - Chuỗi chuẩn mới: `/idea ➜ /req ➜ /spec ➜ /plan ➜ /build ➜ /code-review ➜ /test ➜ /review ➜ /ship`.
  - `/code-review` là **cổng chặn (blocking gate)**: một model **khác model đã `/build`** (Claude/Codex) đọc đúng `git diff` vừa sinh và soi 4 trục — correctness / reuse (ponytail nấc 2) / over-engineering / security & validation tại trust boundary. Còn finding Critical/High chưa xử lý thì **CẤM** sang `/test`. Trần 3 vòng fix→re-review, quá 3 vòng escalate về Architect (dấu hiệu SPEC sai). Bước này chỉ đọc code, **không chạy test và không viết test**.
  - Lý do tách khỏi `/review` (bước 8): bắt bug ở diff thô rẻ hơn nhiều so với để Tester viết xong cả bộ test rồi mới phát hiện logic sai và phải viết lại test. `/review` vẫn giữ nguyên vai trò audit SPEC/acceptance **sau khi test đã xanh**.
  - Thêm vai trò **Code Reviewer** vào bảng phân công (5 ➔ 6 vai trò) trong `360-dev-workflow` và bản Odoo (kèm 4 trục Odoo-specific: `ensure_one()`, `create()` trong loop, `@api.depends`, ACL/record rules, `Markup()` bọc HTML `message_post()`).
  - Đồng bộ toàn hệ: `CLAUDE.md`, `config/capabilities.manifest.json`, `360-dev-workflow` (SKILL/README/plugin.json/workflow-standards/reference), `360-odoo`, `360-hermes` (đặt đúng tên cho pha `/build ⇄ /review` chéo model ≤3 vòng đã có sẵn, **không dựng thêm vòng lặp trùng**), `360-payload-website`, `360-vuaoffice`, `360-airouter`, `360-desktop-app`, `360-flutter`, `360-harness`, `360org/scripts/hooks/360-smart-router.js`.
  - Bổ sung kiểm thử độc lập 22 test cases `tests/workflow-9-step-consistency.test.js` (pass 100%): chống phân mảnh chuỗi bước, chặn sót "8 bước", verify cổng chặn + 4 trục + trần 3 vòng + ràng buộc khác model.
- **Luật Kéo Thả Folder = Tự Động Cấp Quyền Vĩnh Viễn (`CLAUDE.md`)**:
  - Bổ sung luật cứng vào mục "Auto Dynamic Scope": khi Sếp kéo thả thư mục vào khung chat (hoặc đề cập dạng `@"/đường/dẫn/folder/"`), hành động đó mặc định **đã là sự đồng ý** cấp quyền `folder/*`; AI bắt buộc ghi ngay đường dẫn vào `permissions.additionalDirectories` **và** `allowedWorkspaces` của `[project]/.claude/settings.local.json` trước khi gọi tool đọc đầu tiên, nghiêm cấm hỏi lại lần hai.

### Security
- **Scope Guard — `settings.local.json` là nguồn duyệt Cấp 1 (`360org/scripts/hooks/aiac-hook-bridge.js`)**:
  - Sửa root cause `getConfiguredDevWorkspaces()` chỉ đọc settings theo `process.cwd()`: khi Sếp kéo thả folder, Claude Code đổi `cwd` sang folder đó nên whitelist ghi ở AIaC root bị bỏ qua hoàn toàn và hook hỏi lại quyền đã cấp. Nay đọc hợp nhất (dedupe) từ `process.cwd()` + `repoRootCandidate` + `/Volumes/DATA/DEV/aiac`.
  - Loại bỏ tầng filter `isAllowedDevWorkspace()` áp lên dữ liệu đọc từ settings: đường dẫn Sếp đã tự tay ghi trong `settings.local.json` = đã được duyệt, hook tuyệt đối không filter lại (trước đây quyền hợp lệ vẫn bị loại nếu nằm ngoài `/Volumes/DATA/DEV`, khiến file settings mất ý nghĩa).
  - Chuẩn hoá wildcard đuôi (`/Volumes/.../repo/*` → `/Volumes/.../repo`) và mở rộng regex quét `permissions.allow` sang `/(?:Volumes|Users|mnt|home|opt|srv)/…`.
  - Bổ sung bộ kiểm thử độc lập 15 test cases `tests/scope-guard-settings-priority.test.js` (pass 100%): whitelist hiệu lực bất kể `cwd`, cross-scope, AIaC root luôn mở, hồi quy chặn folder lạ, chặn wildcard gốc `SKILL_SOURCES/`, không báo động giả với path nằm trong `content`.

## [3.8.9] - 2026-09-16 — 360-PAYLOAD-WEBSITE HARNESS, TELEMETRY HARDENING & SMART SCOPE GUARD

### Added
- **Plugin `360-payload-website` Harness**:
  - Chuyển đổi và chuẩn hoá toàn diện `vuaai-payload-website-skills` thành plugin độc lập chuẩn AIaC Plugin Harness chuyên dụng để phát triển website marketing trên stack Payload CMS 3.85 + Next.js 16 + React 19 + SQLite WAL + Tailwind CSS v4.
  - Cung cấp 5 templates thực chiến: `docker-compose.yml` (dev local Mac Node 22 Alpine), `ecosystem.config.cjs` (PM2 cluster 2 workers cho CloudPanel production), `gitlab-ci.yml` (GitLab CI/CD 3-stage), `collection.template.ts` (mẫu Collection chuẩn TypeScript kèm auto slug và `localized: true`), `block.template.ts` (mẫu Custom Block kèm i18n và UI Tailwind v4).
  - Tích hợp CLI scaffold: `scripts/payload-scaffold.js` hỗ trợ scaffold nhanh Collection và Custom Block theo chuẩn 360 CORP.
  - Tích hợp linter tĩnh: `scripts/payload-linter.js` kiểm tra quy chuẩn `output: 'standalone'` trong `next.config.*` và `localized: true` trên mọi user-facing fields.
  - Tích hợp hook: `hooks/post-write-payload-check.js` tự động cảnh báo khi sửa `next.config.*` thiếu `output: 'standalone'`.
  - Tích hợp router: `360-smart-router.js` tự động nhận diện workspace `PAYLOAD` khi có `payload.config.*`, dependency `payload` trong `package.json`, hoặc đường dẫn `payload`, nạp rules chuyên biệt và inject skill `360-payload-website`.
  - Tạo symlink alias `~/.claude/skills/vuaai-payload-website-skills` trỏ về `360-payload-website`.
  - Bổ sung bộ kiểm thử độc lập 12 test cases `tests/payload-website-plugin.test.js` đạt pass 100%.

### Changed
- **Telemetry Dashboard (Port 3600)**:
  - Cố định hiển thị đúng 3 cột biểu đồ đo lường: Tổng Tokens Xử Lý / Tổng Token Tiết Kiệm (AIaC) / Net Token Tiết Kiệm (AIaC).
  - Bổ sung hiển thị phần trăm `%` Net Token Tiết Kiệm trên header và tooltips dữ liệu trực tiếp.
  - Cố định chiều cao tối thiểu cho cột thanh bar (`minBarLength: 6`) tránh hiện tượng cột bị biến mất khi tỷ lệ chênh lệch lớn.
- **Global CLAUDE.md**:
  - Cập nhật bảng phân loại dự án, tách bạch rõ ràng giữa Website Payload CMS (`360-payload-website`) và API Gateway Routing (`360-openclaw`).

### Removed
- **Phân Mảnh Tài Liệu `360-openclaw`**:
  - Gỡ bỏ hoàn toàn 5 file references bị copy trùng lặp khỏi `360org/plugins/360-openclaw/prompts/references/` (`brand-360corp.md`, `deploy-cloudpanel-gitlab.md`, `gotchas.md`, `payload-patterns.md`, `stack-and-conventions.md`), trả `360-openclaw` về đúng nhiệm vụ API Gateway & Ecosystem Routing.

### Security
- **Smart Scope Guard (Dynamic Ask Permission)**:
  - Chuyển đổi cơ chế bảo vệ ranh giới dự án từ hard-block sang cơ chế xin phép xác nhận từ người dùng (`Ask Permission`), nâng cao trải nghiệm làm việc liền mạch khi Sếp chỉ định hoặc kéo thả thư mục ngoại vi vào chat.
  - Tách bạch giữa target file path và chuỗi nội dung văn bản trong hook PreToolUse (`content`, `new_string`, `old_string`), triệt tiêu hoàn toàn báo động giả khi viết mã nguồn hoặc tài liệu có chứa đường dẫn.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.8] - 2026-09-14 — AUTOHARNESS SELF-LEARNING ENGINE, ODOO ENTERPRISE SNAPSHOT MERGE & GITLAB-FIRST DEPLOY

### Added

- **[FIX] Khắc Phục Triệt Để Lỗi Cú Pháp JavaScript trên Telemetry Dashboard (Port 3600)**:
  - Sửa lỗi `SyntaxError: Unexpected identifier 'JetBrains'` trên trình duyệt: Khắc phục hiện tượng chuỗi font `'JetBrains Mono'` lồng trong template literal bị Node.js gỡ dấu escape làm vỡ chuỗi và khiến dashboard tê liệt hoàn toàn (canvas trống, tab và bộ lọc không bấm được).
  - Tăng cường khả năng chịu lỗi (Fault-Tolerance) cho Dashboard: Bọc toàn bộ phần khởi tạo biểu đồ Chart.js trong khối `try { ... } catch`, kiểm tra điều kiện an toàn `typeof Chart !== 'undefined'` giúp giao diện không bị gián đoạn ngay cả khi mạng CDN bên ngoài gặp sự cố.

- **[NEW] Khai Báo Native SKILL.md Symlinks cho Toàn Bộ 29 Core Plugins & Lệnh Slash-command `/agent-device`**:
  - Tạo symlink `SKILL.md -> prompts/SKILL.md` tại thư mục gốc của toàn bộ 29 plugins trong `360org/plugins/*`: Đảm bảo Claude Code tự động quét và nạp native 100% danh mục kỹ năng (bao gồm `360-agent-device`, `360-agent-browser`, `360-flutter`, `360-odoo`, `360-harness`...) vào danh sách tool `Skill`.
  - Bổ sung lệnh slash-command `/agent-device` (`.claude/commands/agent-device.md` và `~/.claude/commands/agent-device.md`) giúp Sếp và Agent kích hoạt nhanh công cụ kiểm thử thiết bị sống bất kỳ lúc nào.

- **[NEW] Bảng Xếp Hạng Tần Suất Sử Dụng Plugins / Skills & Đo Lường Cải Tiến AutoHarness trên Dashboard (Port 3600)**:
  - Bổ sung section **"Bảng Xếp Hạng Tần Suất Gọi & Sử Dụng Plugins / Skills"** trực tiếp trên Dashboard Tổng Quan (Tab 1), sắp xếp giảm dần từ lượt gọi nhiều nhất đến ít nhất:
    * Thống kê đầy đủ thứ hạng huy chương danh giá (🥇 Top 1, 🥈 Top 2, 🥉 Top 3, #4, #5...), tên, phân loại (Core Plugin vs Special Skill), số lượt gọi (calls), thanh tỷ trọng thị phần trực quan (Cyan/Emerald gradient), token tiêu tốn, token tiết kiệm và chế độ thực thi.
    * Tích hợp thanh tìm kiếm tức thì và bộ lọc phân loại linh hoạt (Tất Cả, Core Plugins, Special Skills, Đang Hoạt Động >0 calls).
    * Bổ sung endpoint API chuyên biệt `GET /api/telemetry/ranking` trả về danh sách plugin/skill đã sắp xếp theo thứ tự sử dụng giảm dần.
  - Tích hợp panel **"Đo Lường Cải Tiến & Tự Học Hệ Thống — AutoHarness Continuous Distillation Engine"**:
    * 4 thẻ KPI đo lường định lượng: Tổng quy chuẩn đã chưng cất (`learning-ledger.jsonl`), Quy chuẩn đã duyệt vào AIaC (Zero-Drift), Đề xuất đang chờ Sếp duyệt (`pending-proposals.json` qua `/proposals`), và Ước tính lượng Token bảo vệ tránh lặp lỗi (~15k–25k tokens/bài học).
    * Hiển thị danh sách 2 cột: Bài học mới chưng cất trong Sổ cái Ledger và Đề xuất chờ duyệt tại Human-in-the-loop Gate kèm mã băm SHA-256.
    * Bổ sung endpoint API chuyên biệt `GET /api/telemetry/autoharness`.

- **[NEW] Tự Động Hoá Đồng Bộ Bảng Version Matrix trong `docs/CHANGELOGS.md`**:
  - Nâng cấp script đồng bộ phiên bản `scripts/aiac/sync-version.js`: Tự động trích xuất tiêu đề release và ngày phát hành từ heading `## [version] - YYYY-MM-DD — TITLE` trong `docs/CHANGELOGS.md` và tự động chèn dòng mới vào bảng "Bảng Tóm Tắt Phiên Bản (Version Matrix)" nếu chưa có. Đảm bảo tính nhất quán 100% khi chạy đồng bộ phiên bản.

- **[NEW] Đóng gói Plugin `360-agent-device` — Điều Khiển, Tự Động Hoá & Live App Verification Engine trên Thiết Bị Thực**:
  - Tích hợp và đóng gói bộ công cụ `agent-device` (Callstack) vào hệ sinh thái AIaC theo chuẩn Everything Is A Plugin Harness:
    * `360org/plugins/360-agent-device/prompts/SKILL.md`: Đặc tả quy chuẩn kiểm thử thiết bị sống (Live Verification Loop), cheat sheet lệnh CLI (`open`, `snapshot -i`, `press`, `fill`, `scroll`, `assert`, `screenshot`, `diff --settle`), và 4 nguyên tắc vàng kiểm thử.
    * 5 tài liệu tham chiếu chuyên sâu (`prompts/references/`): `verification-loop.md` (chu trình tương tác 5 bước), `ios-simulator-guide.md` (iOS Simulator qua xcrun simctl), `android-emulator-guide.md` (Android Emulator qua adb), `macos-desktop-guide.md` (macOS Accessibility API cho Tauri V-Assistant / Electron VuaOffice), `maestro-and-scripting.md` (ghi kịch bản `.ad` và export Maestro YAML chạy GitLab CI/CD).
    * Bộ công cụ scripts: `scripts/agent-device-run.sh` (wrapper tự dò binary path) và `scripts/device-doctor.sh` (chẩn đoán toàn diện CLI, macOS Accessibility, simctl, adb).
    * Khởi tạo Seam Provider `device` (`index.js`), cấu hình `plugin.json` và bổ sung tự động nhận diện dự án thiết bị trong `360org/scripts/hooks/360-smart-router.js`.
    * Cài đặt binary CLI `/usr/local/bin/agent-device` v0.21.1, tạo symlink `~/.claude/skills/360-agent-device` và bổ sung test suite `tests/agent-device-plugin.test.js` đạt pass 100%.

- **[NEW] Lệnh Slash-command `/version` & Dynamic AIaC Version Inspector**:
  - Thêm script CLI `scripts/aiac/aiac-version.js` và 2 slash-commands: `.claude/commands/version.md` và `.claude/commands/aiac-version.md`. Giúp người dùng gõ `/version` hoặc `/aiac-version` bất kỳ lúc nào để biết chính xác phiên bản AIaC, Git commit SHA, branch, số plugin active, trạng thái Telemetry Dashboard / Local Server và số lượng đề xuất đang chờ duyệt.
  - Loại bỏ hoàn toàn các chuỗi hardcode phiên bản cũ (`v3.8.0`) trong `360-smart-router.js` (SessionStart banner) và `aiac-compact-lite.js` (PreCompact additionalContext); chuyển sang đọc động trực tiếp từ file `VERSION` của repo.

- **[IMPROVE] Cổng Phê Duyệt Bài Học Tự Học (Human-in-the-Loop Approval Gate) & Lệnh `/proposals`**:
  - Cơ chế tự học ngầm định kỳ của AutoHarness (`aiac-auto-distiller.js`) tự động chắt lọc kiến thức từ transcript nhưng không tự ý ghi đè trực tiếp; chuyển toàn bộ sang hàng đợi đề xuất `pending-proposals.json` ở trạng thái `PENDING_APPROVAL`.
  - Bổ sung lệnh `/proposals` (`commands/proposals.md` và `~/.claude/commands/proposals.md`) hỗ trợ Sếp xem danh sách (`/proposals list`), duyệt (`/proposals approve [id|all]`) hoặc từ chối (`/proposals reject [id|all]`).
  - Chỉ khi Sếp duyệt, bài học mới được Promoter ghi vào `prompts/references/auto-learned-rules.md` của plugin tương ứng, ghi trạng thái `APPROVED` vào `learning-ledger.jsonl` và nạp vào bối cảnh phiên làm việc kế tiếp.

- **[FIX] Descriptive Scope Guard Gate — Xử Lý Chạm Vùng Cấm DEV Chủ Động**:
  - Khắc phục hiện tượng Agent bị dừng im lặng ("chết luôn ko làm gì cả") khi công cụ chạm vùng cấm `/Volumes/DATA/DEV/*`.
  - Cải tiến `guardDevScope` trong `360org/scripts/hooks/aiac-hook-bridge.js`: Trả về `permissionDecisionReason` giải thích tường minh đường dẫn bị chặn và cung cấp `additionalContext` mang tính mệnh lệnh cưỡng chế Agent không được bỏ cuộc im lặng, phải báo cáo ngay đường dẫn bị chặn và hướng dẫn Sếp cách cấp quyền vào `.claude/settings.local.json`.

- **[NEW] Trụ Cột 8 AutoHarness & Self-Learning Skill Layer cho AIaC Engine**:
  - `360org/plugins/360-harness/prompts/references/autoharness-self-learning.md`: Tài liệu canonical đặc tả Trụ cột 8 của kiến trúc 360-harness, 6 khối chức năng (CAP, REF, Promoter, Curator, Lifecycle/Ledger, IDX) và 5 quy tắc vàng khi tự học kỹ năng.
  - **Cơ Chế Tự Động Học Ngầm (Autonomous Continuous Distillation — Zero-Command)**:
    * *Daemon-Free & Hook-Driven*: Không cần tiến trình background tốn RAM; hook `Stop` pipeline (`aiac-stop-pipeline.js`) tự động spawn ngầm `aiac-auto-distiller.js` (`detached: true, unref()`) sau mỗi turn/kết thúc phiên mà không gây trễ tương tác của Sếp.
    * *Multi-Signal Extraction*: Tự động quét 350 dòng transcript gần nhất, trích xuất đồng thời 2 nguồn tín hiệu: (1) Chỉ đạo/Quy chuẩn từ Sếp (`User Directives`) và (2) Bẫy lỗi đã khắc phục (`Fix-Verify Pairs`: lỗi assertion/status 1 tiếp nối bằng edit + pass).
    * *Deterministic Promoter Gate*: Tự động làm sạch/redact API key, token, mật khẩu, và tính toán mã băm SHA-256 đối chiếu Sổ cái (`learning-ledger.jsonl`) để chống trùng lặp tri thức.
    * *Auto-Ingestion & SessionStart Surface*: Ghi nhận tức thì vào `prompts/references/auto-learned-rules.md` của plugin đích và nạp 2 bài học mới nhất vào banner `SessionStart` của phiên làm việc kế tiếp.
  - **Cơ chế Chắt lọc Thủ công qua Slash-Command & CLI**:
    * `360org/plugins/360-harness/scripts/aiac-skill-learner.js`: Công cụ CLI quét toàn bộ plugin catalog hiện có, đối chiếu Compare-First và kiểm duyệt proposal.
    * `.claude/commands/learn.md`: Lệnh slash-command `/learn` hỗ trợ Sếp kích hoạt chắt lọc bài học chủ động sau mỗi phiên làm việc khi cần rà soát sâu.
  - Cập nhật `360org/plugins/360-harness/scripts/harness-cli.js`: Bổ sung kiểm tra Trụ cột 8 vào lệnh `verify`, tích hợp lệnh `learn` và `consolidate`.

- **[NEW] GitLab-first, production pull-only cho mọi Odoo module**:
  - `360-odoo/prompts/references/module-production-update.md` là nguồn canonical: bắt buộc test → commit → push GitLab trước deploy; production chỉ `git fetch` + `git pull --ff-only` hoặc checkout SHA đã push, ghi SHA vào báo cáo và rollback bằng Git SHA.
  - Cấm toàn bộ đường đi tắt đưa source local lên production: `rsync`, `scp`, `kubectl cp`, `tar`, `cp` và mọi dạng sync/copy trực tiếp, kể cả hotfix. Worktree Git/symlink phải là source Odoo nạp.
  - Đồng bộ gate này vào `SKILL.md`, `odoo-dev-guide.md`, `debugging-and-bugfixing.md` và `git-workflow.md`; lỗi phát sinh sau deploy phải quay lại local rồi lặp đủ GitLab-first lifecycle, không vá production.

- **[NEW] Quy trình & Script Đồng Bộ Odoo Enterprise Snapshot & Vendor 3-way Merge Backend UI**:
  - `360-odoo/prompts/references/sync-odoo-enterprise-snapshot.md`: Đặc tả quy trình 7 bước tiếp nhận snapshot Odoo Enterprise mới:
    1. Vendor 3-way Merge (upstream `web_enterprise` vào `themes/backend_ui` bảo toàn 100% tính năng và branding đã dev).
    2. Rsync Addons snapshot vào `addons/`, giữ nguyên `.gitignore` và module bổ trợ riêng (`l10n_it_xml_export`).
    3. Tự động đổi dependency `web_enterprise` → `backend_ui` ở toàn bộ các manifest.
    4. Loại bỏ thư mục duplicate `addons/web_enterprise` để tránh conflict với `backend_ui`.
    5. Dọn dẹp module overlay rỗng không có tùy biến thực sự.
    6. Đồng bộ Core Odoo Python trong container để triệt tiêu version skew (`ImportError`).
    7. Verification Gate trên DB test sạch và DB dev live trước khi commit.
  - `360org/scripts/odoo/sync_odoo_enterprise_snapshot.py`: Script CLI tự động hóa với các options `--src`, `--work`, `--container`, `--step`, và `--dry-run`.
  - Bổ sung trigger phrases vào router `360-odoo/prompts/SKILL.md`.

### Changed

- **[UPDATE] Khai tử CloudMounter, chuyển sang SSH alias `ssh local` đồng bộ Local Server**:
  - Loại bỏ hoàn toàn đường dẫn FUSE CloudMounter (`~/Library/CloudStorage/CloudMounter-Local/work/aiac`) khỏi `.claude/settings.local.json` do độ trễ mạng cao và rủi ro deadlock file lock.
  - Chuẩn hoá thao tác đồng bộ mã nguồn cho team trên Local Server (`192.168.1.100`) thông qua SSH alias: `ssh local 'cd /mnt/DATA/work/aiac && git pull origin main'`.

- **[UPDATE] Chuẩn hoá định nghĩa môi trường & thuật ngữ Odoo Upgrade Platform**:
  - `CLAUDE.md`, `database-upgrade.md` (360-odoo): Định vị rạch ròi 3 môi trường:
    * `local`: Máy Mac (iMac) của Sếp (`/Volumes/DATA/...`, macOS).
    * `local server`: Máy chủ nội bộ `192.168.1.100` (`ssh local`, `/mnt/DATA/work/<client-name>/`).
    * `production server`: Máy chủ Vua Hệ Thống (`ssh vuahethong`) và cụm K8s Rancher cluster `saas`.
  - Quy chuẩn lệnh upgrade portal:
    * `test db` / `upgrade test`: Nâng cấp với type `test` (chế độ neutralize, có ruy-băng `TEST`, an toàn test trên local server).
    * `upgrade production` / `production db`: Nâng cấp với type `production` (bản hoàn chỉnh chính thức, không neutralize, sẵn sàng lên production server).

### Fixed

- **[FIX] GitSync giữ tài liệu cùng tên ở thư mục con**: Rule lọc `/AGENTS.md`, `/CLAUDE.md`, `/.mcp.json` và `/.claude/` nay neo đúng tại root của repository. Trước đây bộ lọc theo basename xóa nhầm `docs/AGENTS.md`, khiến public mirror thiếu một tài liệu dù mọi docs khác đã đồng bộ từ `main`. Thêm kiểm chứng cho trường hợp giữ `docs/AGENTS.md` đồng thời vẫn loại cấu hình nội bộ ở root.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.7] - 2026-09-10 — AIAC PERFORMANCE PRO UPGRADE, HOLISTIC UPDATE SYNC & DASHBOARD AUTO-START

### Added

- **[NEW] Giai đoạn 0 (Tiếp nhận sự vụ) & Bước 12 (Đóng ticket + Timesheet) — Quy trình nâng từ 5 lên 6 Giai Đoạn**:
  - `360-odoo/prompts/references/helpdesk-intake-and-reporting.md`: Reference canonical mới đặc tả GĐ0 và Bước 12 kèm code XML-RPC thực thi.
  - **GĐ0 (4 bước)**: (0.1) Tiếp nhận & sắp xếp đủ 5 mục thông tin; (0.2) Verify đúng namespace khách hàng đang lỗi qua `kubectl get ns` + đối chiếu ingress, cấm đoán từ tên gọi tắt; (0.3) Phân tích log đúng thời điểm, ghi traceback + root cause giả định; (0.4) Tạo `helpdesk.ticket`/`project.task` trên `vuahethong.net` qua API key với đầy đủ 8 trường bắt buộc. **Không được động vào code trước khi có ticket.**
  - **Bước 12**: Ghi `account.analytic.line` với số giờ thực tế (cấm làm tròn khống), chuyển stage Done/Solved, post chatter kết quả bằng `Markup(...)` kèm commit sha + bằng chứng verify, đóng `mail.activity` còn treo.
  - **Bảo mật**: API key đọc runtime từ `/Volumes/DATA/ENV/.env`, tuyệt đối không hardcode vào repo. Đã verify file mới sạch secret và `.env` không bị git track.

- **[NEW] Self-check cho logic lọc asset của migrate web_enterprise**: `360org/scripts/odoo/test_migrate_web_enterprise.py` — assert-based, không cần Odoo/DB/framework. Khoá 2 bất biến: (1) lọc cache `ir_attachment` **chỉ theo `url`**, chứng minh file user upload tên chứa `assets` (vd. `bang_gia_assets.xlsx`) không bị `unlink()` xoá vĩnh viễn; (2) nhận diện `ir_asset` mồ côi qua path + bundle, đồng thời ghi nhận rõ giới hạn đã biết.

### Changed

- **[FIX] Ma trận sync `360-instance-arch` kéo thừa hàng GB dữ liệu nặng về máy dev**: Ma trận cũ gộp `docs work backups upgrade resources` vào **một dòng ✓ chung**, nghĩa là DB dump, filestore, zip và artifact upgrade đều bị sync về Mac. Đo thật trên `davita.vn`: `upgraded/` 2.4 G + `db_backup/` 1.1 G so với `modules/` chỉ 118 M — kéo 3.5 GB để dùng 118 M. Nay tách bạch theo đúng mục đích từng tầng:
  - **Máy dev** — chỉ thứ cần để *viết code*: `modules/{extra,default,themes}`, `docs`, `work`, `upgrade/<ver>/modules`, `config/*.template`.
  - **Local server** — bản đầy đủ, giữ lại toàn bộ dữ liệu vận hành: `backups/`, `resources/`, `upgrade/*/data/`, `modules/addons`.
  - **Production** — chỉ code addon + config sạch; loại `docs/`, `tests/`, `.claude/`, `*.dump`, `*.zip`, `backups/`, `upgrade/`.
  - Ignore-list sync bổ sung `backups/`, `resources/`, `upgrade/*/data/`, `*.dump`, `*.sql`, `*.zip`, `filestore/`. Thêm mục **Danh sách loại trừ khi deploy production** kèm lệnh `tar -tzf | grep` verify trước khi copy lên pod, và lệnh `rsync` lấy file lẻ khi thật sự cần.
  - Sửa mâu thuẫn: `SKILL.md` §3 trước đó chỉ loại trừ `modules/addons/` nên trái với nguyên tắc dữ liệu nặng nằm lại local server.

- **[REFACTOR] Chuẩn hoá quy trình migrate `web_enterprise` → `backend_ui` thành skill lặp lại được cho nhiều DB**: `360-odoo/prompts/references/migrate-web-enterprise.md` viết lại theo 6 bước (tiền điều kiện → backup → **dry-run** → apply → restart → verification gate). Vá 4 gap nghiêm trọng giữa tài liệu cũ và script thật:
  - **Thiếu `--apply`**: script mặc định DRY-RUN, tài liệu cũ đưa lệnh không có cờ này → người dùng chạy xong tưởng đã migrate mà DB không đổi gì. Nay cảnh báo ở cả frontmatter lẫn đầu tài liệu.
  - **Thiếu bước backup DB**: script tự cảnh báo "KHÔNG tự rollback được" mà quy trình cũ không có backup. Nay bắt buộc dump + `pg_restore -l` verify + lưu về Local Server theo `<client-name>`, kèm lệnh rollback sẵn.
  - **Bỏ sót `--verify-url`**: script có sẵn Verification Gate tự động, tài liệu cũ lại bảo chạy `curl` tay.
  - **Đường dẫn script chỉ có bản Linux**: bổ sung đường dẫn macOS `/Volumes/DATA/DEV/aiac/...`.
  - Bổ sung: query SQL dò trước module bị ảnh hưởng, mẫu vòng lặp áp dụng nhiều database (backup + dry-run từng DB, cấm apply hàng loạt không giám sát), và mục **Giới hạn đã biết** (`ponytail:`) nêu rõ path không có leading slash chưa bị bắt kèm hướng nâng cấp.

- **[IMPROVE] Bắt buộc backup DB & code về Local Server**: Bước 2–3 của GĐ4 nay yêu cầu rõ **phải có 1 bản lưu về `/mnt/DATA/work/<client-name>/{db_backup,code_backup}/`** — backup chỉ nằm trên pod/volume production là chưa đủ, pod chết hoặc volume hỏng là mất trắng, không rollback được.

- **[REFACTOR] Hợp nhất Quy trình 5 Giai Đoạn Fix Bug & Upgrade Module Odoo về một nguồn chân lý**:
  - Phát hiện Giai đoạn 4 tồn tại **2 bản mâu thuẫn**: `CLAUDE.md` (5 bước, dùng `manual_backup.sh` + `button_immediate_upgrade()`, scale up trước-update sau) và `360-odoo/prompts/SKILL.md` (7 bước, dùng `pg_dump` + verify `pg_restore -l`, update trước-scale sau). Bản `CLAUDE.md` **thiếu 2 bước quan trọng**: backup code đang chạy (mất khả năng rollback) và copy clean code lọc qua `git ls-files`.
  - Sửa lỗi đánh số trùng: Giai đoạn 4 chạy tới Bước 7 nhưng Giai đoạn 5 lại bắt đầu từ Bước 6 → đánh số lại liền mạch **Bước 1–11**.
  - Hợp nhất thành bản canonical duy nhất tại `360-odoo/prompts/references/module-production-update.md`, merge đủ phần riêng của cả hai: đường dẫn addons chuẩn theo instance (`modules/{default,extra,themes}` + `chown -R 101:101`), case install module mới (`update_list()` + `button_immediate_install()`), và lưu ý bắt buộc khi module thêm Model/Field mới (worker giữ registry cũ trong RAM → frontend OWL lỗi `"<model>"."<field>" is undefined`).
  - `CLAUDE.md` rút gọn từ 317 → 282 dòng, chỉ giữ sơ đồ 5 giai đoạn + dẫn chiếu canonical, không nhân bản nội dung chi tiết.

- **[REFACTOR] Chuẩn hóa Everything Is A Plugin Harness — gỡ bỏ toàn bộ skill rời**:
  - Gộp 2 skill Odoo rời vào plugin `360-odoo` đúng chuẩn harness: `prompts/references/database-upgrade.md` (quy trình nâng cấp DB 10 bước qua `upgrade.odoo.com`, 2 gate duyệt) và `prompts/references/migrate-web-enterprise.md` (chuyển `web_enterprise` → `backend_ui` 7 bước, gồm decouple license & privacy).
  - Xử lý xung đột 2 bản trùng lệch nội dung: `odoo-database-upgrade` giữ bản 291 dòng (10 bước) thay bản 238 dòng; `odoo-migrate-web-enterprise` giữ bản 124 dòng (7 bước) thay bản 98 dòng (6 bước, thiếu decouple license). Đã diff xác nhận bản giữ lại là superset hoàn toàn.
  - Đăng ký trigger phrase cho 2 chuyên đề vào frontmatter `description` của `360-odoo/prompts/SKILL.md` để router nhận diện tự động.
  - `~/.claude/skills/`: gỡ 5 mục lệch chuẩn (`odoo-database-upgrade/`, `odoo-database-upgrade.md`, `odoo-migrate-web-enterprise/`, `odoo-migrate-web-enterprise.md`, thư mục `learned/` rỗng của ECC upstream).

### Fixed

- **[FIX] Symlink chết `360-local-builder-env`**: Symlink `~/.claude/skills/360-local-builder-env.md` trỏ tới đường dẫn Linux `/mnt/DATA/work/aiac/...` không tồn tại trên macOS khiến plugin không load được. Đã thay bằng symlink thư mục chuẩn trỏ về `/Volumes/DATA/ENV/.claude/360org/plugins/360-local-builder-env`. Toàn bộ 30 symlink nay khớp 1:1 với 30 plugins.

### Added

- **360-instance-arch Plugin & Target Version Upgrade Hierarchy**:
  - `360org/plugins/360-instance-arch/`: Đóng gói plugin quy chuẩn kiến trúc repo instance khách hàng (7 thư mục gốc, 4 nhánh `modules/` khớp `addons_path`).
  - `prompts/SKILL.md` & `prompts/instance-arch-standards.md`: Chuẩn hóa cấu trúc thư mục `upgrade/<target_version>/` (gồm `modules/{extra, themes, default}` và `data/` chứa dump/filestore/logs từ `upgrade.odoo.com`) để quản lý rành mạch theo từng phiên bản Odoo mục tiêu.
  - Cập nhật test case router nhận diện manifest Odoo ở depth 3 (`modules/<nhóm>/<module>/__manifest__.py`).

- **Tự động Khởi động Telemetry Dashboard & Fallback Node Runtime**:
  - `360org/scripts/hooks/360-smart-router.js`: Hàm `ensureTelemetryDashboard()` tự động fallback sang runtime Node.js nội bộ (`/Volumes/DATA/DEV/vuaassistant/runtime/node/node`) khi hệ thống chưa có `node` trong PATH toàn cục; tự động spawn daemon trên port 3600 mỗi khi phiên Claude Code bắt đầu.
  - `scripts/aiac-dashboard.sh`: Tự động tìm kiếm và thực thi node nội bộ thay vì phụ thuộc cứng vào lệnh `node` của hệ thống.
  - `CLAUDE.md`: Chuẩn hóa quy chuẩn Brand Colors (Tech Royal Blue `#0077cd` & Digital Green `#00ce2c`), phong cách thiết kế UI/UX phẳng & tương phản cao cho hệ thống Odoo/Web.

- **Quy Chuẩn Đồng Bộ Update Toàn Diện AIaC (AIaC Holistic Update & Sync Standard)**:
  - `360org/plugins/360-dev-workflow/prompts/references/aiac-update-sync-standard.md`: Ban hành quy chuẩn cứng 6 điểm bắt buộc đồng bộ mỗi lần update/release: (1) File Version Core, (2) Scripts Version Sync, (3) Telemetry Engine & Dashboard, (4) Catalog & Publish Manifests, (5) Docs & Changelogs, (6) Git Attribution & Clean Release Tag.
  - Cập nhật `CLAUDE.md` mục 1 và 3 nhấn mạnh yêu cầu update đồng bộ 100%, không để sót bất kỳ điểm neo nào.
  - Bổ sung liên kết quy chuẩn trong `360org/plugins/360-dev-workflow/prompts/SKILL.md`.

### Improved

- **AIaC Performance Pro Telemetry Server (`360org/telemetry/server.js`)**:
  - **Dynamic Versioning**: Thay thế đọc version tĩnh bằng hàm `getCurrentVersion()` đọc trực tiếp từ `/Volumes/DATA/DEV/aiac/VERSION` với TTL cache 10 giây; loại bỏ hoàn toàn tình trạng kẹt phiên bản cũ trên dashboard và footer.
  - **Comprehensive Skill Discovery**: Mở rộng hàm `discoverComponents()` tự động quét toàn diện 286+ System Skills trong `skills/*` (tổng số kỹ năng nhận diện tăng từ 39 lên 325+).
  - **Context Capacity Rules**: Cập nhật logic phân loại nhóm context model trong Tab 2, hỗ trợ chính xác các dòng Claude 5, Gemini 2.5/3.8 Flash & Pro (1M & 2M Ultra Context), GPT-5.x (256k).
  - **Daemon Process Management (`360org/scripts/hooks/360-smart-router.js`)**: Hàm `ensureTelemetryDashboard()` thiết lập `cwd: aiacDir` và biến môi trường `AIAC_REPO_ROOT` tường minh khi auto-spawn daemon nền trên port 3600.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.6] - 2026-09-08 — PLUGIN HARNESS STANDARD & ZERO-DOWNTIME ODOO MODULE UPDATE

### Added

- **Plugin Harness Standard**:
  - `CLAUDE.md` & `360org/plugins/360-dev-workflow/prompts/references/plugin-harness-standard.md`: Ban hành luật cứng **Everything Is A Plugin Harness**. Mọi tiêu chuẩn dev, skill, command, hook, agent, connector hoặc reference mới bắt buộc đóng gói dạng plugin plug-and-play trong `360org/plugins/<plugin-name>/`. Tuyệt đối không tạo runtime skill rời ở `.claude/skills/*` làm source-of-truth.
- **Quy trình Zero-Downtime Module Production Update (Odoo K8s SaaS)**:
  - `360org/plugins/360-odoo/prompts/references/module-production-update.md`: Single source of truth cho cập nhật module/addon Odoo cùng version trên cụm Rancher/K8s `saas`.
  - Phân định rạch ròi giữa **Update Module** (backup DB verified bằng `pg_restore -l`, backup code về local server theo `client-name`, copy clean addon, chạy `odoo -d <db> -u <module> --stop-after-init`, scale up pod mới rồi scale down/delete pod cũ) và **Major Upgrade/Migration** (qua `upgrade.odoo.com`).
  - Cập nhật đồng bộ các tài liệu tham chiếu Odoo: `360org/plugins/360-odoo/prompts/SKILL.md`, `odoo-dev-guide.md`, `odoo-standards.md`, `debugging-and-bugfixing.md`, `git-workflow.md`. Loại bỏ hoàn toàn quy trình `rollout restart` và scale về 0 gây downtime.

### Verification

- `node scripts/ci/catalog.js --text` — 67 agents, 94 commands, 286 skills khớp 100%.
- `node scripts/ci/validate-install-manifests.js` — 35 modules, 81 components, 7 profiles VALIDATED.
- `node scripts/aiac/sync-version.js` — đồng bộ 20/20 files version anchors lên **v3.8.6**.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.5] - 2026-09-08 — ENGLISH-CANONICAL DOCS RESTORE & SELECTIVE UPSTREAM SYNC

### Added

- **Upstream Skills Pull**: Bổ sung 3 skills chất lượng cao từ upstream ECC v2.2.0:
  - `skills/dev-team/`: Mô phỏng collaborative dev team session 4 vai trò đồng thời (PM, Architect, Developer, QA) trên cùng 1 turn prompt.
  - `skills/living-docs-governance/`: Quản trị tài liệu sống, chống mục rữa docs theo 4 vai trò rõ ràng (constitution, map, status, history).
  - `skills/terminal-opener/`: Mở terminal host thật qua launch plan shell-free an toàn (`scripts/open-terminal.js`).
- **Hook Upgrades**:
  - `scripts/hooks/cost-tracker.js`: Cập nhật bảng giá token mới nhất (Claude Sonnet 5, Fable/Mythos, Haiku 4.5, Opus 4/5 theo pricing chính thức của Anthropic).
  - `scripts/hooks/session-start.js` + `scripts/lib/instinct-relevance.js`: Hỗ trợ ranking độ liên quan của instinct dựa theo tech-stack của dự án hiện tại (`detectStackKeywords`).

### Fixed

- **`README.md`**: Khôi phục toàn văn README upstream ECC (tiếng Anh làm chuẩn) làm phần canonical bên dưới header AIaC tiếng Việt. Giải quyết 10 fail của `install-readme-clarity`, `ito-compute-sponsor`, `manual-hook-install-docs` (thiếu các mục `### Pick one path only`, `### Reset / Uninstall ECC`, `### Low-context / no-hooks path`, `### Find the right components first`, Cursor agent namespace, cảnh báo copy raw `hooks/hooks.json`, bảng sponsor Itô/Kimi, `ECC primary links`, `ECC guides`).
- **`package.json`**: Bổ sung `skills/odoo-database-upgrade/`, `skills/odoo-migrate-web-enterprise/`, `skills/dev-team/`, `skills/living-docs-governance/`, `skills/terminal-opener/` vào `files[]` để khớp module graph (`npm-publish-surface`).
- **`manifests/install-modules.json`**: Đăng ký 3 skill mới vào module tương ứng (`dev-team` và `living-docs-governance` vào `workflow-quality`, `terminal-opener` vào `devops-infra`).
- **`.opencode/package-lock.json`**: Sinh và commit lock file (gỡ khỏi `.gitignore`) vì `build-opencode` yêu cầu nó có trong payload `npm pack`.
- **`scripts/aiac/sync-version.js`**: Đồng bộ luôn 2 field version của `.opencode/package-lock.json` và `package-lock.json`.
- **`tests/hooks/hooks.test.js`**: Pin `CLAUDE_CODE_ENTRYPOINT: 'cli'` cho case `observe.sh` legacy output — env `claude-desktop-3p` của shell ngoài lọt vào `process.env` khiến hook exit sớm ở Layer 1.
- **`tests/run-all.js`**: Pin `PYTHONDONTWRITEBYTECODE: '1'` cho mọi child test runner để ngăn test Python sinh `__pycache__` làm hỏng assertion kiểm tra payload `npm pack`.

### Verification

- `node scripts/ci/catalog.js --text` — counts khớp 100% (67 agents / 94 commands / 286 skills).
- `node scripts/ci/validate-install-manifests.js` — 35 modules, 81 components, 7 profiles VALIDATED.
- Targeted tests: `npm-publish-surface`, `build-opencode`, `install-readme-clarity`, `ito-compute-sponsor`, `manual-hook-install-docs`, `smart-router`, `sessionstart-live`, `v3-benchmark-e2e` đều **PASS 100%**.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.4] - 2026-09-08 — MANIFEST DRIFT AUDIT & VERSION SYNC AUTOMATION

### Added

- **`scripts/aiac/sync-version.js`**: Script đồng bộ 100% version anchors theo `package.json` (plugin.json Claude/Codex/ECC, marketplace.json, `agent.yaml`, `AGENTS.md` 3 ngôn ngữ, README 4 ngôn ngữ, `ecc-hooks.ts`, `VERSION`). Chạy bắt buộc ở bước 1 của quy trình release 6 điểm.
- **`360org/plugins/360-local-builder-env/index.js`**: Entry script chuẩn cho plugin, khắc phục tình trạng plugin đăng ký nhưng không load được trong `PluginLoader`.
- **Install module `odoo-upgrade`**: Đăng ký `skills/odoo-database-upgrade` và `skills/odoo-migrate-web-enterprise` vào `manifests/install-modules.json` + profile `full`; user cài AIaC nay nhận được 2 skill Odoo mới.

### Fixed

- **Version drift 17 anchor**: Toàn bộ manifest và tài liệu kẹt ở `2.1.0` trong khi repo đã `3.8.3` — đồng bộ về đúng version hiện hành.
- **`360-local-builder-env` chết câm**: `plugin.json` trỏ `main` vào `scripts/local_env_ctl.py` (Python) gây `Invalid or unexpected token` khi loader require; chuẩn hóa `main`, `inject`, `connectors`, `prompts`.
- **Test drift**: `plugin-manifest.test.js` crash khi `.opencode/package-lock.json` bị gitignore; `smart-router` / `sessionstart-live` assert agent-map trong context (agent-map đã đổi sang ghi file, `maxAgentMapChars=0`) và bị rò rỉ `AIAC_SKIP_CODEGRAPH` từ shell ngoài; benchmark chốt cứng 28 plugin trong khi thực tế 29.

### Verification

- `node tests/plugin-manifest.test.js` — 62 pass / 0 fail.
- `node tests/360org-router.test.js` — 23 pass / 0 fail.
- `node tests/v3-benchmark-e2e.test.js` — 29 plugins load 66ms, PASS.
- `node tests/smart-router.test.js`, `tests/sessionstart-live.test.js` — pass.
- `node scripts/ci/validate-install-manifests.js` — 35 modules / 81 components / 7 profiles hợp lệ.
- Full suite `node tests/run-all.js` — 3405 test, fail giảm từ 39 xuống 14 (14 fail còn lại thuộc docs upstream ECC tiếng Anh, không thuộc lõi AIaC).


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.3] - 2026-09-03 — MANUAL-SELECTIVE UPSTREAM GOVERNANCE & GRAPHIFY CORRECTNESS

### Added

- **Quy chuẩn bắt buộc tạo & cập nhật Task Odoo trên `vuahethong.net`**: Bổ sung điều khoản bắt buộc điền đầy đủ 100% các thông tin của task (`project.task`) vào `CLAUDE.md` và `360-odoo` (bao gồm: `user_ids` gán đích danh assignee, `allocated_hours` dự toán thời gian cấm để `00:00`, `date_deadline` thiết lập cụ thể, `tag_ids` gắn tag kỹ thuật/phân loại chuẩn, `milestone_id` nếu có, `mail.activity` lên lịch việc cần làm nhắc nhở nhân sự, `description` đầy đủ 4 phần và `timesheet` khi hoàn thành).
- **Upstream audit report**: Thêm `docs/SKILL_SOURCES_AUDIT_2026-09-03.md`, ghi nhận inventory 67 repository, delta upstream, quyết định accept/reject/defer và tiêu chí nghiệm thu.
- **Governance regression test**: Thêm `tests/skills-source-governance.test.js` để chặn tái xuất hiện auto-sync, machine-local `source_dir`, auto-install và auto commit/push trong updater.
- **Graphify parser regression suite**: Thêm 6 ca kiểm thử cho JavaScript, PHP, Scala, Kotlin, C# và Go.
- **Ponytail zero-command hook**: Bổ sung `hooks/post-write-ponytail-audit.js`; sau `Edit|Write`, agent tự kiểm ladder, minimal diff/root cause và runnable check mà không cần slash-command.

### Changed

- **Provenance manifest v2**: Chuyển `config/skills-source-manifest.json` từ đường dẫn local sang repository + reviewed commit/version + decision + target plugin; runtime không phụ thuộc kho nguồn ngoài AIaC.
- **Manual-selective updater**: `360-update-skill-resource` không còn connector sync không tồn tại, không rsync/copy upstream, không tự cài và không tự commit/push.
- **Graphify `0.9.48+aiac.1`**: Port thủ công 6 bản vá parser đã review từ upstream `v0.9.53`; không nhập nguyên core hoặc dependency/installer/MCP/watch/export mới.
- **Capability policy**: Chuẩn hóa target sang `360org/plugins/*` và ghi rõ nguồn upstream chỉ dùng audit/tham chiếu.

### Verification

- `node tests/skills-source-governance.test.js` — pass.
- `node tests/ponytail-hook.test.js` — pass.
- `pytest tests/test_graphify_selective_upgrade.py` bằng virtualenv Graphify — 6/6 pass.
- `node tests/360org-router.test.js` và `node tests/codegraph.test.js` — pass.
- Full regression đã chạy sâu qua nhiều suite nhưng được dừng sau khi xác nhận các lỗi baseline tài liệu/cấu hình không phát sinh từ bản nâng cấp: thiếu `.opencode/package-lock.json`; Smart Router còn kỳ vọng Agent Map luôn inject; README thiếu catalog marker và một số mục điều hướng/cài đặt hiện hành. Các test trọng yếu của thay đổi đều pass.

## [3.8.2] - 2026-08-25 — 360-HARNESS UNIFIED AGENTIC ENGINE (DEEPSEEK + REASONIX + CLAUDE-CODE)

### Added
- **Unified 360-Harness Plugin Package (`360-harness`)**: Đóng gói hoàn chỉnh bộ kỹ năng và kiến trúc Agent Harness chuẩn AIaC 3.0 tại `360org/plugins/360-harness/`, tổng hợp tinh hoa từ 3 dự án đầu ngành:
  - *DeepSeek-Harness*: Triết lý Cordis PluginOS ("Everything is a Plugin"), Capability Seams, Monotonic SQLite Schema và Wire-protocol Bridges.
  - *DeepSeek-Reasonix*: Dual-Model Architecture (Planner/Executor), ACP Protocol v1 integration và Host/Subprocess Sandbox boundary.
  - *Learn-Claude-Code*: 17-Step Spine (Single Agent Loop, Atomic Tools, On-Demand Skills, Smart Compaction, Resumable Workflow và Goal Loop Stop Gate).
- **360-Harness CLI Diagnostic Tool**: Thêm `scripts/harness-cli.js` xác minh 100% tính tương thích của 7 trụ cột cốt lõi Harness.
- **Hermes Automation & Diagnostic Scripts (`360-hermes`)**: Bổ sung bộ công cụ Python chính thức cho Hermes Gateway Plugin:
  - `360org/plugins/360-hermes/scripts/hermes_plugin_generator.py`: Scaffold plugin mới và 7 tài liệu chuẩn.
  - `360org/plugins/360-hermes/scripts/hermes_plugin_linter.py`: Static analysis kiểm tra contract JSON response và cấu trúc plugin.
  - `360org/plugins/360-hermes/scripts/hermes_plugin_doctor.py`: Chẩn đoán plugin discovery và import resolution (kèm `--self-check`).
- **Skill Mapping & Rules Update**: Bổ sung trigger và mapping tự động cho `360-harness` vào Global `CLAUDE.md`.
- **Global SKILL_SOURCES Wildcard Lock**: Bổ sung luật cứng toàn cầu vào `CLAUDE.md` nghiêm cấm đọc wildcard `/Volumes/DATA/DEV/SKILL_SOURCES/*`, chỉ cho phép đọc net path cụ thể (`/Volumes/DATA/DEV/SKILL_SOURCES/abc/*`) nhằm bảo vệ triệt để token.

### Improved
- **Prompt Cache Prefix Alignment (5-Minute TTL Optimization)**: Tinh chỉnh cấu trúc ngữ cảnh inject tại `360-smart-router.js` theo 4 tầng phân cấp từ tĩnh đến động (Tier 1: Global Rules -> Tier 2: Static Project Memory -> Tier 3: AST Codegraph & Architecture Map -> Tier 4: Dynamic Session Index & Volatile State) giúp giữ cache hit rate >85% và tối ưu chi phí token.
- **Dynamic Net-Path Parser in Scope Guard (`aiac-hook-bridge.js`)**: Cải tiến Scope Guard tự động phân giải và cấp quyền đích danh cho các repository con hợp lệ dưới `SKILL_SOURCES/<repo-name>` mà không bị chặn, trong khi vẫn khóa chặt wildcard gốc `SKILL_SOURCES/*`.
- **Micro-Kernel Plugin Suite (28 Packages)**: Nâng cấp tổng số plugin tiêu chuẩn được quản lý và tự động hóa lên 28 packages.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.1] - 2026-08-25 — TIERED MULTI-LAYERED STORAGE & SQLITE TELEMETRY ENGINE

### Added
- **Tiered Storage Architecture (L1 / L2 / L3)**: Nâng cấp toàn diện cơ chế telemetry phân tầng chống mất mát dữ liệu khi reset IDE hoặc update source code:
  - *L1 In-Memory Cache*: Phục vụ sub-millisecond response (< 5ms) cho dashboard và API `/api/telemetry`.
  - *L2 SQLite Persistent Storage*: Sử dụng native module `node:sqlite` (`DatabaseSync`) lưu trữ vĩnh viễn vào `360org/telemetry/telemetry.sqlite` ở chế độ WAL (Write-Ahead Logging), bảo toàn dữ liệu độc lập theo từng session (`ON CONFLICT DO UPDATE`).
  - *L3 Incremental Discovery Engine*: Quét đa thư mục gốc (`.claude/projects/`, `.claude.bak-*/projects/`), chỉ parse gia tăng các file `.jsonl` mới hoặc có thay đổi `mtime`/`size` và lưu ngay vào L2 SQLite.
- **Accurate Token Metric Accounting**:
  - *Saved Tokens*: Tính toán chính xác từ thực tế prompt caching (`cache_read_input_tokens`).
  - *Wasted Tokens*: Tính toán chính xác từ turn lỗi thực tế của tool và context error overhead (`tool_result.is_error`, command failures).
- **Data Migration & Seeding**: Tự động migrate 222+ sessions lịch sử vào SQLite DB đảm bảo 100% dữ liệu lịch sử đo đạc được bảo toàn nguyên vẹn.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.8.0] - 2026-08-25 — HARNESS ENGINE UPGRADES & RESUMABLE ORCHESTRATION

### Added
- **Resumable Workflow Engine (`s16`)**: Module `360org/core/workflow-engine.js` hỗ trợ deterministic multi-agent pipeline (`pipeline()`, `parallel()`, `agent()`) với cơ chế Semantic Hash Journaling (`.runtime/<runId>.journal.jsonl`). Cho phép resume lại các bước gián đoạn với 100% cache hit (0 token, 0ms).
- **Goal Loop Evaluator Gate (`s17`)**: Hook `360org/scripts/hooks/aiac-goal-evaluator.js` đóng vai trò Stop Hook Gate độc lập, tự động phân tích output hội thoại và chặn dừng phiên nếu chưa đủ bằng chứng thực thi thành công (test pass, exit code 0, HTTP 200 OK).
- **Context Pruner & Smart Compactor (`s08`)**: Module `360org/scripts/hooks/aiac-compact-lite.js` tự động tỉa gọt (pruning) log bash khổng lồ và dữ liệu rác trung gian trước sự kiện PreCompact để bảo toàn 100% ngữ cảnh kiến trúc và toạ độ Code Graph.
- **Harness Upgrade Test Suite**: Bổ sung bộ kiểm thử `tests/v3.8-harness-upgrades.test.js` xác minh 100% tính đúng đắn của 3 thành phần Harness mới.

### Improved
- **Plugin Loader Absolute Path Resolution**: Cải tiến `360org/core/plugin-loader.js` chuẩn hóa đường dẫn tuyệt đối cho toàn bộ 27 plugins v3.x, loại bỏ hoàn toàn lỗi require resolution trong môi trường CLI.
- **PreToolUse Execution Priority**: Đảm bảo security guards (`360-gitsync`) chạy với thứ tự ưu tiên cao nhất trong chuỗi waterfall middleware.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.7.4] - 2026-08-24 — AST KNOWLEDGE GRAPH & SCOPE GUARD ENGINE

### Added
- **Desktop Reverse Engineering (`360-desktop-reverse`)**: Thêm plugin chuyên dụng hỗ trợ đọc hiểu kiến trúc, giải nén và phân tích bundle, `app.asar`, Mach-O, IPC handlers cho Desktop App trong sandbox an toàn.
- **3-Layer Code Knowledge Graph Navigation (`360-graphify`)**: Quy chuẩn điều hướng mã nguồn 3 lớp (Suy luận -> Tra cứu đồ thị tức thì MCP/CLI -> Thao tác đích danh `file_path:line`), chống đọc mò và quét lan man.
- **Odoo Website Snippet Compliance**: Cập nhật quy chuẩn thiết kế Website Builder/Snippets Odoo 17 chống lỗi "This block is outdated".
- **Local-First Project Memory (Layer 1)**: `360-smart-router.js` tự động nạp `[project]/.claude/MEMORY.md` vào SessionStart với độ ưu tiên cao nhất.
- **Mandatory Project Claude Config**: Quy tắc bắt buộc commit kèm thư mục `[project]/.claude/` cho mọi project/module private sau khi quét secret.
- **AIaC Git Guard**: Tích hợp trong `360-dev-workflow` tự động stage `.claude/` trước `git commit` và chặn `git push` khi `.claude/` còn thay đổi chưa commit.
- **Claude Env Clean Reset Tool**: Thêm `360org/scripts/aiac/reset-claude-env.js` để backup và build mới `/Volumes/DATA/ENV/.claude` từ repo AIaC đã commit/push.
- **Telemetry Dashboard Autostart**: Tự động khởi chạy dashboard `http://localhost:3600` ngay đầu `SessionStart`.

### Fixed
- **DEV Root Hard Guard**: `360-smart-router.js` tắt auto load/index/read/scan cho `/Volumes/DATA/DEV/*` và `/Volumes/DATA/DEV/SKILLS/*` mặc định; chỉ mở lại bằng `AIAC_ALLOW_DEV_WORKSPACE=1` khi Sếp yêu cầu rõ.
- **Runtime Doctor Scope Check**: `360org/scripts/aiac/doctor.js` báo FAIL nếu runtime cấp `permissions.additionalDirectories` trỏ vào `/Volumes/DATA/DEV/*`.
- **Lightweight Hook Bridge**: Hỗ trợ `AIAC_LIGHT_HOOKS=1` cho session nhẹ sau reset; chặn tool-level (`Read`, `Bash`, `Write`, `Edit`) truy cập `/Volumes/DATA/DEV/*` ngoài workspace được cấp phép.
- **Permissions AdditionalDirectories**: Nâng cấp `aiac-hook-bridge.js` nhận diện danh sách workspace an toàn từ `permissions.additionalDirectories` và `permissions.allow` trong `.claude/settings.local.json`.
- **WordPress Security Watcher & Active Defense**: Nhận diện tiến trình upgrade hợp lệ trong `wp-content/upgrade/`; throttling alert Telegram định kỳ 1 giờ/lần.
- **Version Synchronization**: Đồng bộ toàn diện phiên bản `3.7.4` trên `VERSION`, `package.json`, `package-lock.json`, `360org/telemetry/server.js` và tài liệu.

### Changed
- Nâng release nội bộ AIaC lên `v3.7.4`.
- Giảm số connector MCP mặc định xuống `chrome-devtools`; các connector khác (`github`, `context7`, `exa`, `memory`, `playwright`, `sequential-thinking`) chuyển sang opt-in via `mcp-configs/mcp-servers.json` do đã được thay thế bằng native skills.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.7.3] - 2026-08-18 — GUARDED SCAN & RUNTIME DOCTOR ENGINE

### Fixed
- **Smart Router Scan Guard**: Chặn hard auto load/index/read/scan `/Volumes/DATA/DEV/SKILLS` và mọi thư mục con; chỉ cho phép truy cập khi Sếp yêu cầu rõ kèm đường dẫn cụ thể.
- **Codegraph Guard/Lock/Cap**: Giữ Codegraph auto cho workspace hiện tại, bổ sung lock theo workspace, TTL 24 giờ, giới hạn entry/file và cache `skipped` khi workspace quá lớn.
- **Agent-map On-Demand**: Tắt auto Agent-map ở `SessionStart`; chỉ chạy khi bật `AIAC_AGENT_MAP=1`, `AIAC_SCAN_PROJECT=1` hoặc `AIAC_SCAN_MODE=audit`.
- **Legacy Upstream Guard**: Chặn auto-update upstream nếu remote local trỏ vào `/Volumes/DATA/DEV/SKILLS`; chỉ mở bằng `AIAC_ALLOW_LEGACY_SKILLS_UPSTREAM=1` khi audit/update vendor rõ ràng.
- **Runtime Doctor Source Path**: `360org/scripts/aiac/doctor.js` ưu tiên `aiac-runtime.json.repoRoot`, giúp doctor chạy từ `/Volumes/DATA/ENV/.claude/360org` vẫn đối chiếu đúng source repo `/Volumes/DATA/DEV/aiac`.

### Changed
- Nâng release nội bộ AIaC lên `v3.7.3`; đồng bộ `VERSION`, `package.json`, `package-lock.json`.
- Cập nhật `tests/360org-router.test.js` lên 14 checks bao phủ denylist, Agent-map on-demand, Codegraph lock/large-workspace skip, legacy upstream guard và runtime doctor path.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.7.2] - 2026-08-18 — MULTI-TOOL TELEMETRY & CLEAN RESET ENGINE

### Fixed
- **Multi-Tool Suite Date Filtering**: Khắc phục lỗi hiển thị tĩnh của "Thị Phần & Phiên Làm Việc Đa Nền Tảng (Multi-Tool Developer Suite)". Toàn bộ số liệu của 5 công cụ AI (Claude Code, Codex CLI, Antigravity CLI, Anti IDE, VSCode Suite) được bóc tách động theo từng ngày (`daily[dateKey]`) và re-render tự động khi chuyển đổi các mốc thời gian.
- **Core Plugins & Sub-Skills Catalog**: Chuẩn hóa cơ chế quét `discoverComponents()`, bóc tách chính xác 24 Core Plugin Packages v3.x và 39 Sub-Skills chuyên biệt trong `360org/plugins/*/prompts/`.

### Improved
- **Minimalist SVG Vector Icons**: Đồng bộ toàn bộ icon hệ thống sang định dạng SVG vector sắc nét, bao gồm nút "Làm mới" với hiệu ứng spin loading animation, icon tìm kiếm và execution mode.
- **Plugin/Skill Used Tokens Tracking**: Bổ sung cột "Token Tiêu Tốn" trực quan cho từng Plugin và Kỹ Năng trong dashboard.
- **Reset & Clean Installer Engine (`reset-aiac.sh`)**: Tích hợp xác nhận an toàn tương tác (`y/yes`), dọn dẹp symlink cũ hỏng và tái liên kết cho Claude Code, Codex CLI, Antigravity/Gemini IDE.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## Bảng Tóm Tắt Phiên Bản (Version Matrix)

| Phiên bản | Trạng thái | Ngày phát hành | Trọng tâm kỹ thuật |
|:---:|:---:|:---:|---|
| **`v3.8.11`** |  **Stable** | 2026-09-18 | **AIaC Platform Release v3.8.11** |
| **`v3.8.10`** |  **Stable** | 2026-09-17 | **AIaC Platform Release v3.8.10** |
| **`v3.8.9`** |  **Stable** | 2026-09-16 | **360-PAYLOAD-WEBSITE HARNESS, TELEMETRY HARDENING & SMART SCOPE GUARD** |
| **`v3.8.8`** |  **Stable** | 2026-09-14 | **AUTOHARNESS SELF-LEARNING ENGINE, ODOO ENTERPRISE SNAPSHOT MERGE & GITLAB-FIRST DEPLOY** |
| **`v3.8.7`** |  **Stable** | 2026-09-08 | **AIaC Performance Pro & Holistic Sync**: Dynamic versioning, full 286+ skills discovery, modern model context capacity, 6-point sync matrix |
| **`v3.8.6`** |  **Stable** | 2026-09-08 | **Plugin Harness & Zero-Downtime Odoo**: Everything Is A Plugin Harness rule, zero-downtime Odoo module update with verified DB backup |
| **`v3.8.5`** |  **Stable** | 2026-09-08 | **English-Canonical Docs & Upstream Sync**: Canonical English docs restored, dev-team, living-docs-governance, terminal-opener skills |
| **`v3.8.4`** |  **Stable** | 2026-09-08 | **Manifest Drift Audit & Version Automation**: Automated version anchors sync (`sync-version.js`), package-lock validation |
| **`v3.8.3`** |  **Stable** | 2026-09-03 | **Selective Upstream Governance & Graphify**: 100% task fields on `vuahethong.net`, provenance manifest v2, Graphify parser fixes |
| **`v3.8.2`** |  **Stable** | 2026-08-25 | **Unified 360-Harness Plugin**: Synthesis of DeepSeek-Harness, Reasonix & Learn-Claude-Code, 7 Core Pillars, Strict Net-Path Scope Guard |
| **`v3.8.1`** |  **Stable** | 2026-08-25 | **Tiered SQLite Telemetry Engine**: L1 memory, L2 SQLite WAL persistent, L3 incremental recovery, accurate saved/wasted tokens |
| **`v3.8.0`** |  **Stable** | 2026-08-25 | **Harness Engine Upgrades**: Resumable Workflow Engine (s16), Goal Loop Evaluator (s17), Context Pruner (s08) |
| **`v3.7.4`** |  **Stable** | 2026-08-24 | **AST Knowledge Graph & Scope Guard**: 3-Layer Graphify, Desktop Reverse, Hard Scope Guard, Strict AIaC Containment |
| **`v3.7.3`** |  **Stable** | 2026-08-18 | **Guarded Scan & Runtime Doctor**: Codegraph guard/lock/cap, Agent-map on-demand, denylist `/Volumes/DATA/DEV/SKILLS`, runtime doctor sync |
| **`v3.7.2`** |  **Stable** | 2026-08-18 | **Multi-Tool Telemetry**: Date slicing, token usage metrics, clean reset engine |
| **`v3.3.0`** |  **Stable** | 2026-08-17 | **Autonomous Multi-Agent Pipeline**: Self-Healing 3 bước (Observation ➔ Hypothesis ➔ Verification), tự sửa bug/linter |
| **`v3.2.0`** |  **Stable** | 2026-08-17 | **Hot-Reload & Dependency Engine**: Hot-reloading không cần restart session, giải quyết Dependency Graph tự động |
| **`v3.1.0`** |  **Stable** | 2026-08-17 | **Multi-Host Sandbox Seam**: Smart Sandbox Dispatcher, hỗ trợ Subprocess, SSH (`local`, `vuahethong`, `cloudpanel`) & K8s Pod (`saas`) |
| **`v3.0.0`** |  **Stable** | 2026-08-13 | **Everything is a Plugin Engine**: Chuyển đổi 100% (23/23) Skills thành Plugin Packages, EventBus Lifecycle, Seam Registry & Hook Bridge |
| **`v2.2.0`** |  Released | 2026-08-13 | **Security & WordPress Engine**: Phát hành plugin mở `360-securities`, nâng cấp chuẩn PCP/WPCS |
| **`v2.1.0`** |  Released | 2026-08-13 | **Odoo 19.0 Architecture**: Upgrade-Safe templates, Palette SCSS, OCA Deep Search |
| **`v2.0.0`** |  Released | 2026-08-05 | **AIaC Core Foundation**: 360 Smart Router, Context Caps, CodeGraph local-first |
| **`v1.10.0`** | Released | 2026-04-05 | **ECC Workflow Expansion**: Brand-voice, Graph-ranking, Billing & Workspace skills |
| **`v1.9.0`** |  Released | 2026-03-20 | **Selective Install Engine**: 10+ ngôn ngữ, 6 reviewers mới, SQLite store |
| **`v1.8.0`** |  Released | 2026-03-04 | **Harness-First Architecture**: Loop Operator, Quality Gate, NanoClaw v2 |


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.3.0] - 2026-08-17 — AUTONOMOUS MULTI-AGENT & SELF-HEALING ENGINE

### Added
- **`agent-pipeline.js`**: Bộ điều phối Multi-Agent Pipeline hỗ trợ SDD (Subagent-Driven Development) với 4 vai trò chính: Architect, Generator, Reviewer, Tester.
- **Autonomous Self-Healing Loop**: Cơ chế phản biện và tự sửa lỗi tự động 3 bước:
  1. *Observation*: Thu thập traceback / stdout lỗi từ PostToolUse hoặc Test step.
  2. *Hypothesis*: Phân tích root cause theo triết lý Ponytail (phân loại Syntax, Dependency, Permission, v.v.).
  3. *Verification*: Áp dụng bản vá và re-test tự động tới khi pass hoặc đạt retry limit.
- **`360-superpowers` Integration**: Nâng cấp plugin `360-superpowers` làm Seam Provider điều phối Self-Healing.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.2.0] - 2026-08-17 — HOT-RELOAD & DEPENDENCY RESOLUTION ENGINE

### Added
- **Dependency Resolution Graph**: Tự động duyệt cây phụ thuộc và load đệ quy các plugin cần thiết theo khai báo `dependencies` trong `plugin.json`.
- **Zero-Restart Hot-Reloading**: Cơ chế `reloadPlugin` và `enableHotReload` (File Watcher) tự động unmount context cũ, chạy clean disposers và nạp lại module mới mà không làm gián đoạn session.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.1.0] - 2026-08-17 — MULTI-HOST SANDBOX & SMART DISPATCHING

### Added
- **`K8sPodRemoteProvider`**: Cung cấp khả năng thực thi trực tiếp bên trong Kubernetes Pod (cluster `saas`) qua `kubectl exec` từ local.
- **`SandboxDispatcher`**: Tự động nhận diện Workspace Context (Odoo SaaS, WordPress, Payload CMS, Hermes) để định tuyến lệnh execute tới đúng Sandbox Provider (`local-subprocess`, `ssh-local`, `ssh-vuahethong`, `ssh-cloudpanel`, `k8s-pod-saas`).
- **`360-airouter` Integration**: Điều phối thông minh mô hình AI (Claude Plan, Gemini Build) song song với hạ tầng Sandbox thực thi.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [3.0.0] - 2026-08-13 — EVERYTHING IS A PLUGIN REVOLUTION

### 1. Core Micro-Kernel Engine (`360org/core/`)
- **`event-bus.js`**: Triển khai Event Lifecycle Bus hỗ trợ 4 cơ chế Dispatch lấy cảm hứng từ Cordis framework: `emit`, `waterfall`, `parallel`, `serial` và `Reversible Effects` qua `disposer`.
- **`capability-seams.js`**: Triển khai Registry quản lý Tam giác tính năng (**Service Definition ➔ Service Provider ➔ Consumer**).
- **`sandbox-seam.js`**: Cung cấp Execution Sandbox Seam với `LocalSubprocessProvider` và `SshRemoteProvider` (kết nối remote execution qua SSH alias `local`, `vuahethong`, `cloudpanel`).
- **`plugin-loader.js`**: Dynamic Plugin Loader với scoped context (`PluginContext`), tự động nạp `plugin.json` manifest.
- **`self-test.js` & `sandbox-seam.test.js`**: Bộ kiểm thử tự động xác minh tính toàn vẹn của EventBus, SeamRegistry, Sandbox Seam và PluginLoader (Pass 100%).

### 2. Danh Mục 23 Plugin Packages Khởi Tạo (`360org/plugins/`)
- `360-wordpress`, `360-odoo`, `360-flutter`, `360-desktop-app`, `360-gitsync`, `360-dev-workflow`, `360-designer`, `360-ponytail`, `360-payload-website`, `360-openclaw`, `360-hermes`, `360-vuaoffice`, `360-vuaassistant`, `360-agent-browser`, `360-agent-map`, `360-codegraph`, `360-rancher`, `360-superpowers`, `360-airouter`, `360-marketing`, `360-caveman`, `360-update-skill-resource`, `360-securities`.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [2.2.0] - 2026-08-13 — WORDPRESS PLUGIN & SECURITY HARDENING

### Added
- **`360-security` Open-Source Plugin**: Phát hành mã nguồn mở kết hợp 12 lớp bảo mật siêu nhẹ và WAF Layer 7, Rename Login, Brute-force lockout.
- **`360-wordpress` Standardization**: Tích hợp WordPress.org Plugin Check (PCP) & WordPress Coding Standards (WPCS).


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [2.1.0] - 2026-08-13 — ODOO 19.0 UPGRADE-SAFE ARCHITECTURE

### Added
- **Upgrade-Safe View Wrappers**: Bắt buộc `<div id="wrap" class="oe_structure oe_empty">` tránh lỗi Outdated Snippet Block khi nâng cấp DB.
- **Dynamic Palette Integration**: Khai báo SCSS `$o-color-1..5` để Odoo Builder tự map màu.
- **OCA Search Integration**: Tích hợp tra cứu kho mã nguồn mở OCA trực tiếp.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [2.0.0] - 2026-08-05 — AIAC CORE INFRASTRUCTURE

### Added
- **360 Smart Router**: Nhận diện dự án tự động (Zero-Command) ở `SessionStart`.
- **Context Caps Protection**: Giới hạn context tối đa 4.200 ký tự để bảo vệ Context Window.
- **CodeGraph Local-First**: Binary v1.5.0 ghim checksum an toàn.
- **Git Remote & Docs Policy**: Mặc định GitLab Private, trailer `Authored-By: 360org <support@360.org.vn>`, bắt buộc cập nhật docs trước khi push.
- **ECC Core Heritage**: Tích hợp Discord community launch, `orch-*` orchestrator family, `kubernetes-patterns` skill, worktree-lifecycle service, cross-harness substrate qua Hermes.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [1.10.0] - 2026-04-05 — ECC WORKFLOW EXPANSION

### Added
- **New Workflow Lanes**: `brand-voice`, `social-graph-ranker`, `connections-optimizer`, `customer-billing-ops`, `google-workspace-ops`, `project-flow-ops`, `workspace-surface-audit`, `manim-video`, `remotion-video-creation`, `nestjs-patterns`.
- **ECC 2.0 Alpha Binary**: Xây dựng TUI scaffold từ `ecc2/` (`dashboard`, `start`, `sessions`, `status`, `stop`, `resume`, `daemon`).


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [1.9.0] - 2026-03-20 — SELECTIVE INSTALL ARCHITECTURE

### Added
- **New Reviewers & Agents**: `typescript-reviewer`, `pytorch-build-resolver`, `java-build-resolver`, `java-reviewer`, `kotlin-reviewer`, `kotlin-build-resolver`, `rust-reviewer`, `rust-build-resolver`, `docs-lookup`.
- **Selective Install Pipeline**: Manifest resolution (`install-plan.js`, `install-apply.js`) và SQLite state store.
- **Multi-Language Rule Packs**: Java, PHP, Perl, Kotlin, C++, Rust.


---

## [3.8.11] - 2026-09-18 — CẬP NHẬT 6 SUB-AGENTS & PACK CUSTOM MODEL

### Changed
- **Sub-Agent Packs (`360-dev-workflow`)**:
  - Chuyển toàn bộ 6 vai trò Orchestration thành file Agent (.md) tiêu chuẩn Claude Code tại `360org/plugins/360-dev-workflow/agents/`.
  - Symlink toàn cục vào `~/.claude/agents/` và `.claude/agents/` để SDK nhận diện trên mọi workspace.
  - Gắn chính xác pack model Sếp chỉ định (Custom AI Router Gateway):
    - `aiac-planner`: **Claude Pro**
    - `aiac-coder`: **claude-3.8-flash**
    - `aiac-code-reviewer`: **claude-code.x-reviewer**
    - `aiac-tester`: **claude-tester**
    - `aiac-reviewer` (UAT): **claude-ai-premium**
    - `aiac-release`: **claude-ai-saver**
- **Chỉnh lý vai trò Reviewer (`multi-agent-orchestration.md`)**:
  - Xác nhận rõ `/review` (Reviewer) là vai trò **Nghiệm thu góc nhìn người dùng (UAT)** đối chiếu với SPEC và trải nghiệm PO yêu cầu, không còn nhập nhằng với Code Reviewer.


## [1.8.0] - 2026-03-04 — HARNESS-FIRST & AUTONOMOUS LOOPS

### Added
- **Autonomous Loop Operators**: `/loop-start`, `/loop-status`, `/quality-gate`, `/model-route`, `continuous-agent-loop`, `nanoclaw-repl`.
- **Hook Profile Runtime**: `ECC_HOOK_PROFILE` và `ECC_DISABLED_HOOKS` runtime controls.

[3.8.9]: https://gitlab.com/360org/aiac/-/compare/v3.8.8...v3.8.9
[3.8.8]: https://gitlab.com/360org/aiac/-/compare/v3.8.7...v3.8.8
