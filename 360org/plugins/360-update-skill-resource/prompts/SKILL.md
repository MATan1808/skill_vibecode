---
name: 360-update-skill-resource
description: |
  Kiểm duyệt cập nhật upstream cho AIaC theo quy trình manual-selective. Dùng khi Sếp yêu cầu cập nhật SKILL_SOURCES, so sánh nguồn mới với AIaC hoặc nâng cấp plugin AIaC.
---

# 360org — Upstream Audit & Manual Upgrade

`SKILL_SOURCES` là kho tham chiếu, không phải runtime dependency. AIaC phải hoạt động độc lập bằng nội dung đã đóng gói trong `360org/plugins/*`.

## Quy trình bắt buộc

1. Đọc báo cáo gần nhất và `config/skills-source-manifest.json`.
2. Inventory toàn bộ repository nguồn. Repo sạch có upstream mới được `git pull --ff-only`; repo dirty, detached, diverged hoặc thiếu upstream phải giữ nguyên và báo cáo.
3. Đọc commit delta, changelog, dependency, license và thay đổi bảo mật.
4. So sánh capability với plugin AIaC hiện tại; phân loại `accept`, `already-covered`, `reject`, `defer`.
5. Viết báo cáo audit trong `docs/` trước khi sửa runtime.
6. Với mục `accept`, port thủ công phần tối thiểu vào `360org/plugins/*`; không clone/copy/rsync nguyên upstream.
7. Thêm regression test, chạy security/compatibility verification rồi cập nhật provenance, version và `docs/CHANGELOGS.md`.

## Luật cấm

- Không tạo runtime reference tới `/Volumes/DATA/DEV/SKILLS/*` hoặc `/Volumes/DATA/DEV/SKILL_SOURCES/*`.
- Không tự cài plugin, MCP, permission hoặc dependency từ upstream.
- Không tự commit hoặc push sau audit/update.
- Không thay file AIaC bằng nguyên cây upstream.
- Không coi version upstream là version package AIaC; luôn theo dõi hai version riêng.

## Báo cáo

- Báo cáo audit chính: `/Volumes/DATA/DEV/aiac/docs/SKILL_SOURCES_AUDIT_<YYYY-MM-DD>.md`.
- Snapshot lịch sử có thể lưu trong `/Volumes/DATA/DEV/aiac/360org/plugins/360-update-skill-resource/reports/`.
- Mọi quyết định phải nêu commit/version đã review, phần chấp nhận/từ chối và test nghiệm thu.
