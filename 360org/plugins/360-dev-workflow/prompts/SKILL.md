---
name: 360-dev-workflow
description: |
  MUST be loaded when user invokes "agent skills" explicitly OR initiates a non-Odoo project.
  Trigger phrases include: "dùng agent skills ...", "agent skills cho project ...", "init project ..." (without
  mentioning Odoo), "start project ...", "scaffold project ...", "new web/mobile/SaaS project ...".
  ⚠️ If the user explicitly says "odoo" anywhere in the request → use `360-odoo` instead.
  Applies to web apps (Next.js, Nuxt, Astro), mobile apps (React Native, Flutter), SaaS platforms,
  marketing sites, CLI tools, libraries, microservices, ML pipelines — anything NOT Odoo.
  Enforces the 9-step Multi-Agent Orchestration workflow: /idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship.
  /code-review is a mandatory blocking gate between /build and /test: a different model than the Coder reads the raw diff for
  correctness bugs, missed reuse, over-engineering and trust-boundary validation before the Tester invests in writing tests.
  Defines mandatory project documentation (7 files: IDEA, REQUIREMENTS, SPEC, ARCH, README, DEPLOY_GUIDE, CHANGELOGS)
  plus CONTEXT.md as doc #8 (domain glossary, created as soon as the first project-specific term appears).
  Specifies AI model assignment: Claude/Codex for PLAN & ANALYSIS roles (Architect, Reviewer),
  Gemini for CODE & EXECUTION roles (Coder, Tester, Shipper), Claude/Codex for Code Reviewer.
---

# Bộ Kỹ Năng Quy Trình Phát Triển Đa Dự Án (360-dev-workflow)

Bộ kỹ năng generic áp dụng cho **mọi dự án phần mềm KHÔNG phải Odoo**: web apps (Next.js, Nuxt, Astro), mobile (React Native, Flutter), SaaS, marketing site, CLI tools, libraries, microservices...

Đối với dự án Odoo, dùng `360-odoo` — bộ skill chuyên biệt kế thừa quy trình từ tài liệu này.

Mọi tiêu chuẩn dev/skill/command/hook/agent/connector mới thêm cho AIAC phải tuân thủ **Everything Is A Plugin Harness** tại [references/plugin-harness-standard.md](references/plugin-harness-standard.md) và **Quy Chuẩn Đồng Bộ Update Toàn Diện AIaC** tại [references/aiac-update-sync-standard.md](references/aiac-update-sync-standard.md); không tạo standalone runtime skill làm source of truth.

- **Luật Thép Zero-Bypass Promotion Pipeline (Quy chuẩn CI/CD thủ công)**: Áp dụng TUYỆT ĐỐI cho MỌI quá trình Dev (Odoo, Web, Mobile, v.v.):
  1. **Vào project** ➔ BẮT BUỘC Fetch code mới nhất từ remote đúng version trước khi gõ dòng code đầu tiên.
  2. **Dev** ➔ Hoàn thiện code và test nội bộ.
  3. **Push** ➔ Commit (khớp version) và Push lên remote (GitLab).
  4. **Move next env (Local Server)** ➔ Pull/Fetch code về môi trường test.
  5. **Test / Update** ➔ Test thực tế. Có lỗi thì sửa ở bước 2 rồi Push lại, KHÔNG sửa nóng.
  6. **Move to Production** ➔ Lên server thật.
  7. **Pull/Fetch & Deploy/Release** ➔ Kéo code đúng SHA đã test, chạy các script nâng cấp DB tương ứng.
  8. **Test live** ➔ Xác minh HTTP 200, check log rỗng lỗi.
  9. **Done / Report** ➔ Đóng ticket.
  ⛔ **CẤM TUYỆT ĐỐI**: Không sync, không copy/paste, không `rsync`/`scp`/`cp` vượt cấp. Không sửa nóng trực tiếp trên server (immutable target). Mọi thư mục làm việc (Mac, Local, Prod) BẮT BUỘC phải là git repo có `.git` trỏ về remote; nếu không có `.git`, AI phải TỪ CHỐI thao tác và báo PO ngay lập tức.

