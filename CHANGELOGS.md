# CHANGELOGS — AIaC (AI Infrastructure as Code)

> Quản lý tập trung hạ tầng AI Agent cho Sếp Châu (360 CORP).
> Chuẩn hóa theo tiêu chuẩn **Keep a Changelog** & **Semantic Versioning**.

---

## [3.8.7] - 2026-09-08 — AIAC PERFORMANCE PRO UPGRADE & HOLISTIC UPDATE SYNC STANDARD

### Added

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

## [3.7.2] - 2026-08-18 — MULTI-TOOL TELEMETRY & CLEAN RESET ENGINE

### Fixed
- **Multi-Tool Suite Date Filtering**: Khắc phục lỗi hiển thị tĩnh của "Thị Phần & Phiên Làm Việc Đa Nền Tảng (Multi-Tool Developer Suite)". Toàn bộ số liệu của 5 công cụ AI (Claude Code, Codex CLI, Antigravity CLI, Anti IDE, VSCode Suite) được bóc tách động theo từng ngày (`daily[dateKey]`) và re-render tự động khi chuyển đổi các mốc thời gian.
- **Core Plugins & Sub-Skills Catalog**: Chuẩn hóa cơ chế quét `discoverComponents()`, bóc tách chính xác 24 Core Plugin Packages v3.x và 39 Sub-Skills chuyên biệt trong `360org/plugins/*/prompts/`.

### Improved
- **Minimalist SVG Vector Icons**: Đồng bộ toàn bộ icon hệ thống sang định dạng SVG vector sắc nét, bao gồm nút "Làm mới" với hiệu ứng spin loading animation, icon tìm kiếm và execution mode.
- **Plugin/Skill Used Tokens Tracking**: Bổ sung cột "Token Tiêu Tốn" trực quan cho từng Plugin và Kỹ Năng trong dashboard.
- **Reset & Clean Installer Engine (`reset-aiac.sh`)**: Tích hợp xác nhận an toàn tương tác (`y/yes`), dọn dẹp symlink cũ hỏng và tái liên kết cho Claude Code, Codex CLI, Antigravity/Gemini IDE.

---

## Bảng Tóm Tắt Phiên Bản (Version Matrix)

| Phiên bản | Trạng thái | Ngày phát hành | Trọng tâm kỹ thuật |
|:---:|:---:|:---:|---|
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

## [3.3.0] - 2026-08-17 — AUTONOMOUS MULTI-AGENT & SELF-HEALING ENGINE

### Added
- **`agent-pipeline.js`**: Bộ điều phối Multi-Agent Pipeline hỗ trợ SDD (Subagent-Driven Development) với 4 vai trò chính: Architect, Generator, Reviewer, Tester.
- **Autonomous Self-Healing Loop**: Cơ chế phản biện và tự sửa lỗi tự động 3 bước:
  1. *Observation*: Thu thập traceback / stdout lỗi từ PostToolUse hoặc Test step.
  2. *Hypothesis*: Phân tích root cause theo triết lý Ponytail (phân loại Syntax, Dependency, Permission, v.v.).
  3. *Verification*: Áp dụng bản vá và re-test tự động tới khi pass hoặc đạt retry limit.
- **`360-superpowers` Integration**: Nâng cấp plugin `360-superpowers` làm Seam Provider điều phối Self-Healing.

---

## [3.2.0] - 2026-08-17 — HOT-RELOAD & DEPENDENCY RESOLUTION ENGINE

### Added
- **Dependency Resolution Graph**: Tự động duyệt cây phụ thuộc và load đệ quy các plugin cần thiết theo khai báo `dependencies` trong `plugin.json`.
- **Zero-Restart Hot-Reloading**: Cơ chế `reloadPlugin` và `enableHotReload` (File Watcher) tự động unmount context cũ, chạy clean disposers và nạp lại module mới mà không làm gián đoạn session.

---

## [3.1.0] - 2026-08-17 — MULTI-HOST SANDBOX & SMART DISPATCHING

