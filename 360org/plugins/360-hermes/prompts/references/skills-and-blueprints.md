# Skill (SKILL.md) & Blueprint (automation) cho Hermes

> Đối chiếu `developer-guide/creating-skills.md` (438 dòng, đọc toàn bộ). Lưu ý: đây là skill **của Hermes Agent** (agent tự đọc khi chạy), khác với skill Claude Code (`hermes-dev-skills` này) dùng để hướng dẫn AI code plugin.

## Khi nào chọn Skill (ưu tiên mặc định)

- Năng lực diễn đạt được bằng hướng dẫn + lệnh shell + tool có sẵn (`terminal`, `web_extract`, `read_file`).
- Wrap 1 CLI/API ngoài mà agent gọi qua tool có sẵn.
- Không cần tích hợp Python custom hay quản lý API key phức tạp trong code agent.

Chọn **Tool** thay vì Skill khi cần auth flow, xử lý binary/streaming, logic phải chạy chính xác mỗi lần (xem [tools-and-hooks.md](./tools-and-hooks.md)).

## Cấu trúc thư mục

```
skills/<category>/<skill-name>/
├── SKILL.md              # bắt buộc
├── scripts/              # optional — helper script
└── references/           # optional
```

## Frontmatter SKILL.md đầy đủ

```yaml
---
name: my-skill
description: Mô tả ngắn (hiện trong kết quả tìm skill)
version: 1.0.0
author: Your Name
license: MIT
platforms: [macos, linux]        # optional — giới hạn OS (macos/linux/windows), bỏ trống = mọi OS
metadata:
  hermes:
    tags: [Category, Subcategory, Keywords]
    related_skills: [other-skill-name]
    requires_toolsets: [web]           # ẩn skill nếu toolset này KHÔNG active
    requires_tools: [web_search]       # ẩn nếu tool này KHÔNG có sẵn
    fallback_for_toolsets: [browser]   # ẩn nếu toolset này ĐANG active (skill dự phòng)
    fallback_for_tools: [browser_navigate]
    config:                            # setting không nhạy cảm, lưu trong config.yaml
      - key: my.setting
        description: "Setting này làm gì"
        default: "sensible-default"
        prompt: "Prompt hiển thị khi setup"
    blueprint:                          # có block này = skill trở thành automation chạy được
      schedule: "0 9 * * *"
      deliver: origin
      prompt: "Task instruction mỗi lần chạy"
      no_agent: false
required_environment_variables:        # secret — lưu trong .env, KHÔNG bao giờ lộ ra model
  - name: MY_API_KEY
    prompt: "Enter your API key"
    help: "Get one at https://example.com"
    required_for: "API access"
required_credential_files:             # OAuth token file, client secret... (khác env var — là FILE)
  - path: google_token.json
    description: Google OAuth2 token
---
```

### Bảng hành vi `requires_*`/`fallback_for_*`

| Field | Hành vi |
|---|---|
| `requires_toolsets` | Ẩn nếu **bất kỳ** toolset liệt kê KHÔNG có sẵn |
| `requires_tools` | Ẩn nếu **bất kỳ** tool liệt kê KHÔNG có sẵn |
| `fallback_for_toolsets` | Ẩn nếu **bất kỳ** toolset liệt kê ĐANG có sẵn |
| `fallback_for_tools` | Ẩn nếu **bất kỳ** tool liệt kê ĐANG có sẵn |

Dùng `fallback_for_*` cho skill dự phòng (vd `duckduckgo-search` chỉ hiện khi `web_search` — cần API key — chưa cấu hình).

## Env var vs Config vs Credential file — chọn đúng chỗ lưu

| Loại dữ liệu | Khai ở đâu | Lưu ở đâu | Model có thấy giá trị thật không |
|---|---|---|---|
| Secret (API key, token) | `required_environment_variables` | `~/.hermes/.env` | Không — chỉ tên biến |
| Setting không nhạy cảm (path, preference) | `metadata.hermes.config` | `config.yaml` dưới `skills.config.<key>` | Có — inject vào skill message lúc load |
| OAuth token file / client secret / cert | `required_credential_files` | file trong `~/.hermes/` | Tự mount read-only vào Docker/Modal sandbox |

`required_environment_variables` khi set sẽ **tự động passthrough** vào sandbox `execute_code`/`terminal` (kể cả Docker/Modal) — script trong skill dùng `$MY_API_KEY` trực tiếp, không cần user cấu hình thêm gì.

## Token thay thế trong SKILL.md

| Token | Thay bằng |
|---|---|
| `${HERMES_SKILL_DIR}` | Đường dẫn tuyệt đối tới thư mục skill |
| `${HERMES_SESSION_ID}` | Session id đang chạy |

```markdown
Để phân tích input, chạy:
    node ${HERMES_SKILL_DIR}/scripts/analyse.js <input>
```

## Inline shell snippet (opt-in, cẩn trọng)

`` !`cmd` `` trong SKILL.md sẽ tự chạy và inline stdout — **tắt mặc định** (chạy trên host không cần duyệt), chỉ bật cho skill nguồn tin cậy:
```yaml
skills:
  inline_shell: true
  inline_shell_timeout: 10
```

## Blueprint — skill kiêm automation

Chỉ cần thêm block `metadata.hermes.blueprint` với `schedule:` là skill trở thành 1 automation chia sẻ được. Cài blueprint **không tự động lên lịch** — Hermes đưa vào `/suggestions`, user phải `accept` thủ công:

```bash
hermes skills install owner/morning-brief
# → Added to your suggestions — run /suggestions to schedule or dismiss it.
/suggestions accept 1
```

## Publish

```bash
hermes skills publish skills/my-skill --to github --repo owner/repo
# hoặc thêm tap riêng:
hermes skills tap add owner/repo
```

**Trust levels khi cài từ hub:** `builtin` (ship sẵn) > `official` (từ `optional-skills/`) > `trusted` (openai/skills, anthropics/skills, huggingface/skills) > `community` (bị security scan, cảnh báo `dangerous` bị chặn cứng, cảnh báo nhẹ override bằng `--force`).

## Guideline khi viết SKILL.md

- Ưu tiên stdlib Python/curl/tool Hermes có sẵn thay vì thêm dependency.
- **Progressive disclosure**: workflow phổ biến nhất lên đầu, edge case xuống cuối — giữ token usage thấp.
- Logic parse phức tạp (XML/JSON) → viết helper script trong `scripts/`, đừng bắt LLM tự viết parser mỗi lần.
- Test: `hermes chat --toolsets skills -q "Use the X skill to do Y"`.
