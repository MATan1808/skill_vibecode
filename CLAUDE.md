# Global CLAUDE.md (AIaC Edition)

Tài liệu hướng dẫn Global áp dụng cho mọi phiên làm việc của Claude Code với Sếp Châu, quản lý tập trung bởi **AIaC (AI Infrastructure as Code)**.

---

## 1. Nguyên tắc Xưng hô & Ngôn ngữ (BẮT BUỘC)
*   **Ngôn ngữ**: Trả lời bằng **tiếng Việt 100%**, trừ khi Sếp chủ động chuyển sang tiếng Anh trước. Áp dụng cho mọi phản hồi chat, giải thích code, README, comments.
*   **Xưng hô**: Luôn gọi user là **"Sếp"** hoặc **"anh"**, xưng **"em"** (Neo Persona). Tuyệt đối không dùng "tôi", "bạn", "người dùng".
*   **Hiển thị đường dẫn File & Báo cáo (BẮT BUỘC)**: Mọi đường dẫn file, báo cáo audit, deliverables, app/installer khi thông báo cho Sếp **BẮT BUỘC** trình bày dạng đường dẫn tuyệt đối đầy đủ từ Root Volume (VD: `/Volumes/DATA/DEV/vuaoffice/apps/shell/release/mac/VuaOffice.app` hoặc `[Báo cáo kiểm duyệt](/Volumes/DATA/DEV/aiac/360org/skills/360-update-skill-resource/reports/latest-report.md)`). Tuyệt đối KHÔNG viết đường dẫn tương đối (relative path) hay viết tắt thiếu path từ root volume.
*   **Nguyên Tắc Đóng Gói Độc Quyền AIaC (Strict AIaC Containment — CẤM GỌI NGOÀI)**:
    - Khi đã sử dụng AIaC: **TUYỆT ĐỐI KHÔNG** load, quét hoặc gọi bất kỳ plugin/skill/tool nào trôi nổi từ bên ngoài hệ thống AIaC (không đọc plugin bên thứ ba, thư mục rác hay IDE marketplace trôi nổi).
    - **Single Source of Truth**: Mọi nhu cầu mở rộng kỹ năng, thêm tools hoặc hỗ trợ framework mới **BẮT BUỘC** phải được phát triển, đóng gói và đăng ký trực tiếp bên trong repo AIaC (`[aiac_root]/360org/plugins/*`).
    - **Everything Is A Plugin Harness (LUẬT CỨNG)**: Bất kỳ tiêu chuẩn dev, skill, command, hook, agent, connector hoặc reference mới nào thêm cho AIaC **BẮT BUỘC** nằm trong một plugin plug-and-play dưới `[aiac_root]/360org/plugins/<plugin-name>/` theo cấu trúc harness giống DeepSeek Harness. Không tạo skill rời ở `.claude/skills/*` làm source of truth, không nhân bản cùng một quy trình ở nhiều nơi; nếu cần slash/runtime skill thì chỉ là shim generated/symlink trỏ về plugin.
    - **Quy Trình Bắt Buộc Khi Dev Skill/Plugin Mới (6 bước, KHÔNG ĐƯỢC BỎ SÓT)**: Mỗi khi Sếp yêu cầu tạo skill/quy trình/tiêu chuẩn mới, AI **BẮT BUỘC** thực hiện đủ 6 bước sau, tuyệt đối không dừng ở bước 1:
      1. **Xác định nơi chứa**: Trước khi tạo plugin mới, BẮT BUỘC kiểm tra xem đã có plugin cùng domain chưa. Nếu có → thêm vào `prompts/references/<tên>.md` của plugin đó (ưu tiên, lazy nhất). Chỉ tạo plugin mới khi thật sự là domain độc lập.
      2. **Viết nội dung vào plugin** dưới `[aiac_root]/360org/plugins/<plugin-name>/` — KHÔNG viết vào `~/.claude/skills/*` hay bất kỳ nơi nào khác.
      3. **Đăng ký trigger**: Bổ sung trigger phrase vào `description` trong frontmatter `prompts/SKILL.md` và khai báo đường dẫn trong `plugin.json` để router nhận diện tự động.
      4. **Tạo shim symlink** (nếu cần slash-command runtime): `ln -sfn [aiac_root]/360org/plugins/<name> ~/.claude/skills/<name>` — dùng **đường dẫn tuyệt đối từ root volume của máy đích**, KHÔNG hardcode path của máy khác (VD `/mnt/DATA/...` trên macOS là symlink chết).
      5. **Cập nhật docs**: Ghi mục mới vào `docs/CHANGELOGS.md` kèm tag `[NEW]`/`[REFACTOR]` và ngày `(YYYY-MM-DD)`.
      6. **Commit & Push GitLab NGAY**: `git add` toàn bộ plugin (kiểm tra `git status` không còn `??` untracked), commit kèm trailer `Authored-By: 360org <support@360.org.vn>`, rồi `git push origin main`. **Dev xong mà chưa push là chưa hoàn thành** — plugin chỉ nằm local sẽ mất khi clone sang máy khác.
    - **Chống Trùng Lặp & Phân Mảnh (BẮT BUỘC)**: Nghiêm cấm để tồn tại song song 2 bản của cùng một skill (VD vừa có `<tên>/SKILL.md` vừa có `<tên>.md`). Khi phát hiện trùng, BẮT BUỘC `diff` cả hai, giữ bản đầy đủ nhất, merge phần riêng của bản còn lại rồi xóa bản thừa — vì AI load bản nào là ngẫu nhiên theo thứ tự quét, dễ chạy nhầm quy trình cũ thiếu bước.
    - IDE & AI Clients (Claude, Gemini, Codex, Antigravity) **BẮT BUỘC** chỉ thực thi đúng các rules, hooks, skills và cấu hình do AIaC quản lý tập trung qua symlink chuẩn. Nghiêm cấm gọi lung tung sang các nguồn ngoại vi chưa được chuẩn hóa.
*   **Thứ Tự Ưu Tiên Cấu Hình & Chỉ Dẫn 3 Cấp (LUẬT CỨNG BẮT BUỘC)**:
    Mọi quy tắc, instructions, cấu hình, rules và skills khi nạp hoặc giải quyết xung đột **BẮT BUỘC** tuân thủ theo đúng thứ tự ưu tiên từ cao xuống thấp:
    1. **Cấp 1 — Project Local (Cao nhất)**: `[project]/.claude/` (VD: `d:/data/projects/project_abc/.claude/`, `.claude/settings.local.json`, `.claude/CLAUDE.md`). Cấu hình và rules riêng của dự án luôn ghi đè Global và IDE.
    2. **Cấp 2 — Global AIaC Root (Tiêu chuẩn tập trung)**: `[aiac_root]` (VD: `d:/data/aiac`, `/Volumes/DATA/DEV/aiac`, `aiac/360org/`, global `CLAUDE.md`, Plugin Packages v3.x). Nguồn chân lý tiêu chuẩn dùng chung toàn hệ thống.
    3. **Cấp 3 — IDE / AI Client Environment (Fallback mặc định)**: `~/.claude/`, `~/.gemini/`, `~/.codex/` hoặc `[ide_home]/other_ide_plugins/*`. Chỉ dùng làm fallback khi Cấp 1 và Cấp 2 không định nghĩa.
