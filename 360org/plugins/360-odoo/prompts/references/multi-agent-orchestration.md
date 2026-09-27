# Quy trình Phối hợp Đa Agent (Multi-Agent Orchestration Workflow) — Odoo Edition

> ⚠️ Tài liệu này áp dụng cho **module Odoo**. Workflow generic cho non-Odoo projects xem [dev-workflow-skills/references/multi-agent-orchestration.md](../../../360-dev-workflow/prompts/references/multi-agent-orchestration.md).

Tài liệu này đặc tả quy trình phối hợp giữa Kiến trúc sư trưởng (Orchestrator) và các Sub-Agents chuyên trách để phát triển một **module Odoo** hoàn chỉnh, theo chuẩn **agent-skills**.

---

## 1. Cơ cấu Đội ngũ & Phân bổ Mô hình AI (Agent Team & AI Models)

**Nguyên tắc vàng:** Claude/Codex cho PLAN & ANALYSIS (tư duy phức tạp, kiến trúc, audit). Gemini cho CODE & EXECUTION (sinh mã, test, đóng gói).

| Vai trò Agent | Mô hình AI đề xuất | Nhiệm vụ chính | Bước phụ trách |
| :--- | :--- | :--- | :--- |
| **Architect** (Neo) | **Claude Opus 4.7+ hoặc Codex/GPT-5** | Phân tích nghiệp vụ Odoo, thiết kế model/relations, viết REQUIREMENTS/SPEC/ARCH. Điều phối dự án. | `/req`, `/spec`, `/plan` |
| **Coder** | **Gemini 2.x Pro / 3.x Flash** | Sinh Python (Models/Controllers) + XML views + OWL JS dựa trên `templates/`. Gọi `odoo-graph-mcp` để verify relations. | `/build` |
| **Code Reviewer** | **Claude Opus 4.7+ hoặc Codex/GPT-5** | Soi `git diff` vừa sinh: correctness ORM, reuse, over-engineering, security ACL/`Markup()` — **chặn trước khi Tester tốn công** | `/code-review` |
| **Tester** | **Gemini 3.x Flash** | Unit tests Python, Odoo Tours, Playwright. Chạy trong Docker Colima. | `/test` |
| **Reviewer** | **Claude Opus 4.7+ hoặc Codex/GPT-5** | Audit `odoo_linter.py`, kiểm tra security CSV/record rules, tối ưu SQL/ORM, N+1 detection. | `/review` |
| **Shipper** | **Gemini 3.x Flash** | Tổng hợp kết quả, viết `walkthrough.md`, chạy `git_cleaner.py`, push lên 2 nhánh Gitlab. | `/ship` |

### Lý do phân bổ

- **Claude/Codex** mạnh ở phân tích nghiệp vụ Odoo phức tạp (đa company, multi-currency, accounting flow), thiết kế kiến trúc OWL/QWeb, code review nhiều khía cạnh. Dùng cho task "suy nghĩ".
- **Gemini** rẻ hơn, đủ tốt cho sinh code Odoo boilerplate (model fields, view layouts, action methods), viết tests, đóng gói. Dùng cho task "thực thi".

---

## 2. Quy trình Vòng đời Phát triển 9 bước (9-Step Lifecycle)

Quy trình phát triển phần mềm phải được chạy tuần tự qua các lệnh tương ứng với các giai đoạn:

```
  IDEA      REQUIREMENTS    SPEC & ARCH      PLAN        BUILD       CODE-REVIEW     VERIFY       REVIEW       SHIP
 ┌──────┐  ┌────────────┐  ┌────────────┐  ┌──────┐   ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌────────┐  ┌──────┐
 │ PO   │─▶│ AI sinh    │─▶│ AI thiết kế│─▶│ Plan │──▶│ Code    │─▶│ Soi diff  │─▶│ Test &  │─▶│ Audit  │─▶│ Go   │
 │ viết │  │ PO duyệt   │  │ PO duyệt   │  │ Task │   │ (Coder) │  │(CodeRev.) │  │ (Tester)│  │(Review)│  │ Live │
 └──────┘  └────────────┘  └────────────┘  └──────┘   └─────────┘  └─────┬─────┘  └─────────┘  └────────┘  └──────┘
  /idea        /req            /spec         /plan      /build     /code-review      /test       /review     /ship
    PO      Claude/Codex   Claude/Codex  Claude/Codex   Gemini    Claude/Codex      Gemini    Claude/Codex  Gemini
                                                             ▲           │
                                                             └───────────┘
                                                        fix → re-review (≤3 vòng)
```

