# AutoHarness: Cơ Chế Tự Học & Tự Tối Ưu Hóa Kỹ Năng AIaC (Self-Learning Skill Layer)

> **CANONICAL** — Tài liệu đặc tả Trụ cột 8 của Kiến trúc `360-harness`: Cơ chế tự động chắt lọc bài học thực tế, cập nhật, sáp nhập và tối ưu hóa các skill trong hệ sinh thái AIaC.
> Tổng hợp và nâng cấp từ mã nguồn **AutoHarness** (`tigerless-labs/autoharness`).

---

## 1. Triết Lý & Bài Toán Giải Quyết

Trong quá trình vận hành hệ thống AIaC (với hơn 30 core plugins như `360-odoo`, `360-vcloud`, `360-instance-arch`, `360-flutter`...), một thách thức lớn thường xuất hiện:
1. **Phân mảnh & Trùng lặp (Accretion of Near-Duplicates)**: Khi gặp sự cố mới (vd: fix lỗi CSS Odoo, sửa cấu hình Rancher), nếu không có cơ chế so sánh, AI sẽ tạo ra hàng chục file skill nhỏ lẻ, manh mún, chồng chéo lên nhau.
2. **Thiếu Bằng Chứng & Nguồn Gốc (Untracked Provenance)**: Skill được sửa hoặc thêm mới nhưng không ai biết vì sao sửa, sửa trong phiên nào, và bằng chứng nào chứng minh giải pháp đó là đúng.
3. **Mâu Thuẫn Quy Chuẩn (Self-Contradiction)**: Quy trình mới phát hiện ra cách làm tối ưu hơn nhưng các quy trình cũ trong repo vẫn giữ hướng dẫn lỗi thời, khiến AI ở các phiên sau bị xung đột hành vi.
4. **Skill Chết / Ít Sử Dụng (Unused Bloat)**: Quá nhiều quy tắc không còn giá trị thực tế làm tiêu tốn dung lượng context và gây nhiễu cho việc định tuyến lệnh.

**Giải pháp AutoHarness**: Thiết lập một tầng tự học **Daemon-Free** (không cần tiến trình ngầm chạy nền tốn RAM), tự kích hoạt sau các chuỗi thao tác thực tế hoặc qua lệnh `/learn`, áp dụng triệt để nguyên lý **"Compare-First"** và **"Umbrella Consolidation"**.

---

## 2. Kiến Trúc 6 Khối AutoHarness Trong AIaC

