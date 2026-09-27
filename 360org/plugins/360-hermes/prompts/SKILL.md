---
name: hermes-dev-skills
description: |
  MUST be loaded when the user mentions "Hermes Agent" plugin/skill/tool development explicitly —
  trigger phrases include: "hermes plugin ...", "platform adapter cho hermes ...", "hermes gateway plugin ...",
  "build hermes tool ...", "hermes provider plugin ...", "hermes skill ...", "dev hermes ...",
  "sửa plugin hermes ...", "debug hermes gateway ...", or any task that touches
  `~/.hermes/plugins/**`, `data/profiles/<profile>/plugins/**`, `gateway/platforms/base.py`,
  `BasePlatformAdapter`, `PluginContext`, `register_platform`, `register_tool`, `register_provider`,
  or a Hermes Agent (NousResearch) `config.yaml` / `plugin.yaml`.
  ALSO trigger on NATURAL-LANGUAGE requests about extending a running Hermes Agent instance, e.g.:
  "làm giúp anh 1 platform adapter cho Zalo", "viết tool mới cho Hermes gọi API nội bộ",
  "tại sao plugin này không load", "audit plugin theo đúng chuẩn Hermes".
  ⚠️ ONLY for Hermes Agent (NousResearch, github.com/NousResearch/hermes-agent) plugin/skill/tool
  development. NOT for Odoo (`odoo-dev-skills`) or generic non-Hermes projects (`dev-workflow-skills`).
  Use this skill for: platform adapters (messaging channel bridges), built-in/plugin tools, SKILL.md
  skills for Hermes itself, model/memory/context-engine/image/video/web-search provider plugins,
  CLI extension hooks, and gateway-side debugging (config wiring, token locks, self-loop, auth chain).
  Inherits the 9-step lifecycle (/idea → /ship) from `dev-workflow-skills` and adds Hermes-specific
  tooling (hermes_plugin_generator.py, hermes_plugin_linter.py, hermes_plugin_doctor.py) and templates
  (plugin.yaml, adapter.py, tools.py skeletons).
  Model assignment (cross-model, PO dùng GPT/Claude/Gemini): Claude = Architect/Debugger,
  GPT/Codex = Reviewer (khác model với người viết code để bắt điểm mù), Gemini = Coder/Tester/Shipper.
  2 approval gates cứng: sau /req (Gate A) và sau /plan (Gate B) — agent DỪNG chờ PO duyệt,
  tuyệt đối không tự /build khi Gate B chưa qua. Pha /build ⇄ /review chạy N sub-agent song song,
  chia việc theo ownership boundary (2 agent không cùng ghi 1 file) + git worktree riêng,
  lặp build→review→fix tối đa 3 vòng/task rồi escalate PO.
  Mandatorily verify every claimed API (register_platform kwargs, BasePlatformAdapter signatures,
  PluginContext methods) against the real source in the running container or the upstream repo
  before shipping — the official docs are a mirror and can drift from a pinned/forked version.
  Covers 3 entry commands: /hermes-new (plugin mới: platform/tool/provider/skill),
  /hermes-fix (plugin không load / wiring sai / xung đột token), /hermes-audit (parity audit
  so với reference implementation + review over-engineering trước khi ship).
  BUNDLED: thư mục skills/ gộp 7 bộ vệ tinh (caveman, ponytail, superpowers, agent-skills,
  anthropics, mattpocock, agency-agents) — xem skills/README.md để định tuyến, đặc biệt mục
  "Chia nhỏ việc cho nhiều agent chạy song song không đụng nhau".
---

# Bộ Kỹ Năng Phát Triển Plugin cho Hermes Agent (hermes-dev-skills)

> ⚠️ **Scope:** CHỈ áp dụng cho phát triển **plugin/tool/skill/provider cho Hermes Agent** (NousResearch, [github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), docs mirror tiếng Trung tại hermes-agent.lzw.me). Dự án Odoo dùng [`odoo-dev-skills`](../../360-odoo/prompts/SKILL.md). Dự án non-Hermes khác dùng [`dev-workflow-skills`](../../360-dev-workflow/prompts/SKILL.md).

