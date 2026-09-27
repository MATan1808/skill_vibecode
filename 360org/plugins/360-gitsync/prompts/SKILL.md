---
name: 360-gitsync
description: |
  Kỹ năng quản lý kho mã nguồn song song GitLab (Private - lưu toàn bộ env, file, database), GitHub (Public - lọc bỏ phần private) và Tự động hóa Release/CI-CD với GitHub Actions Best Practices, Release-Please Protocol & Qodo Quality Reviews.
  Hỗ trợ tự động hóa tạo repo, commit, push, đồng bộ lọc bỏ file nhạy cảm và thiết lập GitHub Actions Workflow đạt chuẩn bảo mật, hiệu năng cao và kiểm tra chất lượng PR.
---

# 360org — Git Sync, Quality PR & GitHub Actions Protocol (`360-gitsync`)

Kỹ năng quản lý kho mã nguồn song song, tự động hóa lọc file bảo mật, kiểm định chất lượng PR theo chuẩn **Qodo Skills**, phát hành release tự động (**Release-Please**) và chuẩn hóa **GitHub Actions CI/CD Workflows** cho toàn bộ dự án thuộc **360org** (Desktop Apps, Web, Odoo, Flutter, VuaOffice, VuaAssistant).

---

## 🛡️ 0. Qodo Quality PR & Edge-Case Assertion Rules (MỚI)

Mọi Commit / PR trước khi sync sang GitHub hoặc merge vào `main` phải đạt các tiêu chuẩn kiểm định chất lượng mã nguồn:

1. **Boundary & Edge-Case Testing**:
   - Mọi unit test được bổ sung phải test các giá trị biên (null/undefined, mảng rỗng, chuỗi rỗng, số âm, số nguyên lớn).
2. **Assertion Precision**:
   - Không dùng assertion chung chung (như `assert result is not None`); phải kiểm tra chính xác giá trị và kiểu dữ liệu output.
3. **PR Security & Diff Review**:
   - Tự động rà soát không để lọt hardcoded secrets, file nhạy cảm `.env`, `.pem` hoặc log debug rác trong git diff.
4. **⚡ Pre-Push & Pre-Commit Documentation Sync Trigger (BẮT BUỘC TOÀN CỤC)**:
   - Trước BẤT KỲ commit hoặc push code nào lên remote (GitLab/GitHub), AI **BẮT BUỘC PHẢI TỰ ĐỘNG TRIGGER** bước rà soát và cập nhật đồng bộ toàn bộ file tài liệu `*.md` liên quan (`CHANGELOGS.md`, `ARCH.md`, `SPEC.md`, `REQUIREMENTS.md`, `README.md`, `DEPLOY_GUIDE.md`...).
   - Nghiêm cấm commit/push mã nguồn đơn lẻ mà thiếu việc cập nhật tài liệu tương ứng.

---

## 🛠️ 1. Nguyên Lý Quản Lý 2 Remote (GitLab vs GitHub)

1. **GitLab (Private Repository - `origin`)**:
   - Máy chủ phát triển chính (Default).
   - Lưu giữ toàn bộ lịch sử commit, file cấu hình `.env`, mã nguồn hoàn chỉnh, cấu hình deploy, logs và database backup.
2. **GitHub (Public/Distribution Repository - `github`)**:
   - Trang phân phối công khai cho cộng đồng và release artifact.
   - CHỈ đẩy mã nguồn sạch đã qua bộ lọc `.githubignore` bằng script `git-sync-publish.sh`.

---

## ⚡ 2. GitHub Actions CI/CD Standards & Best Practices

Áp dụng chuẩn chính thức từ GitHub Actions Core Architecture:

### 🧩 5 Thành Phần Cốt Lõi (Core Components)
1. **Workflows**: File `.github/workflows/*.yml` định nghĩa quy trình tự động hóa.
2. **Events**: Trigger kích hoạt workflow (`push`, `pull_request`, `release`, `workflow_dispatch`, `schedule`).
3. **Jobs**: Tập hợp các bước chạy trên cùng một Runner (`runs-on: ubuntu-latest / macos-latest / windows-latest`).
4. **Steps**: Các lệnh shell (`run: ...`) hoặc Actions reusable (`uses: ...`).
5. **Runners**: Máy chủ thực thi job (GitHub-hosted hoặc Self-hosted).

---

## 🚀 3. Tự Động Hóa Versioning & Release (Release-Please Protocol)

Hệ thống CI/CD & Release áp dụng chuẩn **Release-Please** (dựa trên Conventional Commits):

### 📌 Quy trình Release tự động:
1. **Conventional Commits**: Sếp và Agent viết commit chuẩn: `feat: ...`, `fix: ...`, `chore: ...`.
2. **Release PR Creation**: Release-Please tự động tạo/cập nhật PR Release với `CHANGELOG.md` và nâng version trong `package.json` / `Cargo.toml` / `tauri.conf.json`.
3. **On-Demand Tag Release**: Khi PR Release được merge vào `main` hoặc khi Sếp yêu cầu release bằng tag `v*` (`v1.2.0`), GitHub Action / GitLab CI sẽ tự động kích hoạt build artifact installer (.dmg, .exe, .AppImage) và tạo Release Publish.
