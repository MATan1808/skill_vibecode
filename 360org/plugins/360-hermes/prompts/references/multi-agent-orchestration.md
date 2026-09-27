# Quy trình Phối hợp Đa Agent (Multi-Agent Orchestration Workflow)

Tài liệu này đặc tả quy trình phối hợp giữa Kiến trúc sư trưởng (Orchestrator) và các Sub-Agent chuyên trách để phát triển 1 plugin Hermes hoàn chỉnh, theo chuẩn `dev-workflow-skills` mà `hermes-dev-skills` kế thừa.

> Áp dụng cho **mọi loại plugin Hermes** (Platform Adapter, Tool, Skill, Provider). Dự án Odoo dùng bản riêng ở `odoo-dev-skills`.

**Vòng khép kín bắt buộc:** PO đưa ý tưởng → AI sắp xếp vào `IDEA.md` → AI sinh REQUIREMENTS / SPEC / ARCH / plan task → **PO duyệt (agent DỪNG chờ)** → chia việc nhỏ cho các sub-agent chạy song song không đụng nhau → vòng lặp làm → review → sửa cho đến khi đạt → trả PO kết quả cuối (walkthrough + verify).

---

## 1. Cơ cấu Đội ngũ & Phân bổ Mô hình AI

PO đang dùng 3 họ model chính: **Claude** (Opus/Fable), **GPT** (GPT-5/Codex), **Gemini** (2.x Pro/3.x Flash). Nguyên tắc gán: **mỗi vai 1 model đúng sở trường, và người review KHÔNG BAO GIỜ cùng model với người viết** (cross-model review — model khác nhau có điểm mù khác nhau).

| Vai trò | Model AI | Vì sao model này | Bước phụ trách |
|:---|:---|:---|:---|
| **Architect** | **Claude** (Opus 4.7+/Fable) | Đọc docs dài (600–700 dòng/file), phân biệt đúng loại plugin, phát hiện API bịa/lệch version — cần tư duy cẩn trọng | `/req`, `/spec`, `/plan` |
| **Coder** | **Gemini** (2.x Pro/3.x Flash) | Rẻ, nhanh, đủ tốt khi sinh code theo template có pattern rõ ràng | `/build` |
| **Code Reviewer** | **GPT-5/Codex** (chéo model với Coder) | Soi `git diff` ngay khi Coder xong — chặn bug correctness/over-engineering trước khi Tester tốn công | `/code-review` |
| **Tester** | **Gemini** (3.x Flash) | Chạy lệnh, viết test theo checklist — task execution thuần | `/test` |
| **Reviewer** | **GPT** (GPT-5/Codex) | **Chéo model:** khác cả Coder (Gemini) lẫn Architect (Claude) → bắt được điểm mù của cả người thiết kế lẫn người viết code | `/review` |
| **Shipper** | **Gemini** (3.x Flash) | Đóng gói, deploy checklist, walkthrough — theo quy trình có sẵn | `/ship` |
| **Debugger** | **Claude** (Opus 4.7+/Fable) | RCA khi plugin không load / gateway lỗi — cần suy luận sâu | ad-hoc |

> Khi 1 họ model không khả dụng, thay thế theo cặp sở trường: Claude ↔ GPT (phân tích/review), Gemini ↔ GPT-mini/Flash-tier (execution). Không dồn cả 3 vai phân tích–viết–review về cùng 1 model.

---

## 2. Quy trình Vòng đời 9 bước + 2 Cổng duyệt cứng

```
  IDEA        REQUIREMENTS        SPEC & ARCH         PLAN               BUILD ⇄ CODE-REVIEW (lặp)          TEST         SHIP
  ┌──────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────┐       ┌──────────────────────┐      ┌─────────┐   ┌──────┐
  │ PO   │──▶│ AI sinh      │──▶│ AI thiết kế  │──▶│ Chia    │──🚦──▶│ N sub-agent song song │ ───▶ │ Test    │──▶│ Trả  │
  │ đưa ý│   │              │   │              │   │ task    │ GATE  │ mỗi agent 1 worktree  │      │ tổng    │   │ PO   │
  │ tưởng│   │   🚦 GATE A  │   │              │   │ nguyên  │  B    │ build→review→fix ≤3 vòng│    │ (Tester)│   │ kết  │
  └──────┘   │   PO duyệt   │   └──────────────┘   │ tử      │       └──────────────────────┘      └─────────┘   │ quả  │
   /idea     └──────────────┘     /spec + ARCH     └─────────┘          /build + /code-review        /test       └──────┘
                  /req                                /plan                                                        /ship
```

### 🚦 Cổng duyệt (Approval Gates) — agent BẮT BUỘC DỪNG, không tự chạy tiếp

| Gate | Sau bước | PO duyệt cái gì | Agent được làm gì khi chờ |
|:---:|:---|:---|:---|
| **A** | `/req` | `REQUIREMENTS.md` (WHAT/WHY đúng ý chưa) | Không gì cả — chờ PO ghi `> 📝 Ghi chú:` hoặc xác nhận duyệt trong chat |
| **B** | `/plan` | Trọn bộ `SPEC.md` + `ARCH.md` + `implementation_plan.md` (task list + phân công sub-agent + model) | Không gì cả — tuyệt đối không `/build` khi Gate B chưa qua |

Quy tắc cứng:
- PO chỉnh sửa/ghi chú → agent cập nhật tài liệu → trình lại gate đó, không nhảy cóc.
- Duyệt ở gate nào chỉ có hiệu lực cho gate đó — SPEC đổi sau khi đã qua Gate B thì phải trình duyệt lại.