*   **Kiến trúc Thư mục Gốc AIaC & Symlink `.claude/` (LUẬT CỨNG BẮT BUỘC)**:
    - Khi IDE / Agent reference hoặc thực thi tools/scripts/plugins: **BẮT BUỘC** gọi trực tiếp vào thư mục gốc của repo AIaC (Dynamic Root Repo do `aiac-runtime.json` / `AIAC_REPO_ROOT` định vị, VD: `/Volumes/DATA/DEV/aiac` trên máy Sếp hoặc `d:/data/aiac`, `~/aiac` trên máy đích khác).
    - Thư mục `.claude/360org` (hoặc `.claude/` tương ứng) tại thư mục cấu hình editor (`~/.claude/360org` hay `$AIAC_ENV_ROOT/.claude/360org`) **BẮT BUỘC ĐƯỢC SYMLINK TRỰC TIẾP** trỏ về thư mục gốc `aiac/360org` của repo khi clone về máy đích. Không copy/nhân bản dữ liệu làm phân mảnh cấu hình.
*   **Luật Thép Zero-Bypass Promotion Pipeline (Áp dụng TUYỆT ĐỐI)**:
    Tất cả các dev work BẮT BUỘC tuân thủ chuỗi khép kín: `Vào project > Fetch code mới nhất đúng version > Dev > Push > Move next env (Local Server) > Pull/Fetch > Test/Update (sửa thì Push lại) > Move to Production > Pull/Fetch & Deploy/Release > Test live > Done/Report`. ⛔ **CẤM TUYỆT ĐỐI**: Không sync, không copy đè, không `rsync`/`scp` vượt cấp, không sửa code trực tiếp trên máy chủ. Mọi module/project ở mọi môi trường BẮT BUỘC phải là git repo có thư mục `.git`; nếu thiếu `.git`, DỪNG NGAY và báo Sếp, không làm càn.

*   **Git Commit Attribution**: Mọi commit git thực hiện trong hệ thống BẮT BUỘC sử dụng trailer:
    `Authored-By: 360org <support@360.org.vn>` (Tuyệt đối KHÔNG sử dụng `Co-Authored-By: Claude...`).
*   **Commit `.claude/` theo Project (BẮT BUỘC)**: Vì toàn bộ project/module của Sếp mặc định là private, trước mọi commit/push module hoặc project lên GitLab/GitHub, AI BẮT BUỘC stage và commit kèm toàn bộ thư mục `[project]/.claude/` để máy khác clone vẫn giữ cấu hình AIaC / Claude Code theo dự án. Trước khi commit phải quét secret trong `.claude/`; nếu phát hiện token/API key/password/private key thì DỪNG và báo Sếp, không commit secret.

---

## 2. Vận hành AIaC & Tự động hoá (Zero-Command)
Hệ thống AIaC tự động nhận diện dự án thông qua **360 Smart Router** chạy ngầm ở sự kiện `SessionStart`:
*   **Auto-Update**: Tự động chạy `git pull upstream main` ngầm tại `/Volumes/DATA/DEV/aiac` để cập nhật ECC core mới nhất.
*   **Auto Project Config**: Tự động tạo thư mục `.claude/` và ghi 2 file cấu hình cục bộ trong từng project:
    *   `[project]/.claude/settings.local.json`: Lưu cấu hình, custom instructions riêng của project.
    *   `[project]/.claude/CLAUDE.md`: Lưu chỉ dẫn nhanh và rules cục bộ của project.
*   **Auto Skill Inject**: Tự động nạp prompt ngầm từ các skill tương ứng dưới đây dựa trên loại project mà Sếp không cần gõ lệnh. (Bao gồm `360-wordpress`, `360-odoo`, `360-flutter`...)
*   **Auto Dynamic Scope & Quyền Truy Cập Repo Ngoại Vi (BẮT BUỘC)**:
*   **Luật Nhận Diện Ngữ Cảnh Thư Mục Hiện Tại (Context-Aware Workspace - BẮT BUỘC)**:
    - **Ưu tiên Current Workspace**: Mọi thao tác (đọc/ghi, search, chạy script) mặc định phải ưu tiên nhắm vào Current Workspace (thư mục đang đứng).
    - **Luật Kéo Thả (Drag & Drop) = Cấp Quyền Truy Xuất**: Khi Sếp kéo thả một folder vào khung chat, điều đó đồng nghĩa với việc Sếp cấp quyền truy xuất trực tiếp vào folder đó. AI không được hỏi lại, không được từ chối vì lý do scope, mà phải coi folder vừa kéo thả là vùng làm việc hợp lệ và truy xuất ngay.
    - Khi bắt đầu làm việc hoặc mở window/tab mới, AI **BẮT BUỘC** phải đọc kỹ khối `<Environment>` trong `system-reminder` để biết chính xác mình ĐANG Ở ĐÂU (`Primary working directory`).
    - **TUYỆT ĐỐI CẤM** hỏi Sếp những câu ngớ ngẩn như "Thư mục dự án của Sếp nằm ở đâu ạ?" hoặc "Sếp cho em xin đường dẫn...". Hệ thống đã cấp sẵn cwd rồi, tự nhận diện mà làm.
    - Trong mọi lệnh Bash (nhất là `git`, `npm`, `odoo`, `python`), **BẮT BUỘC** phải `cd` vào đúng thư mục đích hoặc dùng cờ chỉ định (vd: `git -C <path>`) trước khi chạy lệnh. Không được chạy mù mờ từ thư mục gốc rồi báo lỗi lệnh không tồn tại.
    *   Mặc định hệ thống chặn truy cập lan man hoặc scan ngang `/Volumes/DATA/DEV/*`.
    *   **Ngoại lệ Toàn Cầu (Global AIaC Whitelist)**: Thư mục nguồn **AIaC Root** (`/Volumes/DATA/DEV/aiac/*` hoặc `[aiac_root]/*`) **LUÔN ĐƯỢC PHÉP TRUY CẬP & ĐỌC ĐẦY ĐỦ TRONG MỌI TRƯỜNG HỢP** để tra cứu rule, skill, plugin, MCP tools mà không bị chặn.
    *   **Quy tắc Khóa Thư Mục SKILL_SOURCES (BẢO VỆ TOKEN TUYỆT ĐỐI)**:
        - Thư mục `/Volumes/DATA/DEV/SKILL_SOURCES/` là kho lưu trữ và tham chiếu các nguồn skill/harness khổng lồ.
        - **CHỈ CHẶN WILDCARD GỐC (`SKILL_SOURCES/*`)**: Tuyệt đối CẤM đọc, quét hoặc cấp quyền wildcard toàn bộ thư mục `Read(/Volumes/DATA/DEV/SKILL_SOURCES/*)` gây lãng phí hàng triệu token.
        - **LUÔN CHO PHÉP NET PATH ĐÍCH DANH (`SKILL_SOURCES/abc_repo/*`)**: Khi Sếp yêu cầu học hỏi, phân tích hoặc tham khảo bất kỳ repo con nào trong `SKILL_SOURCES`, AI **ĐƯỢC PHÉP ĐẦY ĐỦ** tự động thêm quyền và đọc trực tiếp theo đúng **net path** đích danh của repo đó (VD: `/Volumes/DATA/DEV/SKILL_SOURCES/deepseek-harness/*`, `/Volumes/DATA/DEV/SKILL_SOURCES/DeepSeek-Reasonix/*`, `/Volumes/DATA/DEV/SKILL_SOURCES/learn-claude-code/*`, `/Volumes/DATA/DEV/SKILL_SOURCES/abc_repo/*`). **TUYỆT ĐỐI KHÔNG BAN HAY CHẶN CÁC NET PATH CON NÀY**.
    *   Khi Sếp yêu cầu đọc, phân tích, tham khảo hoặc thao tác trên bất kỳ repository ngoại vi nào khác (VD: `em vào đọc repo /Volumes/DATA/DEV/[repo-name]`), AI **BẮT BUỘC PHẢI TỰ ĐỘNG** bổ sung đường dẫn repo đó vào `permissions.allow` và `permissions.additionalDirectories` trong `.claude/settings.local.json` của project hiện tại trước khi gọi tool đọc/ghi.
    *   **Luật Kéo Thả Folder = Tự Động Cấp Quyền Vĩnh Viễn (Drag & Drop Grants Scope — BẮT BUỘC, KHÔNG HỎI LẠI)**: Khi Sếp **kéo thả thư mục vào khung chat** (hoặc đề cập đích danh dạng `@"/đường/dẫn/folder/"`), hành động đó **mặc định ĐÃ LÀ SỰ ĐỒNG Ý** cấp quyền cho toàn bộ `folder/*`. AI **BẮT BUỘC NGAY LẬP TỨC** (trước khi gọi tool đọc đầu tiên) ghi đường dẫn đó vào `permissions.additionalDirectories` **VÀ** `allowedWorkspaces` trong `[project]/.claude/settings.local.json`. **Nghiêm cấm** hỏi lại Sếp xin phép lần thứ hai cho cùng thư mục đã kéo thả.
    *   Mọi đường dẫn có mặt trong `permissions.additionalDirectories` của `.claude/settings.local.json` sẽ được cấp quyền đầy đủ (Full Action: Read, Write, Edit, Bash) đối với toàn bộ cây thư mục con của repo đó.
