# Caveman — Chế độ giao tiếp siêu nén (đã absorb, opt-in)

> Nguồn: [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) (đã cài standalone tại
> `/Volumes/DATA/DEV/SKILLS/caveman`, symlink vào `~/.claude/skills/`). File này distill 6 năng lực của
> caveman và ánh xạ vào workflow odoo-dev-skills — **không cần gọi skill rời khi làm dự án Odoo**.

## 0. Vị trí trong bộ skill — phân biệt với ponytail

| | ponytail | caveman |
|---|---|---|
| Nén cái gì | **Khối lượng code** (viết ít code hơn, YAGNI) | **Văn phong output** (nói ít chữ hơn) |
| Benchmark (vs baseline) | LOC -54%, tokens -22%, cost -20% | LOC -20%, tokens **+7%**, cost **+3%** (khi dùng một mình) |
| Trong workflow | BẮT BUỘC ở `/build`, `/review` | **OPT-IN** — chỉ bật khi PO yêu cầu |

Hai skill bổ trợ nhau, không thay thế nhau: ponytail quyết định *làm gì*, caveman quyết định *nói thế nào*.
Số benchmark trên (từ chính bộ đo của ponytail) cho thấy caveman dùng một mình không tiết kiệm chi phí thật —
giá trị của nó nằm ở **đầu ra dễ đọc lướt** và ở các năng lực chuyên biệt §2–§5 dưới đây.

## 1. Chế độ nén văn phong (core) — chỉ bật khi PO yêu cầu

**Trigger:** PO nói "caveman", "ngắn gọn thôi", "bớt dài dòng", "less tokens", `/caveman`. **Tắt:** "stop caveman" / "nói bình thường".

**Luật khi bật (giữ nguyên từ bản gốc, đã đo lường):**
- Cắt: từ đệm, xã giao, rào đón, tường thuật tool-call, bảng/emoji trang trí. Câu cụt OK.
- **Giữ nguyên tuyệt đối:** thuật ngữ kỹ thuật, tên field/model/API, code block, error message (quote nguyên văn dòng quyết định ngắn nhất).
- **KHÔNG tự chế viết tắt** (cfg/impl/req/fn) và không dùng mũi tên `→` — tokenizer tách y như từ đầy đủ, không tiết kiệm token nào mà người đọc phải giải mã.
- **Nén văn phong, không nén ngôn ngữ:** PO nói tiếng Việt → caveman tiếng Việt. Mẫu: `[thứ] [bị gì] [vì sao]. [bước tiếp].`
- Không tự xưng "caveman mode on" — chỉ trả lời nén, không kèm bản thường.

**Cường độ:** `lite` (bỏ đệm, giữ ngữ pháp) / `full` (mặc định — bỏ mạo từ, câu cụt) / `ultra` (mỗi fact nói 1 lần, 1 từ khi đủ 1 từ).

**Ranh giới cứng trong dự án Odoo (quan trọng hơn mọi luật trên):** caveman **KHÔNG BAO GIỜ** áp lên
7 mandatory docs (IDEA/REQUIREMENTS/SPEC/ARCH/README/DEPLOY_GUIDE/CHANGELOGS), `walkthrough.md`,
`MIGRATION_REPORT.md`, hay bất kỳ tài liệu nào PO ký duyệt — các tài liệu đó phải đầy đủ, tiếng Việt chuẩn.
Caveman chỉ áp lên: trả lời chat khi PO yêu cầu, message bàn giao giữa các sub-agent (§5), commit message (§3),
comment review (§2).

## 2. Review comment 1 dòng (`/review` — dùng CÙNG ponytail pass)

Mỗi finding đúng 1 dòng: **vị trí, vấn đề, cách sửa** — không mở bài, không "I noticed that...".

```
models/patient.py:42 — _compute_age thiếu depends('birth_date') — thêm vào decorator
views/patient_views.xml:18 — còn attrs= (v17 crash khi cài) — đổi sang invisible="..."
security/ir.model.access.csv — thiếu rule cho hms.appointment — AccessError khi user thường mở form
```

Ở bước `/review`, Reviewer chạy: checklist 9 khía cạnh (final-audit-guide) + pass ponytail (over-engineering)
+ **xuất findings theo format caveman-review 1 dòng** — báo cáo tổng cho PO vẫn viết đầy đủ tiếng Việt.

## 3. Commit message chuẩn nén (`/ship`)

Conventional Commits, subject ≤50 ký tự, body chỉ khi "vì sao" không hiển nhiên từ diff, why hơn what:

```
fix(hms): tránh N+1 khi tính age hàng loạt

read_group 1 query thay vì loop search từng patient.
```

Áp dụng cho Shipper khi push 2 nhánh GitLab (git-workflow.md) — không viết commit dài dòng kể lể what.

## 4. Nén file memory/context (`caveman-compress`)

Nén file ngôn ngữ tự nhiên đọc-mỗi-phiên (`AGENTS.md`, `CLAUDE.md` project, TODO, preferences) theo luật §1
để giảm input token mỗi session; giữ nguyên code/URL/cấu trúc; bản gốc backup thành `FILE.original.md` rồi mới
ghi đè. Dùng khi file self-learning (`AGENTS.md` — xem self-learning.md) phình to sau nhiều bài học tích luỹ.
KHÔNG nén 7 mandatory docs (là tài liệu cho người đọc, không phải context cho máy).

## 5. Cavecrew — sub-agent trả kết quả nén (tiết kiệm context phiên chính)

Ý tưởng: khi phiên chính (Architect) spawn sub-agent, phần **tool-result trả về** chiếm context lớn. Cavecrew
quy định sub-agent trả kết quả theo format caveman → context phiên chính nhỏ hơn ~60%, phiên dài không bị đầy.

Ánh xạ vào multi-agent-orchestration.md:
- **investigator** (định vị code, read-only) ↔ dùng cho bước trinh sát trước `/spec`, `/fix` — trả về: đường dẫn file:dòng + 1 câu kết luận, không dán nguyên file.
- **builder** (sửa 1-2 file) ↔ task lẻ trong `/build` — trả về: diff + kết quả check, không tường thuật.
- **reviewer** (review diff) ↔ pass phụ trong `/review` — trả về findings 1 dòng theo §2.

**Luật báo cáo của mọi sub-agent trong bộ này (áp mặc định, không cần PO bật):** kết quả trả về phiên chính
viết kiểu nén §1-full (đây là kênh máy-đọc-máy); riêng nội dung sẽ đưa cho PO đọc thì viết đầy đủ.

## 6. Bảng tra nhanh

| PO nói / ngữ cảnh | Làm gì |
|---|---|
| "ngắn gọn thôi", "caveman" | Bật §1 cho trả lời chat (tiếng Việt nén), giữ nguyên tài liệu |
| "stop caveman" | Về văn phong thường |
| Bước `/review` | Findings 1 dòng (§2) — luôn áp |
| Bước `/ship` commit | Conventional Commits nén (§3) — luôn áp |
| `AGENTS.md` self-learning phình to | Đề xuất PO cho nén bằng §4 (có backup) |
| Spawn sub-agent | Sub-agent trả kết quả nén (§5) — luôn áp |
| Viết 7 mandatory docs / report PO duyệt | **KHÔNG BAO GIỜ nén** |
