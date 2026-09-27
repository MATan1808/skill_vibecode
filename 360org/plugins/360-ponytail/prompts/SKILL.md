---
name: 360-ponytail
description: Nguyên tắc tối giản hóa mã nguồn — YAGNI, nấc thang leo thang (The Ladder), Karpathy Guidelines (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) và ngăn chặn tình trạng over-engineering của AI Agent. Trigger: "ponytail", "karpathy", "karpathy guidelines", "andrej karpathy".
metadata:
  origin: 360org
---

# 360org — Ponytail (Nguyên tắc viết code tối giản)

Nguyên tắc viết code tối giản tối đa, boring over clever, và triệt tiêu hoàn toàn boilerplate hoặc các abstraction thừa thãi. 

---

## 1. Triết lý Cốt lõi
*   **Lazy Senior Developer**: "Lười" ở đây nghĩa là hiệu quả tối đa, không phải cẩu thả. Đoạn code tốt nhất là đoạn code không bao giờ phải viết.
*   **Deletion > Addition**: Ưu tiên xóa bỏ code thừa hơn là viết thêm code mới.
*   **Boring > Clever**: Code nhàm chán, tường minh luôn tốt hơn code thông minh nhưng phức tạp (clever).

---

## 2. Nấc thang Leo Thang (The Ladder)
Trước khi viết bất kỳ dòng code nào, Agent bắt buộc phải dừng lại ở rực đầu tiên còn hợp lệ:

1.  **Có thực sự cần thiết build không? (YAGNI)**: Yêu cầu mang tính dự đoán, "để dành cho tương lai" ➜ Bỏ qua ngay lập tức.
2.  **Đã có sẵn trong codebase chưa?**: Quét và tái sử dụng các helpers, utils, types, patterns đã có sẵn trong dự án. Tuyệt đối không viết lại những gì đã có ở file bên cạnh.
3.  **Thư viện chuẩn (Stdlib) giải quyết được không?**: Ưu tiên dùng các hàm có sẵn của ngôn ngữ.
4.  **Native Platform Feature có cover không?**: Ví dụ dùng `<input type="date">` thay vì cài thư viện date picker, dùng CSS thay vì JS, dùng DB constraint (Unique, Foreign Key) thay vì code check ở app layer.
5.  **Dependency đã cài sẵn có giải quyết được không?**: Sử dụng các thư viện đã cài trong `package.json` / `requirements.txt` / `pubspec.yaml`, cấm cài package mới cho những tác vụ nhỏ.
6.  **Có thể viết gọn trong 1 dòng không?**: Ưu tiên các giải pháp one-liner sạch sẽ.
7.  **Chỉ khi không nấc nào ở trên đủ**: Viết đoạn code tối thiểu để chạy đúng.

---

## 3. Code Boundary & Luật chống Over-Engineering
*   **Không tự ý vẽ Abstraction**: Không tạo interface nếu chỉ có một class thực thi (implementation), không tạo factory class cho một sản phẩm, không tạo file config cho giá trị không bao giờ đổi.
*   **Sửa Root Cause, không vá Symptom**: Khi fix bug, bắt buộc grep toàn bộ các nơi gọi (caller) của hàm bị lỗi. Sửa một chỗ ở core (Shared Function) thay vì đi vá chắp vá ở từng caller.
*   **Comment đơn giản hóa**: Nếu chủ động shortcut logic (chỉ dùng global lock, scan O(n²), naive heuristic...), bắt buộc ghi comment dạng: `// ponytail: [giới hạn] ➜ nâng cấp thành [giải pháp] khi [điều kiện]`.
*   ** runnable check**: Logic không tầm thường (money path, security, parser) phải để lại ít nhất 1 runnable check nhỏ (assert trong file hoặc 1 test file nhỏ, không dùng test framework cồng kềnh).

---

## 4. Quản lý Nợ Kỹ thuật (Technical Debt)
*   **Ponytail Debt**: Ghi nhận và liệt kê các đoạn code chắp vá tạm thời.
*   **Ponytail Gain**: Đánh giá hiệu năng và số lượng dòng code giảm thiểu được sau khi refactor theo Ponytail.
*   **Định dạng phản hồi**: Code trước, giải thích sau (tối đa 3 dòng) theo pattern:
    `[code] ➜ skipped: [những thứ đã bỏ qua], add khi [điều kiện cần thiết].`

---

## 5. Karpathy Guidelines (Andrej Karpathy)
Tích hợp từ các quan sát thực chiến của Andrej Karpathy về những cạm bẫy mã nguồn phổ biến của LLM:
1.  **Think Before Coding**: Nêu rõ các giả định trước khi viết code. Nếu có nhiều cách hiểu thì phải trình bày, không tự chọn âm thầm. Luôn đề xuất giải pháp đơn giản hơn.
2.  **Simplicity First**: Code tối thiểu giải quyết vấn đề, không viết tính năng đầu cơ, không dựng abstraction cho code dùng 1 lần, không tạo flexibility/config khi không được yêu cầu.
3.  **Surgical Changes (Sửa phẫu thuật)**: Chỉ chạm vào những gì bắt buộc. Không sửa code, comment hay format lân cận nếu không liên quan. Mọi dòng code thay đổi phải truy xuất trực tiếp về yêu cầu.
4.  **Goal-Driven Execution**: Xác định tiêu chí thành công kiểm chứng được (verifiable goals/tests). Lặp lại cho đến khi kiểm chứng đạt chuẩn.
