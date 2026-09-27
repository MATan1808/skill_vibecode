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
---

# Bộ Kỹ Năng Phát Triển Odoo Chất Lượng Cao (360-odoo / odoo-dev-skills)

> ⚠️ **Scope:** CHỈ áp dụng cho dự án Odoo (v14–v19). Dự án non-Odoo (web app, mobile, SaaS, marketing site, ...) dùng [`dev-workflow-skills`](../../360-dev-workflow/prompts/SKILL.md).

Bộ kỹ năng này định hướng AI Agent và lập trình viên phát triển các **module Odoo** chuyên nghiệp, tinh gọn, tương thích từ phiên bản v14 đến v19.0, ưu tiên giao diện OWL 2.0+ hiện đại, tuân thủ quy chuẩn phối hợp đa Agent chuyên trách và sử dụng MCP phân tích cơ sở dữ liệu để tối ưu hóa token.

**Kế thừa từ `dev-workflow-skills`:**
- Workflow 9 bước `/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship`
- Mandatory docs 7 files (IDEA, REQUIREMENTS, SPEC, ARCH, README, DEPLOY_GUIDE, CHANGELOGS)
- **Pre-Push / Pre-Commit Docs Sync Trigger (BẮT BUỘC)**: Tự động cập nhật đồng bộ toàn bộ tài liệu `*.md` trước khi commit/push remote.
- Model assignment (Claude/Codex cho Architect/Reviewer, Gemini cho Coder/Tester/Shipper)
- **DevTrack** — tự động ghi nhận thay đổi qua git hook + đồng bộ cross-agent (claude/codex/gemini).

**Bổ sung Odoo-specific & Upstream Skill Enhancements:**
- **OWL 2.0+ & Reactive State Architecture**: Chuẩn thiết kế JS/OWL components (`@odoo/owl`), Setup Reactive State, Patching DOM, Event Handlers.
- **ORM Modern Syntax (v16-v19)**:
  - **Loại bỏ hoàn toàn `attrs=`** (chuyển sang `invisible="..."`, `readonly="..."`, `required="..."` trực tiếp trong XML views).
  - Khai báo `models.Constraint()` và `models.Index()` thay cho `_sql_constraints` / `index=True` kiểu cũ.
  - Toán tử lọc quan hệ ORM mới: `any!` và `not any!`.
- **GitLab-first, Zero-Downtime Module Production Update (K8s SaaS)**:
  - Dùng một nguồn chuẩn duy nhất: `references/module-production-update.md` — test → commit → push GitLab trước; production chỉ pull SHA đã push từ GitLab. Cấm `rsync`/`scp`/`kubectl cp`/`tar`/`cp`/sync source local trực tiếp lên production; sau đó backup DB + code, chạy `-u <module>`, scale up pod mới rồi scale down/delete pod cũ.
- **Upgrade-Safe & Migration-Safe Odoo Theme & Layout Architecture (MỚI - chuẩn Odoo 19.0)**:
  - Bắt buộc wrapper thẻ `<div id="wrap" class="oe_structure oe_empty">` trên mọi `website.page` để tránh lỗi **"Outdated Snippet Block / Block out of date"** (icon cảnh báo màu cam) khi Odoo nâng cấp version.
  - Không bao giờ copy-paste đè Core templates; 100% sử dụng `inherit_id` + `xpath`. Tắt View mặc định bằng `data/presets.xml` với `active=False`.
  - Khai báo Palette động qua SCSS `$o-color-1..5` để Website Builder tự động map lại màu mà không bị vỡ giao diện.
- **Templates & Scripts Odoo**: (odoo-graph-mcp, odoo-linter, odoo-generator, odoo-builder, token-killer-proxy, git-cleaner).

---

## 🏛️ Quy Chuẩn Upgrade-Safe & Migration-Safe Cho Odoo Theme & Page Layout (Odoo 19.0 Core)

### 1. Thẻ Wrapper Trang Bắt Buộc (`oe_structure`)
Để đảm bảo khi nâng cấp version (v14-v18 ➔ v19), Odoo Website Builder không đánh dấu Snippet Block bị outdated/deprecated hoặc làm biến dạng layout:
```xml
<record id="page_custom_landing" model="website.page">
    <field name="name">Landing Page</field>
    <field name="url">/landing</field>
    <field name="type">qweb</field>
    <field name="is_published" eval="True"/>
    <field name="arch" type="xml">
        <t t-name="website_theme.page_custom_landing">
            <t t-call="website.layout">
                <!-- ✅ BẮT BUỘC wrapper id="wrap" và class="oe_structure" -->
                <div id="wrap" class="oe_structure oe_empty">
                    <!-- Tất cả các Snippets/Building blocks kéo-thả được chèn ở đây -->
                </div>
            </t>
        </t>
    </field>
</record>
```

