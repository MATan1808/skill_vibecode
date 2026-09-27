# Desktop App Standards (360org)

1. **Zero-Docker Testing**:
   - Không dùng Docker/webview preview làm bằng chứng verify.
   - Bắt buộc test native app macOS thật qua `npm run tauri dev` hoặc bản cài local `/Applications/V Assistant.app`.

2. **Branching & Git Isolation**:
   - Dùng worktree/branch riêng cho mỗi tính năng, chỉ merge vào `main` sau khi app thật chạy pass.
