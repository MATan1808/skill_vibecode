---
name: learn
description: Tự động chắt lọc bài học kinh nghiệm từ phiên hiện tại và cập nhật/tối ưu hoá vào đúng Skill trong AIaC (AutoHarness Engine).
allowed_tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob"]
---

# /learn — AIaC AutoHarness Experience Distillation

Lệnh kích hoạt cơ chế **AutoHarness** để rà soát toàn bộ phiên làm việc vừa qua, trích xuất bài học kỹ thuật cốt lõi và cập nhật có kiểm soát vào thư viện Plugin của AIaC.

## Quy trình Thực hiện (5 Bước)

1. **Rà soát & Trích xuất (Review & Extract)**:
   - Quét lại toàn bộ các turn và công cụ đã gọi trong phiên.
   - Nhận diện bài học bền vững: Một lỗi vừa sửa được (root cause), một bẫy lỗi vừa tránh được (pitfall), một cú pháp mới được kiểm chứng, hoặc một chỉ đạo phong cách/quy chuẩn từ Sếp.
   - Bỏ qua các sự cố ngẫu nhiên do môi trường mạng hoặc thao tác lỗi thời vụ.

2. **So sánh Trước (Compare-First)**:
   - Quét danh mục các Plugin AIaC hiện có (`360org/plugins/*`).
   - Tìm plugin và file tài liệu cùng domain:
     * Lỗi / quy trình Odoo ➔ `360-odoo` (`prompts/references/`)
     * Lỗi / quy trình Flutter / Mobile ➔ `360-flutter`
     * Lỗi / quy trình Sync Git / GitLab / GitHub ➔ `360-gitsync`
     * Lỗi / quy trình Kubernetes / Rancher ➔ `360-rancher`
     * Lỗi / quy trình Kiến trúc Instance / Sync Local ➔ `360-instance-arch`
     * Lỗi / quy trình Agent Harness / Loop ➔ `360-harness`
   - Tuyệt đối **KHÔNG tạo skill rời** hoặc micro-skill manh mún.

3. **Tách Biệt Đề Xuất (Propose)**:
   - Soạn thảo nội dung cập nhật dạng `patch` (thêm mục nhỏ/pitfall) hoặc `update` (thêm chuyên đề mới trong `prompts/references/`).
   - Đảm bảo trích xuất ở **tầm nguyên tắc (Rule-altitude)**: mệnh lệnh ngắn gọn, trigger rõ ràng; chuyển chi tiết kỹ thuật/traceback vào file reference.

4. **Kiểm Duyệt An Toàn (Promoter Gate)**:
   - Quét kiểm tra bảo mật: Không hardcode secret, API key, token hay password.
   - Kiểm tra đường dẫn: Đảm bảo đường dẫn file và format markdown chuẩn xác.
   - Ghi kèm lý do (`reason`) và trích dẫn bằng chứng (`evidence`) từ phiên làm việc.

5. **Xác Nhận & Lưu Trữ**:
   - Trình bày tóm tắt thay đổi và đề xuất cho Sếp xem.
   - Ghi nhận vào file tài liệu của Plugin và cập nhật `docs/CHANGELOGS.md`.
