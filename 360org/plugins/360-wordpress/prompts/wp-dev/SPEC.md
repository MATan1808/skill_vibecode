# SPEC — WordPress Dev

## Thành phần dev

- Theme/template: PHP template, `functions.php`, enqueue CSS/JS.
- Plugin: hook callback, shortcode, widget, CPT/taxonomy, meta box.
- Gutenberg block: block registration, editor script/style, render callback.
- REST API: `register_rest_route`, permission callback, schema/validation.
- Admin UI: settings page, nonce, capability, option update.

## Luồng sửa bug

1. Đọc `360-agent-map` để tìm hook/shortcode/REST route/component liên quan.
2. Grep đúng symbol/file, tránh đọc rộng.
3. Sửa root cause nhỏ nhất.
4. Chạy check khả dụng: PHP syntax hoặc smoke test local/staging nếu có.

## Security cơ bản trong dev

- Input boundary: sanitize + validate.
- Output boundary: escape.
- Write action: nonce + capability.
- DB query custom: `$wpdb->prepare`.

## Ngoài phạm vi

Script audit/malware/hardening nằm ở `../securities/`.
