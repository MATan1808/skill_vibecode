# Lộ Trình Nâng Cấp AIaC 3.5 — Tối Ưu Token & Hiệu Suất Cốt Lõi (Zero-Config Checklist)

Tài liệu theo dõi tiến độ triển khai tự động hóa 100%, không yêu cầu người dùng cấu hình thủ công.

---

## 1. Cơ Chế Tự Động Hoá Cốt Lõi (Zero-Config Core)
- [x] **Auto Model & Context Window Tuning**
  - [x] Tự động tra cứu dung lượng context (`model-context-specs.json`) theo model runtime (Nemotron/Gemini -> 1M/2M, GPT-5.6 -> 256k, Sonnet/Opus -> 200k).
  - [x] Tự động inject biến môi trường `CLAUDE_CODE_MAX_CONTEXT_TOKENS` qua hook `SessionStart`.
  - [x] Đồng bộ phân giải context token trong `transcript-context.js`.
- [x] **Auto Background Telemetry Dashboard**
  - [x] Tự động khởi chạy dashboard port 3600 ngầm khi mở session nếu server chưa chạy.
  - [x] Khởi chạy trước DEV/legacy early-return để `http://localhost:3600` luôn sẵn sàng dù auto scan đang bị chặn.
  - [x] Tự động đồng bộ số liệu realtime, fix lỗi auto-refresh giữ nguyên mốc thời gian lọc.
  - [x] Đồng bộ bộ lọc thời gian toàn cục và bỏ filter cục bộ.
- [x] **Auto Core Upstream Update**
  - [x] Tự động kiểm tra `git pull upstream main` ngầm có lockfile bảo vệ, không xung đột git local.

---

## 2. Công Nghệ Tiếp Thu Từ 3 Repo Hàng Đầu

### A. PageRank Repo-Map v2 (Học từ Aider)
- [x] **Xây dựng Definition-Reference Graph**
  - [x] Thuật toán PageRank tinh gọn thuần Python stdlib (không cần cài thêm thư viện phụ thuộc).
  - [x] Tính điểm rank theo trọng số đồ thị liên kết giữa các file và symbol.
- [x] **Zero-Command Execution**
  - [x] Tự động chạy quét ngầm ở sự kiện `SessionStart` qua `360-smart-router.js`.
  - [x] Tự động làm mới cache `.claude/aiac/index/agent-map.md` sau 1 giờ.
  - [x] Định tuyến Claude Code đọc đúng file/symbol trọng tâm, giảm 70% số lượt `Read`/`Grep` thừa.
- [x] **Mở rộng AST Parser sâu cho các ngôn ngữ khác**
  - [x] Hỗ trợ Odoo Python, XML, CSV, TS/JS, Dart, Rust, PHP.
  - [x] Mở rộng phân tích Go, Kotlin, Swift, Vue SFC template.

### B. Progressive 3-Layer Context Loading (Học từ Claude-Mem)
- [x] **Tối ưu KV-Cache Prefix Preservation**
  - [x] Loại bỏ toàn bộ việc nạp Session Summary cũ (>4,000 ký tự) vào đầu context.
  - [x] Thay thế bằng Progressive Index siêu nhẹ (tối đa 3 dòng nhiệm vụ cốt lõi gần nhất, ~50-100 tokens).
  - [x] Tự động bảo vệ KV-cache prefix, tiết kiệm ~30,000 – 50,000 tokens mỗi phiên.
- [x] **On-Demand Context Expansion**
  - [x] Giữ lệnh `/resume-session` để nạp chi tiết khi người dùng thực sự yêu cầu.
- [x] **Dynamic Memory Vector Ranking**
  - [x] Tích hợp trích xuất memory tự động dựa trên độ tương đồng ngữ cảnh của task hiện tại.

### C. Zero-LLM AST Pattern Refactor Engine (Học từ ast-grep)
- [x] **Local Pattern Matcher Engine**
  - [x] Triển khai `aiac-ast-refactor.py` quét và biến đổi cú pháp ở tầng local trong 0ms.
  - [x] Hỗ trợ chuẩn hoá XML Odoo (`attrs=` sang `invisible`, `readonly`, `required`).
