# DevTrack — tự động ghi nhận thay đổi & đồng bộ cross-agent

Lớp **native** (không lệ thuộc OpenSpec/SpecKit, chỉ Python stdlib + git) giúp mọi
agent (Claude/Codex/Gemini/tay) làm việc **thống nhất trên cùng một dự án**:

- **Tự động ghi nhận thay đổi** mỗi khi commit — không cần gõ command.
- **Lịch sử rõ ràng** — git log + `CHANGELOGS.md` tự cập nhật.
- **Bám checklist** — `task.md` tự tick theo task-id trong commit.
- **Cross-agent** — đổi editor không phải đọc lại từ đầu; SessionStart in trạng thái.
- **Không đè nhau** — tái dùng wayfinder MAP (`.scratch/map/MAP.md`) + task-id.

## Nhà của DevTrack: base `dev-workflow-skills`

Lõi (`scripts/devtrack.py` + `hooks/`) đặt **1 lần** ở base; odoo/hermes/v-assistant/
vuaai kế thừa. Cài base như **plugin Claude Code** (`.claude-plugin/`) → `Stop` hook +
`SessionStart` hook áp **toàn cục** cho mọi project, không cần nhân bản vào từng bộ.

> **An toàn:** `Stop` hook toàn cục chỉ auto-commit repo **đã opt-in** (đã
> `devtrack install` → `core.hooksPath=.devhooks`). Repo git khác anh tình cờ mở
> sẽ **không** bị đụng. (`autocommit`/`watch` đều kiểm cờ này trước.)

## Nguyên lý

Git là kênh **duy nhất** mọi agent đều đi qua → toàn bộ enforce + persistence neo
vào **git hooks cài trong project** (qua `core.hooksPath = .devhooks`). Agent chỉ là
"người bấm commit"; git hook mới chuẩn hoá & ghi nhận → state nhất quán bất kể agent.

## Thành phần

| File (trong repo project) | Vai trò |
|---|---|
| `.devhooks/pre-commit` | Gọi `devtrack validate` — kiểm docs bắt buộc + lint nhẹ (soft). |
| `.devhooks/prepare-commit-msg` | Chèn scaffold Conventional Commit khi soạn message mới. |
| `.devhooks/post-commit` | Gọi `devtrack record` — append CHANGELOGS, tick task, cập nhật MAP. |
| `.devhooks/_common.sh` | Tìm `devtrack.py` (env `DEVTRACK_HOME` → path base skill). |

Engine: `dev-workflow-skills/scripts/devtrack.py` (dùng chung cho mọi bộ skill).

## Cài đặt

```bash
# Cho 1 project (mới hoặc retrofit project cũ) — idempotent:
python3 <base>/scripts/devtrack.py install /đường/dẫn/project
```

`install` sẽ: `git init` nếu cần → copy `.devhooks/` → set `core.hooksPath` →
tạo skeleton 8 docs + `task.md` (không đè file có sẵn).

> **Quan trọng — clone:** `core.hooksPath` là git config **LOCAL**, KHÔNG đi theo
> `git clone`. Thư mục `.devhooks/` được version (đi theo clone), nhưng con trỏ
> kích hoạt thì không. Vì vậy máy/agent mới clone cần kích hoạt 1 lần:
> `devtrack activate`. SessionStart hook của bộ skill **tự làm việc này** — agent
> nào có bộ skill, mở repo có `.devhooks/` là tự set → cross-agent seamless.

## Convention

**Task-id** trong `task.md`: dạng `T<số>` hoặc `T<số>.<số>` đứng như token riêng.
```markdown
- [ ] T1.1 Dựng khung dự án
- [ ] T2.3 Thêm đăng nhập OTP
```

**Commit** tham chiếu task-id (trong subject hoặc body) để auto-tick:
```
feat(auth): thêm đăng nhập OTP  T2.3
```
→ post-commit tự đổi `- [ ] T2.3` thành `- [x] T2.3` và append 1 dòng CHANGELOGS.

## Tự động "không cần gõ command"

- **Claude Code**: `Stop` hook → `devtrack autocommit` cuối mỗi lượt (checkpoint nếu
  working tree bẩn). Chuẩn, tin cậy.
- **Codex / Gemini / Antigravity**: KHÔNG có Stop hook như Claude → không tự commit
  ngầm. Hai cách:
  - **Watcher nền** (khuyến nghị để "không cần gõ"): chạy 1 lệnh/project, tự
    checkpoint khi file đổi rồi đứng yên qua 1 chu kỳ (debounce):
    ```bash
    cd <project> && DEVTRACK_AGENT=antigravity \
      python3 <base>/scripts/devtrack.py watch --interval 30
    ```
  - Hoặc để agent/anh tự `git commit` → git hook (`post-commit`) ghi nhận đầy đủ
    (Tầng A, agent-agnostic — chạy trên MỌI editor).

## Hai tầng tự động (phân biệt rõ)

| Tầng | Cơ chế | Antigravity/Codex/Gemini |
|---|---|---|
| **A — ghi nhận khi commit** (changelog, tick task, validate) | git hook | ✅ chạy khi có `git commit` (đã activate hooksPath) |
| **B — tự commit không cần gõ** (checkpoint) | Claude Stop hook / `devtrack watch` | Claude: tự động. Editor khác: cần `devtrack watch` |

## Repo aggregator/skill (không theo mô hình 8 docs)

Dùng `install --no-docs`: bỏ tạo 8 docs, chỉ tạo `task.md`, và đặt cờ
`git config devtrack.checkdocs false` để `validate` không cảnh báo thiếu docs.
```bash
python3 <base>/scripts/devtrack.py install <repo> --no-docs
```

## Cấu hình

| Env | Ý nghĩa |
|---|---|
| `DEVTRACK_HOME` | Thư mục chứa `devtrack.py` (override path base). |
| `DEVTRACK_STRICT=1` | `validate` chặn commit khi thiếu docs (mặc định: chỉ cảnh báo). |
| `DEVTRACK_AGENT` | Tên agent ghi vào checkpoint/MAP (mặc định `agent`, Stop hook đặt `claude`). |

## Giới hạn đã biết (ponytail)

- `core.hooksPath` cần Git ≥ 2.9; không đi theo clone → cần `activate` (đã tự động
  hoá qua SessionStart).
- `record` ghi CHANGELOGS/task.md **sau** commit → thay đổi gộp vào commit kế tiếp
  hoặc checkpoint autocommit (không amend để tránh vòng lặp).
- `autocommit` gom **mọi** thay đổi working tree ở checkpoint → cần `.gitignore` tốt
  (tái dùng logic `scripts/git_cleaner.py`). Checkpoint dùng `--no-verify` và bị
  `record` bỏ qua để không spam changelog.
- Lint Odoo trong `validate` hiện chỉ ở mức khung (chưa chặn) — nâng cấp sau khi cần.

## Self-check

```bash
python3 scripts/devtrack.py selftest   # kiểm parse task-id, tick, changelog idempotent
```
