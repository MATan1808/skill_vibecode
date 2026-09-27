# Audit sâu AIaC — 2026-09-14

> Phạm vi: read-only. Không sửa code, không xoá file, không commit/push trong lượt audit này.
> Phương pháp: đọc mã nguồn đang chạy + chạy 13 case kiểm chứng trong sandbox tạm (`mktemp -d`, HOME giả, AIAC_ROOT giả) để không chạm queue/ledger/memory thật.

---

## 0. Kết luận một dòng

AIaC **không thiếu tính năng, mà thiếu tính đúng**: nhiều trụ cột được khai báo trong tài liệu và `plugin.json` nhưng không có mã chạy tương ứng, còn lớp tự học và telemetry đang tạo ra dữ liệu sai lệch. Hướng cải tiến hiệu quả nhất không phải thêm trí thông minh mới, mà là **nối lại những gì đã viết, sửa chỗ đo sai, gỡ lớp trưng bày**.

---

## 1. Bằng chứng đã kiểm chứng (13/13 case chạy thật, 0 fail)

Sandbox cô lập: bản sao `aiac-auto-distiller.js` được vá `AIAC_ROOT` trỏ vào thư mục tạm; `HOME` trỏ vào thư mục tạm.

| # | Case | Kết quả |
|---|---|---|
| 1 | Directive dạng `content: [{type:'text'}]` → trích được 1 bài học, đúng domain | PASS |
| 2 | Cùng một directive xuất hiện 2 lần trong 1 batch → sinh **2 candidate trùng nhau** | PASS (lỗi) |
| 3 | Lỗi rồi về sau có chữ "passed" → sinh `RESOLVED_PITFALL` **dù không hề có Edit nào** | PASS (lỗi) |
| 4 | Secret **không có dấu nháy** (`api_key: ABCDEF…`) → lọt qua gate, lưu **nguyên văn** vào queue | PASS (lỗi) |
| 5 | Approve vào plugin **không tồn tại** → báo `approved: 1`, xoá khỏi queue, ghi ledger APPROVED, **không ghi được gì** | PASS (lỗi) |
| 6 | Plugin export `{ activate() }` → loader **không bao giờ gọi** `activate` | PASS (lỗi) |
| 7 | Dependency vòng a↔b → **Maximum call stack size exceeded**, không phải bị từ chối | PASS (lỗi) |
| 8 | Goal gate: goal thất bại + quá `maxTurns` → **đóng goal là hoàn tất** | PASS (lỗi) |
| 9 | Test con exit 1 nhưng in `Failed: 0` → `run-all.js` **exit 0** | PASS (lỗi) |
| 10 | Transcript thật (6.347 dòng): không có event `tool_result` top-level, không có field `output` | PASS (lỗi) |
| 11 | Telemetry đếm `FIX_VERIFY`, distiller chỉ ghi `RESOLVED_PITFALL` | PASS (lỗi) |
| 12 | `.claude/commands/agent-device.md` là symlink **tự trỏ vào chính nó** → đọc ra `ELOOP` | PASS (lỗi) |
| 13 | `aiac-compact-lite.js` trả `hookEventName: 'PreCompact'` — schema Claude Code từ chối | PASS (lỗi) |

Mô phỏng vòng đời 1 bài học qua đúng công thức `getAutoHarnessStats()`: một bài học được đề xuất rồi duyệt, một bài học được đề xuất rồi từ chối → dashboard báo **Pending: 2** trong khi thực tế **Pending: 0**.

---

## 2. P1 — Lỗi đang gây hại ngay

### 2.1 AutoHarness có thể nuốt bài học và báo thành công giả
[aiac-auto-distiller.js:317](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js:317) xoá proposal khỏi queue **trước** khi ghi vào plugin; toàn bộ phần ghi nằm trong `try { … } catch (_) {}` ([:329-343](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js:329)). Nếu domain sai chính tả hoặc đĩa lỗi: proposal biến mất, ledger vẫn ghi APPROVED, CLI vẫn in "✅ Đã phê duyệt và áp dụng". Case 5 tái hiện được.

**Sửa tối thiểu**: ghi reference thành công trước, chỉ xoá khỏi queue sau; domain không tồn tại thì trả lỗi thay vì nuốt.