### Bước 1: `/idea` — PO đưa ý tưởng (nói tự nhiên, gạch đầu dòng, voice note đều được). **AI chỉ sắp xếp lại thành `IDEA.md` có cấu trúc** (vision, bài toán, giá trị cốt lõi, phạm vi) — không tự sáng tạo thêm ý, không tự bỏ ý của PO. Trình lại cho PO xem đã đúng ý chưa trước khi sang `/req`.

### Bước 2: `/req` — Architect (Claude) đọc `IDEA.md` → `REQUIREMENTS.md`. → **🚦 Gate A.**

### Bước 3: `/spec` — Architect **bắt buộc chốt loại plugin** (Platform Adapter/Tool/Skill/Provider) trước khi viết `SPEC.md` + `ARCH.md`. Đọc đúng reference tương ứng, trích dẫn nguồn API thật.

### Bước 4: `/plan` — Architect chia task nguyên tử theo quy tắc mục 3 dưới đây, ghi vào `implementation_plan.md` kèm bảng phân công (task → sub-agent → model → file sở hữu). → **🚦 Gate B.**

### Bước 5+6: `/build` ⇄ `/code-review` — pha song song, chi tiết ở mục 3.

> Pha `/code-review` của Hermes **chính là** cổng chặn giữa `/build` và `/test` trong workflow 9 bước chuẩn AIaC — Hermes đã có sẵn cơ chế review chéo model ≤3 vòng/task nên không dựng thêm vòng lặp thứ hai. Reviewer (GPT/Codex) soi `git diff` của từng worktree: correctness, reuse, over-engineering, security & validation tại trust boundary. **Còn finding Critical/High chưa xử lý thì không merge và không sang `/test`**; quá 3 vòng = escalate PO.

### Bước 7: `/test` — Tester (Gemini) chạy thử thật trên bản đã merge: `HERMES_PLUGINS_DEBUG=1 hermes plugins list`, `hermes gateway restart`, đọc `logs/gateway.log`.

### Bước 8: `/review` — Reviewer (Claude/Codex) audit sau khi test xanh: đối chiếu `SPEC.md`/`REQUIREMENTS.md`, đủ acceptance criteria, không lố scope. Khác bước 6: bước 6 soi diff thô chưa có test, bước 8 soi toàn bộ thay đổi đã có bằng chứng test.

### Bước 9: `/ship` — Shipper (Gemini) xác nhận enable đúng `config.yaml`/`.env` của đúng profile, viết `walkthrough.md` **trả PO kết quả cuối**: đã làm gì, file nào, test nào pass, cách verify nhanh, còn nợ gì (ponytail debt).

---

## 3. Pha thực thi song song — chia việc nhỏ KHÔNG ĐỤNG NHAU

Orchestrator (main thread) lấy task list đã duyệt ở Gate B và điều phối theo 5 quy tắc:

1. **Chia theo ranh giới sở hữu (ownership boundary):** mỗi sub-agent sở hữu trọn 1 nhóm file/module/layer. **Hai agent không bao giờ cùng ghi 1 file.** Nếu 2 task buộc phải đụng chung 1 file → gộp thành 1 task hoặc chạy tuần tự, không chạy song song.
2. **Contract I/O trước khi phái việc:** mỗi task giao đi kèm 3 dòng — *nhận gì* (input, file được đọc), *trả gì* (output, file được ghi), *KHÔNG chịu trách nhiệm gì*. Interface chung (schema, tên hàm, env var) chốt trong SPEC trước — sub-agent không được tự đổi contract.
3. **Cách ly vật lý:** mỗi sub-agent 1 git worktree riêng (xem `skills/superpowers/using-git-worktrees/`) — không thể conflict khi đang làm. Ít task hoặc repo nhỏ thì tối thiểu phải giữ quy tắc 1.
4. **Vòng lặp per-task, tối đa 3 vòng:**
   ```
   Coder (Gemini) build → linter tự chạy → Reviewer (GPT) review chéo
        └─ đạt → merge nhánh, đóng task
        └─ chưa đạt → Coder sửa theo findings → review lại (vòng +1)
        └─ hết 3 vòng vẫn kẹt → DỪNG, escalate PO kèm mô tả điểm kẹt (không cố cày thêm)
   ```
5. **Hợp nhất & báo cáo:** merge từng nhánh theo thứ tự dependency, Tester chạy test tổng 1 lần cuối trên bản merge; sub-agent báo cáo về main thread bằng định dạng nén (xem `skills/caveman/cavecrew/`) để không phình context.

Thiết kế topology phức tạp hơn (fan-out/fan-in, orchestrator nhiều tầng, xử lý khi 1 agent chết giữa chừng) → tham khảo persona `skills/agency-agents/engineering/engineering-multi-agent-systems-architect.md` và công thức 5 bước trong `skills/README.md`.

---

## 4. Bảng tóm tắt

| Bước | Lệnh | Vai trò | Model | Gate sau bước |
|:---:|:---|:---|:---|:---:|
| 1 | `/idea` | PO đưa ý tưởng, AI format `IDEA.md` | Claude (format) | PO xác nhận đúng ý |
| 2 | `/req` | Architect | Claude | **🚦 A** |
| 3 | `/spec` | Architect | Claude | — |
| 4 | `/plan` | Architect (kèm bảng phân công task→agent→model) | Claude | **🚦 B** |
| 5 | `/build` | N × Coder song song (worktree riêng) | Gemini | — |
| 6 | `/code-review` | Code Reviewer chéo model, lặp với `/build` ≤3 vòng/task — **cổng chặn, còn Critical/High thì không merge** | GPT/Codex | — |
| 7 | `/test` | Tester trên bản merge | Gemini | — |
| 8 | `/review` | Reviewer audit SPEC/acceptance sau khi test xanh | Claude/Codex | — |
| 9 | `/ship` | Shipper trả PO walkthrough + kết quả | Gemini | PO nhận kết quả |