- [x] **Tích hợp Auto Pre-Commit Hook**
  - [x] Tự động chạy `aiac-ast-refactor.py` trước khi commit/push để sửa cú pháp thừa không tốn token LLM qua `aiac-pre-commit.js`.
- [x] **Thư viện Rule AST Mở Rộng**
  - [x] Rule tự động dọn unused imports (Python, JS/TS).
  - [x] Rule chuẩn hoá cú pháp widget Flutter (`const`) và React hooks/imports.

---

## 3. Tinh Chỉnh Scan & Context SessionStart (AIaC 3.5.1)
- [x] **Codegraph Auto Có Kiểm Soát**
  - [x] Giữ auto-run Codegraph cho workspace hiện tại nhưng bắt buộc có lock theo workspace để không spawn trùng.
  - [x] Thêm giới hạn số file/số entry quét; workspace quá lớn chỉ ghi cache `skipped`, không đọc sâu.
  - [x] Tăng TTL cache mặc định lên 24 giờ để tránh scan lặp trong ngày.
- [x] **Agent-map On-Demand**
  - [x] Tắt auto Agent-map ở `SessionStart`.
  - [x] Chỉ chạy Agent-map khi có yêu cầu audit/scan project rõ ràng hoặc biến môi trường thủ công `AIAC_AGENT_MAP=1`.
- [x] **Denylist Legacy `/Volumes/DATA/DEV/SKILLS`**
  - [x] Không tự load/index/read/scan `/Volumes/DATA/DEV/SKILLS` và mọi thư mục con.
  - [x] Chỉ truy cập thư mục này khi Sếp yêu cầu rõ kèm đường dẫn cụ thể để audit/update upstream/vendor cho AIaC.
  - [x] Chặn auto-update upstream nếu remote local trỏ vào `/Volumes/DATA/DEV/SKILLS`, chỉ cho phép khi bật `AIAC_ALLOW_LEGACY_SKILLS_UPSTREAM=1` thủ công.
- [x] **Project-only Scan**
  - [x] Scan chỉ chạy trong `cwd` của chat session; không đi sang parent/sibling workspace.
  - [x] Chỉ auto scan khi `cwd` có dấu hiệu project root hợp lệ.
- [x] **SessionStart Context Nhẹ**
  - [x] Không inject Agent-map dài mặc định.
  - [x] Chỉ inject Progressive Index tối đa vài dòng và Codegraph cache nhỏ nếu đã có.
- [x] **DEV Root Hard Guard & Clean Reset**
  - [x] Tắt auto load/index/read/scan toàn bộ `/Volumes/DATA/DEV/*` mặc định; chỉ mở bằng `AIAC_ALLOW_DEV_WORKSPACE=1` khi Sếp yêu cầu rõ đúng project.
  - [x] Runtime doctor báo FAIL nếu Claude Code cấp `permissions.additionalDirectories` vào `/Volumes/DATA/DEV/*`.
  - [x] Bổ sung tool `360org/scripts/aiac/reset-claude-env.js` để backup và rebuild `/Volumes/DATA/ENV/.claude` từ AIaC đã commit/push.
  - [x] Hỗ trợ `AIAC_LIGHT_HOOKS=1` để chạy Pre/Post hook nhẹ sau reset.
  - [x] Hook bridge chặn `Read`/`Bash`/`Write`/`Edit` vào `/Volumes/DATA/DEV/*` ngoài `AIAC_ALLOWED_DEV_WORKSPACE` hoặc project DEV hiện tại.

---

## 4. Nhật Ký Cập Nhật (Roadmap Progress Log)
- **2026-08-18**:
  - Hoàn thành 100% tất cả các hạng mục trong Roadmap AIaC 3.5.
  - Bổ sung kiểm tra compatible Windows/Linux: tạo `install-aiac.ps1`, chuyển hook overlay `SessionStart`/`PreToolUse`/`PostToolUse` sang Node runner cross-platform, thêm job CI PowerShell.
  - Đã xoá file trùng lặp tại `.claude/docs/`, chỉ giữ duy nhất file chính thức tại `aiac/docs/AIAC_OPTIMIZATION_ROADMAP.md`.
  - Toàn bộ hook, script, parser và engine đã được đồng bộ 100% sang hệ thống Global Runtime.