### 2.2 Gate chống lộ secret bị thủng ở hai chỗ
- [:96](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js:96) dùng `[[:space:]]` — cú pháp POSIX, **trong JavaScript regex nó là character class chứa các ký tự `:`, `a`, `c`, `e`, `p`, `s`**, không phải khoảng trắng. Rule mask gần như không bao giờ khớp.
- [:103](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js:103) chỉ chặn secret **có dấu nháy**. `api_key: glpat-xxx` không nháy thì lọt.

Hệ quả: secret có thể vào `pending-proposals.json`, `learning-ledger.jsonl` (đều tracked trong git) và `~/.claude/aiac/latest-learnings.json`, rồi được nạp lại vào context mỗi SessionStart. Case 4 tái hiện được.

### 2.3 Bộ test có thể xoá dữ liệu thật của Sếp
[aiac-auto-distiller.test.js:107](/Volumes/DATA/DEV/aiac/tests/aiac-auto-distiller.test.js:107) dọn dẹp bằng:
```
content.replace(/### \[\d{4}-\d{2}-\d{2}\] Test Directive[\s\S]*$/g, '')
```
`[\s\S]*$` **xoá mọi thứ từ marker tới cuối file** — kể cả bài học thật được duyệt sau đó. Test còn ghi thẳng vào queue/ledger/`~/.claude/aiac/latest-learnings.json` thật, và **không dọn** file latest-learnings. Đây chính là nguồn gốc của `M auto-learned-rules.md` đang lơ lửng trong working tree.

### 2.4 `/agent-device` là symlink tự trỏ vào chính nó
`.claude/commands/agent-device.md` đã được commit ở mode `120000` trỏ về đúng đường dẫn của chính nó; `~/.claude/commands/agent-device.md` trỏ tiếp vào đó. Cả hai đọc ra `ELOOP`. Command này **chưa từng chạy được**, dù changelog ghi đã tích hợp.

### 2.5 `run-all.js` có thể báo xanh khi test thật sự fail
[run-all.js:110](/Volumes/DATA/DEV/aiac/tests/run-all.js:110) và [:116](/Volumes/DATA/DEV/aiac/tests/run-all.js:116): `totalFailed += failedMatch ? 0 : 1`. Nếu test con exit 1 nhưng có in chuỗi `Failed: 0` ở đâu đó, suite cộng 0 và kết thúc exit 0. Case 9 tái hiện được. Ngoài ra không có timeout cho mỗi test — một test treo là treo cả suite (đúng những gì đã xảy ra ở lượt trước).

---

## 3. P2 — Đo sai, dẫn tới quyết định sai

### 3.1 Dashboard AutoHarness đang đếm sự kiện chứ không đếm trạng thái
`getAutoHarnessStats()` trong [telemetry/server.js](/Volumes/DATA/DEV/aiac/360org/telemetry/server.js) coi ledger (**event log, chỉ ghi thêm**) như bảng trạng thái:
- `totalLearned = số dòng ledger` → 1 bài học qua 2 giai đoạn đếm thành 2.
- Bài học đã APPROVED hoặc REJECTED **vĩnh viễn vẫn tính là pending**, vì dòng PROPOSED cũ còn nằm đó.
- `pendingCount = Math.max(historicalPending, queue.length)` → không bao giờ giảm.

Hiện tại ledger còn nhỏ (3 event) nên sai số chưa lộ, nhưng sai số **tăng đơn điệu theo thời gian**. Mô phỏng ở mục 1 cho thấy pending thật 0 → dashboard báo 2.

### 3.2 `FIX_VERIFY` đếm một loại không ai ghi
Telemetry đếm `obj.type === 'FIX_VERIFY'`; distiller chỉ ghi `RESOLVED_PITFALL`. Ô này **luôn bằng 0** bất kể hệ thống học được gì.

### 3.3 "Token được bảo vệ" là phép nhân hằng số
`estimatedTokensProtected = approved * 25000 + pending * 15000`. Đây là con số bịa theo công thức, không phải đo lường. Nó vừa kế thừa sai số của `pendingCount`, vừa được trình bày như bằng chứng cải tiến. Tương tự, `wastedTokens` trong `parseJsonlFile` là heuristic (`toolErrorCount * 150 + 5% input`), và `saved` thực chất là `cache_read_input_tokens` — cache-read không đồng nghĩa với token tiết kiệm được nhờ AIaC.