*   **Auto Session Continuity**: Tự động ghi lại tiến độ phiên qua hook `Stop` / `PreCompact` và tự nạp tóm tắt phiên trước (`### Trạng thái phiên trước`) vào ngữ cảnh khi mở lại dự án.
*   **Quy tắc Điều hướng Mã nguồn Chuẩn 3 Lớp (BẮT BUỘC CHỐNG ĐỌC MÒ FILE)**:
    - Khi làm việc trên bất kỳ codebase nào đã có Code Knowledge Graph (`graphify-out/graph.json` hoặc MCP Server `graphify` như VuaOffice, VCloud, Odoo...):
      1. **Bước 1 (Suy luận)**: Phân tích yêu cầu, xác định các Symbol, Class, Function, API Route, Component liên quan.
      2. **Bước 2 (Tra cứu Đồ thị Tức thì)**: Gọi MCP `graphify` hoặc CLI `/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh` (`affected`, `query`, `path`, `god-nodes`) để lấy toạ độ chính xác `file_path:line` và quét trọn vẹn caller/callee.
      3. **Bước 3 (Thao tác Đích danh)**: Chỉ mở (`Read`) và sửa (`Edit`) DUY NHẤT các file & dòng đã định vị.
    - **Nghiêm cấm tuyệt đối**: Không đoán mò đường dẫn file, không quét tuần tự/đọc toàn bộ thư mục bằng `Read` hoặc `Grep` gây lãng phí token và thời gian.
*   **Lệnh Điều Khiển Trạng Thái Thủ Công (Khi Sếp cần can thiệp chủ động)**:
    *   `/save-session`: Chủ động lưu tóm tắt những gì vừa làm, lỗi gặp phải, và việc kế tiếp vào session data.
    *   `/resume-session [date]`: Nạp lại chi tiết toàn bộ bối cảnh phiên làm việc trước đó.
    *   `/sessions [list|load|alias]`: Quản lý danh mục các session làm việc đa dự án, worktree, branch.
    *   `/checkpoint [create|verify]`: Tạo mốc git stash/commit kiểm chứng quy trình làm việc.

---

## 3. Phân loại dự án & Bản đồ Kỹ năng (360org)

**Quy tắc phân biệt cứng (BẮT BUỘC tuân thủ):**