Bộ kỹ năng này định hướng AI Agent và lập trình viên xây dựng **plugin cho Hermes Agent** — platform adapter (kênh chat mới), tool built-in/plugin, skill (SKILL.md), và provider plugin (model/memory/context-engine/image/video/web-search) — đúng chuẩn kiến trúc plugin của Hermes, tận dụng tối đa cơ chế "drop-a-directory, zero core changes".

**Kế thừa từ `dev-workflow-skills`:**
- Workflow 9 bước `/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship`
- Mandatory docs 7 files (IDEA, REQUIREMENTS, SPEC, ARCH, README, DEPLOY_GUIDE, CHANGELOGS) — áp dụng cho **từng plugin** đang phát triển (không phải cho bản thân skill này)
- Model assignment (Claude/Codex cho Architect/Reviewer, Gemini cho Coder/Tester/Shipper)
- **DevTrack** — tự động ghi nhận thay đổi qua git hook + đồng bộ cross-agent. Bật cho plugin/dự án đang dev: `python3 <dev-workflow-skills>/scripts/devtrack.py install <path>` → commit tự append CHANGELOGS + tick task.md; đổi editor không phải đọc lại. Chi tiết: [dev-workflow-skills/references/devtrack.md](../../360-dev-workflow/prompts/references/devtrack.md)

**Bổ sung Hermes-specific:**
- Templates: `plugin.yaml`, `adapter.py` (platform), `tools.py`/`schemas.py` (tool plugin)
- Scripts: `hermes_plugin_generator.py`, `hermes_plugin_linter.py`, `hermes_plugin_doctor.py`
- References: Platform Adapters, Tools & Hooks, Skills & Blueprints, Provider Plugins, CLI Extension, Git/Contributing, Debugging & Operations (gotcha thật đã gặp trong production), Ponytail, Final Audit

---

## 🎯 4 loại plugin có thể build — nhận diện đúng loại trước khi code

Hermes có **4 loại extension point** khác h�ẳn nhau, chọn sai loại sẽ dẫn tới code thừa hoặc thiếu tích hợp. Hỏi PO/tự suy luận theo bảng sau trước khi vào `/spec`:

| Muốn làm gì? | Loại đúng | Vì sao |
|---|---|---|
| Thêm 1 kênh nhắn tin mới (Zalo, WeCom, kênh nội bộ...) mà user chat qua đó | **Platform Adapter** | Kế thừa `BasePlatformAdapter`, đăng ký qua `ctx.register_platform()`. Xem [references/platform-adapters.md](references/platform-adapters.md). |
| Cần tích hợp API/logic xử lý riêng, có API key, xử lý binary/streaming | **Tool (plugin)** | Đăng ký qua `ctx.register_tool()`. Xem [references/tools-and-hooks.md](references/tools-and-hooks.md). |
| Có thể diễn đạt bằng "hướng dẫn + lệnh shell + tool có sẵn" (không cần code Python riêng) | **Skill (SKILL.md)** | KHÔNG cần code, chỉ cần markdown + script hỗ trợ. Xem [references/skills-and-blueprints.md](references/skills-and-blueprints.md). Đây là lựa chọn **ưu tiên mặc định** theo docs chính thức — chỉ viết Tool khi Skill không đủ. |
| Thêm 1 model inference backend / memory backend / context-compression strategy mới | **Provider Plugin** | `register_provider()` (model), tương tự cho memory/context-engine. Xem [references/provider-plugins.md](references/provider-plugins.md). |
| Muốn hook vào lifecycle (trước/sau tool call, trước/sau LLM call, session start/end) | **Hook** (`ctx.register_hook`) | Không phải 1 loại riêng — đính kèm vào plugin đã chọn ở trên. Xem [references/tools-and-hooks.md](references/tools-and-hooks.md). |

