# Platform Adapter — thêm 1 kênh nhắn tin mới cho Hermes Gateway

> Nội dung đối chiếu trực tiếp với `github.com/NousResearch/hermes-agent/website/docs/developer-guide/adding-platform-adapters.md` (693 dòng, đọc toàn bộ) và source thật `gateway/platforms/base.py` lấy từ container Hermes đang chạy production. Nếu server đang chạy 1 fork/version khác, luôn verify lại chữ ký thật trước khi ship.

## Khi nào chọn Platform Adapter

Khi muốn user chat với Hermes qua **1 kênh nhắn tin mới** (Zalo, kênh nội bộ, IRC, một CRM có Discuss riêng...). Nếu chỉ cần gọi 1 API xử lý logic (không phải kênh chat 2 chiều) → xem [tools-and-hooks.md](./tools-and-hooks.md) thay vì file này.

## Kiến trúc tổng quan

```
User ↔ Messaging Platform ↔ Platform Adapter ↔ Gateway Runner ↔ AIAgent
```

Mọi adapter kế thừa `BasePlatformAdapter` (`gateway/platforms/base.py`) và implement:

- **`connect(self, *, is_reconnect: bool = False) -> bool`** *(abstract)* — verify đúng chữ ký này (đã đối chiếu source thật, không phải doc rút gọn).
- **`disconnect() -> None`** *(abstract)*
- **`send(chat_id, content, reply_to=None, metadata=None) -> SendResult`** *(abstract)*
- **`send_typing(chat_id, metadata=None) -> None`** (optional override)
- **`get_chat_info(chat_id) -> Dict[str, Any]`** *(abstract)*

Tin nhắn vào (inbound) do adapter tự nhận, build `MessageEvent` rồi gọi `await self.handle_message(event)` — base class tự route vào gateway runner.

## Hai cách thêm platform

- **Plugin (khuyến nghị cho community/third-party — luôn dùng cách này cho task thực tế):** thả 1 thư mục vào `~/.hermes/plugins/` hoặc `data/profiles/<profile>/plugins/platforms/<name>/`, KHÔNG sửa core.
- **Built-in:** sửa 20+ file core (`gateway/config.py`, `gateway/run.py`, `hermes_cli/*`, `toolsets.py`, `tools/send_message_tool.py`...) — chỉ dùng khi bạn là core contributor của chính repo NousResearch/hermes-agent. **Không áp dụng cho plugin riêng của khách hàng/dự án.**

## Cấu trúc thư mục (Plugin Path)

```
plugins/platforms/my-platform/     # hoặc data/profiles/<profile>/plugins/platforms/my-platform/
  plugin.yaml      # Metadata — requires_env/optional_env tự populate hermes config UI
  adapter.py       # Class adapter + entry point register(ctx)
```

### `plugin.yaml`

```yaml
name: my-platform
label: My Platform
kind: platform
version: 1.0.0
description: My custom messaging platform adapter
author: Your Name
requires_env:
  - MY_PLATFORM_TOKEN          # chuỗi trần cũng chạy được
  - name: MY_PLATFORM_CHANNEL  # hoặc dict đầy đủ cho UX tốt hơn
    description: "Channel to join"
    prompt: "Channel"
    password: false
optional_env:
  - name: MY_PLATFORM_HOME_CHANNEL
    description: "Default channel for cron delivery"
    password: false
```

**Supported dict keys:** `name` (bắt buộc), `description`, `prompt`, `url`, `password` (bool, tự suy ra từ hậu tố `*_TOKEN`/`*_SECRET`/`*_KEY`/`*_PASSWORD`/`*_JSON` nếu bỏ trống), `category` (mặc định `"messaging"`).

### `adapter.py` — khung tối thiểu