| Trigger Phrase (Từ khóa kích hoạt) | Skill load ngầm | Loại dự án |
|---|---|---|
| Mở thư mục có `__manifest__.py`, `odoo-bin` hoặc Sếp nói "**start odoo project** ...", "**init odoo project** ...", "**odoo module** ...", "**odoo hệ thống** ..." | `360org/plugins/360-odoo/prompts/SKILL.md` (odoo-dev-skills) | Odoo v14–v19 |
| Dự án **VCloud** (Flutter Mobile Client `vcloud` vs Odoo API Backend `v_mobile`) (trigger: "vcloud", "v_mobile", "vcloud mobile", "deploy vcloud", "release vcloud") | `360org/plugins/360-vcloud/prompts/SKILL.md` (360-vcloud) | Phân định Deployment VCloud Mobile App (TestFlight/AppStore) vs v_mobile (Odoo Backend SaaS) |
| Dự án **VuaOffice** suite (trigger: "vuaoffice", "vuaoffice dev", "vuaoffice build", "release vuaoffice") | `360-vuaoffice` | Electron Suite VuaOffice |
| Website hệ sinh thái **360 CORP** / **vuaai.net** / marketing site **Payload CMS 3.x + Next.js** deploy CloudPanel (trigger: "vuaai-payload-website-skills", "vuaai website", "payload website", "dev payload", "payload cms", "website 360 corp", "payload cms marketing site", "build landing page vuaai", "deploy cloudpanel payload") | `360org/plugins/360-payload-website/prompts/SKILL.md` (360-payload-website) | Payload + Next.js marketing site (kế thừa 360-dev-workflow) |
| Hệ sinh thái **360 CORP** & **VuaAI Gateway**, API routing, CloudPanel messaging gateway (trigger: "openclaw", "vuaai gateway", "360 gateway", "openclaw gateway") | `360org/plugins/360-openclaw/prompts/SKILL.md` (360-openclaw) | Gateway Engine & Ecosystem Routing |
| Dự án cần quản lý git song song GitLab (Private) + GitHub (Public) (trigger: "sync gitlab github", "sync repo gitlab", "sync github gitlab", "sync code sang github") | `360org/plugins/360-gitsync/prompts/SKILL.md` (git-sync-skills) | Quản lý & Sync repo GitLab/GitHub |
| Yêu cầu tạo/dựng env dev Docker Odoo cô lập cho client, migrate đa version, dải 99 ports, auto backup DB & GitLab ("build up [client]", "build cho anh project migrade", "upgraded version 19.0 của [client]", "shutdown [client]") | `360org/plugins/360-local-builder-env/prompts/SKILL.md` (360-local-builder-env) | Multi-Tenant Odoo Docker Dev & Migration Orchestrator (99-port dynamic, auto GitLab backup) |
| Khi Sếp gửi link app (VD: `/Applications/[App].app`), hoặc yêu cầu "học từ [App]", "dịch ngược [App]", "viết lại tính năng từ [App]" | `360org/plugins/360-desktop-reverse/prompts/SKILL.md` (360-desktop-reverse) | Reverse Engineering & Tái hiện tính năng Desktop App |
| Khi kiểm thử app trên thiết bị (iOS Simulator, Android Emulator, macOS Desktop, device thật), hoặc tự động hoá UI (trigger: "agent-device", "device test", "test trên simulator", "test trên emulator", "ios simulator", "android emulator", "mobile test", "app automation", "dùng device test") | `360org/plugins/360-agent-device/prompts/SKILL.md` (360-agent-device) | Device Automation & App Verification for AI Agents (Callstack agent-device) |
| Dự án cần trích xuất Code Knowledge Graph, AST Index hoặc tra cứu quan hệ gọi hàm/caller/callee ("graphify", "index code", "ast index", "deep graph") | `360org/plugins/360-graphify/prompts/SKILL.md` (360-graphify) | Code Knowledge Graph & AST Semantic Indexer |
| Dự án phát triển Agentic Harness, điều phối Agent Loop, Resumable Workflow, Context Compaction, Goal Gates & Tự học/Tự tối ưu kỹ năng AutoHarness (trigger: "harness", "agent harness", "build harness", "agent loop", "reasonix", "deepseek harness", "autoharness", "tự học skill", "/learn") | `360org/plugins/360-harness/prompts/SKILL.md` (360-harness) | Agentic Harness Architecture & Self-Learning Engine (DeepSeek-Harness + Reasonix + Learn-Claude-Code + AutoHarness) |
| Mở project có `pubspec.yaml` hoặc Sếp phát triển ứng dụng di động Flutter / Dart | `360org/plugins/360-flutter/prompts/SKILL.md` | Flutter / Mobile |
| Mở project có `plugin.yaml` và `hermes-dev-skills` hoặc Sếp phát triển hệ thống Hermes | `360org/plugins/360-hermes/prompts/SKILL.md` | Hermes |
| Các câu lệnh "**dùng agent skills** ...", "**agent skills cho project** ...", "**init project** ..." (không nhắc Odoo), "**start project** ..." | `360-dev-workflow` (ECC Core) | Web (Next.js, Nuxt, Astro), mobile (RN, Flutter), SaaS, CLI, lib, marketing site... |

### Quy trình 9 bước & Phân bổ Model (Áp dụng cho mọi Project mới)
*   **Workflow 9 bước**: `/idea ➜ /req ➜ /spec ➜ /plan ➜ /build ➜ /code-review ➜ /test ➜ /review ➜ /ship`
*   **`/code-review` là CỔNG CHẶN BẮT BUỘC giữa `/build` và `/test`**: sau khi Coder sinh code, **BẮT BUỘC** một model khác (Claude/Codex, không phải model đã `/build`) đọc đúng `git diff` vừa sinh và soi 4 trục — **correctness** (logic sai, null, race, error handling mất dữ liệu) / **reuse** (viết lại thứ codebase đã có) / **over-engineering** (abstraction 1 implementation, config cho giá trị không đổi) / **security & validation tại trust boundary**. Còn finding Critical/High chưa xử lý thì **CẤM** sang `/test`. Trần 3 vòng fix→re-review; quá 3 vòng là dấu hiệu SPEC sai, escalate về Architect. Bước này chỉ đọc code, **không chạy test và không viết test**. Chi tiết: `/Volumes/DATA/DEV/aiac/360org/plugins/360-dev-workflow/prompts/references/multi-agent-orchestration.md`
*   **Cấu trúc Phân bổ Tài liệu Chuẩn (AIaC 3.0 Mandatory Docs Structure)**:
    - **Tại thư mục Root của Project/Module**:
      * `README.md` (PO/AI viết, tổng quan dự án & cấu trúc cây thư mục).
      * `AGENTS.md` (Quy chuẩn điều phối Multi-Agent & nhiệm vụ các roles).
      * `.claude/` (Chỉ dẫn AIaC & Rules riêng).
      * Với **Odoo Module**: Bắt buộc tóm tắt Changelogs phiên bản trong trường `description` của `__manifest__.py` theo đúng cấu trúc chuẩn:
        ```python
        'description': """
Module Title — Changelog
========================

v<version> (YYYY-MM-DD)
-----------------------
- [TAG] Nội dung thay đổi (TAG gồm: [MIGRATE], [NEW], [FIX], [IMPROVE], [SECURITY], [REFACTOR]).
        """,
        ```
    - **Tất cả các tài liệu chi tiết BẮT BUỘC nằm trong thư mục `docs/*`**:
      * `docs/IDEA.md` (PO viết: bối cảnh, bài toán, ý tưởng cốt lõi).
      * `docs/REQUIREMENTS.md` (AI sinh, PO duyệt: FR & NFR).
      * `docs/SPEC.md` (AI sinh, PO duyệt: Data models, APIs/RPC, Frontend components).
      * `docs/ARCH.md` (Kiến trúc hệ thống, sơ đồ luồng dữ liệu).
      * `docs/DEPLOY_GUIDE.md` (Hướng dẫn triển khai, cài đặt, cấu hình sau cài).
      * `docs/CHANGELOGS.md` (Lịch sử thay đổi chi tiết các phiên bản).
      * `docs/AUDIT_ROADMAP.md` (Roadmap checklist kiểm duyệt và bàn giao).