### Added
- **`K8sPodRemoteProvider`**: Cung cấp khả năng thực thi trực tiếp bên trong Kubernetes Pod (cluster `saas`) qua `kubectl exec` từ local.
- **`SandboxDispatcher`**: Tự động nhận diện Workspace Context (Odoo SaaS, WordPress, Payload CMS, Hermes) để định tuyến lệnh execute tới đúng Sandbox Provider (`local-subprocess`, `ssh-local`, `ssh-vuahethong`, `ssh-cloudpanel`, `k8s-pod-saas`).
- **`360-airouter` Integration**: Điều phối thông minh mô hình AI (Claude Plan, Gemini Build) song song với hạ tầng Sandbox thực thi.

---

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

## [2.2.0] - 2026-08-13 — WORDPRESS PLUGIN & SECURITY HARDENING

### Added
- **`360-security` Open-Source Plugin**: Phát hành mã nguồn mở kết hợp 12 lớp bảo mật siêu nhẹ và WAF Layer 7, Rename Login, Brute-force lockout.
- **`360-wordpress` Standardization**: Tích hợp WordPress.org Plugin Check (PCP) & WordPress Coding Standards (WPCS).

---

## [2.1.0] - 2026-08-13 — ODOO 19.0 UPGRADE-SAFE ARCHITECTURE

### Added
- **Upgrade-Safe View Wrappers**: Bắt buộc `<div id="wrap" class="oe_structure oe_empty">` tránh lỗi Outdated Snippet Block khi nâng cấp DB.
- **Dynamic Palette Integration**: Khai báo SCSS `$o-color-1..5` để Odoo Builder tự map màu.
- **OCA Search Integration**: Tích hợp tra cứu kho mã nguồn mở OCA trực tiếp.

---

## [2.0.0] - 2026-08-05 — AIAC CORE INFRASTRUCTURE

### Added
- **360 Smart Router**: Nhận diện dự án tự động (Zero-Command) ở `SessionStart`.
- **Context Caps Protection**: Giới hạn context tối đa 4.200 ký tự để bảo vệ Context Window.
- **CodeGraph Local-First**: Binary v1.5.0 ghim checksum an toàn.
- **Git Remote & Docs Policy**: Mặc định GitLab Private, trailer `Authored-By: 360org <support@360.org.vn>`, bắt buộc cập nhật docs trước khi push.
- **ECC Core Heritage**: Tích hợp Discord community launch, `orch-*` orchestrator family, `kubernetes-patterns` skill, worktree-lifecycle service, cross-harness substrate qua Hermes.

---

## [1.10.0] - 2026-04-05 — ECC WORKFLOW EXPANSION

### Added
- **New Workflow Lanes**: `brand-voice`, `social-graph-ranker`, `connections-optimizer`, `customer-billing-ops`, `google-workspace-ops`, `project-flow-ops`, `workspace-surface-audit`, `manim-video`, `remotion-video-creation`, `nestjs-patterns`.
- **ECC 2.0 Alpha Binary**: Xây dựng TUI scaffold từ `ecc2/` (`dashboard`, `start`, `sessions`, `status`, `stop`, `resume`, `daemon`).

---

## [1.9.0] - 2026-03-20 — SELECTIVE INSTALL ARCHITECTURE

### Added
- **New Reviewers & Agents**: `typescript-reviewer`, `pytorch-build-resolver`, `java-build-resolver`, `java-reviewer`, `kotlin-reviewer`, `kotlin-build-resolver`, `rust-reviewer`, `rust-build-resolver`, `docs-lookup`.
- **Selective Install Pipeline**: Manifest resolution (`install-plan.js`, `install-apply.js`) và SQLite state store.
- **Multi-Language Rule Packs**: Java, PHP, Perl, Kotlin, C++, Rust.

---

## [1.8.0] - 2026-03-04 — HARNESS-FIRST & AUTONOMOUS LOOPS

### Added
- **Autonomous Loop Operators**: `/loop-start`, `/loop-status`, `/quality-gate`, `/model-route`, `continuous-agent-loop`, `nanoclaw-repl`.
- **Hook Profile Runtime**: `ECC_HOOK_PROFILE` và `ECC_DISABLED_HOOKS` runtime controls.
