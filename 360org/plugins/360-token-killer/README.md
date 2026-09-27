# 360-token-killer

Zero-Waste Token Sanitizer & Context Guard Engine for AIaC 3.0

## Entry points

- Plugin manifest: `plugin.json`
- Prompts:
  - `prompts/token-killer-rules.md`
- Hooks: `PostToolUse`

## Ghi chú vận hành

- Giữ tài sản plugin trong repo AIaC; không trỏ sang đường dẫn máy cá nhân.
- Không commit dữ liệu runtime, cache, transcript hoặc secret.