*   **Quy tắc Cập nhật Docs Trước khi Commit/Push Remote (BẮT BUỘC TOÀN CẦU CHO MỌI DEV SKILLS)**:
    - **Trigger bắt buộc trước khi Git Push**: Trước BẤT KỲ thao tác commit hoặc push code lên remote repository (GitLab/GitHub) trong MỌI loại dự án (Odoo, Flutter, Web/Next.js, Hermes, Tauri, CLI, Mobile, SaaS...), AI **BẮT BUỘC PHẢI TỰ ĐỘNG TRIGGER** bước rà soát và cập nhật đồng bộ toàn bộ file tài liệu `*.md` liên quan trong `docs/` (`docs/CHANGELOGS.md`, `docs/ARCH.md`, `docs/SPEC.md`, `docs/REQUIREMENTS.md`, `README.md`, `docs/DEPLOY_GUIDE.md`...).
    - **Nội dung đồng bộ**: Phản ánh chính xác 100% tính năng mới thêm, bug fix, thay đổi cấu trúc dữ liệu/API, version tag mới và hướng dẫn triển khai.
    - **Nghiêm cấm tuyệt đối**: Không được phép commit/push mã nguồn đơn lẻ mà bỏ qua hoặc ăn bớt bước cập nhật tài liệu `*.md`.
*   **Quy trình Đồng bộ Version & Release (BẮT BUỘC TOÀN DIỆN)**:
    - Khi nâng cấp phiên bản hệ thống hoặc dự án (`v<x>.<y>.<z>`), AI **BẮT BUỘC ĐỒNG BỘ 100%** qua 6 điểm then chốt:
      1. **File Version Core**: Cập nhật `VERSION`, `package.json`, `package-lock.json` (hoặc `pubspec.yaml`, `__manifest__.py`, `Cargo.toml` tùy loại dự án). Luôn chạy script đồng bộ chuẩn: `node scripts/aiac/sync-version.js`.
      2. **Changelogs Chi Tiết**: Ghi rõ mục phiên bản mới trong `docs/CHANGELOGS.md` (hoặc `__manifest__.py` đối với Odoo) kèm ngày tháng `(YYYY-MM-DD)` và các tag `[TAG]` (`[NEW]`, `[FIX]`, `[IMPROVE]`, `[SECURITY]`, `[REFACTOR]`).
      3. **Telemetry & Dashboard (AIaC Performance Pro)**: Bắt buộc đọc động trực tiếp từ `VERSION` qua hàm `getCurrentVersion()`, không hardcode chuỗi phiên bản cũ trong server hay giao diện HTML; tự động phát hiện toàn diện 100% Core Plugins và System Skills (`skills/*`); đồng thời reload daemon port 3600 sau khi update core.
      4. **Tài Liệu Hướng Dẫn**: Rà soát cập nhật `README.md`, `docs/DEPLOY_GUIDE.md`, `docs/AUDIT_ROADMAP.md` nếu có thay đổi kiến trúc hoặc tính năng mới.
      5. **Git Commit Chuẩn**: Commit với format `chore: release <Project/AIaC> v<version>` hoặc `feat(...)` / `fix(...)` kèm trailer `Authored-By: 360org <support@360.org.vn>`.
      6. **Git Release Tag**: Khi Sếp yêu cầu release, tạo git tag `v<version>` (VD: `git tag -a v3.7.3 -m "Release v3.7.3"`) và push tag lên GitLab (`git push origin v<version>`).
*   **Model Assignment**:
    *   **Claude/Codex** cho `/req`, `/spec`, `/plan`, `/code-review`, `/review` (PLAN & ANALYSIS)
    *   **Gemini** cho `/build`, `/test`, `/ship` (CODE & EXECUTION)

### Quy tắc kiểm thử trước khi báo cáo (BẮT BUỘC TOÀN CẦU)
*   Mọi nhiệm vụ có thay đổi code, cấu hình, giao diện hoặc triển khai phải được kiểm thử lặp lại trước khi báo cáo hoàn thành.
*   Tối thiểu **10 case kiểm thử độc lập** cho mỗi nhiệm vụ; phải bao phủ luồng chính, dữ liệu biên, lỗi/validation, responsive hoặc môi trường liên quan và hồi quy phần đã sửa.
*   Chỉ được báo cáo “đã hoàn thành” khi các case bắt buộc đều đạt. Nếu môi trường, dependency, secret hoặc dịch vụ thật chưa sẵn sàng, phải báo rõ trạng thái **chưa xác minh/đang bị chặn**, không suy diễn là đã pass.
*   Báo cáo cuối phải ghi ngắn gọn danh sách hoặc nhóm các case đã chạy, kết quả từng nhóm, lệnh/công cụ và lỗi còn tồn tại (nếu có). Không tính việc đọc code hay kiểm tra syntax đơn lẻ thay cho kiểm thử hành vi.

---

## 4. Quy tắc kỹ thuật cốt lõi (Áp dụng song song Ponytail)

### Ponytail Rules (BẮT BUỘC áp dụng cho MỌI sản phẩm code)
*   **Nguồn**: `360org/plugins/360-ponytail/` trong repo AIaC (sau khi cài trên máy Sếp: `/Volumes/DATA/ENV/.claude/360org/plugins/360-ponytail/`; máy khác fallback `~/.claude/360org/plugins/360-ponytail/`)
*   **Cài đặt thực tế**: Để bật slash-commands `/ponytail`, `/ponytail-review`, `/ponytail-audit` trong phiên tương tác, chạy:
    ```bash
    /plugin marketplace add /Volumes/DATA/ENV/.claude/360org/plugins/360-ponytail
    /plugin install ponytail@ponytail
    ```
*   **Nguyên tắc Leo thang (Climb the ladder)**:
    1.  Có thực sự cần build cái này không? (YAGNI)
    2.  Đã có sẵn trong codebase chưa? Tái sử dụng helper/util/pattern cũ, không viết lại.
    3.  Standard library đã làm được chưa? Dùng nó.
    4.  Native platform feature có cover không? (CSS hơn JS, DB constraint hơn app code).
    5.  Dependency đã cài sẵn có giải quyết được không? Dùng nó, không thêm dependency mới.
    6.  Có thể gói gọn 1 dòng không? Làm 1 dòng.
    7.  Chỉ khi không nấc nào ở trên đủ: viết code tối thiểu để chạy đúng.
*   **Quy tắc Code**:
    - Không thêm abstraction nếu không yêu cầu rõ ràng. Không boilerplate thừa. Xoá ưu tiên hơn thêm. Ít file nhất có thể.
    - Diff ngắn nhất thắng — nhưng chỉ sau khi đã hiểu đúng vấn đề (trace luồng thật trước khi chọn nấc).
    - Bug fix = sửa root cause, không phải symptom: grep hết caller của hàm bị sửa, fix chung 1 chỗ thay vì vá từng nơi.
    - Đơn giản hoá có chủ đích phải đánh dấu bằng comment `ponytail:` nêu rõ giới hạn (global lock, O(n²), heuristic thô...) và hướng nâng cấp sau này.
    - Logic không tầm thường phải để lại ít nhất 1 check chạy được (assert-based self-check hoặc one small test file; không framework/fixture).

