---
name: 360-agent-browser
description: |
  Quy chuẩn và bộ công cụ tự động hoá browser (headless & UI automation) của hệ sinh thái 360org.
  Hỗ trợ E2E testing, web scraping, DOM interaction và browser agent automation dựa trên Playwright & Rust/Node runtime.
  MUST be loaded khi task liên quan tới: E2E test, browser automation, web scraping, hoặc UI testing cho Web/Desktop apps.
---

# 360org — Agent Browser Automation (`360-agent-browser`)

Quy chuẩn kiểm thử E2E và tự động hoá trình duyệt cho hệ sinh thái **360org**.

---

## 🛠️ Công năng cốt lõi

- **Headless & UI Automation**: Thao tác click, fill, wait, screenshot, PDF export, network interception.
- **E2E Testing Engine**: Tích hợp với `e2e-runner` và quy trình kiểm thử ứng dụng Web/Desktop (Electron & Tauri).
- **DOM Inspection & Extraction**: Bóc tách dữ liệu web, chụp snapshot accessibility tree, kiểm tra computed styles.

---

## 🚀 Hướng dẫn nhanh

```bash
# Chạy CLI agent-browser
npx agent-browser --help

# Mở trình duyệt và thực thi test scenario
npx agent-browser test --url http://localhost:3000
```
