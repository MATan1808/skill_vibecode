# Grilling & Domain Modeling (hút từ mattpocock/skills)

Hai kỹ thuật chống lệch pha giữa PO và agent, distill từ [mattpocock/skills](https://github.com/mattpocock/skills) (`grilling`, `grill-with-docs`, `domain-modeling`). Áp dụng cho **mọi dự án non-Odoo** (bản Odoo-specific xem [odoo-dev-skills/references/grilling-and-domain-modeling.md](../../../360-odoo/prompts/references/grilling-and-domain-modeling.md)).

- **Grilling** = phỏng vấn PO có kỷ luật **trước khi** sinh REQUIREMENTS/SPEC — chữa lỗi phổ biến nhất: agent build đúng thứ nó *tưởng* PO muốn.
- **Domain modeling** = duy trì `CONTEXT.md` (từ điển nghiệp vụ chung) — chữa lỗi agent dùng 20 từ cho khái niệm có sẵn 1 tên.

---

## 1. Grilling — phỏng vấn PO trước khi viết tài liệu

**Khi nào (bắt buộc):** bước `/req` trước khi sinh `REQUIREMENTS.md`; bước `/spec` khi quyết định kiến trúc còn nhiều hướng; trước mọi thay đổi lớn mà phạm vi/tiêu chí thành công còn mơ hồ.

**Luật phỏng vấn (5 luật cứng):**

1. **Mỗi lần đúng 1 câu hỏi.** Hỏi dồn nhiều câu làm PO rối và trả lời hời hợt. Chờ trả lời xong mới hỏi câu kế.
2. **Mỗi câu hỏi kèm phương án đề xuất của agent.** PO chỉ cần gõ "ok" là chốt được — giảm ma sát tối đa.
3. **Fact thì tự tra, decision mới hỏi.** Cái gì tra được từ môi trường (codebase, schema, docs của repo, package.json...) thì agent **tự tra**, cấm hỏi PO. Chỉ hỏi những gì thuộc quyền quyết định của PO: nghiệp vụ, ưu tiên, trade-off, phạm vi.
4. **Đi hết cây quyết định.** Mỗi câu trả lời có thể mở nhánh mới — resolve từng nhánh theo thứ tự phụ thuộc. Dừng khi không còn nhánh chưa chốt.
5. **Chưa chốt xong thì chưa viết.** Không sinh REQUIREMENTS/SPEC/code khi cây quyết định còn nhánh treo. Kết quả grilling ghi thẳng vào tài liệu của bước đang chạy.

**Trong lúc grilling, làm luôn 2 việc docs (grill-with-docs):**
- Gặp thuật ngữ nghiệp vụ mới/mơ hồ → chốt tên gọi với PO, ghi ngay vào `CONTEXT.md` (§2).
- Gặp quyết định khó-giải-thích-lại-sau → ghi 3–5 dòng vào mục "Quyết định kiến trúc" trong `ARCH.md`: bối cảnh → các hướng đã cân nhắc → lý do chọn. Không tạo cây `docs/adr/` riêng (ponytail: mục trong ARCH.md là đủ).

**Chống-mẫu:** hỏi 5 câu 1 lượt; hỏi fact tra được; grilling xong không ghi vào docs; grilling cho việc nhỏ rõ ràng (ponytail: làm luôn).

---

## 2. Domain Modeling — `CONTEXT.md` (tài liệu thứ 8)

`CONTEXT.md` đặt ở root dự án (cạnh 7 mandatory docs), là **từ điển nghiệp vụ chung** giữa PO và mọi agent. Tạo ngay khi xuất hiện thuật ngữ riêng đầu tiên — không tạo file rỗng chờ sẵn.

**Format — mỗi term 1 mục, càng ngắn càng tốt:**

```markdown
# CONTEXT.md — Từ điển nghiệp vụ <tên dự án>

## Thuật ngữ

- **Combo** (`combo`): gói ≥2 sản phẩm bán kèm giá ưu đãi. KHÔNG phải bundle kỹ thuật — mỗi item vẫn xuất kho riêng.
- **Lead nóng** (`hot_lead`): lead đã điền form báo giá trong 48h. Quy tắc routing khác lead thường.

## Quy ước đặt tên

- Field/component/route đặt theo tên kỹ thuật `(...)` ở trên — combo luôn là `combo`, không dùng `bundle`/`package`.
```

**Luật sử dụng:**

1. **Mọi sub-agent (Coder/Tester/Reviewer/Shipper) phải đọc `CONTEXT.md` trước khi làm việc** — tên biến, component, route, tên test đều dùng đúng term. Architect khi dispatch sub-agent phải đính kèm `CONTEXT.md` vào prompt.
2. **Cập nhật inline, không chờ cuối phiên** — phát hiện term mới/trùng nghĩa/dùng sai là sửa ngay trong lượt đó.
3. **Stress-test term bằng edge-case** khi chốt term mới — term vỡ thì định nghĩa lại trước khi code.
4. **Chỉ đưa term riêng của nghiệp vụ** — khái niệm chuẩn ngành (cart, checkout, session...) không cần.
5. Nói chuyện với PO dùng **tên tiếng Việt**, code dùng **tên kỹ thuật** — `CONTEXT.md` là bảng ánh xạ 2 chiều.

**Lợi ích đo được:** agent trả lời ngắn hơn, đặt tên nhất quán, codebase dễ navigate, ít token thinking. Trả lãi mỗi phiên làm việc.