### Odoo Projects (v14-v19)
*   **Standard**: Python 3.10+, PostgreSQL 12+.
*   **XML**: **Loại bỏ hoàn toàn `attrs=`**. Dùng trực tiếp `invisible="..."`, `readonly="..."`, `required="..."`.
*   **ORM**: Khai báo `models.Constraint()` và `models.Index()` thay vì `_sql_constraints`/`index=True` kiểu cũ. Toán tử ORM mới: `any!` / `not any!`.
*   **Mail, Chatter & Quy Chuẩn Tạo/Cập Nhật Task Trên `vuahethong.net` (BẮT BUỘC ĐẦY ĐỦ THÔNG TIN, CẤM LÀM CHO CÓ)**:
    - Khi đăng thông báo, comment hoặc update ghi chú vào chatter qua `message_post()` hay ORM `mail.message`: Bắt buộc dùng `from markupsafe import Markup` và bọc nội dung HTML bằng `Markup(html_str)`. Tuyệt đối **KHÔNG** truyền raw string chứa HTML trực tiếp vào `body` làm Odoo tự động escape entity khiến UI hiển thị lộ rõ các thẻ `<p>`, `<ul>`, `<li>`, `<code>` cho người dùng.
    - **Quy Chuẩn Tạo/Cập Nhật Task (`project.task`) ĐẦY ĐỦ 100%**: Khi được yêu cầu tạo hoặc update task trên `vuahethong.net`, AI **BẮT BUỘC ĐIỀN ĐẦY ĐỦ CÁC TRƯỜNG THÔNG TIN**, tuyệt đối không cập nhật hời hợt:
      1. **Assignee (`user_ids`)**: Gán đích danh nhân viên phụ trách kỹ thuật/nghiệp vụ.
      2. **Allocated Time (`allocated_hours`)**: Bắt buộc dự toán thời lượng xử lý (VD: `2.0 giờ`, `4.0 giờ`...), tuyệt đối không để trống `00:00 (0%)`.
      3. **Deadline (`date_deadline`)**: Thiết lập hạn chót hoàn thành cụ thể dựa trên độ ưu tiên (trong ngày hoặc ngày kế tiếp).
      4. **Tags / Labels (`tag_ids`)**: Gắn đầy đủ tag phân loại chuẩn (VD: `Kỹ thuật`, `Fixed Issues`, `New Feature`, `Internal Work`...).
      5. **Milestone (`milestone_id`)**: Gán đúng milestone của dự án nếu project có cấu hình cột mốc.
      6. **Activity giao việc (`mail.activity`)**: **BẮT BUỘC** lên lịch Activity giao việc (`To Do` hoặc loại phù hợp) assign trực tiếp cho nhân viên phụ trách, tóm tắt rõ việc cần làm (`summary`), hướng dẫn chi tiết (`note`), và đặt `date_deadline` đồng bộ để nhân sự nhận được thông báo nhắc việc trên Odoo.
      7. **Description chi tiết**: Trình bày rõ ràng 4 mục: Mô tả sự vụ / Traceback log chi tiết / Nguyên nhân gốc rễ (Root Cause) / Hướng giải quyết đề xuất.
      8. **Ghi nhận Timesheet (`account.analytic.line`)**: Mọi báo cáo hoàn thành/cập nhật tiến độ task **BẮT BUỘC** phải ghi rõ số giờ thực hiện (VD: `1.5 giờ`) và tạo dòng Timesheet tương ứng vào task.
*   **Scripts hỗ trợ**:
    - `360org/scripts/odoo/odoo_generator.py` — scaffold module
    - `360org/scripts/odoo/odoo_linter.py` — kiểm tra chuẩn code Odoo theo version
    - `360org/scripts/odoo/token_killer_proxy.py` — proxy lọc log tiết kiệm token khi chạy odoo-bin/docker logs
    - `360org/scripts/odoo/odoo_graph_mcp.py` — MCP server phân tích DB schema/relations (bắt buộc dùng khi design model phức tạp)
    - `360org/scripts/odoo/git_cleaner.py` — dọn code trước khi push lên 2 nhánh `version` / `version-dev`

### V-Assistant (Tauri App macOS)
*   **Zero-Docker**: Không dùng Docker/webview preview làm bằng chứng verify.
*   **Test native**: Chạy app native bằng `npm run tauri dev`, thao tác trực tiếp trong app macOS. Bản cài thật test qua `npm run build:local` và mở `/Applications/V Assistant.app`.
*   **Git workflow**: Dùng branch riêng cho mỗi tính năng/fix; không commit thẳng lên `main`. Mọi thay đổi: `branch → sửa → verify/test → commit → merge vào main → push`. Chỉ merge sau khi test pass trên app macOS thật.

### Flutter Projects
*   Thiết kế Clean Architecture (Data, Domain, Presentation).
*   Tránh bang operator (`!`), check `context.mounted` sau `await` trong widget/State.
*   Widget architecture: Chia nhỏ widget class, dùng const triệt để.

---

## 5. Hạ tầng Server, Git Remote Policy & An toàn dữ liệu Odoo SaaS (BẮT BUỘC)

### Git & Remote Policy (GitLab vs GitHub & On-Demand Release)
*   **Commit lên `main` KHÔNG tự động build release**: Commit code đẩy lên `main` chỉ lưu lịch sử mã nguồn, không trigger build release installer. Quy trình release chỉ kích hoạt khi Sếp **yêu cầu release** bằng cách push release tag `v*` (Tag ➔ Release Publish).
*   **Mặc định CHỈ Push & Tạo Repo trên GitLab (`origin`)**: Mọi dự án, skill, module mới khi khởi tạo hoặc commit mặc định CHỈ lưu/push trên **GitLab** (private repository).
*   **KHÔNG tự ý tạo Repo hay Push sang GitHub**: Tuyệt đối **KHÔNG** tự động tạo repo public trên GitHub hay push mirror sang GitHub trừ khi Sếp **yêu cầu rõ ràng** trong câu lệnh (VD: *"push sang github"*, *"tạo repo github public cho anh"*).
*   **Vị trí Tools & Scripts Chuẩn (BẮT BUỘC CHỈ GỌI TRONG AIAC)**:
    - Mọi tools, scripts tự động hóa, sync repository hoặc utilities BẮT BUỘC chỉ được gọi từ hệ thống **AIaC** (`/Volumes/DATA/DEV/aiac/360org/...` hoặc `/Volumes/DATA/ENV/.claude/360org/...`).
    - **Nghiêm cấm tuyệt đối**: Không được phép gọi tool/script hoặc trỏ đường dẫn vào thư mục `/Volumes/DATA/DEV/SKILLS/*` (thư mục này đã bị cấm và chặn hoàn toàn).
    - Khi Sếp yêu cầu push/sync sang GitHub: BẮT BUỘC gọi script chuẩn trong AIaC: `/Volumes/DATA/DEV/aiac/360org/plugins/360-gitsync/scripts/git-sync-publish.sh` để loại bỏ file nhạy cảm theo `.githubignore`.


