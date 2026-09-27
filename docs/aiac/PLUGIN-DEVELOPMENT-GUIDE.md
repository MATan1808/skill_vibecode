# AIaC Plugin Development Guide

> Hướng dẫn chuẩn phát triển, đóng gói và phát hành Plugin Package cho AIaC v3.x.

---

## 1. Cấu trúc Chuẩn của một Plugin Package

Mỗi plugin nằm trong thư mục độc lập tại `/Volumes/DATA/DEV/aiac/360org/plugins/<plugin-name>/`:

```
360-example-plugin/
├── plugin.json               # Manifest khai báo metadata, hooks, dependencies
├── index.js                  # Entry point đăng ký Seam Provider & Disposers
├── hooks/                    # Script xử lý vòng đời hook (nếu có)
│   └── post-write-linter.js
├── scripts/                  # Command line tools hoặc connectors (nếu có)
│   └── example-tool.sh
├── prompts/                  # Prompt templates & guidelines
│   └── example-guide.md
└── references/               # Tài liệu tham khảo tra cứu nhanh
```

---

## 2. Khai báo Manifest (`plugin.json`)

```json
{
  "name": "360-example",
  "version": "3.0.0",
  "description": "Example Plugin for AIaC v3.x",
  "main": "index.js",
  "dependencies": ["360-dev-workflow"],
  "inject": ["shell", "git", "linter"],
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write|Edit", "script": "hooks/post-write-linter.js" }
    ]
  },
  "connectors": [
    { "name": "example-cli", "type": "bash", "script": "scripts/example-tool.sh" }
  ],
  "prompts": [
    "prompts/example-guide.md"
  ]
}
```

---

## 3. Viết Entry Point (`index.js`)

Plugin nhận vào đối tượng `ctx` (`PluginContext`) có gắn sẵn EventBus, Seam Registry và Disposable collector:

```javascript
'use strict';

module.exports = (ctx) => {
  // 1. Đăng ký Seam Provider
  ctx.provide('linter', 'example-linter', {
    name: 'Example Linter',
    lint: async (filePath) => {
      // Thực hiện linting
      return { valid: true, errors: [] };
    }
  });

  // 2. Lắng nghe sự kiện qua EventBus
  ctx.on('tool/executed', async (event) => {
    if (event.tool === 'Write') {
      // Xử lý logic sau khi ghi file
    }
  });

  // 3. Đăng ký dọn dẹp tài nguyên khi unload
  ctx.effect(() => {
    return () => {
      // Cleanup side-effects
    };
  });
};
```

---

## 4. Kiểm thử Plugin

Chạy bộ test tích hợp để đảm bảo Plugin tuân thủ kiến trúc v3:

```bash
node /Volumes/DATA/DEV/aiac/tests/v3-full-roadmap.test.js
```
