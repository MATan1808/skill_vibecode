# WP UI Design

Nhánh này dùng cho thiết kế giao diện WordPress, đặc biệt Avada/Fusion fleet của 360 CORP và các pattern/block theme.

## Khi nào dùng

- Thiết kế/chỉnh Avada, Fusion Builder, Fusion Core, Slider Revolution layout.
- Chỉnh theme/block theme, `theme.json`, style variation, template part.
- Tạo block pattern, hero/CTA/cover/media-text section.
- UI polish cho WordPress page nhưng không đụng malware/server hardening.

## Nguồn đã nhập từ `wp-dev-skills`

```text
skills/avada-builder-design/
skills/wp-block-themes/
skills/wp-patterns/
skills/wpds/
```

## Avada/Fusion rule

- Avada/Fusion là chuẩn fleet, không thay bằng theme `twenty*`.
- Khi cần Avada shortcode, Fusion Builder layout, Figma/PDF/hình/link → Avada, Layouts/Header/Library/Post Cards/Off Canvas/Performance hoặc custom element: đọc `skills/avada-builder-design/SKILL.md` trước và chạy validator shortcode nếu sinh output paste vào Avada.
- Khi sửa UI trên production, backup file/theme trước nếu có ghi.
- Không copy nguyên `wp-content`; chỉ sửa đúng theme/child theme/template/asset cần thiết.
- Nếu phát hiện IOC/malware trong Avada/Fusion, dừng nhánh UI và chuyển sang `../securities/SKILL.md`.

## Tài liệu nên đọc

- `skills/avada-builder-design/SKILL.md`
- `skills/wp-block-themes/SKILL.md`
- `skills/wp-patterns/SKILL.md`
- `skills/wpds/SKILL.md`
