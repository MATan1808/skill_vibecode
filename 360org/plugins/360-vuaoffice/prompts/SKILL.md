---
name: 360-vuaoffice
description: |
  Bộ kỹ năng & quy chuẩn phát triển bộ ứng dụng văn phòng VuaOffice (gensoffice origin).
  Bao gồm các AI Agent skills phát triển tính năng biên tập văn bản (Docs), bảng tính (Sheets), trình chiếu (Slides), email, lưu trữ đám mây và xử lý tài liệu AI.
  MUST be loaded khi task liên quan tới: phát triển, debug, thiết kế hoặc mở rộng tính năng cho VuaOffice Suite.
---

# 360org — VuaOffice Suite Development & AI Skills (`360-vuaoffice`)

Quy chuẩn và bộ kỹ năng phát triển bộ ứng dụng văn phòng thông minh **VuaOffice Suite** (gensoffice origin).

---

## 🛠️ Các Sub-skills Phục Vụ Phát Triển VuaOffice

- **VuaOffice Docs & Office**: `skills/gsk-google-docs`, `skills/gsk-google-sheets`, `skills/gsk-google-slides`, `skills/gsk-summarize-large-document`.
- **Cloud Storage & Connectivity**: `skills/gsk-google-drive`, `skills/gsk-onedrive`, `skills/gsk-sharepoint`, `skills/gsk-aidrive`.
- **Communication & Mail**: `skills/gsk-gmail`, `skills/gsk-outlook-email`.
- **Document AI & Design**: `skills/gsk-design`, `skills/gsk-understand-images`, `skills/gsk-analyze-media`.

---

## 🔄 Quy Trình Cập Nhật Skill

Để cập nhật các tính năng từ upstream (npm `@genspark/cli`):

```bash
bash scripts/aiac/update-vuaoffice-skills.sh
```

---

## 🚨 Yêu Cầu Tài Liệu Bắt Buộc & Pre-Push Trigger (BẮT BUỘC)

Kế thừa toàn diện quy trình 9 bước (`/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship`, trong đó `/code-review` là **cổng chặn bắt buộc** giữa `/build` và `/test`) và **7 tài liệu kỹ thuật bắt buộc** (`IDEA.md`, `REQUIREMENTS.md`, `SPEC.md`, `ARCH.md`, `README.md`, `DEPLOY_GUIDE.md`, `CHANGELOGS.md`):

### ⚡ Pre-Push & Pre-Commit Documentation Sync Trigger
Trước BẤT KỲ lệnh git commit hoặc git push nào lên remote repository (GitLab/GitHub) của VuaOffice:
- **Tự động kích hoạt (Auto-Trigger)**: Kiểm tra và cập nhật đồng bộ toàn bộ file tài liệu `*.md` (`CHANGELOGS.md`, `ARCH.md`, `SPEC.md`, `REQUIREMENTS.md`, `DEPLOY_GUIDE.md`...).
- **Nội dung ghi nhận**: Ghi nhận chi tiết mọi thay đổi nghiệp vụ, module, tính năng AI, bug fix, và hướng dẫn triển khai/build app.
- **Quy tắc bất biến**: Tuyệt đối KHÔNG commit/push code khi tài liệu `*.md` chưa được cập nhật tương ứng.
