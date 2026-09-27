# 360-instance-arch

Customer Instance Repo Layout & Long-term Dev Convention (Odoo)

Kiến trúc thư mục chuẩn cho **một instance khách hàng** dev dài hạn: 7 thư mục gốc, 4 nhánh `modules/` khớp 1-1 `addons_path`, luồng 3 tầng dev → local server → production.

## Entry points

- Plugin manifest: `plugin.json`
- Prompts:
  - `prompts/SKILL.md`
  - `prompts/instance-arch-standards.md`
- Hooks: không khai báo

## Phân biệt với skill khác

| Phạm vi | Skill |
|---|---|
| Repo instance khách hàng (nhiều module + docs + config) | **360-instance-arch** |
| Một module Odoo đơn lẻ | `360-odoo` |
| Project không phải Odoo | `360-dev-workflow` |

## Ghi chú vận hành

- Giữ tài sản plugin trong repo AIaC; không trỏ sang đường dẫn máy cá nhân.
- Không commit dữ liệu runtime, cache, transcript hoặc secret.
- Skill mô tả quy ước, không tự sửa file project — mọi thao tác dựng thư mục đều do agent thực hiện sau khi PO duyệt.
