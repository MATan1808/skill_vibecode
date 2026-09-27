# Git Sync & Remote Policy Standards (360org)

1. **Mặc định Private GitLab**:
   - Mọi repository, commit mặc định chỉ đẩy lên GitLab (`origin`).
   - Tuyệt đối không tự ý tạo repo public hoặc push sang GitHub trừ khi Sếp yêu cầu rõ ràng.

2. **GitHub Publish Workflow**:
   - Bắt buộc chạy `git-sync-publish.sh` để lọc bỏ file nhạy cảm theo `.githubignore`.
   - Trailer bắt buộc cho mọi commit: `Authored-By: 360org <support@360.org.vn>`.
