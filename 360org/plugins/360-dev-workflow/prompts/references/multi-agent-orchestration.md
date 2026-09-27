# Quy trình Phối hợp Đa Agent (Multi-Agent Orchestration Workflow)

Tài liệu này đặc tả quy trình phối hợp giữa Kiến trúc sư trưởng (Orchestrator - AI Agent chính) và các Sub-Agents chuyên trách để phát triển một dự án phần mềm hoàn chỉnh từ đầu đến cuối theo chuẩn **agent-skills**.

> Áp dụng cho **mọi dự án non-Odoo**. Dự án Odoo dùng [odoo-dev-skills](../../../360-odoo/prompts/references/multi-agent-orchestration.md) (kế thừa từ đây + Odoo-specific).

---

## 1. Cơ cấu Đội ngũ & Phân bổ Mô hình AI

Phân chia 6 vai trò AI chuyên trách. **Nguyên tắc vàng:** Phiên chính điều phối dùng Claude-VIP; các bước thực thi được giao cho sub-agent chuyên trách với pack cấu hình sẵn.

| Vai trò | Mô hình AI | Nhiệm vụ chính | Bước phụ trách |
|:---|:---|:---|:---|
| **Architect / Planner** | **Claude Pro** | Phân tích nghiệp vụ, viết REQUIREMENTS, SPEC, ARCH, lập kế hoạch chi tiết | `/req`, `/spec`, `/plan` |
| **Coder** | **claude-3.8-flash** | Sinh mã nguồn và sửa lỗi theo SPEC (Odoo, Web, App) | `/build` |
| **Code Reviewer** | **claude-code.x-reviewer** | Soi diff vừa sinh tìm bug correctness, ponytail over-engineering — **chặn trước khi Tester tốn công** | `/code-review` |
| **Tester** | **claude-tester** | Viết unit/integration/E2E tests, chạy kiểm thử tự động | `/test` |
| **Reviewer (UAT)** | **claude-ai-premium** | User Reviewer / Nghiệm thu từ góc nhìn người dùng cuối và đối chiếu SPEC | `/review` |
| **Shipper / Release**| **claude-ai-saver** | Đóng gói, build artifacts, deploy, viết walkthrough | `/ship` |

> **Vì sao Code Reviewer tách khỏi Reviewer:** hai vai trò đảm nhận 2 nhiệm vụ tách biệt hoàn toàn. `/code-review` (Code Reviewer) soi **diff thô ngay khi Coder vừa viết xong**, tập trung bắt bug logic và over-engineering. `/review` (User Reviewer/UAT) chạy **sau khi kiểm thử đã xanh**, nghiệm thu sản phẩm dưới góc nhìn người dùng cuối, đảm bảo đúng SPEC và trải nghiệm PO yêu cầu. Không gộp làm một.

---

## 2. Quy trình Vòng đời Phát triển 9 bước (9-Step Lifecycle)

```
  IDEA      REQUIREMENTS    SPEC & ARCH      PLAN        BUILD       CODE-REVIEW     VERIFY       REVIEW       SHIP
 ┌──────┐  ┌────────────┐  ┌────────────┐  ┌──────┐   ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌────────┐  ┌──────┐
 │ PO   │─▶│ AI sinh    │─▶│ AI thiết kế│─▶│ Plan │──▶│ Code    │─▶│ Soi diff  │─▶│ Test &  │─▶│ Audit  │─▶│ Go   │
 │ viết │  │ PO duyệt   │  │ PO duyệt   │  │ Task │   │ (Coder) │  │(CodeRev.) │  │ (Tester)│  │(Review)│  │ Live │
 └──────┘  └────────────┘  └────────────┘  └──────┘   └─────────┘  └─────┬─────┘  └─────────┘  └────────┘  └──────┘
  /idea        /req            /spec         /plan      /build     /code-review      /test       /review     /ship
 Claude/PO  Claude/Codex   Claude/Codex  Claude/Codex   Gemini    Claude/Codex      Gemini    Claude/Codex  Gemini
                                                             ▲           │
                                                             └───────────┘
                                                        fix → re-review (≤3 vòng)
```

