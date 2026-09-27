# Odoo v14-v19 Standards (360org)

1. **XML Views**:
   - Loại bỏ hoàn toàn `attrs=`. Dùng trực tiếp `invisible="..."`, `readonly="..."`, `required="..."`.

2. **ORM Constraints & Indexing**:
   - Dùng `models.Constraint()` và `models.Index()` thay cho `_sql_constraints` / `index=True`.
   - Dùng toán tử ORM mới `any!` và `not any!`.

3. **Mail, Chatter & Quy Chuẩn Tạo/Cập Nhật Task Trên `vuahethong.net` (BẮT BUỘC ĐẦY ĐỦ THÔNG TIN, CẤM LÀM CHO CÓ)**:
   - Khi đăng bài, ghi chú hoặc gửi comment tự động vào chatter qua ORM (`task.message_post()`, `record.message_post()`, `mail.message`):
     * Trong Odoo 15+, trường `body` mặc định được sanitize và escape chuỗi HTML nếu không được đánh dấu an toàn.
     * **BẮT BUỘC** import `from markupsafe import Markup` và bọc nội dung HTML bằng `Markup(html_string)` trước khi truyền vào `body` hoặc `msg.write({'body': Markup(...)})`.
     * **Nghiêm cấm tuyệt đối**: Không truyền raw HTML string chưa bọc Markup trực tiếp làm hiển thị lộ toàn bộ thẻ `<p>`, `<ul>`, `<li>`, `<code>` ra ngoài giao diện chatter.
   - **Quy Chuẩn Tạo/Cập Nhật Task (`project.task`)**:
     * **Assignee (`user_ids`)**: Gán đích danh nhân sự chịu trách nhiệm.
     * **Allocated Time (`allocated_hours`)**: Bắt buộc dự toán thời lượng (VD: `2.0 giờ`), không để `00:00`.
     * **Deadline (`date_deadline`)**: Đặt ngày hoàn thành cụ thể.
     * **Labels/Tags (`tag_ids`)**: Gắn tag phân loại chuẩn (`Kỹ thuật`, `Fixed Issues`...).
     * **Milestone (`milestone_id`)**: Gán milestone nếu dự án có cấu hình.
     * **Activity (`mail.activity`)**: BẮT BUỘC tạo Activity (`To Do`) chỉ định nhân sự phụ trách kèm deadline và ghi chú để Odoo gửi thông báo nhắc việc.
     * **Description**: Đầy đủ Mô tả / Traceback / Root Cause / Giải pháp.
     * **Timesheet (`account.analytic.line`)**: Bắt buộc ghi nhận thời gian thực hiện khi hoàn thành/cập nhật tiến độ.

4. **Asset Bundling Chuẩn cho Web Editor & Builder**:
   - Mở rộng thanh công cụ chỉnh sửa Website Builder (LinkTools, Snippet Options, Colorpicker) **BẮT BUỘC** khai báo vào bundle `web_editor.assets_wysiwyg`.
   - Script tương tác cho khách vãng lai/người dùng trên Website công khai dùng `web.assets_frontend`.
   - Giao diện quản trị hệ thống dùng `web.assets_backend`.

5. **Zero-Downtime Module Production Update**:
   - Backup DB trước khi update module và verify dump bằng `pg_restore -l`.
   - Backup code bằng stream tar từ production pod về local server theo `client-name`.
   - Cập nhật code addon sạch, chạy `odoo -d <db> -u <module> --stop-after-init`, rồi scale up pod mới + scale down pod cũ; không dùng `rollout restart` cho production module update.
   - Chi tiết: `prompts/references/module-production-update.md`.