### 2. Định Nghĩa Snippet Metadata Chuẩn Tương Thích Upstream
```xml
<template id="s_hero_section" name="Hero Section 360">
    <!-- ✅ Bắt buộc class o_colored_level và data-snippet -->
    <section class="s_hero_section o_colored_level py-5" data-snippet="website_theme.s_hero_section" data-name="Hero Section">
        <div class="container">
            <h1 class="display-4 fw-bold o_editable">Tiêu đề Trang Web</h1>
            <p class="lead o_editable">Nội dung giới thiệu doanh nghiệp</p>
            <a href="/contactus" class="btn btn-primary btn-lg o_editable">Liên hệ ngay</a>
        </div>
    </section>
</template>
```

---

## 🎯 Quy Chuẩn Code Odoo Modern (v16–v19)

### 1. XML View Rule — KHÔNG DÙNG `attrs=`
```xml
<!-- ❌ SAI (Cú pháp cũ v14-v15): -->
<field name="amount" attrs="{'invisible': [('state', '=', 'draft')], 'readonly': [('state', '=', 'done')]}"/>

<!-- ✅ ĐÚNG (Cú pháp Modern v16-v19): -->
<field name="amount" invisible="state == 'draft'" readonly="state == 'done'"/>
```

### 2. Python Model Rule — Modern ORM Syntax & Constraints
```python
from odoo import models, fields

class CustomOrder(models.Model):
    _name = 'custom.order'

    name = fields.Char(string='Order Ref', required=True)
    state = fields.Selection([('draft', 'Draft'), ('done', 'Done')], default='draft')
    line_ids = fields.One2many('custom.order.line', 'order_id', string='Lines')

    # ✅ Modern SQL Index & Constraint
    _sql_constraints = [] # ❌ KHÔNG dùng _sql_constraints cũ
    
    # ✅ Dùng models.Constraint() & models.Index()
    _constraints = [
        models.Constraint('UNIQUE(name)', 'order_name_unique', 'Order Ref must be unique!')
    ]
```

---

## 🎨 Quy Chuẩn Thiết Kế Backend Layout & Giao Diện Odoo (BẮT BUỘC)

### 1. Tuyệt Đối Tuân Thủ Core Layout Odoo — Không Tự Ý Sáng Tạo
*   **Khuôn khổ Odoo & OWL Framework**: Toàn bộ cấu trúc giao diện (Backend Form, Tree/List, Kanban, Pivot, Graph, Dashboard) **BẮT BUỘC 100%** sử dụng các cấu trúc, class Bootstrap/Odoo có sẵn trong Odoo Core (như benchmark chuẩn: `purchase_dashboard.xml`, `sale`, `account`, `crm`).
*   **Nghiêm cấm tự chế layout**: Không tự ý bịa thêm các custom card, CSS layout, floating wrapper hoặc cấu trúc dị biệt khác quy chuẩn của Odoo.
*   **Nhận diện Thương hiệu 360 CORP**: Chỉ được phép tùy biến màu sắc thông qua CSS variable hoặc palette thương hiệu 360 CORP trên nền các class chuẩn của Odoo (`btn-primary`, `bg-view`, `bg-100`, `text-primary`), giữ nguyên vẹn 100% hierarchy, typography và component spacing của hệ thống Odoo chuẩn.

---

## 🛠️ Quy trình Zero-Downtime Update Module Trên Kubernetes SaaS (360-rancher)

Dùng một nguồn chuẩn duy nhất: [references/module-production-update.md](references/module-production-update.md).

Tóm tắt: test → commit → push GitLab → production `git pull --ff-only` đúng SHA → verify source → backup DB và `pg_restore -l` → backup code về local server theo `client-name` → chạy `odoo -d "$POSTGRES_DB" -u <module>` → scale up pod mới → verify Ready/version → scale down/delete pod cũ. Cấm copy/sync source local và không dùng `kubectl rollout restart` cho production module update.
