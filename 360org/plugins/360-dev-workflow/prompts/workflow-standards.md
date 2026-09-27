# 360-dev-workflow Standards

1. **Workflow 9 Bước Bắt Buộc**: `/idea ➜ /req ➜ /spec ➜ /plan ➜ /build ➜ /code-review ➜ /test ➜ /review ➜ /ship`
   - `/code-review` là **cổng chặn** giữa `/build` và `/test`: soi diff thô tìm bug correctness / reuse / over-engineering / security trước khi Tester bỏ công viết test. Còn finding Critical/High chưa xử lý thì không được sang `/test`. Trần 3 vòng fix, quá 3 vòng escalate về Architect.
2. **7 Tài Liệu Bắt Buộc**: `IDEA.md`, `REQUIREMENTS.md`, `SPEC.md`, `ARCH.md`, `README.md`, `DEPLOY_GUIDE.md`, `CHANGELOGS.md`.
3. **Quy Tắc Cập Nhật Docs Trước Khi Git Push**: Bắt buộc đồng bộ tài liệu trước mọi commit/push.
