---
name: 360-wordpress
description: Skill tổng WordPress toàn diện cho 360org (Theme, Plugin, Block, Security, REST API, Hardening & Custom Plugins như 360-securities). Dùng với CloudPanel/WordPress, không dùng cho Odoo/V-Assistant/Flutter.
---

# 360 WordPress Skill Suite

Skill tổng cho toàn bộ công việc phát triển, tối ưu và bảo mật WordPress của AIaC.

## Cấu trúc Bộ Kỹ Năng

```text
360-wordpress/
├── securities/        # Quét mã độc, audit, hardening, incident response, wt-hardening & 360-securities
├── wp-ui-design/      # Thiết kế UI/theme/block, Avada Builder & Block themes
└── wp-dev/            # Phát triển Plugin, Theme, Gutenberg Block, REST API, Settings API, WPCS & Unit Test
```

## Phân Nhánh Chức Năng

1. **Phát triển Plugin & Theme (`wp-dev/`)**:
   - Sử dụng khi phát triển plugin WordPress chuyên nghiệp (bao gồm plugin mã nguồn mở cho cộng đồng như `360-securities`).
   - Tuân thủ **WordPress Coding Standards (WPCS)**, PHP 8.0+ Strict Types, REST API permission callbacks, Settings API, Nonce + Capability verification, và WordPress.org Plugin Check (PCP) guidelines.
   - Các skill con chuyên sâu: `wp-plugin-development`, `wp-security-review`, `wp-rest-api-development`, `wp-block-development`, `wp-woocommerce-dev`, `wp-test-strategy`, `wp-phpstan-review`.

2. **Bảo mật & Hardening (`securities/`)**:
   - Tự động kiểm tra 12 lớp bảo mật từ plugin `wt-hardening` (XmlRpc, UserEnumeration, HideWpVersion, LoginLimiter, SecurityHeaders, StrongPasswords...).
   - Audit mã độc, khắc phục sự cố webshell/backdoor, và triển khai plugin bảo mật cộng đồng **`360-securities`**.

3. **Thiết kế UI & Layout (`wp-ui-design/`)**:
   - Avada Builder design system, Custom shortcode integration, Block themes & Patterns.

## Bất biến & Quy chuẩn

- Tuân thủ **WordPress PHP Coding Standards**: Spaces inside parentheses `( $arg )`, Yoda conditions `( true === $val )`, `array()` thay vì `[]`.
- Không hardcode đường dẫn `/wp-content/plugins/` (sử dụng `plugin_dir_url()` hoặc `plugin_dir_path()`).
- Mọi action thay đổi dữ liệu phải kiểm tra **Capability + Nonce + Input Sanitization + Output Escaping**.
- Khi phát triển plugin cộng đồng/khách hàng: 100% tuân thủ **WordPress.org Plugin Directory Guidelines**.
- **⚡ Pre-Push & Pre-Commit Documentation Sync (BẮT BUỘC)**: Trước BẤT KỲ commit/push nào lên remote (GitLab/GitHub), AI phải tự động cập nhật đồng bộ các tài liệu `*.md` (`CHANGELOGS.md`, `README.md`, `DEPLOY_GUIDE.md`...) phản ánh chi tiết thay đổi và hướng dẫn sử dụng.