```
                         [Phiên Làm Việc Thực Tế (Session Trace)]
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CAP (Capture & Trigger)                                                            │
│ • Đếm số lượng Tool Call (mặc định: mỗi 50 tool calls hoặc kết thúc phiên / lệnh /learn)│
│ • Cắt lát byte an toàn, khử thông tin nhạy cảm (Redaction Egress)                     │
└───────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 2. REF (Reflector / Người Phản Tư)                                                    │
│ • Quét Description Index của toàn bộ Plugin AIaC hiện có (Compare-First)              │
│ • Quyết định: PATCH skill đang nạp > UPDATE subfile > CREATE ô dù mới (Umbrella)      │
│ • TUYỆT ĐỐI KHÔNG GHI ĐĨA — Chỉ phát ra Đề xuất Thay đổi (Intents: patch/update/...)  │
└───────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 3. PROMOTER (Cổng Kiểm Duyệt & Ghi Nguyên Tử)                                         │
│ • Linter xác thực: Kiểm tra Frontmatter, Trigger cues, Độ dài dòng                    │
│ • Guard xác thực: Quét rò rỉ Secret, kiểm tra cú pháp file, kiểm tra symlink         │
│ • Atomic Commit: Ghi nguyên tử vào đúng `prompts/references/` của Plugin tương ứng    │
└───────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   ▼                                                 ▼
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│ 4. CURATOR (Sáp Nhập Ô Dù Định Kỳ)  │          │ 5. LIFECYCLE & LEDGER (MNG + LED)    │
│ • Quét các cụm skill cùng domain     │          │ • Ghi sổ cái `.ledger.jsonl` kèm     │
│ • Gộp các kỹ năng hẹp vào một Skill  │          │   bằng chứng `evidence-*.md`         │
│   Ô dù lớn (Umbrella Class-level)    │          │ • Đo lường: USE vs VIEW vs PATCH     │
│ • Chuyển bản hẹp thành subfile       │          │ • Lưu trữ an toàn vào `.archive/`,   │
│   `references/` thay vì để rời rạc   │          │   tuyệt đối không xoá mất dấu vết    │
└──────────────────────────────────────┘          └──────────────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 6. IDX (Chỉ Mục Khởi Tạo Phiên - Session-Start Surface)                               │
│ • Nạp tóm tắt các kỹ năng mới cập nhật vào bối cảnh phiên tiếp theo                   │
│ • Đảm bảo AI luôn biết các bài học mới nhất mà không làm tràn Context Window          │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 5 Quy Tắc Vàng Khi Tự Học & Tự Tối Ưu Kỹ Năng Trong AIaC

### Quy tắc 1: Compare-First & Sáp Nhập Trước (KHÔNG ĐẺ SKILL RỜI)
Khi một bài học mới được rút ra từ phiên làm việc:
1. **Kiểm tra skill đang hoạt động**: Nếu sự cố xảy ra khi đang chạy Odoo → BẮT BUỘC cập nhật vào `360-odoo`. Nếu xảy ra khi sync git → cập nhật vào `360-gitsync`. Nếu xảy ra khi dựng môi trường local → cập nhật vào `360-instance-arch` hoặc `360-local-builder-env`.
2. **Thứ tự ưu tiên hành động**:
   - `patch`: Sửa trực tiếp một đoạn hướng dẫn, thêm một lưu ý, hoặc bổ sung một bẫy lỗi (`pitfall`) vào file sẵn có.
   - `update`: Bổ sung một file tài liệu chi tiết vào `prompts/references/<chuyen-de>.md` hoặc script bổ trợ vào `scripts/`.
   - `create`: Chỉ tạo ô dù mới khi lĩnh vực đó **hoàn toàn chưa có plugin nào đại diện** trong hệ sinh thái AIaC.

### Quy tắc 2: Tách Rời Đề Xuất (Reflector) & Ghi Nhận (Promoter)
- **Reflector (LLM)**: Chỉ có quyền phân tích và đưa ra **Đề xuất Thay đổi (Intents)**. Không bao giờ được phép trực tiếp sửa đổi các file hướng dẫn cốt lõi khi chưa qua kiểm duyệt.
- **Promoter (Xác thực tất định)**: Chỉ cho phép ghi vào đĩa khi thỏa mãn:
  - Không chứa API Key, Token, Password hay thông tin nhạy cảm.
  - Phù hợp với chuẩn định dạng Markdown, Frontmatter hợp lệ.
  - Đường dẫn file tham chiếu phải tồn tại thực tế.
  - Phải có trích dẫn bằng chứng thực tế (`evidence`) từ phiên làm việc.

### Quy tắc 3: Rule-Altitude Distillation (Trích Xuất Tầm Nguyên Tắc)
- Không biến `SKILL.md` thành một nhật ký kể chuyện hay bản chép lại log của một phiên đơn lẻ.
- `SKILL.md` chỉ giữ các **nguyên tắc ngắn gọn, mệnh lệnh dứt khoát, trigger rõ ràng**.
- Toàn bộ log traceback chi tiết, đoạn code mẫu dài, bảng dữ liệu đối chiếu bắt buộc đẩy vào `prompts/references/<tên>.md` hoặc `templates/`.

### Quy tắc 4: Umbrella Consolidation (Gộp Kỹ Năng Dưới Một Ô Dù)
- Thay vì để tồn tại 10 file skill nhỏ lẻ cho 10 lỗi Odoo khác nhau, `curator` sẽ tự động gom chúng lại dưới một ô dù duy nhất: `360-odoo/prompts/references/debugging-and-bugfixing.md`.
- Một kỹ năng được xem là tốt khi nó bao quát được cả một lớp bài toán (Class of problems), chứ không phải chỉ giải quyết một file cụ thể ở một dòng cụ thể.

### Quy tắc 5: Đóng Dấu Sổ Cái (Ledger) & Lưu Bằng Chứng (Evidence)
Mỗi khi một skill được tạo mới (`create`) hoặc cập nhật (`patch`/`update`), hệ thống lưu lại một dòng lịch sử:
```json
{
  "action": "patch",
  "plugin": "360-odoo",
  "target": "prompts/references/migrate-web-enterprise.md",
  "reason": "Phát hiện thiếu cờ --apply khiến script migrate chỉ chạy dry-run",
  "evidence": "references/evidence-a1b2c3d4.md",
  "timestamp": "2026-09-11T15:30:00Z"
}
```
Bằng chứng (`evidence`) là đoạn trích thực tế từ terminal hoặc log lỗi của phiên làm việc, chứng minh rằng sự thay đổi này xuất phát từ thực tế chứ không phải do AI suy diễn vô căn cứ.

---

## 4. Vận Hành Cơ Chế Tự Học: Tự Động Ngầm (Zero-Command) & Cổng Phê Duyệt

### 4.1. Cơ Chế Tự Động Học Ngầm Kèm Phê Duyệt (Autonomous Distillation with Approval Gate)
Theo chỉ đạo trực tiếp từ Sếp Châu: **Agent định kỳ tự động học ngầm từ phiên làm việc, so sánh với catalog AIaC, nhưng BẮT BUỘC lưu vào danh sách đề xuất (proposals) để Sếp xem và duyệt (approved) trước khi áp dụng chính thức.**

Quy trình 4 bước khép kín:
1. **Hook Stop Pipeline (`aiac-stop-pipeline.js`)**: Mỗi khi kết thúc turn hoặc kết thúc phiên, hook chạy ngầm (`async: true`, process detached) không gây gián đoạn phiên làm việc.
2. **2 Nguồn Tín Hiệu Tự Động (Signal Capture)**:
   - **Tín hiệu 1 — Chỉ Đạo & Quy Chuẩn Từ Sếp (User Directives)**: Tự động nhận diện các chỉ đạo nguyên tắc (`bắt buộc`, `không được`, `tuyệt đối cấm`, `quy chuẩn`, `từ giờ`, `chuyển sang`, `cỏ cái này... đi`, `dùng SSH thay vì CloudMounter`...).
   - **Tín hiệu 2 — Bẫy Lỗi Đã Khắc Phục (Fix-Verify Pairs)**: Nhận diện chuỗi sự kiện lỗi test/build (AssertionError, exit code 1) sau đó được sửa và verify thành công (PASS, exit code 0).
3. **Cổng Staging & Chống Trùng Lặp (Deduplication & Proposal Staging)**:
   - So sánh với catalog AIaC và đối chiếu mã băm SHA-256 với Sổ cái (`learning-ledger.jsonl`) lẫn hàng đợi chờ duyệt (`pending-proposals.json`).
   - Lọc bỏ 100% secret, token, password.
   - Ghi vào hàng đợi đề xuất `360org/plugins/360-harness/data/pending-proposals.json` với trạng thái `PENDING_APPROVAL`.
4. **Cổng Duyệt Của Sếp (Human-in-the-Loop Approval Gate)**:
   - Sếp xem danh sách đề xuất: lệnh `/proposals` hoặc CLI:
     ```bash
     node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js list
     ```
   - Sếp phê duyệt bài học:
     ```bash
     # Phê duyệt toàn bộ
     node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js approve all
     # Hoặc phê duyệt theo mã ID cụ thể
     node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js approve prop_1789361018992_hash_t
     ```
   - Chỉ khi được Sếp duyệt: Bài học mới được Promoter ghi chính thức vào `prompts/references/auto-learned-rules.md` của plugin tương ứng, ghi vết `APPROVED` vào Sổ cái và nạp vào bối cảnh phiên làm việc kế tiếp (`SessionStart`).
   - Nếu Sếp từ chối:
     ```bash
     node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js reject all
     ```

### 4.2. Cơ Chế Xử Lý Vùng Cấm DEV Thông Minh (Descriptive Scope Guard Gate)
Khi lệnh vô tình chạm vùng cấm `/Volumes/DATA/DEV/*`, `guardDevScope` trong `360org/scripts/hooks/aiac-hook-bridge.js` xử lý chủ động thay vì dừng im lặng:
1. **Thông báo tường minh lý do chặn**: Trả về `permissionDecisionReason` chỉ rõ đường dẫn cụ thể bị chặn và giải thích vùng bảo vệ chống quét lan man / chống đốt token.
2. **Chỉ thị cưỡng chế Agent không dừng im lặng (`additionalContext`)**: Cảnh báo bắt buộc Agent phải thông báo ngay cho Sếp biết đường dẫn bị chặn và đề xuất mở quyền đích danh.
3. **Hướng dẫn khắc phục**: Hướng dẫn thêm đường dẫn repo con đích danh vào `allowedWorkspaces` hoặc `permissions.additionalDirectories` trong `.claude/settings.local.json`.

### 4.3. Cơ Chế Kích Hoạt Thủ Công Khi Cần: Slash-Command `/learn` & CLI
Bất cứ khi nào Sếp hoặc developer muốn chủ động kích hoạt rà soát và chắt lọc bài học sâu:
```
/learn
```
AI sẽ tự động:
1. Đọc lại toàn bộ ngữ cảnh phiên làm việc vừa qua.
2. Trích xuất bài học có tính tái sử dụng cao nhất.
3. So sánh với danh mục plugin AIaC hiện có (`Compare-First`).
4. Đề xuất cập nhật vào đúng reference của plugin tương ứng.
5. Hiển thị diff cho Sếp duyệt trước khi ghi nhận vào hệ thống.

### 4.4. Kiểm Tra Bài Học Đã Tự Động Học (CLI & Dashboard)
```bash
# Xem phiên bản và số bài học đã tự động chắt lọc trong Ledger
node /Volumes/DATA/DEV/aiac/scripts/aiac/aiac-version.js

# Xem danh sách các bài học đang chờ Sếp duyệt
node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js list
```
