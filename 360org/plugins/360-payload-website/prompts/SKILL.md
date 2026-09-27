---
name: 360-payload-website
description: |
  Playbook thực chiến để build website marketing cho hệ sinh thái 360 CORP (VuaAI, VuaHệThống,
  VuaWebsite, VuaSángTạo) trên stack Payload CMS 3.85 + Next.js 16 + React 19 + SQLite + Tailwind v4.
  MUST be loaded khi task liên quan tới: build/sửa website trong hệ sinh thái 360 CORP / vuaai.net,
  hoặc bất kỳ marketing site nào dùng Payload CMS + Next.js deploy native trên CloudPanel qua GitLab CI/CD.
  Trigger phrases: "vuaai-payload-website-skills", "vuaai website", "payload website", "dev payload",
  "payload cms", "website 360 corp", "payload cms marketing site", "build landing page vuaai",
  "deploy cloudpanel payload", "site hệ sinh thái vua...".
  Đúc kết từ thực chiến build vuaai.net: stack, quy ước Payload (collections/blocks/i18n), dev local qua Docker,
  deploy native CloudPanel (PM2 + nginx + Let's Encrypt), CI/CD GitLab 3-stage, các gotcha đã gặp, và
  content pattern thương hiệu 360 CORP (BarriersGrid, ComparisonTable, PricingTable, ComboShowcase, EcosystemGrid).
  Kế thừa workflow 9 bước & model assignment từ `360-dev-workflow`.
---

# Bộ Kỹ Năng Build Website 360 CORP (360-payload-website)

> Skill này là **playbook cụ thể** cho 1 loại dự án: marketing site của hệ sinh thái **360 CORP** trên stack Payload + Next.js, deploy native CloudPanel. Nó **kế thừa** workflow 9 bước và model assignment từ `360-dev-workflow` — chỉ bổ sung phần đặc thù stack + hạ tầng + thương hiệu.

Đúc kết trực tiếp từ quá trình build **vuaai.net** (2026). Mọi quyết định trong đây đã được kiểm chứng thực tế, kể cả các lỗi đã sửa.

---

## 🎯 Khi nào dùng skill này

- Build mới / chỉnh sửa website trong hệ sinh thái 360 CORP: `vuaai.net`, `vuahethong.net`, `vuawebsite.net`, `vuasangtao.com`
- Bất kỳ marketing site nào dùng **Payload CMS 3.x + Next.js + SQLite**, deploy **native trên CloudPanel** qua **GitLab CI/CD**
- KHÔNG dùng cho: dự án Odoo (→ `360-odoo`), dự án non-Payload generic (→ `360-dev-workflow`)

---

## 🧱 Stack chuẩn (đã kiểm chứng)

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| CMS | **Payload CMS 3.85** | Next.js-native, admin panel tại `/admin` |
| Frontend | **Next.js 16 + React 19** | App Router, `output: 'standalone'` bắt buộc |
| Styling | **Tailwind v4 + shadcn/ui** | Theme tokens ở `src/cssVariables.js` |
| Editor | **Lexical** (`@payloadcms/richtext-lexical`) | Rich text format chuẩn |
| DB | **SQLite** (`@payloadcms/db-sqlite`) | WAL mode, đủ cho marketing + form lead |
| Font | **Geist** | |
| i18n | Payload localization | `vi` (default) + `en`, fallback bật |
| Plugins | seo, form-builder, search, redirects, nested-docs | |
| Package manager | **pnpm 9** (qua corepack) | KHÔNG dùng npm/yarn |
| Dev local | **Docker Compose** (Mac) | KHÔNG cài Node native trên macOS |
| Production | **CloudPanel native** (Node 20 + PM2 + nginx) | KHÔNG Docker trên prod |
| CI/CD | **GitLab** shared runner | 3-stage: lint / build-image / deploy |

---

## 🚦 Quy tắc bất di bất dịch (rút từ thực chiến)

1. **Mac = Docker, Prod = Native.** Không cài Node/pnpm trực tiếp trên macOS. Không chạy Docker trên CloudPanel.
2. **Không sửa code trực tiếp trên server prod** — luôn qua git → CI/CD.
3. **`localized: true` cho MỌI field user-facing** (`text`, `textarea`, `richText`).
4. **Không xóa `output: 'standalone'`** trong `next.config.ts` (cần cho PM2/standalone build).
5. **Không commit** `.env`, `*.db`, `public/media/`.
6. **Branch flow:** `develop` = lint only → `*-dev` = build image → merge sang `main` = deploy native CloudPanel.
7. **Sau khi đổi schema:** chạy `pnpm generate:types` trong container.
8. **Node ≥ 20.9** (Payload 3.85 yêu cầu; server cũ hay dính Node 18 → phải nvm lên 20).

---

## 🛠️ Công cụ hỗ trợ trong Plugin (Scripts & Scaffold)

Plugin tích hợp sẵn các công cụ tự động hóa dưới thư mục `scripts/`:

```bash
# Scaffold nhanh Collection mới (chuẩn TypeScript & localized fields)
node 360org/plugins/360-payload-website/scripts/payload-scaffold.js collection <CollectionName> [targetDir]

# Scaffold nhanh Block mới (gồm cả config.ts và Component.tsx chuẩn Tailwind)
node 360org/plugins/360-payload-website/scripts/payload-scaffold.js block <BlockName> [targetDir]

# Kiểm tra quy chuẩn Payload (output: 'standalone', localized: true, DB adapter)
node 360org/plugins/360-payload-website/scripts/payload-linter.js [projectDir]
```

---

## 🗺️ Bản đồ tài liệu tham chiếu (references/)

Đọc theo nhu cầu — không load hết:

| Nhiệm vụ | Tệp |
|---|---|
| Stack chi tiết, cấu trúc thư mục, quy ước Payload | [references/stack-and-conventions.md](references/stack-and-conventions.md) |
| Tạo collections + custom blocks + i18n | [references/payload-patterns.md](references/payload-patterns.md) |
| Dev local qua Docker + prod CloudPanel + CI/CD GitLab | [references/deploy-cloudpanel-gitlab.md](references/deploy-cloudpanel-gitlab.md) |
| Content pattern thương hiệu 360 CORP (các block signature) | [references/brand-360corp.md](references/brand-360corp.md) |
| **Gotchas** — các lỗi đã gặp & cách sửa (đọc TRƯỚC khi debug) | [references/gotchas.md](references/gotchas.md) |

---

## 📦 Templates copy-paste (templates/)

| File | Mục đích |
|---|---|
| [docker-compose.yml](../templates/docker-compose.yml) | Dev local Mac (Node 22 Alpine + SQLite) |
| [gitlab-ci.yml](../templates/gitlab-ci.yml) | Pipeline 3-stage đã proven (lint/build-image/deploy) |
| [ecosystem.config.cjs](../templates/ecosystem.config.cjs) | PM2 cluster config cho prod |
| [collection.template.ts](../templates/collection.template.ts) | Boilerplate Collection mẫu chuẩn TypeScript |
| [block.template.ts](../templates/block.template.ts) | Boilerplate Block mẫu chuẩn kèm i18n |

---

## 🔗 Quan hệ với các skill khác

- **Kế thừa từ `360-dev-workflow`:** workflow 9 bước `/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship`, 7 mandatory docs, model assignment (Claude/Codex plan+review, Gemini build+test+ship).
- **DevTrack** (kế thừa từ base) — tự động ghi nhận thay đổi qua git hook + đồng bộ cross-agent.
- **Tích hợp CRM VuaHệThống:** form lead trên các site 360 CORP thường POST sang **CRM của vuahethong.net** (nền Odoo). Khi tích hợp CRM đó, đọc thêm `360-odoo` phần controllers-and-api.
