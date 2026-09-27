---
name: odoo-dev-skills
description: |
  MUST be loaded when user mentions "odoo" explicitly in the request — trigger phrases include:
  "start odoo project ...", "init odoo project ...", "odoo module ...", "odoo hệ thống ...",
  "scaffold odoo ...", "dev odoo ...", "migrate odoo db ...", "upgrade odoo ...", "fix odoo bug ...",
  "backport odoo ...", "odoo-ui-designer ...", "thiết kế odoo website UI ...", "thiết kế trang từ link webpage ...",
  "odoo website theme ...", "odoo snippet ...", "odoo website builder ...", "odoo website drag and drop ...",
  "drag and drop odoo website ...", or any task about Odoo versions v14-v19 and later.
  ALSO trigger on NATURAL-LANGUAGE requests (no slash command needed) about an Odoo project/DB/module, e.g.:
  "migrate giúp anh module này từ 15 lên 17", "nâng/upgrade db từ 14 lên 19", "chuyển module X sang v18",
  "fix giúp anh bug này" (kèm log Odoo), "backport module này về 16". The agent must recognize the intent and
  run the matching engine autonomously — không bắt user gõ /odoo-migrate, /odoo-fix...
  ⚠️ ONLY for Odoo projects. If the user says "dùng agent skills" / "init project" without mentioning
  Odoo → use `dev-workflow-skills` instead (the non-Odoo generic skill).
  Use this skill for all tasks involving Odoo modules, models, views, XML actions, security CSVs,
  record rules, OWL frontend components, widgets, QWeb templates, HTTP controllers, and testing.
  It helps guide you to write high-quality, clean, version-compatible Odoo code, prioritizing OWL frontend components,
  and optimize token usage during terminal execution.
  Inherits the 9-step lifecycle (/idea → /ship) from `dev-workflow-skills` and adds Odoo-specific tooling
  (odoo-graph-mcp, odoo-linter, odoo-generator, odoo-builder, zero-downtime-test) and templates (model.py, view.xml, owl_component.js).
  Model assignment: Claude/Codex for Architect & Reviewer (PLAN & ANALYSIS), Gemini for Coder, Tester, Shipper (CODE & EXECUTION).
  Mandatorily use the odoo-graph-mcp tool to verify relations and structure during design and build phases.
  Fully absorbs all 6 ponytail capabilities (lazy-dev ladder, over-engineering diff review, whole-module
  audit, ponytail-comment debt ledger, gain scoreboard, quick-reference help) — see references/ponytail-lazy-dev.md.
  No separate ponytail skill install/call needed for Odoo work; standalone ponytail skills remain only for non-Odoo projects.
  Also absorbs superpowers (TDD Iron Law, systematic-debugging 4-phase, git-worktrees, subagent-driven-development)
  and agent-skills (spec-driven, deprecation-and-migration patterns) — distilled into references, no separate install.
  Also absorbs caveman (terse communication mode — see references/caveman-terse-mode.md): opt-in terse chat replies
  when PO asks for brevity, 1-line review findings at /review, compressed commit messages at /ship, compressed
  sub-agent handoff (cavecrew) by default; NEVER applied to the 7 mandatory docs or PO-approved reports.
  Also absorbs mattpocock/skills techniques (see references/grilling-and-domain-modeling.md and
  multi-agent-orchestration.md §5-6): grilling interview at /req-/spec (one question at a time, facts self-looked-up,
  decisions asked), CONTEXT.md domain glossary as doc #8, seam-based TDD + test anti-patterns, minimise/instrument
  in debugging, two-axis review (Standards + Spec) at /review, wayfinder shared-map so ONE Architect orchestrates
  MANY parallel agents across sessions on one project, and handoff docs between sessions/agents.
  Portable multi-harness bundle: copy the folder → runs on Claude Code, Codex, Gemini CLI, GitHub Copilot (VSCode),
  OpenClaw, Hermes, Paperclip (agentic), and Google Antigravity (AGENTS.md + .agent/rules).
  Covers 6 scopes via 5 entry commands: /odoo-new (module mới), /odoo-migrate (migrate DB local thay upgrade.odoo.com),
  /odoo-fix (auto-fix bug an toàn), /odoo-backport (backport/refactor/integrate), /odoo-ui-designer (thiết kế Website UI kéo-thả).
  Migrate DB & fix bug are top priority; always backup → work DB → verify so no data loss / DB corruption.
  Absorbs 3 chuyên đề migrate DB & snapshot: (1) nâng cấp database qua `upgrade.odoo.com` theo 10 bước có 2 gate duyệt —
  xem references/database-upgrade.md, trigger "upgrade db qua upgrade.odoo.com", "nâng db từ 14 lên 19";
  (2) chuyển `web_enterprise` → `backend_ui` 6 bước (tiền điều kiện → backup → dry-run → apply → restart →
  verification gate), lặp lại được cho nhiều DB, kèm decouple license/privacy — xem
  references/migrate-web-enterprise.md, trigger "migrate web_enterprise sang backend_ui", "chuyển sang backend_ui",
  "gỡ web_enterprise", "lỗi css sau upgrade", "css error occured using an old style", "vỡ giao diện sau nâng cấp",
  "Could not get content for", "decouple odoo license", "ẩn version odoo";
  (3) đồng bộ Odoo Enterprise snapshot mới vào addons/ và vendor 3-way merge backend_ui 7 bước chuẩn — xem
  references/sync-odoo-enterprise-snapshot.md, trigger "sync odoo ee snapshot", "đồng bộ snapshot odoo enterprise",
  "move code odoo ee", "thay thế addons odoo ee", "merge web_enterprise vào backend_ui", "sync snapshot 19.0",
  "lấy toàn bộ code odoo-ee thay thế cho backend_ui". Script tự động hóa: `360org/scripts/odoo/sync_odoo_enterprise_snapshot.py`.
  ⚠️ Script migrate mặc định DRY-RUN — thiếu cờ `--apply` là không ghi gì vào DB.
  Quy trình fix bug là 6 GIAI ĐOẠN (GĐ0-GĐ5, 12 bước): GĐ0 BẮT BUỘC tiếp nhận-phân tích-tạo ticket trên
  vuahethong.net qua API key TRƯỚC khi động vào code; Bước 12 BẮT BUỘC đóng ticket + ghi timesheet giờ thực tế.
  Trigger "khách báo lỗi", "tiếp nhận sự vụ", "tạo ticket vuahethong", "đóng ticket", "ghi timesheet",
  "báo cáo hoàn thành task" — xem references/helpdesk-intake-and-reporting.md.