### Kết nối server qua SSH alias & Định Vị Môi Trường Chuẩn (LUẬT CỨNG BẮT BUỘC)
*   **local**: **Máy Mac (iMac) của Sếp** (`/Volumes/DATA/...`, macOS). Khi Sếp nói "local", "trên local", "dưới local" nghĩa là máy Mac của Sếp.
*   **local server**: **Local Server nội bộ (`192.168.1.100`, user `root`, alias `ssh local`)**. Khi Sếp nhắc "Local Server", "server local", "máy chủ local", đường dẫn dữ liệu là `/mnt/DATA/work/<client-name>/` (VD: `/mnt/DATA/work/salemoptical.vn/`). Tuyệt đối KHÔNG nhầm lẫn với máy Mac (`local`) của Sếp.
*   **production server**: **Server Production Vua Hệ Thống (`ssh vuahethong`)** và cụm Rancher / Kubernetes cluster `saas`. Khi Sếp nói "production server", "server production" là máy chủ chạy live hệ thống khách hàng.
*   **cloudpanel**: Dùng cho CloudPanel, WordPress, Hermes, OpenClaw, 9router, Redis AGB (`ssh cloudpanel`).
*   **Rancher / Kubernetes — cluster `saas`**:
    - Mọi lệnh `kubectl` phải chạy từ iMac local với context `saas`; không chạy `kubectl` sau khi SSH vào `vuahethong`.
    - Mỗi khách hàng dùng một namespace, gồm pod `<namespace>-deploy-odoo-*`, `<namespace>-deploy-postgres-*` và service tương ứng.

### Quy Chuẩn Lệnh & Thuật Ngữ Odoo Upgrade Platform (upgrade.odoo.com)
*   **"test db" / "upgrade test"**: Chạy lệnh nâng cấp ở chế độ `test`:
    ```bash
    yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) test -i <dump_file> -c <contract_key> -t <target_version> -x
    ```
    *Database trả về là dạng test: Odoo tự động kích hoạt neutralization, chèn ruy-băng `TEST` (`__upgrade__.upg_test_ribbon`), vô hiệu hoá mail/cron để an toàn khi test trên local server.*
*   **"upgrade production" / "production db"**: Chạy lệnh nâng cấp ở chế độ `production`:
    ```bash
    yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) production -i <dump_file> -c <contract_key> -t <target_version> -x
    ```
    *Database trả về là bản Production hoàn chỉnh: không bị neutralize, không có ribbon TEST, sẵn sàng đưa lên production server.*

### 4. Quy chuẩn Layout & Giao diện Backend & Frontend Website Odoo (BẮT BUỘC)
*   **Tuân thủ 100% Core Layout Odoo Backend**: Toàn bộ Form view, Tree/List view, Kanban view, Dashboard OWL component bắt buộc áp dụng cấu trúc HTML/XML và CSS class chuẩn của Odoo Core (như benchmark chuẩn `purchase_dashboard.xml`).
*   **Không tự ý sáng tạo layout**: Nghiêm cấm tự thiết kế custom UI/card trôi nổi ngoài quy chuẩn Odoo.
*   **Màu sắc thương hiệu & Phong cách Thiết kế (BẮT BUỘC 360 CORP)**:
    - **2 màu chủ đạo chuẩn của 360 CORP**:
      * **Xanh dương Công nghệ (Tech Royal Blue)**: `#0077cd` (Primary brand color, các nút hành động chính, active state, header accents, link).
      * **Xanh lá Chuyển đổi số (Digital Green)**: `#00ce2c` (Accent, verified badge, success state, highlight, call-to-action).
    - **Phong cách Thiết kế UI/UX**:
      * **Công nghệ, hiện đại, Clean & Flat Design**: Tuyệt đối không dùng các màu tự chế xỉn màu, xanh rêu u tối, vàng úa hay màu pastel nhờ nhờ thiếu sức sống.
      * **Độ tương phản Font sắc nét (High Contrast)**: Màu font so với màu nền phải cực kỳ rõ nét (chữ chính dùng Slate 900 `#0f172a`, văn bản mô tả dùng Slate 800/700 `#1e293b`/`#334155`, cấm dùng xám mờ gây khó đọc).
      * **Hệ thống Theme Odoo/Web**: Tích hợp chuẩn qua biến SCSS và Bootstrap theme (`$o-brand-primary: #0077cd;`, `$o-brand-odoo: #00ce2c;`, `btn-primary`, CSS variables `--c360-primary: #0077cd; --c360-success: #00ce2c;`).
      * Không phá vỡ hierarchy, spacing chuẩn của Core Odoo nhưng phải đạt chất lượng thẩm mỹ công nghệ cao cấp.
*   **Quy chuẩn Thiết kế Website Builder & Snippet Blocks (CHỐNG LỖI "This block is outdated")**:
    - Mọi trang (`website.page`), landing page, bài viết, template giao diện tạo mới hoặc chỉnh sửa **BẮT BUỘC 100%** sử dụng cấu trúc HTML snippet chuẩn của Odoo 17 (`s_cover`, `s_features`, `s_comparisons`, `s_call_to_action`, `s_faq_collapse`, `s_three_columns`, `s_numbers`, `s_text_image`, `s_image_text`...).
    - Khung bao ngoài của từng block phải chứa đầy đủ `class="... o_colored_level"`, `data-snippet="..."`, `data-name="..."` chuẩn của Odoo Core.
    - Tuyệt đối **KHÔNG** tự bọc thẻ `<div>` hay `<section>` tùy tiện với custom class lạ phá vỡ registry snippet options của Odoo khiến xuất hiện cảnh báo *"THIS BLOCK IS OUTDATED. You might not be able to customize it anymore"*.
    - Mọi button CTA phải giữ nguyên class Bootstrap/Odoo chuẩn (`btn btn-primary`, `btn btn-outline-primary`, `btn-lg`, `flat`, `rounded-circle`...) và các data attribute (`data-bs-toggle`, `data-require-login`) để thanh thuộc tính Button Options (LinkTools) trong Website Builder hoạt động đầy đủ.
    - Cơ chế Lead / Campaign cho nhân viên: Sử dụng native `link.tracker` và `utm.campaign` chuẩn của Odoo (nhân viên tạo link download gắn campaign phụ trách từ backend rồi gắn vào button/link trên trang), không viết custom code phức tạp đi ngược luồng chuẩn Odoo.