### Bước 1: Ý tưởng từ Product Owner (`/idea`)
- **Hoạt động:** **Product Owner (PO)** viết `IDEA.md` — mô tả vision ban đầu bằng ngôn ngữ tự nhiên: bài toán cần giải quyết, đối tượng khách hàng, giá trị cốt lõi, hình dung sơ bộ về sản phẩm.
- **Sản phẩm đầu ra:** `IDEA.md` — tài liệu gốc, không cần chuẩn format.
- **Quy tắc:** AI **không** tự sáng tạo ý tưởng. AI chỉ format lại nếu PO yêu cầu. IDEA.md là *single source of truth* cho mọi bước sau.

### Bước 2: Phân tích & Viết Yêu cầu (`/req`)
- **Model:** Claude Opus 4.7+ hoặc Codex/GPT-5
- **Hoạt động:** **Architect** đọc `IDEA.md`, **chạy phiên grilling với PO** ([grilling-and-domain-modeling.md §1](grilling-and-domain-modeling.md) — mỗi lần 1 câu, kèm đề xuất, fact tự tra / decision mới hỏi, đi hết cây quyết định), rồi mới chuyển hoá thành `REQUIREMENTS.md` — tài liệu yêu cầu có cấu trúc. Term nghiệp vụ chốt được trong lúc grilling ghi ngay vào `CONTEXT.md`.
- **Sản phẩm đầu ra:** `REQUIREMENTS.md` bao gồm:
  1. Mục tiêu kinh doanh (business goals)
  2. Đối tượng người dùng (user personas)
  3. Yêu cầu chức năng chi tiết (functional requirements)
  4. Yêu cầu phi chức năng (performance, security, i18n)
  5. Ràng buộc (constraints, dependencies)
  6. Tiêu chí nghiệm thu (acceptance criteria)
- **Phê duyệt:** Gửi PO duyệt. PO ghi chú trực tiếp vào file bằng `> 📝 Ghi chú:`. Chỉ chuyển sang `/spec` khi PO ký duyệt.
- **Liên kết:** Mỗi requirement phải truy nguồn về mục tương ứng trong IDEA.md.

### Bước 3: Đặc tả Kỹ thuật & Kiến trúc (`/spec`)
- **Model:** Claude Opus 4.7+ hoặc Codex/GPT-5
- **Hoạt động:** **Architect** đọc `REQUIREMENTS.md` đã duyệt, viết đặc tả kỹ thuật chi tiết.
- **Sản phẩm đầu ra:**
  1. `SPEC.md`: Data model, wireframe, API endpoints, UI blocks/components.
  2. `ARCH.md`: Sơ đồ kiến trúc hệ thống, deployment topology, luồng dữ liệu.
- **Phê duyệt:** Gửi PO xem xét và xác nhận kiến trúc trước khi lập kế hoạch.
- **Liên kết:** Mỗi section SPEC phải tham chiếu requirement tương ứng (ví dụ: "Từ REQ §3.2").

### Bước 4: Lập kế hoạch thực hiện chi tiết (`/plan`)
- **Model:** Claude Opus 4.7+ hoặc Codex/GPT-5
- **Hoạt động:** **Architect** chia nhỏ thiết kế thành các đầu việc nhỏ độc lập và có thể kiểm thử (Atomic tasks).
- **Sản phẩm đầu ra:**
  1. `implementation_plan.md`: Kế hoạch thay đổi tệp tin.
  2. `task.md`: TODO list theo dõi tiến độ.

### Bước 5: Xây dựng & Phát triển mã nguồn (`/build`)
- **Model:** **Gemini 2.x Pro / 3.x Flash** (Coder — ưu tiên tốc độ & chi phí)
- **Hoạt động:** **Architect** gọi Sub-agent **Coder** để thực hiện viết mã nguồn Python (Models/Controllers) + XML views + OWL JS.
- **Bắt buộc:** Coder phải gọi `scripts/odoo_graph_mcp.py` để verify relations DB trước khi sinh code.
- **Sản phẩm đầu ra:** Mã nguồn module Odoo hoàn chỉnh.

### Bước 6: Soi diff trước khi kiểm thử (`/code-review`) — CỔNG CHẶN BẮT BUỘC
- **Model:** Claude Opus 4.7+ hoặc Codex/GPT-5 (Code Reviewer — **phải khác model đã `/build`**)
- **Đầu vào:** đúng `git diff` Coder vừa sinh, không phải toàn module
- **Hoạt động:** Gọi skill `code-review` trên diff, soi 4 trục Odoo-specific:
  1. **Correctness** — sai `self`/`recordset`, thiếu `ensure_one()`, `create()` trong loop, compute thiếu `@api.depends`, `unlink()` mất dữ liệu
  2. **Reuse** — viết lại helper/mixin đã có trong module hoặc trong Odoo core
  3. **Over-engineering** — abstract model 1 kế thừa, wizard cho việc 1 nút, `attrs=` kiểu cũ, custom UI ngoài snippet chuẩn
  4. **Security & validation** — thiếu `ir.model.access.csv` / record rules, SQL raw chưa tham số hoá, `sudo()` không lý do, raw HTML vào `message_post()` không bọc `Markup()`
