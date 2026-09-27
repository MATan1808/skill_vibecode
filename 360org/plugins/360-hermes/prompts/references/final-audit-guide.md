# Final Audit & Parity Audit Checklist — trước khi ship 1 plugin Hermes

Dùng ở bước `/review` (đánh giá đúng/sai, song song với ponytail over-engineering review ở `ponytail-lazy-dev.md § 2`).

## Checklist 8 khía cạnh

1. **Đúng loại plugin** — SPEC.md có nêu rõ Platform Adapter/Tool/Skill/Provider và lý do chọn (bảng trong `SKILL.md`)? Có khả năng đáng lẽ nên là Skill thay vì Tool không?
2. **Đúng chữ ký API** — mọi `register_platform()`/`register_tool()`/`register_provider()` param đã đối chiếu với docs gốc hoặc source thật, có trích nguồn (file:dòng hoặc link) trong SPEC/PLAN, không phải suy đoán.
3. **Contract handler đúng** — nếu là Tool: handler trả JSON string, lỗi trả `{"error": ...}`, không `raise` ra ngoài.
4. **Token/credential an toàn** — không log secret; nếu giữ kết nối persistent với credential duy nhất, đã dùng `acquire_scoped_lock()`/`release_scoped_lock()` chưa (xem `platform-adapters.md`)?
5. **Xử lý lỗi không sập cả gateway** — mọi vòng lặp poll/callback đều bọc try/except riêng từng tick, không để 1 lỗi network làm chết cả adapter.
6. **Format đầu ra đúng platform** — nếu platform yêu cầu plain-text nhưng render qua HTML, đã xử lý newline/escape đúng (xem `debugging-and-operations.md § 5`)?
7. **Env vars đầy đủ trong `plugin.yaml`** — mọi biến plugin đọc từ `os.getenv()` đều có khai trong `requires_env`/`optional_env` để `hermes config` UI hiện đúng.
8. **Đã test thật trên server** — không chỉ code xong là coi như xong: `hermes gateway restart` + đọc `logs/gateway.log` + gửi tin nhắn test thật.

## Parity Audit — bắt buộc khi thêm Platform Adapter mới

Quy trình chính thức từ docs (xem `platform-adapters.md § Parity Audit`):

```bash
# platform tham chiếu đã ổn định, chọn platform gần giống nhất với platform mới
grep -rl "<reference_platform>" --include="*.py" .
grep -rl "<new_platform>" --include="*.py" .
# File có trong tập đầu mà thiếu ở tập sau → khoảng trống cần điều tra
```

Lặp lại cho `.md` và cấu hình liên quan. Với mỗi khoảng trống: xác định đây là chỗ cần bổ sung (vd thiếu token lock, thiếu cron delivery) hay chỉ là tham chiếu đặc thù platform kia (bỏ qua được).

## Output review

Theo format chuẩn `/code-review`: mỗi finding 1 dòng `<file>:L<dòng>: <mô tả ngắn>`, xếp theo mức độ nghiêm trọng — bug đúng/sai trước, rồi tới thiếu tích hợp tự động (bảng "Plugin System tự lo" trong `platform-adapters.md`), rồi tới over-engineering (xem `ponytail-lazy-dev.md § 2`).

Không có gì để báo: `Sạch rồi. Sẵn sàng /ship.`
