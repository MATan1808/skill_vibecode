# Báo cáo cập nhật upstream gần nhất

- Ngày audit: 2026-09-03
- Báo cáo đầy đủ: `/Volumes/DATA/DEV/aiac/docs/SKILL_SOURCES_AUDIT_2026-09-03.md`
- Chính sách: audit-first, manual-selective, không sync nguyên upstream.
- Runtime dependency ngoài AIaC: không.

## Kết quả

- Đã inventory 67 Git repository và 9.417 skill manifest trong kho tham chiếu.
- Đã pull fast-forward các repository sạch; giữ nguyên ba repository có thay đổi local.
- Đã chuyển provenance manifest sang schema v2 không chứa machine-local source directory.
- Đã nâng Graphify chọn lọc với 6 bản vá parser từ upstream `v0.9.53`, giữ base đóng gói `0.9.48+aiac.1`.
- Đã khôi phục PostToolUse hook zero-command của Ponytail.
- Ponytail, Caveman và các plugin khác không được copy nguyên upstream; delta chưa nhận được giữ ở trạng thái review/defer.

## Verification

- Governance updater: pass.
- Ponytail hook: pass.
- Graphify selective regression: 6/6 pass.
- Router package và CodeGraph self-check: pass.

## Nợ baseline ngoài phạm vi

- `tests/plugin-manifest.test.js`: thiếu `.opencode/package-lock.json` từ baseline.
- `tests/smart-router.test.js`: kỳ vọng cũ “360 Agent Map” luôn inject, không khớp chính sách runtime on-demand hiện tại.
- Catalog/docs validation: README thiếu catalog marker cùng một số hướng dẫn Codex, Copilot, Hermes, install identifier và MCP hiện hành.
- Full `tests/run-all.js` đã chạy sâu qua nhiều suite nhưng được dừng sau khi các lỗi baseline trên đã được xác nhận; không tuyên bố full suite pass.