**Nguyên tắc bắt buộc:** trước khi viết Tool, tự hỏi *"cái này có thể là Skill không?"* — docs chính thức nói rõ *Skill dễ tạo hơn, không cần sửa code agent, chia sẻ được cộng đồng*. Chỉ chọn Tool khi cần API key/auth flow/xử lý binary/streaming thật sự.

---

## 🚨 Yêu cầu Tài liệu Plugin bắt buộc (MANDATORY DOCS)

Mỗi **plugin Hermes** khi khởi tạo và phát triển phải luôn chứa đầy đủ 7 file tài liệu kỹ thuật ở thư mục gốc plugin (kế thừa từ `dev-workflow-skills`):

1. **`IDEA.md`** — Ý tưởng gốc từ Product Owner: vision, bài toán, giá trị cốt lõi. PO viết, AI chỉ format.
2. **`REQUIREMENTS.md`** — Yêu cầu chi tiết (WHAT/WHY), AI sinh từ IDEA, PO duyệt.
3. **`SPEC.md`** — Đặc tả kỹ thuật (HOW): loại plugin (bảng trên), env vars, schema tool, kiến trúc adapter. Sinh từ REQUIREMENTS đã duyệt.
4. **`ARCH.md`** — Sơ đồ tích hợp vào Gateway/AIAgent, deployment topology (profile nào, container nào).
5. **`README.md`** — Giới thiệu plugin, cách cài (`plugin.yaml` env vars), cách bật trong `config.yaml`.
6. **`DEPLOY_GUIDE.md`** — Các bước enable trên server thật: đặt `.env`, `hermes config set`, `hermes gateway restart`, verify log.
7. **`CHANGELOGS.md`** — Nhật ký phát triển plugin.

### ⚡ Pre-Push & Pre-Commit Documentation Sync Trigger (BẮT BUỘC)
Trước BẤT KỲ lệnh git commit hoặc git push nào lên remote repository (GitLab/GitHub):
- **Tự động kích hoạt (Auto-Trigger)**: Kiểm tra và cập nhật đồng bộ toàn bộ file tài liệu `*.md` (`CHANGELOGS.md`, `ARCH.md`, `SPEC.md`, `REQUIREMENTS.md`, `DEPLOY_GUIDE.md`...).
- **Nội dung ghi nhận**: Ghi rõ ràng mọi thay đổi về plugin handler, adapter, tool schema, provider API và các bản vá lỗi.
- **Quy tắc bất khả xâm phạm**: Không bao giờ commit/push mã nguồn khi tài liệu `*.md` chưa được cập nhật tương ứng.

**Luồng tài liệu bắt buộc:**
```
IDEA.md (PO viết) → REQUIREMENTS.md (AI sinh, PO duyệt) → SPEC.md (AI sinh, PO duyệt) → code
```
Không bỏ qua bước. SPEC phải nêu rõ đây là Platform Adapter/Tool/Skill/Provider (bảng ở trên) — sai chỗ này kéo theo sai toàn bộ phần còn lại.

---

## 🛠️ Quy trình Phối hợp Đa Agent theo Vòng đời (/idea đến /ship)

```
  IDEA      REQUIREMENTS    SPEC & ARCH      PLAN        BUILD       CODE-REVIEW     VERIFY       REVIEW       SHIP
 ┌──────┐  ┌────────────┐  ┌────────────┐  ┌──────┐   ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌────────┐  ┌──────┐
 │ PO   │─▶│ AI sinh    │─▶│ AI thiết kế│─▶│ Plan │──▶│ Code    │─▶│ Soi diff  │─▶│ Test &  │─▶│ Audit  │─▶│ Go   │
 │ viết │  │ PO duyệt   │  │ PO duyệt   │  │ Task │   │ (Coder) │  │(CodeRev.) │  │ (Tester)│  │(Review)│  │ Live │
 └──────┘  └────────────┘  └────────────┘  └──────┘   └─────────┘  └─────┬─────┘  └─────────┘  └────────┘  └──────┘
  /idea        /req            /spec         /plan      /build     /code-review      /test       /review     /ship
                                                             ▲           │
                                                             └───────────┘
                                                        fix → re-review (≤3 vòng)
```

