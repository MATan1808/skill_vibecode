---
name: 360-designer
description: Agent thiết kế tổng thể cho 360 CORP & VUA HỆ THỐNG — ấn phẩm truyền thông corporate premium (standee, poster, banner, brochure, backdrop, social creative), bộ icon phẳng ERP, UI/UX intelligence (design system, typography, color, a11y, responsive), logo, CIP, slide, brand identity. Dùng khi yêu cầu thiết kế ấn phẩm, UI component, hệ thống token, hoặc brand asset.
---

# Skill: 360 DESIGNER & ICON BUILDER

> Kỹ năng tổng thể về Thiết kế thương hiệu, ấn phẩm truyền thông, UI/UX và Icon cho **360 CORP**.

---

## 🏗️ Cấu trúc Module

| Module | Thư mục | Vai trò chính |
|---|---|---|
| **Publication Designer** | Gốc `360-designer/` | Thiết kế ấn phẩm truyền thông (standee, poster, banner, Facebook cover, brochure, backdrop). |
| **Icon Builder** | `icon-builder/` | Thiết kế bộ icon phẳng, tối giản cho hệ thống ERP & nhận diện thương hiệu 360 CORP. |
| **UI/UX Intelligence** | `references/ui-ux-rules.md` | UX rules, a11y checklist, responsive, typography/color, design dials — cho web & app. |
| **Platform Adapters** | `references/platform-adapters.md` | Ma trận chuyển đổi thẩm mỹ vào Odoo QWeb/Block, VuaAssistant (Tauri macOS), WordPress Avada Shortcode, Flutter, Next.js mà KHÔNG sinh lỗi runtime. |
| **Design System** | `references/design-system.md` | Token architecture (primitive→semantic→component), CSS variables, Tailwind/shadcn setup. |
| **Brand Identity** | `references/brand.md` | Logo, CIP, brand voice, color palette, typography spec, asset management. |

---

## 🎯 Routing — Dùng module nào?

| Yêu cầu | Module |
|---|---|
| Thiết kế ấn phẩm in/digital (standee, poster, banner, backdrop) | **Publication Designer** (bên dưới) |
| Bộ icon ERP / UI icon | **Icon Builder** → `icon-builder/SKILL.md` |
| Thiết kế UI component, page, layout web/app | **UI/UX Intelligence** → `references/ui-ux-rules.md` |
| Design token, CSS variables, Tailwind theme | **Design System** → `references/design-system.md` |
| Logo, CIP mockup, brand guideline | **Brand Identity** → `references/brand.md` |
| Social media image (IG, FB, LinkedIn, YouTube) | **Publication Designer** + kích thước tại `references/banner-sizes.md` |
| Slide / Presentation | **Brand Identity** → mục Slides |

---

## Triết lý engine thiết kế ấn phẩm

Engine visual là **AI image generation**, nhưng AI **không** được giao việc viết chữ tiếng Việt, đặt logo hay in thông tin liên hệ — vì nó hay sai chính tả, méo dấu, bịa logo/nội dung. Vì vậy quy trình tách 2 lớp:

1. **AI tạo LỚP NỀN (visual base)** — ảnh nền/hình minh hoạ ngành (ERP dashboard, AI, automation, networking, executive corporate), **KHÔNG có chữ, KHÔNG logo**.
2. **Script compose LỚP NỘI DUNG** — `compose_publication.py` phủ headline/subheadline/CTA + logo thật + thanh liên hệ chính thức + QR lên nền, kiểm soát pixel, font tiếng Việt chuẩn, branding đúng.

Nhờ vậy: không lỗi font, logo thật, contact đúng tuyệt đối, layout không méo, in được ngay.