- **Vòng lặp fix:** finding Critical/High → Coder sửa → re-review, **trần 3 vòng**; quá 3 vòng escalate về Architect (dấu hiệu SPEC sai).
- **Sản phẩm đầu ra:** `code-review-report.md` (finding + severity + `file:line`) + diff đã fix. **CẤM** sang `/test` khi còn Critical/High chưa xử lý.
- **Quy tắc:** chỉ đọc code — không chạy test, không viết test, không bật Docker.

### Bước 7: Kiểm thử chức năng và đơn vị (`/test`)
- **Model:** **Gemini 3.x Flash** (Tester)
- **Hoạt động:** **Architect** gọi Sub-agent **Tester** viết unit tests Python, Odoo Tours, Playwright; chạy trong Docker Colima.
- **Sản phẩm đầu ra:** Unit tests, integration tests, E2E scripts và báo cáo kết quả.
- **Điều kiện vào:** Bước 6 đã đóng — Tester nhận code đã qua cổng correctness nên không phải viết lại test vì logic sai.

### Bước 8: Đánh giá chất lượng mã nguồn (`/review`)
- **Model:** Claude Opus 4.7+ hoặc Codex/GPT-5 (Reviewer — task suy luận sâu)
- **Hoạt động:** **Architect** chạy review **2 trục bằng 2 sub-agent riêng biệt, song song** (hút từ mattpocock/skills `code-review` — tách riêng để 2 góc nhìn không nhiễm nhau):
  - **Trục Standards:** chạy `odoo_linter.py`, audit bảo mật (CSV, record rules), tối ưu SQL/ORM, detect N+1, pass ponytail over-engineering.
  - **Trục Spec:** đối chiếu diff với `SPEC.md`/`REQUIREMENTS.md` gốc — đủ acceptance criteria chưa, có làm lố scope không, naming đúng `CONTEXT.md` không.
- **Sản phẩm đầu ra:** Báo cáo review gộp 2 trục. Nếu phát hiện lỗi, **Architect** yêu cầu **Coder** (Gemini) sửa (vòng lặp nội bộ).

### Bước 9: Đóng gói & Chuẩn bị triển khai (`/ship`)
- **Model:** **Gemini 3.x Flash** (Shipper)
- **Hoạt động:** **Architect** gọi Sub-agent **Shipper** tổng hợp code, kết quả test, báo cáo review; chạy `git_cleaner.py`; push lên 2 nhánh Gitlab.
- **Sản phẩm đầu ra:** Tài liệu `walkthrough.md` tổng kết.
- **Phê duyệt Final:** Bàn giao sản phẩm hoàn chỉnh cho PO kiểm duyệt cuối cùng.

---

## 3. Bảng tóm tắt Model Assignment (Odoo)

| Bước | Lệnh | Vai trò | Model ưu tiên | Lý do |
|:---:|:---|:---|:---|:---|
| 1 | `/idea` | PO (con người) | (Claude hỗ trợ format) | Vision phải từ con người |
| 2 | `/req` | Architect | **Claude/Codex** | Phân tích nghiệp vụ Odoo |
| 3 | `/spec` | Architect | **Claude/Codex** | Thiết kế model/OWL kiến trúc |
| 4 | `/plan` | Architect | **Claude/Codex** | Atomic tasks cần tư duy hệ thống |
| 5 | `/build` | Coder | **Gemini** | Sinh code boilerplate, dùng templates |
| 6 | `/code-review` | Code Reviewer | **Claude/Codex** (khác model với Coder) | Soi diff thô, chặn bug trước khi test |
| 7 | `/test` | Tester | **Gemini** | Viết tests, chạy Playwright |
| 8 | `/review` | Reviewer | **Claude/Codex** | Audit nhiều khía cạnh, security |
| 9 | `/ship` | Shipper | **Gemini** | Đóng gói, git cleaner, push |

---

## 4. Subagent-Driven Development (hút từ superpowers) — cho bước `/build`

Thay vì 1 agent làm tuốt tuột 1 mạch dài (dễ trôi context, lỗi lan), **dispatch mỗi task nhỏ cho 1 sub-agent riêng (fresh context)** kèm **review 2 tầng** trước khi sang task kế:

