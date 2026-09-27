---
name: 360-superpowers
description: Tự động phân chia công việc bằng Subagents và Quy trình kiểm chứng thực tế ngầm bắt buộc (macOS Native).
metadata:
  origin: 360org
---

# 360org — Superpowers (Subagent & Kiểm chứng ngầm)

Bộ kỹ năng giúp Agent tự động hóa việc phân chia công việc phức tạp thông qua Subagents và bắt buộc chạy kiểm thử thực tế trên hệ điều hành trước khi hoàn thành task.

---

## 1. Tự động Phân chia Công việc (Subagent-Driven Development)
Khi nhận được yêu cầu lớn, phức tạp từ Sếp Châu (ví dụ: "Thêm module saas dự án mới cho Odoo", hoặc "Viết tính năng scheduler cho V-Assistant"):
*   **Không code mù quáng**: Agent tự động phân tách yêu cầu thành các phần việc độc lập.
*   **Tự động gọi Subagents**: Sử dụng công cụ `Agent` (hoặc `Workflow` ngầm) để chia việc cho các subagents chuyên biệt chạy song song:
    - **Subagent A (Planner/Specifier)**: Khảo sát codebase, viết SPEC.md, ARCH.md.
    - **Subagent B (Builder)**: Nhận Spec và Plan để tập trung code các files logic.
    - **Subagent C (Tester/Reviewer)**: Chạy test, linter, review chất lượng code chống over-engineering.
*   **Tổng hợp**: Agent chính tổng hợp kết quả từ các subagents và kiểm tra chéo độ nhất quán.

---

## 2. Quy trình Kiểm chứng ngầm Bắt buộc (Verification-Before-Completion)
*   **Compile được ≠ Chạy được**: Agent không được phép báo cáo "Đã xong" nếu chỉ biên dịch thành công (cargo check pass hoặc tsc pass).
*   **Test live bắt buộc**:
    - **Với V-Assistant**: Bắt buộc spawn tiến trình chạy thử app native (`npm run tauri dev`) hoặc build bản cài thật (`npm run build:local`) và trực tiếp thao tác/verify logic trên macOS.
    - **Với Odoo**: Bắt buộc chạy linter (`odoo_linter.py`) và test thử migration DB trên pod one-off trước khi merge.
*   **Bằng chứng kiểm chứng**: Mỗi khi báo cáo kết quả cho Sếp Châu, Agent bắt buộc phải đính kèm bằng chứng thực tế: output chạy test, log log-file verify, hoặc mã lỗi cụ thể (nếu fail).
