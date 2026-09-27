---
name: 360-wordpres-wp-dev
description: WordPress development skill cho theme/plugin/block/shortcode/REST API và fix bug WP. Không dùng cho scan malware/hardening server; việc đó thuộc 360-wordpres/securities.
---

# WordPress Dev

Dùng nhánh này cho phát triển và sửa lỗi WordPress thông thường.

## Khi nào dùng

- Dev theme, child theme, template, Gutenberg block.
- Dev plugin, shortcode, widget, CPT/taxonomy, meta field.
- Dev/fix REST API, admin settings, enqueue asset.
- Fix bug PHP/JS/CSS trong WordPress khi không phải incident malware/server.

## Không dùng cho

- Quét virus, malware, IOC, hardening production.
- Cleanup webshell/backdoor/admin giả.
- Audit CloudPanel fleet hoặc xử lý server-level incident.

Các việc đó nằm ở:

```text
360-wordpres/securities/
```

## Quy tắc dev

1. Dùng API native WordPress trước: hook, shortcode, CPT, REST API, nonce, capability check.
2. Không thêm plugin/dependency nếu vài dòng code giải quyết được.
3. Escape output (`esc_html`, `esc_attr`, `wp_kses_post`), sanitize input (`sanitize_text_field`, `absint`, `wp_unslash`).
4. Check nonce/capability ở mọi action/admin/AJAX/REST write.
5. Không sửa trực tiếp production nếu chưa có lệnh rõ của Sếp.
6. Với bug phức tạp, đọc `360-agent-map` trước để tìm hook/shortcode/REST route đã có, tránh viết trùng.

## Check tối thiểu

- PHP syntax cho file đã sửa nếu có PHP CLI.
- Smoke test đúng đường dẫn/tính năng nếu có môi trường local/staging.
- Với production CloudPanel: chỉ truy cập khi Sếp yêu cầu rõ, dùng `ssh cloudpanel`.