**Khuyến nghị**: mọi số suy đoán phải gắn nhãn `~ ước lượng` trên UI, hoặc bỏ hẳn. Một con số sai được tô màu xanh còn nguy hiểm hơn không có số.

### 3.4 Trạng thái luôn là "Active" bất kể hook có chạy hay không
`status: 'Active (Autonomous Continuous Distillation)'` là chuỗi cứng. Nếu Stop hook bị gỡ, dashboard vẫn báo Active.

---

## 4. P2 — Cỗ máy tự học đang học sai nguồn

### 4.1 Signal B (Fix-Verify) chết trên dữ liệu thật
Distiller tìm `ev.type === 'tool_result'` và `ev.output`. Transcript thật của phiên này (6.347 dòng) chỉ có các type: `assistant`, `attachment`, `user`, `system`, `custom-title`, `mode`, `queue-operation`, `last-prompt`, `atis-latch` — **0 event `tool_result`, 0 field `output` top-level**. Kết quả tool nằm lồng trong `message.content`. Nửa cơ chế học từ lỗi đang chạy trên schema không tồn tại; nó chỉ pass trong unit test vì test tự dựng schema giả.

### 4.2 Khi Signal B khớp thì tiêu chí lại quá lỏng
Không yêu cầu có Edit, không so khớp lệnh, không đọc exit code thật — chỉ cần trong 8 event sau có chuỗi `PASS`/`passed`/`0 failed`. Case 3 chứng minh: lỗi + một câu "em đã xem" + output pass là đủ sinh bài học. Đáng chú ý, chuỗi `0 failed` cũng xuất hiện khi test **thất bại** ở suite khác.

### 4.3 Chống trùng không có tác dụng trong cùng một lượt
`existingHashes` chỉ nạp một lần lúc đầu và **không cập nhật trong vòng lặp** ([:165](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js:165)). Case 2: cùng directive lặp 2 lần → 2 proposal giống hệt.

### 4.4 Nhận diện transcript có thể vớ nhầm phiên
`findLatestSessionFile()` không nhận `transcript_path` từ stdin của Stop hook — dù [aiac-stop-pipeline.js:20](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/aiac-stop-pipeline.js:20) đã đọc `rawInput` rồi **vứt đi**. Nó tự dò theo mtime, và nếu không thấy thì quét **toàn bộ** thư mục projects, lấy file mới nhất của **bất kỳ dự án nào**. Chạy song song 2 phiên Claude là có thể học nhầm của nhau.

### 4.5 Đọc transcript kiểu tốn bộ nhớ
`readRecentSessionEvents` đọc `readFileSync` **toàn bộ** file rồi mới `slice(-600)`. File hiện tại 9,6 MB. "600 dòng cuối" không tiết kiệm được gì.

### 4.6 Bài học được nạp lại không hề lọc theo ngữ cảnh
[360-smart-router.js:493](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/360-smart-router.js:493) `getAutoLearnedInsights()` lấy **2 mục đầu tiên** của file global, không lọc domain, không lọc workspace. Bài học Odoo vẫn được nạp vào phiên Flutter. Tương tự, `getDynamicContextualMemory()` ([:475](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/360-smart-router.js:475)) khớp memory bằng điều kiện `chứa tên thư mục **hoặc** chứa chữ "odoo"` — mọi dự án trên đời đều được nạp memory Odoo.

---

## 5. P2 — Cấu hình lệch và mã "trưng bày"

### 5.1 Nguồn phát hành khác hẳn máy đang chạy
| Sự kiện | `config/claude/settings.overlay.json` (nguồn phát hành) | `~/.claude/settings.json` (máy Sếp) |
|---|---|---|
| Stop | `aiac-compact-lite.js` | `aiac-stop-pipeline.js` |

Nghĩa là: máy Sếp có AutoHarness chạy ở Stop, còn **bất kỳ máy nào cài từ overlay canonical đều không có**. Đây là lệch nguồn chân lý, không phải "AutoHarness không chạy".

### 5.2 Compactor quảng cáo việc nó không làm
[aiac-compact-lite.js](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/aiac-compact-lite.js): hàm `pruneLargeOutput` được viết, export, **và không được gọi ở đâu trong entrypoint**. Hook chỉ ghi 3 dòng JSON trạng thái rồi trả về câu "Ngữ cảnh đã được dọn dẹp và nén tối ưu. Giữ trọn vẹn toạ độ Code Graph". Không có việc tỉa gọt nào diễn ra. Thêm nữa, output khai `hookEventName: 'PreCompact'` — **Claude Code từ chối schema này** (đã thấy lỗi validation thật ngay trong phiên hôm nay).

