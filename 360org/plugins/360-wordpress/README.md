# 360-wordpress

WordPress Plugin, Theme & Hardening Development Engine

## Entry points

- Plugin manifest: `plugin.json`
- Prompts:
  - `prompts/wp-plugin-standards.md`
- Hooks: `PostToolUse`
- Dependencies:
  - `360-securities`
  - `360-designer`
  - `360-ponytail`

## Ghi chú vận hành

- Giữ tài sản plugin trong repo AIaC; không trỏ sang đường dẫn máy cá nhân.
- Không commit dữ liệu runtime, cache, transcript hoặc secret.
