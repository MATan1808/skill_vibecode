# Grilling & Domain Modeling (hút từ mattpocock/skills) — Odoo Edition

Hai kỹ thuật chống lệch pha giữa PO và agent, distill từ [mattpocock/skills](https://github.com/mattpocock/skills) (`grilling`, `grill-with-docs`, `domain-modeling`). Đã Việt hoá và ánh xạ vào workflow 9 bước.

- **Grilling** = phỏng vấn PO có kỷ luật **trước khi** sinh REQUIREMENTS/SPEC — chữa lỗi phổ biến nhất: agent build đúng thứ nó *tưởng* PO muốn.
- **Domain modeling** = duy trì `CONTEXT.md` (từ điển nghiệp vụ chung) — chữa lỗi agent dùng 20 từ cho khái niệm có sẵn 1 tên.

---

## 1. Grilling — phỏng vấn PO trước khi viết tài liệu

**Khi nào (bắt buộc):**
- Bước `/req` — trước khi sinh `REQUIREMENTS.md` từ `IDEA.md`.
- Bước `/spec` — khi có quyết định kiến trúc còn nhiều hướng (chọn model kế thừa hay model mới, wizard hay server action, OWL component hay view chuẩn...).
- Trước migrate/fix/backport lớn — khi phạm vi hoặc tiêu chí thành công còn mơ hồ.

**Luật phỏng vấn (5 luật cứng):**

1. **Mỗi lần đúng 1 câu hỏi.** Hỏi dồn nhiều câu một lúc làm PO rối và trả lời hời hợt. Chờ PO trả lời xong mới hỏi câu kế.
2. **Mỗi câu hỏi kèm phương án đề xuất của agent.** PO chỉ cần gõ "ok" là chốt được — giảm ma sát tối đa. Ví dụ: *"Trường `state` của phiếu nên có mấy trạng thái? Em đề xuất 3: draft → confirmed → done, huỷ dùng `active=False` thay vì state riêng. Ok không anh?"*
3. **Fact thì tự tra, decision mới hỏi.** Cái gì tra được từ môi trường — codebase, DB schema (qua `odoo-graph-mcp`), code core Odoo (grep/raw.githubusercontent), docs của repo — thì agent **tự tra**, cấm hỏi PO. Chỉ hỏi những gì thuộc quyền quyết định của PO: nghiệp vụ, ưu tiên, trade-off, phạm vi.
4. **Đi hết cây quyết định.** Mỗi câu trả lời có thể mở ra nhánh mới — resolve từng nhánh theo thứ tự phụ thuộc (quyết định A chặn quyết định B thì hỏi A trước). Dừng khi không còn nhánh nào chưa chốt.
5. **Chưa chốt xong thì chưa viết.** Không sinh REQUIREMENTS/SPEC/code khi cây quyết định còn nhánh treo. Kết quả grilling ghi thẳng vào tài liệu của bước đang chạy.

**Trong lúc grilling, làm luôn 2 việc docs (grill-with-docs):**
- Gặp thuật ngữ nghiệp vụ mới/mơ hồ → chốt tên gọi với PO và ghi ngay vào `CONTEXT.md` (§2).
- Gặp quyết định khó-giải-thích-lại-sau (vì sao chọn hướng A bỏ hướng B) → ghi 3–5 dòng vào mục "Quyết định kiến trúc" trong `ARCH.md`: bối cảnh → các hướng đã cân nhắc → lý do chọn. Không tạo cây `docs/adr/` riêng (ponytail: mục trong ARCH.md là đủ).

**Chống-mẫu:**
- ❌ Hỏi 5 câu 1 lượt dạng bảng — PO sẽ bỏ sót.
- ❌ Hỏi fact tra được ("model `sale.order` có field X không anh?") — tự tra đi.
- ❌ Grilling xong nhưng không ghi kết quả vào docs — phỏng vấn công cốc, phiên sau hỏi lại từ đầu.
- ❌ Grilling cho việc 1 file 5 phút — ponytail: việc nhỏ rõ ràng thì làm luôn.

---

## 2. Domain Modeling — `CONTEXT.md` (tài liệu thứ 8)

`CONTEXT.md` đặt ở root module (cạnh 7 mandatory docs), là **từ điển nghiệp vụ chung** giữa PO và mọi agent. Tạo ngay khi xuất hiện thuật ngữ riêng đầu tiên — không tạo file rỗng chờ sẵn.

**Format — mỗi term 1 mục, càng ngắn càng tốt:**

```markdown
# CONTEXT.md — Từ điển nghiệp vụ <tên module>

## Thuật ngữ

- **Ca gãy** (`split_shift`): ca làm việc bị tách 2 khúc trong ngày (sáng + tối). KHÔNG phải 2 ca riêng — chấm công tính là 1 ca.
- **Chốt sổ** (`period_lock`): khoá mọi chỉnh sửa chấm công của kỳ. Sau chốt sổ, sửa phải qua wizard "Điều chỉnh bổ sung" (`adjustment`), không sửa trực tiếp record gốc.
- **Phiếu điều chỉnh** (`adjustment`): record bổ sung trỏ về record gốc qua `origin_id`, không ghi đè.

## Quy ước đặt tên

- Field/model/label đặt theo cột `(...)` ở trên — ví dụ ca gãy luôn là `split_shift`, không dùng `broken_shift`/`double_shift`.
```

**Luật sử dụng:**

1. **Mọi sub-agent (Coder/Tester/Reviewer/Shipper) phải đọc `CONTEXT.md` trước khi làm việc** — tên field, method, label view, tên test đều phải dùng đúng term. Architect khi dispatch sub-agent (orchestration §4/§5) phải đính kèm `CONTEXT.md` vào prompt.
2. **Cập nhật inline, không chờ cuối phiên.** Đang grilling/build mà phát hiện term mới, term trùng nghĩa, hoặc term dùng sai chỗ → sửa `CONTEXT.md` ngay trong lượt đó.
3. **Stress-test term bằng edge-case.** Khi chốt term mới, thử 1–2 kịch bản biên: *"Ca gãy mà khúc tối rơi sang ngày hôm sau thì tính ngày nào?"* — nếu term vỡ, định nghĩa lại trước khi code.
4. **Term Odoo chuẩn không cần đưa vào** (picking, reconcile, chatter... đã là ngôn ngữ chung) — chỉ đưa term **riêng của nghiệp vụ khách** hoặc term Odoo bị khách dùng lệch nghĩa.
5. Nói chuyện với PO dùng **tên tiếng Việt**, code dùng **tên kỹ thuật** trong ngoặc — `CONTEXT.md` chính là bảng ánh xạ 2 chiều đó.

**Lợi ích đo được:** agent trả lời ngắn hơn (1 term thay 1 câu giải thích), đặt tên nhất quán xuyên module, codebase dễ navigate, ít token thinking. Trả lãi mỗi phiên làm việc.
