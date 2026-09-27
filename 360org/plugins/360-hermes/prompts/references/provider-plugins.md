# Provider Plugin (Model / Memory / Context-Engine / Media) cho Hermes

> Đối chiếu `developer-guide/model-provider-plugin.md` (đọc toàn bộ 268 dòng). Memory/context-engine/image/video/web-search provider theo cùng pattern "thả 1 thư mục, không sửa repo" — nếu build loại này, đọc thêm trực tiếp `memory-provider-plugin.md` / `context-engine-plugin.md` / `image-gen-provider-plugin.md` / `video-gen-provider-plugin.md` / `web-search-provider-plugin.md` tương ứng trên GitHub trước khi code (chưa đọc toàn bộ các file này, không bịa chi tiết field).

## Khi nào chọn Provider Plugin

Khi muốn thêm 1 **inference backend** (model provider), 1 **memory backend** (cross-session knowledge), hoặc 1 **context-compression strategy** (context engine) mới cho Hermes — không phải kênh chat, không phải tool đơn lẻ.

## Model Provider Plugin

### Discovery
`providers/__init__.py._discover_providers()` chạy lazy lần đầu gọi `get_provider_profile()`/`list_providers()`. Thứ tự:
1. **Bundled** — `<repo>/plugins/model-providers/<name>/`
2. **User** — `$HERMES_HOME/plugins/model-providers/<name>/` — drop vào là chạy, không cần restart cho session sau
3. **Legacy single-file** — `<repo>/providers/<name>.py` (back-compat)

**User plugin override bundled cùng tên** vì `register_provider()` là last-writer-wins — muốn override 1 provider built-in (vd trỏ endpoint staging riêng) chỉ cần drop file cùng `name` vào thư mục user.

### Cấu trúc tối thiểu

```
plugins/model-providers/my-provider/
├── __init__.py       # gọi register_provider(profile) ở module-level — file BẮT BUỘC duy nhất
├── plugin.yaml       # kind: model-provider (khuyến nghị, không có sẽ dùng source-text heuristic)
└── README.md         # optional
```

```python
# plugins/model-providers/acme-inference/__init__.py
from providers import register_provider
from providers.base import ProviderProfile

register_provider(ProviderProfile(
    name="acme-inference",
    aliases=("acme",),
    display_name="Acme Inference",
    description="Acme — OpenAI-compatible direct API",
    signup_url="https://acme.example.com/keys",
    env_vars=("ACME_API_KEY", "ACME_BASE_URL"),
    base_url="https://api.acme.example.com/v1",
    auth_type="api_key",
    default_aux_model="acme-small-fast",
    fallback_models=("acme-large-v3", "acme-medium-v3", "acme-small-fast"),
))
```

Chỉ cần 2 file này — các integration sau tự động wire: credential resolution (`hermes_cli/auth.py`), `--provider` CLI flag, `hermes model` picker (`CANONICAL_PROVIDERS`), `hermes doctor` health check, `hermes setup` wizard (`OPTIONAL_ENV_VARS`), URL reverse-mapping (`agent/model_metadata.py`), auxiliary model, runtime resolution (`hermes_cli/runtime_provider.py`), transport kwargs (`agent/transports/chat_completions.py`).

### `ProviderProfile` — field quan trọng

| Field | Type | Mục đích |
|---|---|---|
| `name` | str | ID chuẩn — khớp `model.provider` trong `config.yaml` và flag `--provider` |
| `aliases` | tuple | Tên thay thế (`grok` → `xai`) |
| `api_mode` | str | `chat_completions` \| `codex_responses` \| `anthropic_messages` \| `bedrock_converse` |
| `env_vars` | tuple | Env var API key theo thứ tự ưu tiên; entry cuối `*_BASE_URL` = override base URL |
| `base_url` | str | Endpoint mặc định |
| `auth_type` | str | `api_key` \| `oauth_device_code` \| `oauth_external` \| `copilot` \| `aws_sdk` \| `external_process` |
| `fallback_models` | tuple | Danh sách hiện khi fetch catalog live thất bại |
| `fixed_temperature` | Any | `None` = dùng giá trị caller; sentinel `OMIT_TEMPERATURE` = không gửi temperature |
| `default_max_tokens` | int\|None | Cap max_tokens riêng provider |
| `default_aux_model` | str | Model rẻ cho task phụ (compression, vision, summarization) |

### Override hook (subclass `ProviderProfile` khi có quirk riêng)

`prepare_messages()` (tiền xử lý message riêng provider), `build_extra_body()` (field API riêng, vd OpenRouter provider-preferences), `build_api_kwargs_extras()` (field cần đẩy top-level thay vì extra_body), `fetch_models()` (custom auth/catalog fetch, vd Bedrock không có REST endpoint → trả `None`).

### `auth_type` chi phối gì
Nếu KHÔNG phải `api_key`, các automation ở tầng CLI (doctor check, `--provider` flag tự động, setup wizard) có thể bỏ qua provider — manifest vẫn được ghi nhận nhưng không tự động hoá đầy đủ như provider `api_key`.

### Test nhanh không ảnh hưởng máy thật

```bash
export HERMES_HOME=/tmp/hermes-plugin-test
mkdir -p $HERMES_HOME/plugins/model-providers/my-provider
# ... viết __init__.py như trên ...
export MY_API_KEY=your-test-key
hermes -z "hello" --provider my-provider -m some-model
```

### Phân phối qua pip

```toml
[project.entry-points."hermes_agent.plugins"]
acme-inference = "acme_hermes_plugin:register"
```
`register` là hàm gọi `register_provider(profile)`. Vẫn cần khai `kind: model-provider` trong manifest hoặc dựa vào source-text heuristic.

## Memory / Context-Engine / Media Provider Plugin

Theo cùng triết lý "drop 1 thư mục, khai `kind:` tương ứng trong `plugin.yaml`, không sửa repo":
- **Memory provider** (`kind: memory-provider`) — backend lưu trữ tri thức xuyên session, **single-select** (1 cái active tại 1 thời điểm) — đọc `developer-guide/memory-provider-plugin.md` trước khi code.
- **Context Engine** (`kind: context-engine`) — chiến lược nén/thay thế context compression, cũng single-select — đọc `developer-guide/context-engine-plugin.md`.
- **Image/Video/Web-search provider** — tương tự model provider nhưng cho generative media / web search — đọc `image-gen-provider-plugin.md`/`video-gen-provider-plugin.md`/`web-search-provider-plugin.md` tương ứng.

> ⚠️ Chưa đọc toàn văn 5 file trên trong phiên làm việc tạo ra skill này — trước khi build loại provider này, Architect **bắt buộc** tự đọc file `.md` gốc tương ứng trên GitHub (`NousResearch/hermes-agent/website/docs/developer-guide/`) và trích nguồn cụ thể vào SPEC.md, không suy diễn field từ model-provider-plugin.md sang các loại khác.