---

# Bộ Kỹ Năng Phát Triển Odoo Chất Lượng Cao (360-odoo / odoo-dev-skills)

> ⚠️ **Scope:** CHỈ áp dụng cho dự án Odoo (v14–v19). Dự án non-Odoo (web app, mobile, SaaS, marketing site, ...) dùng [`dev-workflow-skills`](../../360-dev-workflow/prompts/SKILL.md).

Bộ kỹ năng này định hướng AI Agent và lập trình viên phát triển các **module Odoo** chuyên nghiệp, tinh gọn, tương thích từ phiên bản v14 đến v19.0, ưu tiên giao diện OWL 2.0+ hiện đại, tuân thủ quy chuẩn phối hợp đa Agent chuyên trách và sử dụng MCP phân tích cơ sở dữ liệu để tối ưu hóa token.

**Kế thừa từ `dev-workflow-skills` & Quy chuẩn Cấu trúc Tài liệu AIaC 3.0:**
- Workflow 9 bước `/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship`
- **Cấu trúc phân bổ tài liệu chuẩn (BẮT BUỘC)**:
  * Root: `README.md`, `AGENTS.md`, `.claude/`, và summary changelogs bắt buộc trong `description` của `__manifest__.py` theo chuẩn định dạng:
    ```python
    'description': """
Module Title — Changelog
========================

v<version> (YYYY-MM-DD)
-----------------------
- [TAG] Nội dung chi tiết ([MIGRATE], [NEW], [FIX], [IMPROVE], [SECURITY], [REFACTOR]).
    """,
    ```
  * Thư mục `docs/*`: Chứa toàn bộ tài liệu chi tiết `docs/IDEA.md`, `docs/REQUIREMENTS.md`, `docs/SPEC.md`, `docs/ARCH.md`, `docs/DEPLOY_GUIDE.md`, `docs/CHANGELOGS.md`, `docs/AUDIT_ROADMAP.md`.
- **Pre-Push / Pre-Commit Docs Sync Trigger (BẮT BUỘC)**: Tự động cập nhật đồng bộ toàn bộ tài liệu trong `docs/` trước khi commit/push remote.
- Model assignment (Claude/Codex cho Architect/Reviewer, Gemini cho Coder/Tester/Shipper)
- **DevTrack** — tự động ghi nhận thay đổi qua git hook + đồng bộ cross-agent (claude/codex/gemini).

**Bổ sung Odoo-specific & Upstream Skill Enhancements:**
- **OWL 2.0+ & Reactive State Architecture**: Chuẩn thiết kế JS/OWL components (`@odoo/owl`), Setup Reactive State, Patching DOM, Event Handlers.
- **ORM Modern Syntax (v16-v19)**:
  - **Loại bỏ hoàn toàn `attrs=`** (chuyển sang `invisible="..."`, `readonly="..."`, `required="..."` trực tiếp trong XML views).
  - Khai báo `models.Constraint()` và `models.Index()` thay cho `_sql_constraints` / `index=True` kiểu cũ.
  - Toán tử lọc quan hệ ORM mới: `any!` và `not any!`.
- **Mail, Chatter & Quy Chuẩn Tạo/Cập Nhật Task Trên `vuahethong.net` (BẮT BUỘC ĐẦY ĐỦ THÔNG TIN, CẤM LÀM CHO CÓ)**:
  - Khi post comment/chatter qua `message_post()` hoặc cập nhật `mail.message`: Bắt buộc bọc HTML qua `Markup(html_string)` từ thư viện `markupsafe` (`from markupsafe import Markup; task.message_post(body=Markup(...))`). Tuyệt đối không truyền raw string làm hiển thị lộ thẻ HTML trên UI.
  - Khi tạo hoặc cập nhật task (`project.task`), bắt buộc điền đầy đủ 100%: **Assignee** (nhân sự phụ trách), **Allocated Time** (giờ dự kiến, cấm để 00:00), **Deadline** (ngày hoàn thành cụ thể), **Labels/Tags** (phân loại chuẩn), **Milestone** (nếu có), **Activity** (`mail.activity` dạng `To Do` phân công kèm hạn chót và chỉ dẫn cụ thể cho nhân viên), **Description** (mô tả, traceback, root cause, giải pháp), và **Timesheet** (`account.analytic.line`) khi hoàn thành/báo cáo. Tuyệt đối cấm tạo/update task cho có.
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

