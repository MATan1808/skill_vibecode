# Extending the CLI (Wrapper TUI) — hiếm dùng

> Đối chiếu `developer-guide/extending-the-cli.md`. Chỉ liên quan khi cần build 1 **wrapper CLI riêng** bọc quanh Hermes TUI (thêm widget/keybinding/layout) — KHÔNG liên quan tới platform adapter/tool/skill/provider thông thường. Phần lớn task Hermes plugin sẽ không cần file này.

## Khi nào cần

Khi muốn build 1 CLI wrapper thêm widget UI, keybinding, hoặc custom layout cho TUI của Hermes mà không muốn override toàn bộ method `run()` (1000+ dòng) của `HermesCLI`.

## 5 extension seam của `HermesCLI`

| Hook | Mục đích | Override khi... |
|---|---|---|
| `_get_extra_tui_widgets()` | Chèn widget vào layout | Cần UI element cố định (panel, status line, mini-player) |
| `_register_extra_tui_keybindings(kb, *, input_area)` | Thêm phím tắt | Cần hotkey (toggle panel, transport control) |
| `_build_tui_layout_children(**widgets)` | Toàn quyền sắp xếp widget | Cần reorder/wrap widget có sẵn (hiếm) |
| `process_command()` | Slash command riêng | Cần xử lý `/mycommand` (hook đã có từ trước) |
| `_build_tui_style_dict()` | Style prompt_toolkit riêng | Cần màu/style riêng (hook đã có từ trước) |

3 hook đầu là mới (protected hooks), 2 hook sau đã tồn tại từ trước.

## Ví dụ khung tối thiểu

```python
from cli import HermesCLI
from prompt_toolkit.layout import FormattedTextControl, Window
from prompt_toolkit.filters import Condition

class MyCLI(HermesCLI):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._panel_visible = False

    def _get_extra_tui_widgets(self):
        cli_ref = self
        return [Window(
            FormattedTextControl(lambda: "📊 My custom panel content"),
            height=1,
            filter=Condition(lambda: cli_ref._panel_visible),
        )]

    def _register_extra_tui_keybindings(self, kb, *, input_area):
        cli_ref = self
        @kb.add("f2")
        def _toggle_panel(event):
            cli_ref._panel_visible = not cli_ref._panel_visible

    def process_command(self, cmd: str) -> bool:
        if cmd.strip().lower() == "/panel":
            self._panel_visible = not self._panel_visible
            print(f"Panel is now {'visible' if self._panel_visible else 'hidden'}")
            return True
        return super().process_command(cmd)

if __name__ == "__main__":
    MyCLI().run()
```

Chạy: `cd ~/.hermes/hermes-agent && source .venv/bin/activate && python my_cli.py`

`_get_extra_tui_widgets()` chèn widget **giữa spacer và status bar** — trên input area, dưới output chính.