### Bước 1: Ý tưởng từ Product Owner (`/idea`)
- **Thực hiện bởi:** Product Owner (con người) — Claude/Codex chỉ hỗ trợ format
- **Hoạt động:** PO viết `IDEA.md` — mô tả vision, bài toán, đối tượng, giá trị cốt lõi
- **Sản phẩm:** `IDEA.md`
- **Quy tắc:** AI **không** tự sáng tạo ý tưởng. IDEA.md là *single source of truth*.

### Bước 2: Phân tích & Viết Yêu cầu (`/req`)
- **Thực hiện bởi:** **Architect** (Claude/Codex)
- **Hoạt động:** Đọc IDEA.md, **grilling PO trước** ([grilling-and-domain-modeling.md §1](grilling-and-domain-modeling.md) — mỗi lần 1 câu kèm đề xuất, fact tự tra / decision mới hỏi, đi hết cây quyết định), rồi chuyển hoá thành REQUIREMENTS.md có cấu trúc. Term nghiệp vụ chốt được → ghi ngay `CONTEXT.md`
- **Sản phẩm:** `REQUIREMENTS.md` (business goals, personas, functional reqs, non-functional reqs, constraints, acceptance criteria)
- **Phê duyệt:** PO duyệt bằng `> 📝 Ghi chú:` trong file. Bắt buộc duyệt mới sang bước 3.

### Bước 3: Đặc tả Kỹ thuật & Kiến trúc (`/spec`)
- **Thực hiện bởi:** **Architect** (Claude/Codex)
- **Hoạt động:** Đọc REQUIREMENTS đã duyệt, thiết kế kỹ thuật chi tiết
- **Sản phẩm:** `SPEC.md` (data model, wireframe, API, components) + `ARCH.md` (sơ đồ, deployment)
- **Phê duyệt:** PO duyệt kiến trúc trước khi plan.

### Bước 4: Lập kế hoạch (`/plan`)
- **Thực hiện bởi:** **Architect** (Claude/Codex)
- **Hoạt động:** Chia nhỏ thành atomic tasks
- **Sản phẩm:** `implementation_plan.md` + `task.md`

### Bước 5: Phát triển mã nguồn (`/build`)
- **Thực hiện bởi:** **Coder** (Gemini)
- **Hoạt động:** Sinh code theo SPEC, dùng templates
- **Sản phẩm:** Source code hoàn chỉnh

### Bước 6: Soi diff trước khi kiểm thử (`/code-review`) — CỔNG CHẶN BẮT BUỘC

- **Thực hiện bởi:** **Code Reviewer** (Claude/Codex) — **phải khác model đã `/build`** để không tự soi chính mình
- **Đầu vào:** đúng diff Coder vừa sinh (`git diff`), không phải toàn repo
- **Hoạt động:** Gọi skill `code-review` trên diff. Chỉ soi 4 trục, không soi SPEC (để dành `/review` bước 8):
  1. **Correctness** — logic sai, off-by-one, null/undefined, race, error handling làm mất dữ liệu
  2. **Reuse** — có helper/util/pattern sẵn trong codebase mà Coder viết lại không (ponytail nấc 2)
  3. **Over-engineering** — abstraction 1 implementation, factory 1 product, config cho giá trị không đổi, boilerplate "để sau"
  4. **Security & validation tại trust boundary** — input chưa validate, secret hardcode, SQL/command injection
- **Vòng lặp fix:** có finding Critical/High → Coder sửa → re-review. **Trần 3 vòng**; quá 3 vòng mà vẫn đỏ = dấu hiệu SPEC sai, escalate về Architect chứ đừng vá tiếp.
- **Sản phẩm:** `code-review-report.md` (finding + severity + `file:line`) và diff đã fix. **Không được sang `/test` khi còn finding Critical/High chưa xử lý hoặc chưa được Architect chấp nhận rủi ro có ghi lý do.**
- **Quy tắc:** Bước này **KHÔNG chạy test** và **KHÔNG viết test** — đó là việc của bước 7. Nó chỉ đọc code.

