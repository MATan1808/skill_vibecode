# VuaOffice Standards

1. Electron Suite.
2. Kiểm thử native app macOS (`npm run tauri dev` hoặc `npm run build:local` & mở app thật).
3. **Code Knowledge Graph (360-graphify)**:
   - Toàn bộ codebase VuaOffice được index tại `/Volumes/DATA/DEV/vuaoffice/graphify-out/graph.json` và tích hợp MCP server `graphify`.
   - Khi audit, phân tích kiến trúc, sửa bug hoặc thêm tính năng mới, Agent BẮT BUỘC ưu tiên sử dụng MCP Server `graphify` (hoặc CLI `/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh`) để lấy toạ độ hàm/caller/callee/blast radius thay vì đọc quét lặp lại toàn bộ mã nguồn.
   - Sau khi hoàn tất refactor/thêm file mới, tự động chạy cập nhật đồ thị bằng: `/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh update /Volumes/DATA/DEV/vuaoffice`.