**🚦 2 cổng duyệt cứng + vòng lặp song song** (chi tiết: [references/multi-agent-orchestration.md](references/multi-agent-orchestration.md)):
- **Gate A** sau `/req`, **Gate B** sau `/plan` — agent **DỪNG chờ PO duyệt**, không tự chạy tiếp; SPEC đổi sau khi qua gate thì trình duyệt lại.
- Pha `/build` ⇄ `/code-review` là **vòng lặp = cổng chặn trước `/test`** (build → review chéo model → fix, ≤3 vòng/task rồi escalate PO; còn finding Critical/High thì không merge), chạy **N sub-agent song song không đụng nhau**: chia theo ownership boundary (2 agent không bao giờ cùng ghi 1 file), contract I/O rõ, mỗi agent 1 git worktree + 1 model (Claude=phân tích, GPT=review, Gemini=code/test/ship).
- Kết thúc `/ship`: trả PO kết quả cuối — walkthrough, test pass, cách verify, nợ ponytail còn lại.

### 1. Ý tưởng từ Product Owner (`/idea`)
PO đưa ý tưởng thô (nói tự nhiên/gạch đầu dòng đều được) — **AI chỉ sắp xếp lại thành `IDEA.md` có cấu trúc**, không tự sáng tạo thêm, không bỏ ý của PO. Trình PO xác nhận đúng ý trước khi sang `/req`.

### 2. Phân tích & Viết Yêu cầu (`/req`)
**Architect** đọc `IDEA.md` → `REQUIREMENTS.md`. PO duyệt bằng `> 📝 Ghi chú:` trong file.

### 3. Đặc tả Kỹ thuật & Kiến trúc (`/spec`)
**Architect** chốt loại plugin (bảng ở trên), viết `SPEC.md` + `ARCH.md`. Bắt buộc đọc reference tương ứng ([platform-adapters.md](references/platform-adapters.md) / [tools-and-hooks.md](references/tools-and-hooks.md) / [skills-and-blueprints.md](references/skills-and-blueprints.md) / [provider-plugins.md](references/provider-plugins.md)) trước khi viết SPEC, không đoán API.

### 4. Lập kế hoạch chi tiết (`/plan`)
**Architect** chia nhỏ thành task nguyên tử, có thể kiểm thử độc lập, ghi vào `implementation_plan.md` kèm **bảng phân công: task → sub-agent → model → file sở hữu** (2 agent không chung file). Đây là deliverable trình **Gate B**.

### 5. Phát triển mã nguồn (`/build`)
**Coder** sinh mã dựa trên `templates/`, tuân thủ ladder ponytail mức `full` ([references/ponytail-lazy-dev.md § 1](references/ponytail-lazy-dev.md)). Với Platform Adapter, **bắt buộc** chạy `scripts/hermes_plugin_linter.py` trước khi coi là xong.

### 6. Kiểm thử (`/test`)
**Tester** viết test theo checklist trong [references/platform-adapters.md § Tests](references/platform-adapters.md) (construction, message event building, send mock, feature riêng), chạy thử bằng `HERMES_PLUGINS_DEBUG=1 hermes plugins list` + `hermes gateway restart` + xem `logs/gateway.log`.

### 7. Đánh giá chất lượng code (`/review`)
**Reviewer** quét lỗi + chạy **Parity Audit** (so sánh file/pattern với 1 platform tham chiếu đã có, xem [references/final-audit-guide.md](references/final-audit-guide.md)), cộng thêm pass over-engineering ([references/ponytail-lazy-dev.md § 2](references/ponytail-lazy-dev.md)).

