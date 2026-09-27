# REQUIREMENTS — WordPress Dev

## Chức năng

- Dev/fix theme, child theme, template và asset enqueue.
- Dev/fix plugin, shortcode, widget, CPT/taxonomy và meta field.
- Dev/fix Gutenberg block và admin settings.
- Dev/fix REST API endpoint với nonce/capability check.

## An toàn code

- Escape output: `esc_html`, `esc_attr`, `wp_kses_post`, `esc_url`.
- Sanitize input: `sanitize_text_field`, `absint`, `sanitize_key`, `wp_unslash`.
- Kiểm tra nonce/capability ở mọi action ghi dữ liệu.
- Không thêm dependency/plugin nếu native WordPress API đủ dùng.
- Không sửa production nếu Sếp chưa yêu cầu rõ.

## Ngoài phạm vi

Security/audit/malware/hardening/server cleanup thuộc `../securities/`.
