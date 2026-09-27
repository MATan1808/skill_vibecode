# Triển khai & sử dụng AIaC

AIaC được cài như lớp bổ sung cho Claude Code: kế thừa ECC và cấu hình có sẵn, không thay thế chúng.

## 1. Điều kiện

- macOS hoặc Linux; Node.js 18+ và Claude Code CLI.
- Clone AIaC có remote `upstream` trỏ ECC và `origin` trỏ GitLab của 360org.
- Không đặt secret trong repo, overlay hoặc project profile.

## 2. Cài đặt

```bash
git clone git@gitlab.com:360org/aiac.git ~/.360-aiac
```

```bash
cd ~/.360-aiac && ./install-aiac.sh
```

Installer thực hiện:

1. Chạy installer ECC theo profile hiện hữu của repo.
2. Đồng bộ **không `--delete`** riêng `360org/` vào `~/.claude/360org/`.
3. Đăng ký các skill `360-*` chỉ khi tên chưa được cấu hình bởi nội dung/link khác.
4. Backup Global `CLAUDE.md` hiện hữu một lần rồi liên kết đến `AIaC/CLAUDE.md`.
5. Merge idempotent `config/claude/settings.overlay.json` vào `~/.claude/settings.json`.
6. Ghi `~/.claude/360org/aiac-runtime.json` với đường dẫn clone hiện tại để Router tự nhận biết repo mà không hard-code đường dẫn máy.

AIaC không thay permissions, MCP, plugins, model, `skillOverrides`, `~/.claude/settings.local.json` hoặc file project-local đã có.

## 3. Kiểm tra trước/sau khi cài

```bash
bash -n install-aiac.sh
```

```bash
node scripts/aiac/merge-claude-settings.js --dry-run
```

```bash
python3 tests/agent-map.test.py && node tests/codegraph.test.js && node tests/smart-router.test.js && node tests/wordpress-router.test.js
```

```bash
node tests/mcp-catalog.test.js && node tests/sessionstart-live.test.js
```

```bash
node tests/lib/install-claude-skill-migration.test.js
```

Khi mở Claude Code trong project, Router tạo file còn thiếu:

```text
[project]/.claude/settings.local.json
[project]/.claude/CLAUDE.md
[project]/.claude/aiac/PROJECT_PROFILE.md
[project]/.claude/aiac/index/agent-map.md
[project]/.claude/codegraph.md
```

Workspace chưa có skill chuyên biệt có thêm `SKILL_DISCOVERY.md`. Đây là **draft cục bộ**, không phải plugin đã được cài hoặc capability đã được xác nhận.

## 4. CodeGraph semantic theo project

AIaC cài CodeGraph v1.5.0 từ release đã ghim checksum và tắt telemetry. Không chạy `codegraph install` của upstream vì lệnh đó có thể thêm MCP, permission và prompt hook vào cấu hình Claude Code.

```bash
bash scripts/aiac/install-codegraph.sh
```

Khi một project cần trace symbol/call flow/impact lặp lại, khởi tạo index local:

```bash
CODEGRAPH_TELEMETRY=0 codegraph init
```

```bash
CODEGRAPH_TELEMETRY=0 codegraph explore "<luồng hoặc symbol cần khảo sát>"
```

Chỉ sau khi index pass và Sếp cần dùng liên tục mới merge entry MCP vào **`[project]/.mcp.json`** bằng catalog secret-free:

```bash
node scripts/aiac/merge-project-mcp.js --server codegraph --project /đường/dẫn/project
```

Không bật global MCP hoặc permission wildcard.

## 5. Cập nhật

Router chỉ cập nhật nền khi clone AIaC sạch và fast-forward được. Nếu repo bẩn/xung đột, Router không thay đổi gì. Với cập nhật có chủ đích hoặc merge conflict, thực hiện review Git bình thường rồi chạy lại installer.

```bash
git fetch upstream
```

```bash
git merge --ff-only upstream/main
```

```bash
./install-aiac.sh
```

## 6. Thêm capability mới

1. Để Router tạo draft cục bộ khi có nhu cầu thực tế chưa được nhận diện.
2. Kiểm tra ECC và `360org/skills/` trước để loại bỏ trùng lặp.
3. Nghiên cứu tài liệu chính thức; không tự thêm plugin, MCP, quyền hay secret.
4. Chỉ khi dùng lại và kiểm chứng được, thêm skill vào `360org/skills/360-<name>/`, mô tả source/dependency/trigger/test.
5. Cập nhật `REQUIREMENTS.md`, `SPEC.md`, `ARCH.md`, `CHANGELOGS.md` và `task.md` cùng thay đổi.