### 5.3 Stop pipeline mô tả 3 việc, làm 1
Comment đầu file liệt kê goal evaluation / distill / bảo toàn session. Thực tế chỉ spawn distiller. `rawInput` đọc rồi bỏ. Không gọi goal evaluator, không lưu session.

### 5.4 Goal Gate (trụ cột 7) chưa từng được nối dây
`git grep` toàn repo: `aiac-goal-evaluator` chỉ xuất hiện ở 1 comment, 1 dòng changelog và 1 unit test. **Không có đăng ký trong settings nào.** Nó là mã chết. Và khi được nối, nó vẫn có 3 khuyết tật: `0 failed` bị `includes('failed')` bắt thành thất bại; goal có điều kiện lạ mặc định trả `completed: true`; quá `maxTurns` thì đánh dấu **hoàn tất** dù chưa hề có bằng chứng (case 8).

### 5.5 Loader và plugin nói hai ngôn ngữ khác nhau
[plugin-loader.js:167-177](/Volumes/DATA/DEV/aiac/360org/core/plugin-loader.js:167) chỉ chấp nhận `module.exports = function` hoặc object có `.apply`. [360-harness/index.js:15](/Volumes/DATA/DEV/aiac/360org/plugins/360-harness/index.js:15) export `{ activate, deactivate }`. **`activate` không bao giờ được gọi** (case 6) → seam `harness/360-unified-engine` chưa từng được đăng ký. Loader còn: bắt exception rồi vẫn `set()` vào `loadedPlugins` và emit `plugin/loaded` (báo nạp thành công khi đã lỗi); `reloadPlugin` không khôi phục watcher nên hot-reload chỉ chạy được **một lần**; dependency vòng gây tràn stack chứ không bị từ chối (case 7) — comment ở [:110](/Volumes/DATA/DEV/aiac/360org/core/plugin-loader.js:110) ghi "Tránh cycle dependency" nhưng `visited` là cục bộ mỗi lần gọi.

### 5.6 8/10 hook khai báo trong plugin.json trỏ vào file không tồn tại
```
360-desktop-app   -> hooks/post-write-desktop-check.js
360-dev-workflow  -> hooks/pre-git-push-docs-guard.js
360-dev-workflow  -> hooks/stop-devtrack-checkpoint.js
360-flutter       -> hooks/post-write-dart-analyze.js
360-harness       -> scripts/harness-init.js
360-harness       -> scripts/harness-stop-guard.js
360-odoo          -> hooks/post-write-odoo-linter.js
360-wordpress     -> hooks/post-write-wp-linter.js
```
Đáng lưu ý: `pre-git-push-docs-guard` chính là cơ chế cưỡng chế luật "cập nhật docs trước khi push" trong CLAUDE.md — luật đó hiện **hoàn toàn dựa vào em nhớ**, không có gì chặn. Cũng cần nói rõ: dù có file, `AIAC_LIGHT_HOOKS=1` đang bật nên plugin middleware **không được nạp**; chỉ Scope Guard chạy.

### 5.7 Router tự chặn chính repo AIaC
[360-smart-router.js:323](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/360-smart-router.js:323) `isForbiddenDevWorkspace()` chặn **mọi thư mục con** của `/Volumes/DATA/DEV`, không trừ AIaC. Chính phiên này nhận được:
> `[AIaC] /Volumes/DATA/DEV/* workspace: auto load/index/read/scan disabled.`

Tức là khi Sếp làm việc ngay trên AIaC: không nhận diện dự án, không nạp local memory, không nạp bài học, không gợi ý skill — router thoát sớm ở [:697](/Volumes/DATA/DEV/aiac/360org/scripts/hooks/360-smart-router.js:697). CLAUDE.md lại quy định AIaC root **luôn được phép**. Đây là mâu thuẫn trực tiếp giữa luật và mã, và là lý do lớn nhất khiến hệ thống "kém thông minh" trong chính các phiên phát triển AIaC.

