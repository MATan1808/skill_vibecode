---
name: 360-openclaw
description: |
  360 CORP Ecosystem & VuaAI Gateway Engine. Quản trị tích hợp, cổng routing bảo mật,
  kết nối API Gateway và hệ sinh thái VuaAI / OpenClaw trên hạ tầng CloudPanel/Server.
  Trigger phrases: "openclaw", "vuaai gateway", "360 gateway", "openclaw gateway".
  LƯU Ý: Đối với các tác vụ phát triển, bảo trì website marketing Payload CMS 3.x + Next.js,
  sử dụng chuyên biệt plugin `360-payload-website` (hoặc alias `vuaai-payload-website-skills`).
---

# 360-OpenClaw: Ecosystem & Gateway Engine

> Plugin quản trị cổng kết nối (Gateway), điều hướng dịch vụ và hạ tầng hệ sinh thái 360 CORP & VuaAI.

---

## 🎯 Chức năng chính

1. **VuaAI Gateway & API Routing:**
   - Điều hướng traffic giữa các dịch vụ trong hệ sinh thái 360 CORP (VuaAI, VuaHệThống, VuaWebsite, VuaSángTạo).
   - Tích hợp cổng webhook, messaging gateway và bảo mật API tokens.

2. **Hạ tầng Server & CloudPanel Deployment:**
   - Quản trị dịch vụ trên host `cloudpanel` (`ssh cloudpanel`).
   - Cấu hình Reverse Proxy Nginx, SSL Let's Encrypt và bảo mật cổng.

---

## 🔗 Chuyển tiếp chuyên biệt (Domain Delegation)

- **Phát triển Website Marketing (Payload CMS 3.x + Next.js):**
  - Chuyển sang plugin chuẩn: [`360-payload-website`](../../360-payload-website/prompts/SKILL.md)
  - Chứa đầy đủ: scaffolding CLI (`payload-scaffold.js`), linter (`payload-linter.js`), templates Docker/PM2/GitLab CI, quy chuẩn `localized: true` và `output: 'standalone'`.

- **Quản trị ERP & CRM:**
  - Chuyển sang plugin: [`360-odoo`](../../360-odoo/prompts/SKILL.md)
