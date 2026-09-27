# 360-gitsync

GitLab Private to GitHub Public Dual-Sync Engine with Security Filter

## Entry points

- Plugin manifest: `plugin.json`
- Prompts:
  - `prompts/gitsync-standards.md`
- Hooks: `PreToolUse`

## Ghi chú vận hành

- Giữ tài sản plugin trong repo AIaC; không trỏ sang đường dẫn máy cá nhân.
- Không commit dữ liệu runtime, cache, transcript hoặc secret.