Vài điểm nhỏ cùng file: `maxAgentMapChars = 0` khiến agent-map dù có sinh cũng không bao giờ được nạp; `detectAndTuneContextWindow()` gán `process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS` **trong tiến trình hook con**, không ảnh hưởng tiến trình Claude cha — không có tác dụng; `ensureTelemetryDashboard` có fallback hardcode node ở repo khác (`/Volumes/DATA/DEV/vuaassistant/runtime/node/node`); `localRules` có khoá `v-assistant` nhưng `detectProject` trả `desktop-app` — nhánh rule đó chết.

---

## 6. P3 — Rác và trùng lặp (đã đo bằng hash nội dung, git-aware)

5.637 file tracked, **73 nhóm trùng nội dung byte-for-byte**. Tách bạch:

**Vendor upstream Graphify — 28 nhóm, KHÔNG nên đụng.** Đó là ma trận skill theo IDE (`skills/claude/`, `skills/amp/`, `skills/codex/`…) của upstream, trùng là do thiết kế của họ.

**Của AIaC — 45 nhóm, ~2,2 MB dư.** Đáng xử lý:

| Nhóm | Bản sao | Ghi chú |
|---|---|---|
| `360-securities/prompts/securities/` | **3 bản** của toàn bộ scripts + references, ở `references/` + `skills/wp-audit-hardening/` + `wp-audit-website/` | Nặng nhất; `audit.sh` 15,4 KB × 3 |
| `360-openclaw` vs `360-payload-website` | 5 file reference giống hệt | Đúng loại "2 bản cùng một skill" mà CLAUDE.md cấm. Cần chọn 1 canonical |
| `360-ponytail/prompts/references/` | `ponytail-*/SKILL.md` vs `skills/ponytail-*/SKILL.md` — 5 cặp | Trùng cấu trúc thư mục |
| `360-update-skill-resource/reports/` | 5 report ngày 2026-08-13 giống hệt nhau, + 2 report 08-15 | Log chạy, không phải nguồn |
| `.agents/skills/` vs `skills/` vs `.cursor/skills/` | brand-discovery, competitive-*, frontend-slides | 3 nơi giữ cùng nội dung |
| `.claude/commands/proposals.md` vs `commands/proposals.md` | 2 bản | |
| `.opencode/commands/harness-audit.md` vs `commands/harness-audit.md` | 2 bản | |
| `assets/images/security/` | `attack-chain.png` = `attack-vectors.png` (950 KB); `sandboxing-comparison.png` = `sandboxing.png` (1.068 KB) | 2 MB thuần trùng |

Cần nói rõ hai điều để không kết luận vội: (1) `node_modules` **không hề bị commit** — 0 file tracked, nên "repo phình" không phải do dependency; (2) `.codegraph/` là cache local em tạo trong lúc audit, đang `??` untracked, **cần được ignore chứ không commit**.

---

## 7. Lộ trình đề xuất — sửa ít nhất, lợi nhiều nhất

Xếp theo tỉ lệ lợi ích/diff:

**Đợt 1 — chặn mất mát và lộ lọt (diff nhỏ, giá trị cao nhất)**
1. Đảo thứ tự trong `approveProposal`: ghi thành công rồi mới xoá khỏi queue; domain không tồn tại → trả lỗi.
2. Sửa `[[:space:]]` → `\s`; bỏ ràng buộc dấu nháy trong `hasSecret`.
3. Sửa regex dọn dẹp trong test → chỉ xoá đúng block của test; chuyển test sang `AIAC_ROOT`/`HOME` tạm (đúng cách sandbox em vừa dùng ở mục 1); dọn cả `latest-learnings.json`.
4. Xoá symlink `agent-device.md` hỏng, ghi lại thành file thật.
5. `run-all.js`: exit-code của test con là nguồn chân lý; thêm timeout mỗi test.

**Đợt 2 — thôi đo sai**
6. `getAutoHarnessStats`: gộp ledger theo `contentHash`, lấy **trạng thái cuối cùng**; `pendingCount` đọc thẳng từ queue.
7. Đổi `FIX_VERIFY` → `RESOLVED_PITFALL`.
8. Gắn nhãn `~ ước lượng` cho mọi con số suy đoán, hoặc bỏ ô "token được bảo vệ".
9. `status` phản ánh việc hook Stop có thực sự được đăng ký hay không.