### 8. Đóng gói & Bàn giao (`/ship`)
**Shipper** tổng hợp `walkthrough.md`, xác nhận đã enable đúng trong `config.yaml`/`.env` của đúng profile, và thực hiện:
- **Clean & Permission:** Sau khi sync code lên server, bắt buộc chạy dọn dẹp (`__pycache__`) và cấp lại đúng quyền sở hữu/quyền hạn (`chown -R ubuntu:ubuntu`, `chmod 755` cho thư mục, `chmod 644` cho files) để tránh lỗi `Permission denied` đối với user chạy app. Xem chi tiết tại [references/debugging-and-operations.md § 11](references/debugging-and-operations.md).
- **Restart & Verify:** Hướng dẫn hoặc thực hiện `hermes gateway restart` (hoặc profile tương ứng) + kiểm tra log thật của gateway ngay lập tức để xác nhận không phát sinh lỗi khởi động hay load plugin.

---

## 📂 Bản đồ điều hướng Tài liệu tham chiếu (references/)

| Nhiệm vụ | Tệp hướng dẫn | Nội dung chính |
| :--- | :--- | :--- |
| Quy trình Phối hợp Đa Agent | [references/multi-agent-orchestration.md](references/multi-agent-orchestration.md) | Vai trò, model assignment, 9 bước chi tiết cho plugin Hermes. |
| **[TRỌNG TÂM]** Platform Adapter (kênh chat mới) | [references/platform-adapters.md](references/platform-adapters.md) | `BasePlatformAdapter`, `register_platform()` đầy đủ tham số, env-driven config, cron delivery, token lock, long-poll/webhook pattern, parity audit. |
| Tool plugin & Lifecycle Hooks | [references/tools-and-hooks.md](references/tools-and-hooks.md) | `register_tool()`, handler contract (luôn trả JSON string), `register_hook()` 7 loại hook, khi nào Tool thay vì Skill. |
| Skill (SKILL.md) & Blueprint (automation) | [references/skills-and-blueprints.md](references/skills-and-blueprints.md) | Frontmatter đầy đủ, `requires_toolsets`/`requires_tools`, env var passthrough, blueprint = skill có `schedule`, publish lên Skills Hub. |
| Provider Plugin (model/memory/context/media) | [references/provider-plugins.md](references/provider-plugins.md) | `register_provider()`, `ProviderProfile`, discovery order, auto-wire (CLI, doctor, setup wizard). |
| Extending CLI (wrapper TUI) | [references/cli-extension.md](references/cli-extension.md) | 5 extension seam của `HermesCLI`, khi nào cần (hiếm). |
| Git/Contributing workflow | [references/git-workflow.md](references/git-workflow.md) | Dev setup chuẩn (uv, venv ngoài source tree), thứ tự ưu tiên đóng góp, quy trình PR. |
| **[VẬN HÀNH THẬT]** Debug & Gotcha production | [references/debugging-and-operations.md](references/debugging-and-operations.md) | Permission UID 1000, dash vs bash script, token nested vs top-level, self-loop ID space (res.users≠res.partner khi nối Odoo-XMLRPC), 9router auth chain. |
| Final Audit & Parity Checklist | [references/final-audit-guide.md](references/final-audit-guide.md) | Checklist trước khi ship 1 plugin, quy trình Parity Audit chính thức. |
| **[MẶC ĐỊNH]** Ladder + Review + Audit + Debt ledger + Scoreboard | [references/ponytail-lazy-dev.md](references/ponytail-lazy-dev.md) | 6 năng lực ponytail, ánh xạ vào `/build`, `/review`. |

---

## 🛰️ Bộ skill vệ tinh đã gộp (skills/)

