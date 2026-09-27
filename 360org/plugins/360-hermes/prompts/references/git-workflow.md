# Git / Contributing Workflow cho Hermes plugin dev

> Đối chiếu `developer-guide/contributing.md` (288 dòng, đọc toàn bộ). Áp dụng khi plugin đóng góp ngược vào repo `NousResearch/hermes-agent` hoặc publish lên Skills Hub / GitHub riêng; với plugin nội bộ (vd `vuahethong_gateway`), phần "PR Process" có thể bỏ qua nhưng phần "Code Style"/"Security" vẫn áp dụng.

## Thứ tự ưu tiên đóng góp (tham khảo khi quyết định scope)
1. Bug fix (crash, sai hành vi, mất dữ liệu)
2. Cross-platform compatibility (macOS, Linux distro khác nhau, WSL2)
3. Security hardening (shell injection, prompt injection, path traversal)
4. Performance & robustness (retry, error handling, graceful degradation)
5. Skill mới (hữu ích rộng rãi)
6. Tool mới (hiếm cần — hầu hết năng lực nên là Skill)
7. Documentation

## Dev setup chuẩn (khi cần patch/test core Hermes, không chỉ viết plugin ngoài)

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
cd "${HERMES_HOME:-$HOME/.hermes}/hermes-agent"
uv pip install -e ".[all,dev]"
npm install   # optional — browser tools / docs
git checkout -b fix/description
scripts/run_tests.sh
```

**Venv luôn tạo NGOÀI source tree** nếu clone thủ công — venv nằm trong thư mục agent thao tác có thể bị agent tự xoá nhầm (`rm -rf venv`) và crash runtime giữa chừng.

## Code Style
- PEP 8, không ép cứng line-length.
- Comment chỉ khi giải thích intent không hiển nhiên/trade-off/quirk API — không comment mô tả code làm gì.
- Bắt exception cụ thể; lỗi bất ngờ log bằng `logger.error(..., exc_info=True)`.
- **Profile-safe paths:** KHÔNG hardcode `~/.hermes` — dùng `get_hermes_home()` (code path) / `display_hermes_home()` (message hiển thị user) từ `hermes_constants`. Quan trọng với plugin chạy trên nhiều profile (`data/profiles/<profile>/...`).

## Cross-platform gotcha (áp dụng nếu plugin có thể chạy trên Windows/WSL2)
- Không dùng `signal.SIGKILL` không guard — không tồn tại trên Windows. Dùng `gateway.status.terminate_pid(pid, force=True)` hoặc `getattr(signal, "SIGKILL", signal.SIGTERM)`.
- `os.kill(pid, 0)` probe: Windows raise `OSError`, không phải `ProcessLookupError` — bắt cả 2.
- `os.setsid`/`os.killpg`/`os.getpgid`/`os.fork` raise trên Windows — guard bằng `if sys.platform != "win32":`.
- Mở file luôn `encoding="utf-8"` tường minh — mặc định Windows dùng locale hệ thống (cp1252), vỡ chữ non-Latin.
- Dùng `pathlib.Path`, không tự nối `/`.

## Security checklist khi plugin có xử lý shell/input user
- `shlex.quote()` khi interpolate input user vào shell command.
- `os.path.realpath()` trước khi check access control (chống symlink bypass).
- Không log secret (token, API key) ra log file.
- Bắt exception rộng quanh code chạy tool ngoài.

## Commit message (Conventional Commits)
```
<type>(<scope>): <description>
```
Type: `fix`, `feat`, `docs`, `test`, `refactor`, `chore`. Scope tham khảo: `cli`, `gateway`, `tools`, `skills`, `agent`, `install`. Ví dụ: `fix(gateway): prevent double-reply from partner/user id mismatch in vuahethong adapter`.

## Trước khi submit PR / bàn giao plugin
1. `scripts/run_tests.sh` (nếu trong repo core) hoặc test thủ công `hermes chat` / `hermes gateway restart` (nếu plugin ngoài).
2. Test thủ công đúng code path vừa sửa.
3. Nêu rõ platform đã test (macOS/Linux/WSL2/Windows) nếu liên quan file path/process/signal.
4. 1 PR/1 thay đổi logic, không gộp nhiều việc không liên quan.