### Bước 7: Kiểm thử (`/test`)
- **Thực hiện bởi:** **Tester** (claude-tester)
- **Hoạt động:** Viết tests, chạy kiểm thử (tối thiểu 10 case độc lập theo luật kiểm thử toàn cầu)
- **Sản phẩm:** Unit/integration/E2E tests + báo cáo
- **Điều kiện vào:** Bước 6 đã đóng. Tester nhận code đã qua cổng correctness nên không phải viết lại test vì logic sai.

### Bước 8: Đánh giá chất lượng (`/review`)
- **Thực hiện bởi:** **Reviewer (UAT)** (claude-ai-premium)
- **Hoạt động:** Đóng vai người dùng cuối để nghiệm thu sản phẩm. Kiểm tra xem sản phẩm đã đáp ứng đúng SPEC chưa, trải nghiệm người dùng có tốt không, có đủ acceptance criteria không.
- **Khác gì bước 6:** bước 6 soi *diff thô, chưa có test*, chỉ hỏi "code có sai không". Bước 8 soi *toàn bộ thay đổi đã có test xanh*, hỏi "có đúng thứ PO đặt hàng không, trải nghiệm có mượt không". Bước 6 đã chặn hết bug correctness nên bước 8 không phải lặp lại việc đó.
- **Sản phẩm:** Review report góc nhìn UAT. Nếu lệch SPEC → Architect yêu cầu Coder sửa (vòng lặp về bước 5).

### Bước 9: Đóng gói & Bàn giao (`/ship`)
- **Thực hiện bởi:** **Shipper / Release** (claude-ai-saver)
- **Hoạt động:** Build artifacts, deploy, viết walkthrough
- **Sản phẩm:** `walkthrough.md` + production deployment
- **Phê duyệt:** PO duyệt cuối cùng.

---

## 3. Bảng tóm tắt model assignment

| Bước | Lệnh | Vai trò | Model ưu tiên |
|:---:|:---|:---|:---|
| 1 | `/idea` | PO (con người) | (AI hỗ trợ format) |
| 2 | `/req` | Architect / Planner | **Claude Pro** |
| 3 | `/spec` | Architect / Planner | **Claude Pro** |
| 4 | `/plan` | Architect / Planner | **Claude Pro** |
| 5 | `/build` | Coder | **claude-3.8-flash** |
| 6 | `/code-review` | Code Reviewer | **claude-code.x-reviewer** |
| 7 | `/test` | Tester | **claude-tester** |
| 8 | `/review` | Reviewer (UAT) | **claude-ai-premium** |
| 9 | `/ship` | Shipper / Release | **claude-ai-saver** |

---

## 4. Điều phối NHIỀU agent song song trên 1 dự án — Bản đồ chung (hút từ mattpocock/skills `wayfinder`)

Quy trình 9 bước ở trên chạy tốt khi feature vừa **1 phiên agent**. Khi việc **lớn hơn 1 phiên** — refactor xuyên nhiều package, dựng hệ thống nhiều phân hệ, migrate stack — cần lớp điều phối **xuyên phiên, xuyên agent**: 1 **Architect (Orchestrator)** cầm bản đồ, n agent thợ mỗi người nhận 1 ticket.

**Khi nào dùng (và khi nào KHÔNG):**
- ✅ Việc ước lượng > 1 phiên context, hoặc muốn ≥ 2 agent chạy song song.
- ❌ Feature vừa 1 phiên → chạy 9 bước bình thường. Dựng bản đồ cho việc 1 phiên là over-engineering (ponytail).

### 4.1 Bản đồ (MAP)

