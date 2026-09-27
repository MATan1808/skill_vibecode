---
name: 360-caveman
description: Tối ưu hóa Token & nén Context window của Agent — Dọn dẹp log rác, đo lường token, và trả lời siêu cô đọng (Terse Mode).
metadata:
  origin: 360org
---

# 360org — Caveman (Tối ưu hóa Token & Context)

Bộ quy chuẩn giúp Agent tiết kiệm token tối đa, ngăn ngừa tình trạng tràn context window dẫn đến mất trí nhớ (forgetting) hoặc tốn chi phí API vô ích.

---

## 1. Phong cách Trả lời Siêu cô đọng (Terse Mode)
*   **Đi thẳng vào vấn đề**: Bỏ qua các câu chào hỏi xã giao, lời kết luận sáo rỗng hoặc giải thích lý thuyết dông dài.
*   **Trình bày gọn gàng**: Không in nguyên khối các tag XML nội bộ (`<instructions>`, `<system-reminder>`) ra chat. Trình bày ngắn gọn bằng danh sách Markdown hoặc Blockquote.
*   **Code-First**: Đưa code ra trước, giải thích kỹ thuật chỉ khi Sếp Châu yêu cầu sâu.

---

## 2. Quét & Nén Context Chủ Động (`caveman-compress`)
Khi làm việc với các project lớn hoặc khi chạy thử nghiệm sinh ra quá nhiều log/text:
*   **Chủ động nén**: Sếp có thể ra lệnh cho Agent chạy nén context bất cứ lúc nào.
*   **Cách thức**: Agent tự động tổng hợp các file đã đọc, tóm tắt các thay đổi quan trọng và các quyết định kỹ thuật đã đưa ra thành một bản Snapshot ngắn gọn, sau đó dọn sạch context cũ.
*   **Giới hạn đọc file**: Không dùng lệnh `cat`, `head`, `tail` để in toàn bộ file lớn ra chat. Chỉ đọc các vùng code cần sửa bằng `Read` có offset/limit.

---

## 3. Đo lường Token & Quản lý Chi phí (`caveman-stats`)
*   Agent tự động theo dõi số lượng token tiêu thụ qua từng lượt (turn) và hiển thị cảnh báo nếu context phình to đột biến.
*   Khi chạy log (Odoo, Docker, Tauri), bắt buộc phải pipe qua proxy lọc log (`token_killer_proxy.py` hoặc parser Node.js) để loại bỏ 80% log thừa (pooling requests, assets loading, noise logs) trước khi đưa vào context.
