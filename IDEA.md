# IDEA — AI Infrastructure as Code (AIaC)

> Ý tưởng ban đầu thiết lập bởi Sếp Châu

Hệ thống quản lý cấu hình, kĩ năng (skills), quy tắc (rules) và công cụ tự động hóa tập trung cho AI Agents của Sếp Châu tại **360org**.

## 1. Tầm nhìn
Mục tiêu là xây dựng một **Trạm điều khiển trung tâm (Core Base)** duy nhất cho AI Agent, cho phép:
*   Mọi thiết bị mới chỉ cần chạy 1 lệnh cài đặt là có đầy đủ bộ khung AI hỗ trợ đắc lực.
*   Cập nhật lõi ECC Core gốc (upstream) tự động, không xung đột với các plugin tùy biến của 360org.
*   Phát triển tính năng AIaC mới mà không làm thay đổi hoặc làm hỏng mã nguồn ECC upstream: mọi phần do 360org sở hữu phải nằm trong namespace tách biệt, có điểm tích hợp rõ ràng và chỉ được nối vào core qua installer/adapter ổn định.
*   Tự động hóa hoàn toàn (Zero-Command) dựa trên vị trí thư mục (cwd), tự sinh cấu hình cục bộ và sơ đồ dependencies (Codegraph) giúp tiết kiệm token tối đa.

## 2. Bản đồ tính năng chính
- **Core Base (ECC v1.10.0)**: Kế thừa toàn bộ hệ thống lõi.
- **Smart Router (360-smart-router.js)**: Trái tim tự động định tuyến luật, sinh config local và auto-update ngầm.
- **Codegraph**: Tự động sinh sơ đồ Mermaid biểu diễn import/export, giúp Claude có cái nhìn toàn cảnh dự án tức thì.
- **Tài sản kĩ năng 360org**: Odoo Suite, V-Assistant Suite, Hermes, OpenClaw, Flutter.