```python
import os
from gateway.platforms.base import (
    BasePlatformAdapter, SendResult, MessageEvent, MessageType,
)
from gateway.config import Platform, PlatformConfig


class MyPlatformAdapter(BasePlatformAdapter):
    def __init__(self, config: PlatformConfig):
        super().__init__(config, Platform("my_platform"))
        extra = config.extra or {}
        self.token = os.getenv("MY_PLATFORM_TOKEN") or extra.get("token", "")

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        # Kết nối API, khởi động listener/poll loop
        self._mark_connected()
        return True

    async def disconnect(self) -> None:
        self._mark_disconnected()

    async def send(self, chat_id, content, reply_to=None, metadata=None):
        return SendResult(success=True, message_id="...")

    async def get_chat_info(self, chat_id):
        return {"name": chat_id, "type": "dm"}


def check_requirements() -> bool:
    return bool(os.getenv("MY_PLATFORM_TOKEN"))


def validate_config(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    return bool(os.getenv("MY_PLATFORM_TOKEN") or extra.get("token"))


def register(ctx):
    """Entry point — Hermes plugin system gọi hàm này."""
    ctx.register_platform(
        name="my_platform",
        label="My Platform",
        adapter_factory=lambda cfg: MyPlatformAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        required_env=["MY_PLATFORM_TOKEN"],
        install_hint="pip install my-platform-sdk",
        env_enablement_fn=_env_enablement,           # xem mục Env-Driven Auto-Config
        cron_deliver_env_var="MY_PLATFORM_HOME_CHANNEL",
        allowed_users_env="MY_PLATFORM_ALLOWED_USERS",
        allow_all_env="MY_PLATFORM_ALLOW_ALL_USERS",
        max_message_length=4000,
        platform_hint="You are chatting via My Platform. It supports markdown formatting.",
        emoji="💬",
    )
```

### `build_source()` helper (dùng thay vì tự dựng `SessionSource`)

`BasePlatformAdapter` có sẵn helper — ưu tiên dùng thay vì tự import `gateway.session.SessionSource` và set field tay:

```python
source = self.build_source(
    chat_id=chat_id, chat_name=name, chat_type="dm",  # hoặc "group"/"channel"
    user_id=user_id, user_name=user_name,
)
event = MessageEvent(text=content, message_type=MessageType.TEXT, source=source, message_id=msg_id)
await self.handle_message(event)
```

## Những gì Plugin System tự lo (không cần đụng core)

| Integration point | Cách hoạt động |
|---|---|
| Tạo adapter | Registry check trước built-in if/elif chain |
| Parse config | `Platform._missing_()` chấp nhận platform name bất kỳ |
| Validate config đã kết nối | Gọi `validate_config()` của registry |
| Phân quyền user | `allowed_users_env` / `allow_all_env` |
| Auto-enable từ env only | `env_enablement_fn` seed `PlatformConfig.extra` + `home_channel` |
| Bridge YAML→env | `apply_yaml_config_fn` |
| Cron delivery | `cron_deliver_env_var` làm `deliver=<name>` hoạt động |
| `hermes config` UI | `requires_env`/`optional_env` trong `plugin.yaml` |
| Gửi tin (`tools/send_message_tool.py`) | Route qua adapter đang sống |
| Cross-platform webhook | Registry check platform đã biết |
| System prompt hint | `platform_hint` tiêm vào context LLM |
| Chunking tin nhắn dài | `max_message_length` |
| PII redaction | `pii_safe` flag |
| Token lock đa-profile | Tự gọi `acquire_scoped_lock()` trong `connect()` — plugin phải tự thêm, KHÔNG tự động |

## Env-Driven Auto-Configuration

Đa số user set platform bằng cách bỏ env var vào `.env` thay vì sửa `config.yaml`. Hook `env_enablement_fn` cho phép plugin đọc env vars **trước khi** adapter được khởi tạo, để `hermes gateway status`/cron delivery thấy đúng trạng thái mà không cần instantiate SDK:

```python
def _env_enablement() -> dict | None:
    token = os.getenv("MY_PLATFORM_TOKEN", "").strip()
    channel = os.getenv("MY_PLATFORM_CHANNEL", "").strip()
    if not (token and channel):
        return None          # chưa đủ config tối thiểu → không auto-enable
    seed = {"token": token, "channel": channel}
    home = os.getenv("MY_PLATFORM_HOME_CHANNEL")
    if home:
        seed["home_channel"] = {"chat_id": home, "name": "Home"}
    return seed              # key 'home_channel' được tách riêng thành HomeChannel dataclass, còn lại merge vào PlatformConfig.extra
```

## Cron Delivery ngoài process gateway

`cron_deliver_env_var` làm platform trở thành `deliver=` target hợp lệ. Nhưng nếu cron chạy **tách process** khỏi gateway (`hermes cron run` riêng với `hermes gateway`), phải thêm `standalone_sender_fn` — nếu không sẽ lỗi `No live adapter for platform '<name>'`:

```python
async def _standalone_send(pconfig, chat_id, message, *, thread_id=None, media_files=None, force_document=False):
    """Mở kết nối tạm/lấy token mới, gửi, đóng lại."""
    return {"success": True, "message_id": "..."}  # hoặc {"error": "..."}

ctx.register_platform(..., standalone_sender_fn=_standalone_send)
```

Tham khảo implementation thật: `plugins/platforms/{irc,teams,google_chat}/adapter.py`.

## Token Lock — bắt buộc cân nhắc khi credential dùng chung nhiều profile

Nếu adapter giữ 1 kết nối persistent với credential duy nhất (bot token, API key gắn với 1 user cụ thể), thêm scoped lock để tránh 2 profile Hermes vô tình dùng chung credential → double reply cho cùng 1 tin nhắn:

```python
from gateway.status import acquire_scoped_lock, release_scoped_lock

async def connect(self, *, is_reconnect: bool = False) -> bool:
    if not acquire_scoped_lock("my_platform", self.token):
        logger.error("Token already in use by another profile")
        return False
    ...

async def disconnect(self) -> None:
    release_scoped_lock("my_platform", self.token)
```

## Pattern Long-Poll vs Webhook

**Long-poll** (giống Telegram, Weixin, hoặc bất kỳ backend chỉ có XML-RPC/REST search API — vd Odoo-style `mail.message` polling):
```python
async def connect(self, *, is_reconnect: bool = False) -> bool:
    self._poll_task = asyncio.create_task(self._poll_loop())
    self._mark_connected()
    return True

async def _poll_loop(self):
    while self._running:
        for msg in await self._fetch_updates():
            await self.handle_message(self._build_event(msg))
        await asyncio.sleep(self.poll_interval)
```

**Webhook/Callback** (platform tự push tin về endpoint của mình, vd WeCom Callback):
```python
async def connect(self, *, is_reconnect: bool = False) -> bool:
    self._app = web.Application()
    self._app.router.add_post("/callback", self._handle_callback)
    self._mark_connected()
    return True

async def _handle_callback(self, request):
    event = self._build_event(await request.text())
    await self._message_queue.put(event)
    return web.Response(text="success")  # ACK ngay lập tức
```

Với platform có deadline phản hồi ngắn (vd WeCom 5s), luôn ACK ngay rồi gửi reply thật qua API riêng sau — session agent chạy 3-30 phút, không thể trả lời inline trong callback window.

## Platform-specific slow-LLM UX (nâng cao)

Một số platform có ràng buộc riêng khi LLM trả lời chậm: LINE có reply-token dùng 1 lần hết hạn ~60s, WhatsApp đóng session sau 24h chỉ nhận template message, SMS không có typing indicator. Pattern xử lý: override `_keep_typing()` để chạy song song 1 task riêng ở ngưỡng thời gian, luôn `await super()._keep_typing(...)` trước, dọn task phụ trong `finally`. Tham khảo implementation đầy đủ: `plugins/platforms/line/adapter.py`.

## Checklist Test

Tạo `tests/gateway/test_<platform>.py` bao gồm: adapter construction từ config, build message event, `send()` (mock API ngoài), tính năng riêng platform. Chạy thử thật: `HERMES_PLUGINS_DEBUG=1 hermes plugins list` (debug plugin không load), `hermes gateway restart`, xem `logs/gateway.log`.

## Parity Audit — chạy trước khi ship 1 platform mới

```bash
# Tìm mọi file .py nhắc tới platform tham chiếu (đã ổn định)
grep -rl "bluebubbles" --include="*.py" .
# Tìm mọi file .py nhắc tới platform mới
grep -rl "newplat" --include="*.py" .
# File có trong tập đầu mà không có trong tập sau → khoảng trống tiềm năng
```

## Reference Implementations trong repo (đọc trước khi tự viết mới)

| Adapter | Pattern | Độ phức tạp | Tham khảo cho |
|---|---|---|---|
| `bluebubbles.py` | REST + webhook | Trung bình | Tích hợp REST API đơn giản |
| `weixin.py` | Long-poll + CDN | Cao | Xử lý media, encryption |
| `wecom_callback.py` | Callback/webhook | Trung bình | HTTP server, AES crypto, multi-app |
| `plugins/platforms/irc/adapter.py` | Long-poll + IRC protocol | Cao | Plugin adapter đầy đủ tính năng, có scoped token lock mẫu |
| `plugins/platforms/line/adapter.py` | Webhook + slow-LLM UX | Cao | `_keep_typing` override, request cache state machine |