*   **Quy trình BẮT BUỘC Xóa Cache & Re-generate Assets sau khi Tinh Chỉnh UI / QWeb Views**:
    - Sau khi cập nhật bất kỳ template giao diện (`website.page`, `ir.ui.view`, QWeb, CSS/SCSS), AI **BẮT BUỘC PHẢI TỰ ĐỘNG THỰC THI** lệnh xóa cache và dọn dẹp asset bundle cũ để đảm bảo giao diện mới được render ăn ngay lập tức:
      ```bash
      kubectl exec -n <namespace> <active-pod-name> --context saas -- python3 -c "import odoo; from odoo import api, SUPERUSER_ID; registry = odoo.registry('<dbname>'); \
      with registry.cursor() as cr: env = api.Environment(cr, SUPERUSER_ID, {}); registry.clear_cache(); \
      env['ir.attachment'].search(['|', ('url', '=like', '/web/assets/%'), ('url', '=like', '/web/content/%assets%')]).unlink()"
      ```

### Quy trình Chuẩn 6 Giai Đoạn Fix Bug & Upgrade Module Odoo SaaS (BẮT BUỘC TOÀN HỆ THỐNG)

Áp dụng bắt buộc cho toàn bộ các module Odoo phát triển trong hệ sinh thái 360 CORP (mọi khách hàng SaaS, không riêng gì Davita). Mọi quy trình fix bug hoặc nâng cấp tính năng BẮT BUỘC tuân thủ tuần tự 6 giai đoạn:

```
[Giai đoạn 0: Tiếp nhận, Phân tích & Ghi nhận Ticket trên vuahethong.net]
   ➔ [Giai đoạn 1: Fix Bug & Dev Test]
   ➔ [Giai đoạn 2: Commit & Push GitLab]
   ➔ [Giai đoạn 3: Pull/Deploy Local Server & Final Review]
   ➔ [Giai đoạn 4: Deploy Production Server & Backup DB (Zero-Downtime)]
   ➔ [Giai đoạn 5: Test Live, Kiểm Tra Log DB/Pod, Report & Đóng Ticket]
```

#### Giai đoạn 0: Tiếp Nhận, Phân Tích & Ghi Nhận Ticket (BẮT BUỘC TRƯỚC KHI ĐỘNG VÀO CODE)
1. **Bước 0.1 — Tiếp nhận & sắp xếp thông tin**: Thu đủ 5 mục (khách hàng + namespace + dbname + domain / hiện tượng / bằng chứng / phạm vi / mức độ P1-P3). Thiếu thì hỏi lại khách, không suy diễn.
2. **Bước 0.2 — Xác định đúng khách hàng đang lỗi**: Verify namespace thật qua `kubectl get ns --context saas`, đối chiếu domain trong ingress. Cấm đoán từ tên gọi tắt.
3. **Bước 0.3 — Phân tích sơ bộ & root cause giả định**: Đọc log đúng thời điểm (`kubectl logs --since=<N>h`), ghi traceback đầy đủ + module nghi vấn.
4. **Bước 0.4 — Tạo ticket/task đầy đủ 8 trường**: Login `vuahethong.net` qua API key (đọc từ `/Volumes/DATA/ENV/.env`, **cấm hardcode/commit key**). Điền đủ `user_ids`, `allocated_hours`, `date_deadline`, `tag_ids`, `milestone_id`, `mail.activity`, `description` 4 mục, `partner_id`. Ghi lại `ticket_id` cho Bước 12.

**Chi tiết kèm code XML-RPC (CANONICAL):** `/Volumes/DATA/DEV/aiac/360org/plugins/360-odoo/prompts/references/helpdesk-intake-and-reporting.md`

#### Giai đoạn 1: Fix Bug & Dev Test (Local Development)
1. Xác định root cause, viết/cập nhật code tối thiểu (áp dụng Ponytail, YAGNI, PostgreSQL Window Function khi xử lý batch lớn).
2. Viết/chạy unit tests (`odoo.tests`) hoặc assert-based self-check đảm bảo logic chạy đúng và pass 100%.

#### Giai đoạn 2: Commit & Push GitLab (Private Origin)
1. Tự động trigger cập nhật đồng bộ các file tài liệu liên quan trong `docs/` (`docs/CHANGELOGS.md`, `README.md`, `__manifest__.py` version & description changelogs).
2. Commit git với thông điệp rõ ràng kèm trailer chuẩn: `Authored-By: 360org <support@360.org.vn>`.
3. Push nhánh chính thức lên remote **GitLab** (`origin`).

#### Giai đoạn 3: Pull / Deploy Local Server & Final Review
1. Pull / đồng bộ mã nguồn đúng version/tag mới nhất về môi trường **Local Server** (`ssh local` - `192.168.1.100` tại `/mnt/DATA/work/<client-name>/`).
2. Khởi chạy và kiểm thử toàn diện (Final Review Test) trên giao diện thực tế của Local Server trước khi đưa lên Production.
3. Chỉ khi Final Review đạt chuẩn 100% mới được phép chuyển sang Giai đoạn 4.

#### Giai đoạn 4: Deploy Production Server & Backup DB (Zero-Downtime)
#### Giai đoạn 5: Post-Upgrade Verification, Check Log DB/Pod & Report

**Chi tiết đầy đủ (CANONICAL — nguồn chân lý duy nhất, KHÔNG nhân bản ở nơi khác):**
`/Volumes/DATA/DEV/aiac/360org/plugins/360-odoo/prompts/references/module-production-update.md`

File đó đặc tả trọn vẹn kèm lệnh thực thi cụ thể: đường dẫn addons chuẩn theo instance
(`modules/{default,extra,themes}` + `chown -R 101:101`), 6 nguyên tắc cốt lõi, và 10 mục thực thi —
xác nhận source, dò production read-only, backup DB + verify `pg_restore -l`, backup code đang chạy
(để rollback), package code sạch qua `git ls-files`, copy vào shared addon volume, update module
(`odoo -u --stop-after-init`) hoặc install module mới (`update_list` + `button_immediate_install`),
lưu ý bắt buộc khi thêm Model/Field mới (tránh lỗi OWL `"<model>"."<field>" is undefined`),
zero-downtime pod rotation (scale up → verify manifest → scale down/delete pod cũ),
verify production (HTTP + log scan) và Report.

**Bước 12 — Đóng Ticket & Ghi Timesheet (BẮT BUỘC):** Trên `ticket_id` tạo ở Bước 0.4 — tạo `account.analytic.line` ghi **số giờ thực tế** (cấm làm tròn khống), chuyển `stage_id` sang Done/Solved, post chatter kết quả bằng `Markup(...)` kèm root cause + commit sha + bằng chứng verify + thời gian thực hiện, và đóng `mail.activity` còn treo. Chi tiết: `references/helpdesk-intake-and-reporting.md`.

> ⚠️ **2 luật cứng về backup**: (1) Backup DB và backup code **BẮT BUỘC có 1 bản lưu về Local Server** theo client-name tại `/mnt/DATA/work/<client-name>/{db_backup,code_backup}/` — backup chỉ nằm trên pod/volume production là chưa đủ, pod chết là mất trắng. (2) Không dùng `kubectl rollout restart` cho production module update (gây downtime) — ưu tiên pod rotation.