```
Với mỗi task trong task.md (đã chia atomic ở /plan):
  1. Architect giao 1 sub-agent Coder MỚI (fresh) đúng 1 task, kèm:
     - trích đoạn SPEC liên quan + templates + ràng buộc ponytail (mức full)
     - bắt buộc gọi odoo-graph-mcp verify relations trước khi viết
  2. Review TẦNG 1 — Spec compliance: sub-agent làm ĐÚNG task chưa?
     (đủ acceptance, không lố scope, đúng version Odoo)
  3. Review TẦNG 2 — Code quality: ponytail (over-engineering), linter,
     security CSV/rule, N+1. Lỗi → trả Coder sửa (vòng lặp nội bộ).
  4. Chỉ khi 2 tầng PASS mới commit task đó và sang task kế.
```

**Lợi ích:** mỗi sub-agent context sạch → ít lỗi chéo; review 2 tầng bắt lỗi sớm; TDD (RED trước) chạy trong từng task. **Khi nào KHÔNG cần:** task quá nhỏ/1 file — làm thẳng, đừng tách sub-agent cho có (ponytail: đừng thêm tầng thừa).

> Phân model: Coder = **Gemini** (execution); 2 tầng review = **Claude/Codex** (analysis). Migrate/fix phức tạp thì Architect (Claude/Codex) tự cầm vòng lặp RCA.

---

## 5. Điều phối NHIỀU agent song song trên 1 dự án — Bản đồ chung (hút từ mattpocock/skills `wayfinder`)

§4 là vòng lặp **trong 1 phiên**: task tuần tự trong `task.md`, mỗi task 1 sub-agent. Nhưng khi việc **lớn hơn 1 phiên agent** — migrate cả cụm module qua nhiều version, feature chạm 4–5 module, dựng hệ thống mới nhiều phân hệ — thì cần lớp điều phối **xuyên phiên, xuyên agent**: 1 **Architect (Orchestrator)** cầm bản đồ, n agent thợ mỗi người nhận 1 ticket.

**Khi nào dùng §5 (và khi nào KHÔNG):**
- ✅ Việc ước lượng > 1 phiên context, hoặc muốn ≥ 2 agent chạy song song, hoặc nhiều người/nhiều máy cùng tham gia.
- ❌ Feature vừa 1 phiên → chỉ cần §4. Dựng bản đồ cho việc 1 phiên là over-engineering (ponytail).

### 5.1 Bản đồ (MAP) — artifact trung tâm

Mặc định dùng **local markdown** trong repo: `.scratch/map/MAP.md` + `.scratch/map/tickets/NNN-<ten-ticket>.md` (repo đã dùng GitHub/GitLab Issues thì map = 1 issue nhãn `wayfinder:map`, ticket = child issue — cơ chế y hệt). `.scratch/` đưa vào `.gitignore` nhánh production, giữ ở nhánh `-dev`.

```markdown
# MAP.md

## Đích đến
<1–2 dòng: hoàn thành nghĩa là gì — vd "Toàn bộ 6 module custom chạy sạch trên v17,
test pass, DB demo migrate không lỗi". Mọi phiên đọc mục này ĐẦU TIÊN để định hướng.>

## Ghi chú
<ràng buộc chung mọi agent phải biết: version Odoo, references bắt buộc đọc,
CONTEXT.md, chuẩn ponytail mức nào, cổng an toàn nào cần PO duyệt>

## Quyết định đã chốt
<!-- INDEX, không phải kho: mỗi ticket đóng = 1 dòng gist + link. Chi tiết sống trong ticket. -->
- [003 — Chọn chiến lược field company_dependent](tickets/003-company-dependent.md) — giữ property, không tách bảng
- [001 — Thứ tự migrate module](tickets/001-thu-tu-migrate.md) — base_x → hr_y → account_z (theo depends)

## Chưa đặc tả được (fog)
<!-- việc biết là phải làm nhưng chưa đủ thông tin để viết ticket — sẽ "graduate" thành ticket khi các ticket trước mở đường -->
- Xử lý report QWeb cũ: chờ chốt xong ticket 003 mới biết scope

## Ngoài phạm vi
<!-- đã cân nhắc và LOẠI — ghi lại để agent sau không mở lại -->
- Nâng cấp theme website: PO chốt để đợt sau
```

Mỗi **ticket** = 1 file, kích thước vừa **1 phiên agent** (~100K token làm được trọn):

