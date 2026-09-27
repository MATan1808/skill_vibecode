# SPECIFICATION — AI Infrastructure as Code (AIaC)

Đặc tả kỹ thuật AIaC: lớp mở rộng Claude Code, kế thừa ECC nhưng không ghi đè cấu hình cá nhân hoặc mã upstream.

---

## 1. Ranh giới sở hữu

| Thành phần | Chủ sở hữu | Quy tắc |
|---|---|---|
| ECC core | Upstream ECC | Cập nhật qua Git; AIaC không sửa luồng nội bộ để ép hoạt động. |
| `360org/**` | AIaC | Namespace duy nhất cho skill/script/rule đặc thù 360org. |
| `config/claude/settings.overlay.json` | AIaC | Chỉ khai báo hook AIaC. Không chứa secret, MCP, quyền, model hay plugin. |
| `~/.claude/settings.json` | Claude/Sếp | Merge idempotent; giữ key/array hiện có. |
| `~/.claude/settings.local.json` | Sếp | AIaC không đọc, sửa hoặc ghi đè. |
| `[project]/.claude/*` có sẵn | Project/Sếp | Router chỉ tạo file còn thiếu; không thay nội dung hiện hữu. |

## 2. Luồng SessionStart

1. Claude Code chạy SessionStart hook AIaC từ `settings.overlay.json`.
2. `360-smart-router.js` đọc stdin hook, nhận diện workspace bằng dấu hiệu file/đường dẫn.
3. Router tạo hồ sơ cục bộ nếu chưa có:
   - `.claude/settings.local.json` là JSON hợp lệ `{}`; không dùng field tự chế.
   - `.claude/CLAUDE.md` gồm rule cục bộ tối thiểu.
   - `.claude/aiac/PROJECT_PROFILE.md` ghi loại dự án/dấu hiệu/skill áp dụng.
   - Workspace chưa có skill tạo `.claude/aiac/SKILL_DISCOVERY.md` làm quy trình draft cục bộ.
4. Router sinh `360-agent-map` và codegraph đồng bộ ở lần đầu; cache quá một giờ mới làm mới nền.
5. Router gọi `session-start.js` của ECC nếu có, sau đó gộp `additionalContext` theo schema `hookSpecificOutput`.
6. Context AIaC bị giới hạn 4.200 ký tự, trong đó agent-map tối đa 1.600 ký tự và codegraph tối đa 900 ký tự. Skill chi tiết chỉ được mở khi yêu cầu thực tế phù hợp.

## 3. Agent Map và Codegraph

`360org/scripts/common/agent-map.py` quét bằng Python stdlib để tạo index nhẹ tại `.claude/aiac/index/`:

- `agent-map.md`: summary nạp vào SessionStart để chọn đúng file/symbol trước khi đọc sâu.
- `agent-map.json`: symbol class/function/component và tín hiệu domain.
- `domain-graph.json`: tín hiệu Odoo/WordPress/V-Assistant/Flutter/generic.
- `feature-map.json`: hotspot dẫn xuất, agent cập nhật sau thay đổi có ý nghĩa.
- `checksums.json`: checksum nguồn để biết map stale.

Parser mặc định bao phủ Python, JS/TS, Dart, PHP, Rust, XML và CSV bảo mật. Odoo nhận `_name`, `_inherit`, fields, route, XML record/menu, security CSV; WordPress nhận hook/shortcode/CPT/taxonomy/REST route; V-Assistant nhận React component, Tauri invoke và Rust command marker.

`360org/scripts/common/codegraph.js` quét các tệp JS/TS, Python và Dart, chỉ giữ import resolve được trong source tree:

- JS/TS: import/export/require tương đối.
- Python: import module nằm trong project và import tương đối.
- Dart: import tương đối hoặc `package:<tên-project>/` ánh xạ vào `lib/`.
- Bỏ qua dependency ngoài và thư mục build/cache/vendor.
- Sắp thứ tự xác định, loại cạnh trùng, mặc định hiển thị tối đa 40 cạnh; router yêu cầu tối đa 20 cạnh.
- Ghi `.claude/codegraph.md`; đây là cache để chọn tệp cần đọc, không thay thế phân tích mã nguồn.

### CodeGraph semantic (tùy chọn theo project)

`360-codegraph` dùng upstream CodeGraph v1.5.0 (MIT) cho nhu cầu vượt quá overview: AST/symbol/call graph, SQLite FTS5, impact, affected tests, framework-aware resolver và MCP `codegraph_explore`. AIaC ghim archive/checksum tại `config/codegraph/release.json`, tắt telemetry bằng `CODEGRAPH_TELEMETRY=0`, và không gọi installer upstream vì nó có thể ghi MCP, permission và prompt hook toàn cục.

Chỉ sau `codegraph init` thành công trên project và có nhu cầu structural query lặp lại mới merge project-local `.mcp.json` qua `scripts/aiac/merge-project-mcp.js`. Catalog tại `config/mcp/catalog.json` không chứa secret, không auto-allow wildcard MCP và không bật global MCP.

## 4. Học theo dự án và khám phá capability

ECC đã có session summary, observation, instinct và learned-skill lifecycle. AIaC sử dụng các cơ chế đó thay vì tạo hệ nhớ song song.

Với capability còn thiếu, agent phải:

1. Kiểm tra skill ECC và `360org` hiện có để tránh trùng lặp.
2. Đối chiếu `config/capabilities.manifest.json` để biết capability nào đã giữ/gộp/bỏ/reference-only.
3. Nghiên cứu tài liệu chính thức/nguồn đáng tin đúng stack khi có yêu cầu thực tế.
4. Ghi draft tại `[project]/.claude/aiac/discovered-skills/`; draft không được tự cài plugin, thay đổi quyền, thêm MCP hay chứa secret.
5. Chỉ đưa vào `360org/skills/360-<name>` sau khi đã dùng lại, kiểm chứng và audit trùng lặp.

## 5. Cập nhật AIaC/ECC

Router chỉ cố cập nhật khi `aiac-runtime.json` trỏ tới repo AIaC hợp lệ và worktree sạch:

1. Dùng lock tạm để tránh nhiều phiên cập nhật đồng thời.
2. `git fetch --quiet upstream main`.
3. Chỉ `git merge --ff-only upstream/main` trong tiến trình nền.
4. Nếu repo bẩn, không có upstream hoặc không fast-forward được thì không thay đổi gì.

Điều này không thay thế quy trình review/merge chính thức cho thay đổi xung đột hoặc tài sản 360org.

## 6. Kiểm thử tối thiểu

```bash
python3 tests/agent-map.test.py
```

```bash
node tests/codegraph.test.js
```

```bash
node tests/smart-router.test.js
```

```bash
node tests/wordpress-router.test.js
```

```bash
bash -n install-aiac.sh
```

```bash
node scripts/aiac/merge-claude-settings.js --target /đường/dẫn/settings.json --dry-run
```