Mặc định dùng **local markdown**: `.scratch/map/MAP.md` + `.scratch/map/tickets/NNN-<ten>.md` (repo dùng GitHub/GitLab Issues thì map = issue nhãn `wayfinder:map`, ticket = child issue — cơ chế y hệt).

`MAP.md` gồm 5 mục: **Đích đến** (1–2 dòng: hoàn thành nghĩa là gì — mọi phiên đọc đầu tiên) / **Ghi chú** (ràng buộc chung, references bắt buộc, CONTEXT.md) / **Quyết định đã chốt** (index: 1 dòng gist + link ticket mỗi quyết định) / **Chưa đặc tả được** (fog — biết phải làm nhưng chưa đủ thông tin để viết ticket) / **Ngoài phạm vi** (đã cân nhắc và loại — để agent sau không mở lại).

Mỗi **ticket** = 1 file vừa **1 phiên agent** (~100K token), gồm: **Loại** (quyết-định / thực-thi), **Bị chặn bởi** (blocking edges), **Việc/Câu hỏi** (đủ để agent fresh context làm được), **Bối cảnh** (link SPEC, CONTEXT.md, references), **Kết quả** (agent thợ ghi khi xong — nơi duy nhất giữ chi tiết).

**3 luật của bản đồ:**
1. **Map là index, không phải kho** — chi tiết sống trong ticket, map chỉ gist + link. Map load 1 lần/phiên, phải rẻ.
2. **Gọi ticket bằng TÊN**, không gọi số trần.
3. **Quyết định trước, thực thi sau** — ticket quyết-định resolve xong mới sinh ticket thực-thi; muốn "tiện tay code luôn" trong ticket quyết định = dấu hiệu cần đóng nó và mở ticket thực thi mới.

### 4.2 Vòng điều phối của Architect (1 điều phối n agent)

```
Mỗi chu kỳ:
  1. ĐỌC MAP.md → FRONTIER = các ticket mở không bị chặn.
  2. DISPATCH song song: mỗi ticket frontier → 1 sub-agent fresh context, prompt kèm
     nội dung ticket + Đích đến + Ghi chú + CONTEXT.md + trích SPEC liên quan.
     Ticket đụng code → cấp git worktree riêng cho mỗi agent để không giẫm chân.
  3. THU KẾT QUẢ: agent thợ ghi "Kết quả" vào ticket → Architect đóng ticket,
     thêm 1 dòng "Quyết định đã chốt", graduate fog, mở ticket phát sinh.
  4. LẶP đến khi frontier rỗng + Đích đến đạt → tổng kết cho PO, dọn/archive .scratch/map.
```

**Phân model theo loại ticket:** Architect cầm map + ticket *quyết-định* = **Claude/Codex**; ticket *thực-thi* = **Gemini** — đúng nguyên tắc vàng §1. **Xung đột song song:** 2 ticket đụng cùng file → thêm blocking edge cho chạy tuần tự, đừng dựng cơ chế merge phức tạp (ponytail).

---

## 5. Handoff — bàn giao giữa các phiên / giữa các agent (hút từ mattpocock/skills `handoff`)

Dùng khi: context 1 agent sắp cạn giữa chừng; chuyển việc sang agent model khác; nghỉ giữa chừng mai làm tiếp.

Viết **1 file handoff** vào thư mục temp của máy (không bỏ vào workspace/repo):
1. **Đang làm gì, tới đâu** — trạng thái thật, kể cả "test đang đỏ ở X".
2. **Trỏ, không chép** — quyết định đã chốt thì link tới MAP.md/ticket/SPEC/ARCH/commit, không lặp nội dung đã có trong artifact khác.
3. **Bước kế tiếp cụ thể** — hành động đầu tiên agent mới nên làm.
4. **Skill/references cần load.**
5. **Redact** mọi secret/API key/thông tin cá nhân.

Agent mới: đọc handoff → đọc MAP.md + CONTEXT.md → làm tiếp. Không cần đọc lại transcript phiên cũ.
