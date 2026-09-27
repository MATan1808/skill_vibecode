# Tool Plugin & Lifecycle Hooks cho Hermes

> Đối chiếu `developer-guide/adding-tools.md` (211 dòng, đọc toàn bộ) + phần `PluginContext` trong `user-guide/features/plugins`.

## Skill hay Tool? — hỏi trước khi viết bất kỳ dòng code nào

Docs chính thức nói thẳng: **"Before writing a tool, ask yourself: should this be a skill instead?"**

- **Skill** khi: năng lực diễn đạt được bằng hướng dẫn + lệnh shell + tool có sẵn (`terminal`, `web_extract`), không cần quản lý API key/logic xử lý riêng trong code Python của agent. Ví dụ: tìm kiếm arXiv, workflow git, quản lý Docker, xử lý PDF.
- **Tool** khi: cần tích hợp end-to-end với API key, xử lý logic tuỳ biến phải chạy chính xác mỗi lần, xử lý dữ liệu binary/streaming/real-time. Ví dụ: browser automation, TTS, phân tích ảnh.

**Mặc định thiên về Skill** — chỉ viết Tool khi thực sự cần.

## Tool built-in (core) vs Tool plugin

Trang docs `adding-tools.md` viết cho việc thêm **tool built-in vào chính repo Hermes** (`tools/*.py` + `toolsets.py`) — chỉ làm việc này nếu bạn là core contributor của repo NousResearch/hermes-agent. **Với plugin riêng của dự án/khách hàng, luôn dùng route Plugin** (`ctx.register_tool()` trong `register(ctx)` của plugin, không sửa `tools/` core).

## Đăng ký Tool qua Plugin (route dùng cho hầu hết task thực tế)

```python
def register(ctx):
    ctx.register_tool(
        name="my_tool",
        toolset="my_toolset",
        schema=MY_TOOL_SCHEMA,   # JSON schema chuẩn function-calling
        handler=my_tool_handler,
        check_fn=check_requirements,   # optional — trả False thì tool bị ẩn khỏi definitions
        requires_env=["MY_API_KEY"],
    )
```

### Hợp đồng bắt buộc của handler (áp dụng cho cả built-in lẫn plugin tool)

- Handler **PHẢI** trả về **chuỗi JSON** (`json.dumps(...)`), không bao giờ trả dict thô.
- Lỗi **PHẢI** trả dạng `{"error": "message"}`, không bao giờ `raise` ra ngoài — registry không tự bắt exception cho bạn.
- Chữ ký: `handler(args: dict, **kwargs) -> str`, `args` là tham số LLM gọi tool.
- Cần async → đặt `is_async=True` khi register, registry tự bridge (`_run_async()`), không tự gọi `asyncio.run()`.
- Cần `task_id` (tool quản lý state theo session) → nhận qua `**kwargs`, lấy bằng `kw.get("task_id")`.

```python
def weather_tool(location: str, units: str = "metric") -> str:
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key:
        return json.dumps({"error": "WEATHER_API_KEY not configured"})
    try:
        return json.dumps({"location": location, "temp": 22, "units": units})
    except Exception as e:
        return json.dumps({"error": str(e)})
```

## Lifecycle Hooks (`ctx.register_hook`)

Đính kèm callback vào 1 trong các lifecycle event sau (không phải loại plugin riêng — gắn vào plugin platform/tool/provider đã đăng ký):

| Hook | Thời điểm |
|---|---|
| `pre_tool_call` / `post_tool_call` | Trước/sau khi tool chạy |
| `pre_llm_call` / `post_llm_call` | Trước/sau khi gọi LLM inference |
| `on_session_start` / `on_session_end` / `on_session_finalize` / `on_session_reset` | Vòng đời session |
| `subagent_stop` | Sau khi subagent được delegate hoàn thành |
| `pre_gateway_dispatch` | Chặn message ở tầng gateway trước khi dispatch vào agent loop |

## Extension points khác của `PluginContext` (không phải Python code)

- **MCP servers** — đăng ký tool từ config, không cần code Python.
- **Shell hooks** — lệnh shell chạy theo event (notification/logging).
- **Config-driven TTS/STT** — khai báo provider CLI, không cần viết Python.
- **Gateway event hooks** — drop-in `HOOK.yaml` + handler cho event tầng platform.
- **Custom skill repositories** — `hermes skills tap add owner/repo` cho private tap.

## Registration khác trong `PluginContext`

`register_command()` (slash command CLI/gateway), `register_cli_command()` (subcommand `hermes <plugin> <sub>`), `register_skill()` (bundle skill namespaced), `dispatch_tool()` (gọi tool đã đăng ký với agent context), `inject_message()` (queue tin nhắn vào conversation đang chạy), `llm.complete()` (mượn model đang active để hoàn thành 1-shot completion, vd tiền xử lý/classify trước khi trả tool result).

## Setup Wizard Integration (optional)

Nếu tool cần API key, thêm vào `hermes_cli/config.py` (chỉ áp dụng khi build built-in tool trong core repo):

```python
OPTIONAL_ENV_VARS = {
    "WEATHER_API_KEY": {
        "description": "Weather API key",
        "prompt": "Weather API key",
        "url": "https://weatherapi.com/",
        "tools": ["weather"],
        "password": True,
    },
}
```

Với Tool plugin, cơ chế tương đương là khai `requires_env`/`optional_env` trong `plugin.yaml` — tự populate UI `hermes config`, không cần sửa file core này.

## Checklist

- [ ] Đã tự hỏi "cái này có nên là Skill thay vì Tool không?" và trả lời được lý do chọn Tool.
- [ ] Handler trả JSON string, lỗi trả `{"error": "..."}`, không `raise` ra ngoài.
- [ ] `check_fn` trả `False` khi thiếu dependency/env — tool tự ẩn, không lỗi khi register.
- [ ] Nếu tool async → `is_async=True`.
- [ ] Test bằng `hermes chat -q "Use the <tool> tool for <case>"`.