**Đợt 3 — nối dây hoặc gỡ bỏ (chọn một, đừng để lửng lơ)**
10. `360-smart-router`: miễn trừ AIaC repo root khỏi `isForbiddenDevWorkspace` — đây là thay đổi một dòng nhưng mở lại toàn bộ lớp thông minh cho chính các phiên làm AIaC.
11. Đồng bộ `settings.overlay.json` với `~/.claude/settings.json` (chốt Stop dùng `aiac-stop-pipeline.js`).
12. Chuyển `transcript_path` từ stdin Stop hook vào distiller; đọc transcript theo dòng thay vì nạp cả 9,6 MB.
13. Signal B: hoặc viết lại theo schema `message.content` thật, hoặc tắt hẳn. Hiện tại nó vô dụng ở ngoài và quá lỏng ở trong.
14. `plugin-loader`: hỗ trợ `activate` (2 dòng) hoặc đổi `360-harness/index.js` sang `apply` (1 dòng); đừng `set()` plugin khi entry đã ném lỗi.
15. 8 hook khai báo mà không tồn tại: viết thật (ưu tiên `pre-git-push-docs-guard`) hoặc xoá khỏi manifest.
16. Goal Gate: nối dây + sửa 3 khuyết tật, hoặc xoá khỏi tài liệu để không tự tin nhầm.
17. Compactor: gọi `pruneLargeOutput`, sửa `hookEventName` cho hợp schema, hoặc bỏ câu quảng cáo sai.

**Đợt 4 — dọn rác**
18. `360-securities`: giữ 1 bản canonical, còn lại symlink (đúng mô hình 29 SKILL.md đang chạy tốt).
19. Chốt `360-openclaw` hay `360-payload-website` là nguồn chân lý cho 5 reference trùng.
20. Xoá report trùng, ảnh trùng; thêm `.codegraph/` vào `.gitignore`.

---

## 8. Những gì đang tốt, không nên đụng

- **Native SKILL.md symlink**: cả 29/29 đều là relative link (`prompts/SKILL.md`) và đọc được — đây là mẫu đúng cho việc chống trùng lặp ở mục 7.18.
- **Không commit `node_modules`**: 0 file tracked.
- **`run-all.js` strip Git env + `PYTHONDONTWRITEBYTECODE`**: hai biện pháp cô lập tốt, có comment giải thích rõ lý do.
- **Trần context có tính toán** trong router (3.200 ký tự, có cap từng tầng).
- **Approval gate về mặt ý tưởng**: tách đề xuất khỏi áp dụng là đúng; vấn đề nằm ở cách thực thi, không ở thiết kế.
- **Scope Guard** vẫn chạy cả khi light-hooks bật — phần bảo vệ không bị tắt theo.
- **CodeGraph local-first**: index 1.730 file / 20.013 node / 59.925 edge trong 5,0s, telemetry tắt.

---

## 9. Điều em chưa kiểm chứng (nói rõ để Sếp không tin nhầm)

- **Chưa chạy lại toàn bộ `node tests/run-all.js`.** Lượt trước em dừng giữa chừng và đã báo "pass" khi chưa đủ căn cứ — em đính chính. Em cố ý chưa chạy lại vì test hiện hành ghi vào queue/ledger/memory **thật** (mục 2.3); nên sửa cô lập trước rồi mới chạy.
- **Dashboard cổng 3600 chưa được kiểm chứng trên trình duyệt.** Lượt trước em nói "mượt mà 100%" — cái đó vượt bằng chứng. Em mới chỉ xác nhận `node -c` pass và endpoint `/api/telemetry/ranking` trả JSON. MCP `chrome-devtools` trong phiên này timeout sau 30s.
- **Attribution plugin trong telemetry**: heuristic đoán theo chuỗi con của lệnh Bash, nên một lệnh `grep` chỉ *nhắc đến* tên plugin cũng có thể bị tính là một lượt dùng. Em chưa đo được sai số thực tế.
- **Chưa kiểm** khả năng mất dữ liệu do 2 tiến trình distiller chạy song song ghi `pending-proposals.json` (không có lock, `writeFileSync` toàn file). Về mã là có rủi ro, nhưng em chưa dựng được ca đua thực tế.
- **Chưa đọc** repo ngoài `/Volumes/DATA/DEV/SKILL_SOURCES/*` trong lượt audit này.

---

*Audit thực hiện bằng đọc mã nguồn trực tiếp + CodeGraph định vị + 13 case kiểm chứng sandbox. Các subagent bị chặn model (`model_not_found`) nên toàn bộ kết luận là kiểm chứng thủ công.*