`hermes-dev-skills` là **trung tâm**; thư mục [skills/](skills/) gộp nguyên trạng 6 bộ skill vệ tinh làm lớp năng lực bổ trợ (không thay thế lifecycle 9 bước và references Hermes ở trên):

| Bộ | Vai trò trong hệ Hermes |
|---|---|
| [skills/caveman/](skills/caveman/) | Nén token giao tiếp (trả lời/commit/review/subagent nén ~65%). |
| [skills/ponytail/](skills/ponytail/) | Bản đầy đủ của nguyên tắc lười có kỷ luật — lõi đã dùng qua [references/ponytail-lazy-dev.md](references/ponytail-lazy-dev.md), bản này thêm `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`. |
| [skills/superpowers/](skills/superpowers/) | Quy trình dev kỷ luật: TDD, systematic-debugging, writing/executing-plans, git worktrees, verification. |
| [skills/agent-skills/](skills/agent-skills/) | Thực hành kỹ nghệ theo chủ đề: API design, CI/CD, security, observability, migration, context engineering… |
| [skills/anthropics/](skills/anthropics/) | Skill chính thức Anthropic: docx/pptx/xlsx/pdf, mcp-builder, skill-creator, webapp-testing, frontend/canvas design. |
| [skills/mattpocock/](skills/mattpocock/) | Phong cách Matt Pocock: domain modeling, diagnosing-bugs, grill/teach, writing-great-skills. |
| [skills/agency-agents/](skills/agency-agents/) | ~277 agent persona theo ~20 division (engineering, project-management, design, security…). **Trọng tâm:** `engineering-multi-agent-systems-architect` + division `project-management` cho bài toán chia nhỏ việc song song không đụng nhau (contract I/O từng agent + ownership boundary + git worktree). |

Định tuyến chi tiết + quy tắc ưu tiên khi trùng chức năng + công thức 5 bước chia việc song song: [skills/README.md](skills/README.md). Giấy phép bên thứ ba: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## 🤖 Công cụ Tự động hóa đi kèm (scripts/)

1. **Sinh khung plugin mới:** `python scripts/hermes_plugin_generator.py --name <plugin_name> --kind platform|tool|provider --dest <path>` — tạo `plugin.yaml` + `adapter.py`/`tools.py` + 7 mandatory docs từ `templates/`.
2. **Kiểm tra chuẩn plugin (Linter):** `python scripts/hermes_plugin_linter.py --path <plugin_dir>` — verify đủ method bắt buộc, `register_*()` đủ tham số khuyến nghị, JSON-return contract cho tool handler.
3. **Chẩn đoán plugin không load (Doctor):** `python scripts/hermes_plugin_doctor.py --path <plugin_dir>` — check cấu trúc thư mục, `__init__.py` export `register`, gợi ý chạy `HERMES_PLUGINS_DEBUG=1 hermes plugins list` để lấy log thật.

> Mọi script có `--self-check` (ponytail: 1 check chạy được, không cần Hermes thật): `hermes_plugin_generator.py`, `hermes_plugin_linter.py`, `hermes_plugin_doctor.py`.

---

## ⚠️ Nguyên tắc chống bịa API

Docs chính thức (`hermes-agent.lzw.me`, GitHub `NousResearch/hermes-agent`) là **bản mirror**, có thể lệch so với version đang chạy thật trên server (image Docker pinned). Trước khi khẳng định 1 tham số/method tồn tại và code theo nó:
1. Ưu tiên đọc trực tiếp source thật trong container đang chạy (`docker exec hermes cat /opt/hermes/gateway/platforms/base.py` hoặc tương đương) nếu có quyền truy cập server.
2. Nếu không có quyền truy cập server, đối chiếu ít nhất với file `.md` gốc trên GitHub (không chỉ tóm tắt search), trích dẫn đường dẫn file:dòng.
3. Không suy diễn tham số dựa trên "nghe hợp lý" — nếu không chắc, nói rõ với PO là "chưa verify được, cần kiểm tra thêm" thay vì code liều.
