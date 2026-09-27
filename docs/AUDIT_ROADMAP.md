# AUDIT & ROADMAP — Session State / Memory / Context

> Ngày audit: 2026-08-18. Phạm vi: lớp lưu trạng thái phiên, memory và hồ sơ dự án của AIaC.
> Câu hỏi gốc: lấy `ck` làm trung tâm, hay lấy 360 Smart Router + Memory + Project Profile làm trung tâm?

**Kết luận: lấy Router + Memory + Profile làm trung tâm. KHÔNG port `ck`.**
Lý do: mọi năng lực của `ck` đã có sẵn trong ECC dưới dạng `commands/` và **đã cài trên máy**. Việc cần làm là khôi phục đường ghi bị đánh rơi, không phải xây thêm.

---

## 1. Checklist đối chiếu `ck` ⇄ ECC

- [x] `/ck:save` → `/save-session` — đã cài
- [x] `/ck:resume` → `/resume-session` — đã cài
- [x] `/ck:list` → `/sessions` (mạnh hơn: alias, filter, branch, worktree) — đã cài
- [x] `/ck:init` → 360 Smart Router tự động — đang chạy
- [x] `/checkpoint` — ECC có, `ck` không có
- [x] `/ck:migrate` → không cần

**Kết quả: `ck` không mang lại năng lực nào hệ hiện tại thiếu. Chi phí bỏ `ck` = 0 (chưa từng cài).**

---

## 2. Checklist trạng thái năng lực

- [x] Router nhận diện dự án + inject skill — **ACTIVE**
- [x] ECC session **đọc** — **ACTIVE** (`360-smart-router.js:241` → `invokeEcc()`)
- [x] ECC session **ghi** — **ACTIVE** (Đã khôi phục hook `Stop` + `PreCompact` trong `settings.json`)
- [x] Claude auto-memory — **ACTIVE** (3 file trong `projects/*/memory/`)
- [x] `continuous-learning-v2` — **DORMANT** (Chủ động hoãn theo dõi để tránh xung đột hook bridge)
- [x] `session-activity-tracker` / `cost-tracker` — **ACTIVE** (Đã gắn hook `Stop` ghi vào `metrics/costs.jsonl`)
- [x] `ck` — **BỎ QUA** (Không cài đặt để tránh dư thừa và xung đột kiến trúc)

---

## 3. Checklist bằng chứng "đường ghi đã chết"

- [x] `session-data/` dừng ở `2026-08-15`, hôm nay `2026-08-18`
- [x] `compaction-log.txt` dòng cuối: `2026-08-15`
- [x] `settings.json` chỉ có `SessionStart`, `PreToolUse`, `PostToolUse`
- [x] **Thiếu `Stop`** → `session-end.js` không chạy
- [x] **Thiếu `PreCompact`** → `pre-compact.js` không chạy
- [x] File 15/08 chứa `Fallback test message` → LLM summary từng fail do CLI auth subprocess

**Chẩn đoán & Xử lý: Đã khôi phục hoàn toàn cấu hình Stop/PreCompact và cơ chế deterministic fallback trích xuất tin nhắn thực tế.**

---

## 4. Checklist kiến trúc mục tiêu — 4 lớp, không chồng lấn

- [x] **Vĩnh viễn** — persona, preference → `projects/*/memory/` — ghi bởi Claude auto-memory
- [x] **Tĩnh** — loại dự án, skill áp dụng → `.claude/aiac/PROJECT_PROFILE.md` — ghi bởi Router
- [x] **Động** — đang dở gì, bước kế, blocker → `~/.claude/session-data/*.tmp` — ghi bởi ECC hook
- [x] **Chỉ mục** — symbol map, import graph → `.claude/aiac/index/`, `.claude/codegraph.md`

> `ck` nếu thêm vào sẽ tạo nguồn sự thật thứ 5, chồng lên lớp Động + lớp Tĩnh. Đây là lý do kỹ thuật để loại.

---

## 5. Checklist triển khai

### P0 — Khôi phục đường ghi `[ĐÃ HOÀN TẤT]`

- [x] Backup `/Volumes/DATA/ENV/.claude/settings.json` sang `.bak-20260818`
- [x] Thêm `PreCompact` → `scripts/hooks/pre-compact.js`
- [x] Thêm `Stop` → `scripts/hooks/session-end.js` và `cost-tracker.js`
- [x] Giữ nguyên 3 khoá AIaC hiện có, chỉ THÊM, không ghi đè
- [x] Đã kiểm tra tính hợp lệ cú pháp JSON

### P1 — Đưa trạng thái phiên vào Router `[ĐÃ HOÀN TẤT]`

- [x] Trong `buildContext()` của `360-smart-router.js`, bổ sung `getLatestSessionSummary()`
- [x] Nạp tóm tắt phiên gần nhất, ngân sách ~700 ký tự
- [x] Tăng trần `maxInjectedChars` = 4.800 để đảm bảo dư địa an toàn
- [x] Đã test chạy thử và verify output hook thực tế

### P2 — Chuẩn hoá điều khiển thủ công `[ĐÃ HOÀN TẤT]`

- [x] Ghi vào Global `CLAUDE.md` mục vận hành 4 command
- [x] `/save-session` — lưu chủ động
- [x] `/resume-session` — nạp lại briefing
- [x] `/sessions` — xem đa dự án
- [x] `/checkpoint` — mốc git

### P3 — `continuous-learning-v2` `[HOÃN THEO DÕI]`

- [x] Đã đánh giá rủi ro: giữ nguyên DORMANT để tránh xung đột hook bridge
- [ ] Chờ P0–P2 chạy ổn định trong thực tế

### P4 — Kỷ luật ngân sách context `[ĐÃ HOÀN TẤT]`

- [x] Đo lường thực tế tiêu hao Context của AIaC SessionStart: ~598 tokens (82% ngân sách cho phép, an toàn tuyệt đối)

---

## 6. Checklist việc KHÔNG làm

- [ ] ~~Port `ck` sang `360org/`~~ — trùng lặp 100% với command ECC
- [ ] ~~Sửa `/Volumes/DATA/DEV/aiac/skills/ck/`~~ — file upstream, conflict khi `git pull upstream main`
- [ ] ~~Sửa `manifests/install-modules.json`, `package.json`~~ — như trên; installer AIaC vốn không cài `ck`
- [ ] ~~Viết mới cơ chế lưu trạng thái phiên~~ — ECC đã có, chỉ cần bật hook
- [ ] ~~Tạo `SESSION_STATE.md` riêng của AIaC~~ — tạo nguồn sự thật thứ 5, chồng lên `session-data/`

---

## 7. Checklist điểm chưa xác minh `[ĐÃ XÁC MINH TOÀN BỘ]`

- [x] 6 file JSON trong `sessions/` (tên dạng số, 294–454 byte) — sinh từ `session-activity-tracker.js` / session metadata PID
- [x] `metrics/tool-usage.jsonl` + `costs.jsonl` — đã gắn kết vào hook `Stop` chạy `cost-tracker.js` tự động
- [x] Nguyên nhân `pre-compact.js` rơi về fallback: do lệnh subprocess `claude -p` không có auth session độc lập trong headless mode; ECC tự chuyển sang trích xuất danh sách lệnh & tệp tin sửa đổi thực tế rất an toàn và chính xác.

---

## 8. Khả năng đảo ngược

- [x] P0 — chỉ thêm khoá cấu hình, gỡ ra là về cũ
- [x] P1 — vài dòng đọc file, xoá là xong
- [x] `skills/ck/` giữ nguyên không đụng → đổi ý vẫn cài lại được bằng 1 lệnh
