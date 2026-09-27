# Cơ chế Tự học Tự động của AI Agent (Autonomous Self-Learning)

Tài liệu này hướng dẫn cách thiết lập và vận hành cơ chế tự học tự động (Autonomous Self-Learning) dành cho các AI Agent khi tham gia phát triển dự án Odoo trong công ty. Cơ chế này giúp AI tự thích ứng, tự sửa sai và ghi nhớ các quy tắc đặc thù của dự án mà không cần người dùng phải gõ lệnh thủ công.

---

## 1. Nguyên lý hoạt động của Tự học Tự động

Thay vì bắt người dùng phải chạy các lệnh gập khuôn như `/learn`, AI Agent hoạt động trên hệ thống phải có thói quen **tự quan sát và tự ghi nhận** (Post-execution habits):

```text
[Phản hồi của người dùng] 
       │
       ▼ (AI phát hiện có sự sửa đổi/chỉ dẫn ràng buộc mới)
[Phân tích bài học] 
       │
       ▼ (AI tự động trích xuất quy tắc cốt lõi)
[Cập nhật file Rules] 
       │
       ▼ (AI ghi đè/bổ sung vào .agents/AGENTS.md)
[Báo cáo & Cam kết] (AI thông báo cho người dùng đã học và ghi nhớ quy tắc)
```

---

## 2. Quy trình thực thi bắt buộc đối với AI Agent

Khi người dùng đưa ra các câu lệnh sửa sai (ví dụ: *"Không được chạy local, phải chạy qua docker"* hoặc *"chạy sh prod up thay vì ./prod"*), AI Agent phải tự động thực hiện các bước sau:

### Bước 1: Phát hiện và Trích xuất Quy tắc
- AI phân tích sự khác biệt giữa hành động sai trước đó và hành động đúng được người dùng chỉ định.
- Trích xuất thành quy tắc ngắn gọn, rõ ràng dưới dạng: **Bối cảnh -> Hành động cấm -> Hành động thay thế đúng**.

### Bước 2: Tự động ghi nhận vào tệp cấu hình dự án
- AI kiểm tra sự tồn tại của tệp `.agents/AGENTS.md` ở gốc của Workspace hiện tại. Nếu chưa có, AI tự động tạo thư mục `.agents` và tệp `AGENTS.md`.
- AI tự động append (hoặc cập nhật) quy tắc mới học được vào phần **"Quy tắc quan trọng đã học (Rules Learned)"** của file `AGENTS.md`.

### Bước 3: Đọc lại Rules trước mỗi lượt chạy
- Đầu mỗi cuộc hội thoại hoặc trước khi thực thi bất kỳ câu lệnh terminal nào, AI Agent bắt buộc phải đọc tệp `.agents/AGENTS.md` để nạp các quy tắc tùy chỉnh của dự án vào ngữ cảnh làm việc hiện tại, đảm bảo không bao giờ vi phạm các quy tắc đã học.

---

## 3. Cấu trúc mẫu của tệp `.agents/AGENTS.md`

Tệp `.agents/AGENTS.md` được lưu trữ tại thư mục gốc của dự án và có cấu trúc tiêu chuẩn như sau:

```markdown
# Quy tắc tùy chỉnh dự án & Bài học tự học của AI

Tệp này ghi lại các quy tắc vận hành và bài học tự học được tích lũy tự động trong quá trình làm việc.

---

## 🚨 Quy tắc quan trọng đã học (Rules Learned)

### 1. [Tên quy tắc 1]
- **Quy tắc:** [Mô tả quy tắc cấm/buộc phải làm]
- **Cách xử lý đúng:** [Hướng dẫn thực hiện đúng chuẩn]

### 2. [Tên quy tắc 2]
- **Quy tắc:** [Mô tả quy tắc cấm/buộc phải làm]
- **Cách xử lý đúng:** [Hướng dẫn thực hiện đúng chuẩn]
```