```markdown
# 004 — Migrate module hr_timesheet_custom lên v17

## Loại: thực-thi          <!-- hoặc: quyết-định (điều tra/chọn hướng, chưa code) -->
## Bị chặn bởi: 001, 003   <!-- blocking edges — quyết định thứ tự và frontier -->

## Việc / Câu hỏi
<mô tả đủ để agent fresh context làm được, không cần đọc lại hội thoại nào>

## Bối cảnh
<link SPEC section, CONTEXT.md, references cần đọc, đường dẫn module>

## Kết quả
<agent thợ ghi khi xong: đã làm gì / quyết định gì + vì sao — 1 nơi duy nhất giữ chi tiết>
```

**3 luật của bản đồ:**
1. **Map là index, không phải kho.** Chi tiết quyết định sống trong ticket; map chỉ gist 1 dòng + link. Map load 1 lần mỗi phiên — phải rẻ.
2. **Gọi ticket bằng TÊN**, không gọi số trần. "Ticket *Chọn chiến lược company_dependent*" đọc hiểu ngay; "ticket 003" thì không.
3. **Quyết định trước, thực thi sau.** Ticket loại *quyết-định* resolve xong mới sinh ticket loại *thực-thi* tương ứng. Cưỡng lại cám dỗ "tiện tay code luôn" trong ticket quyết định — đó là dấu hiệu cần đóng ticket và mở ticket thực thi mới.

### 5.2 Vòng điều phối của Architect (1 điều phối n agent)

```
Mỗi chu kỳ điều phối:
  1. ĐỌC MAP.md → tính FRONTIER = các ticket mở KHÔNG bị chặn (Bị chặn bởi: rỗng
     hoặc toàn ticket đã đóng).
  2. DISPATCH song song: mỗi ticket frontier → 1 sub-agent fresh context, prompt kèm:
     nội dung ticket + mục "Đích đến" + "Ghi chú" + CONTEXT.md + trích SPEC liên quan.
     - Ticket thực-thi đụng code → cấp git worktree RIÊNG cho mỗi agent
       (git-workflow.md §3) để không giẫm chân nhau.
     - Trong mỗi ticket thực-thi, agent thợ tự chạy vòng §4 (TDD + review 2 tầng).
  3. THU KẾT QUẢ: agent thợ ghi mục "Kết quả" vào ticket → Architect:
     đóng ticket, thêm 1 dòng vào "Quyết định đã chốt", graduate fog thành ticket mới
     nếu đã đủ thông tin, mở ticket phát sinh (kèm blocking edges).
  4. LẶP đến khi frontier rỗng + "Đích đến" đạt → tổng kết cho PO, dọn .scratch/map
     (hoặc archive vào nhánh -dev).
```

**Phân model theo loại ticket:** Architect cầm map = **Claude/Codex**; ticket *quyết-định* (điều tra, chọn hướng, RCA) = **Claude/Codex**; ticket *thực-thi* (code theo spec đã chốt, viết test, đóng gói) = **Gemini** — đúng nguyên tắc vàng §1.

**Xử lý xung đột song song:** 2 ticket đụng cùng file/module → **thêm blocking edge cho chạy tuần tự**, đừng dựng cơ chế merge phức tạp (ponytail). Worktree chỉ giải quyết cách ly, không giải quyết tranh chấp logic.

**Cổng an toàn vẫn giữ nguyên:** ticket nào chạm backup/production/dữ liệu nghiệp vụ không chắc → agent thợ dừng ở cổng, ghi vào "Kết quả" trạng thái chờ, Architect gom lại hỏi PO 1 lượt.

---

## 6. Handoff — bàn giao giữa các phiên / giữa các agent (hút từ mattpocock/skills `handoff`)

Dùng khi: context 1 agent sắp cạn giữa chừng ticket; chuyển việc sang agent model khác (Claude → Gemini); nghỉ giữa chừng và mai làm tiếp.

Viết **1 file handoff** vào thư mục temp của máy (không bỏ vào workspace/repo), nội dung:

1. **Đang làm gì, tới đâu** — ticket/task nào, trạng thái thật (kể cả "test đang đỏ ở X").
2. **Trỏ, không chép** — quyết định đã chốt thì **link** tới MAP.md/ticket/SPEC/ARCH/commit, KHÔNG lặp lại nội dung đã có trong artifact khác.
3. **Bước kế tiếp cụ thể** — hành động đầu tiên agent mới nên làm.
4. **Skill/references cần load** — vd: `orm-basics.md`, `CONTEXT.md`, ticket 004.
5. **Redact** mọi secret/API key/thông tin cá nhân.

Agent mới nhận việc: đọc handoff → đọc `MAP.md` + `CONTEXT.md` → làm tiếp. Không cần đọc lại transcript phiên cũ.
