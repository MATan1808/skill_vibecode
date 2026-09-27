# Nguyên Lý Thăng Cấp Mã Nguồn Tuyệt Đối (Zero-Bypass Promotion Pipeline)

Tài liệu này định nghĩa nguyên tắc luân chuyển mã nguồn **không thể bị phá vỡ** trong toàn bộ hệ sinh thái AIaC, áp dụng đặc biệt khắt khe cho môi trường SaaS / Production (như `vuahethong.net`).

## Vấn đề cần giải quyết
1. Bất đồng bộ môi trường (Code Drift): Mac một version, Local Server một version, Production chạy bản mới nhất chưa qua test kỹ.
2. Sửa nóng trên Production: Gây ra lỗi `column does not exist` do pod tự rotate nạp code mới chưa chạy update DB.
3. Bỏ qua chốt chặn kiểm thử thực tế (Final Review): Trực tiếp đẩy code thẳng từ môi trường phát triển lên máy chủ khách hàng.

---

## Luồng Thăng Cấp Bắt Buộc (Strict Promotion Pipeline)

Tuyệt đối tuân thủ luồng chảy tuyến tính một chiều sau:
**`Dev Local ➔ Push GitLab ➔ Pull Local Server ➔ Test/Fix ➔ Push GitLab ➔ Pull Production ➔ Release Test ➔ Done ➔ Report`**

### 1. Dev Local (Phát triển & Unit Test)
- **Môi trường:** Máy Mac (`/Volumes/DATA/WORK/...`)
- Mọi code logic, bản vá lỗi, hay module mới ĐỀU phải xuất phát từ đây.
- AIaC bắt buộc áp dụng nguyên lý Ponytail, giảm thiểu sửa đổi mã lõi, và chạy self-check.

### 2. Push GitLab (Chốt chặn Phiên bản)
- Code đạt chuẩn Dev Local phải được commit kèm changelog và đẩy lên GitLab (`origin/19.0` hoặc `<branch>`).
- **Nghiêm cấm:** Trực tiếp copy/rsync/scp từ Mac sang các môi trường trên.

### 3. Pull Local Server (Môi trường Final Review)
- **Môi trường:** Local Server (`ssh local`), container `odoo_dev_v19` / DB `test`.
- Kéo đúng bản cập nhật từ GitLab về Local Server.
- Khởi chạy và mô phỏng giao diện / hành vi y hệt Production.
- Nếu phát hiện lỗi (Fix/Update) ➔ Quay lại **Bước 1** (sửa trên Mac, push lại GitLab). KHÔNG được sửa nóng trên Local Server.

### 4. Pull Production (Zero-Downtime Deployment)
- **Môi trường:** Server thật khách hàng (`vuahethong`).
- Kéo từ GitLab đúng SHA đã qua bước test ở Local Server.
- Quản lý pod qua K8s: Code mới nạp, chạy `odoo -u <module> --stop-after-init` xong thì mới thay thế Pod cũ. Không được để Pod tự rotate nạp code chưa sẵn sàng DB (như vụ thiếu cột `zalo_media_state`).

### 5. Release Test ➔ Done ➔ Report
- Xác minh HTTP 200, kiểm tra log pod rỗng lỗi, và nghiệm thu luồng chức năng.
- Báo cáo kết quả và kết thúc quy trình (cập nhật task, ghi timesheet).

---

## Lệnh Khóa Hành Vi AI (AI Guardrails)
- AI Agent **tuyệt đối KHÔNG ĐƯỢC** sinh lệnh ssh/kubectl trực tiếp thay đổi tệp tin mã nguồn (git commit, pull merge conflicts tự xử lý, hay sửa file trực tiếp bằng `nano`/`echo`) trên máy chủ Production.
- Production là **immutable target** (chỉ Fetch + Checkout).
