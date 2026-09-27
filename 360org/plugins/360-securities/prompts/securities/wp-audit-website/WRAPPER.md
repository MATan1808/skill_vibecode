---
name: wp-audit-website
description: |
  Load khi user nhắc đến bảo mật / sự cố WordPress trên CloudPanel: "bị hack", "nhiễm mã độc",
  "quét virus", "virus wordpress", "scan wp", "audit wp site", "site bị tấn công", "site dính mã độc",
  "500 error", "site down", "không truy cập được", "clean wp", "bịt lỗ hổng", "wp security",
  "kiểm tra security wordpress", "malware scan", "backdoor", "inject", "xóa virus wp",
  hoặc bất kỳ yêu cầu audit/hardening site WordPress nào trên fleet CloudPanel.
  KHÔNG dùng cho Odoo, Flutter, V-Assistant — chỉ cho WordPress trên ssh cloudpanel.
---

<!-- ponytail: skill wrapper; nội dung thực tế tại /Volumes/DATA/DEV/SKILLS/wp-audit-website/SKILL.md -->

Skill này thuộc danh mục **Securities** của AIaC.

Đọc và áp dụng toàn bộ skill gốc tại:
`/Volumes/DATA/DEV/SKILLS/wp-audit-website/SKILL.md`

Các script và references đi kèm:
- `scripts/audit.sh` — quét read-only, không thay đổi gì
- `scripts/harden.sh` — hardening, chỉ chạy sau khi Sếp duyệt
- `scripts/remove-default-themes.sh` — xóa theme mặc định twenty*
- `references/` — hướng dẫn đọc kết quả, malware cleanup, môi trường CloudPanel

**Quy tắc bất biến:**
- Chạy `audit.sh` trước, report cho Sếp, chỉ hành động khi được cho phép.
- Audit logs tạm thời ở `/audit-work/` trên server; sau đó sync về `/Volumes/DATA/WORDPRESS/` rồi xóa sạch server.
- Server production: `ssh cloudpanel`. Không tự SSH khi Sếp chưa yêu cầu.
