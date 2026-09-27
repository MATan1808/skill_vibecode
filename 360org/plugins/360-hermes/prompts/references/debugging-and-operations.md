# Debug & Gotcha vận hành thật (đúc kết từ production)

> Khác các reference khác (dựa trên docs chính thức), file này đúc kết từ **kinh nghiệm vận hành thật** 8 profile Hermes song song trên 1 VPS production (`/opt/hermes`, xem memory `hermes-multi-agent-deploy`). Đọc file này khi plugin build xong nhưng không hoạt động đúng trên server thật — docs chính thức không nói tới các gotcha này.

## 1. Permission — log root-owned khiến gateway crash

`docker compose exec` mặc định chạy bằng **root**, nhưng process gateway bên trong container chạy bằng **UID 1000**. Nếu bạn `exec` vào container để chạy `hermes -p <profile> gateway start` bằng root, log file sinh ra root-owned → lần sau gateway (UID 1000) khởi động lại sẽ gặp `PermissionError` khi ghi log và thoát ngay lập tức.

**Fix:**
```bash
chown -R 1000:1000 data/profiles/<profile>
docker compose exec -u 1000:1000 hermes hermes -p <profile> gateway start
```

## 2. Script `hermes` dùng bashism nhưng README bảo chạy bằng `sh`

Nếu README/docs nói chạy `sh hermes <cmd>` nhưng script có shebang `#!/bin/bash`, khi chạy qua `sh` thực chất đang chạy bằng **dash** (Ubuntu `/bin/sh` symlink tới dash), không phải bash — 2 bashism phổ biến gây lỗi âm thầm:
- `set -o pipefail` — dash không hỗ trợ, phải bọc trong điều kiện kiểm tra shell trước khi dùng.
- `. .env` — dash tìm file nguồn trong `$PATH`, không phải cwd; phải viết `. ./.env` để tường minh đường dẫn tương đối.

Nếu tự viết script quản lý plugin/profile, luôn test cả 2 cách gọi (`bash script.sh` và `sh script.sh`) nếu README khuyến khích cả 2.

## 3. Token Telegram: profile `default` đọc khác profile con

Nếu build/debug adapter đọc token theo pattern tương tự Telegram: profile **con** (tạo bằng `hermes profile create`) đọc token qua **env** `.env` container-wide, nhưng profile **`default`** lại đọc qua **`config.yaml` top-level** `platforms.telegram.botToken` — không phải env, không phải nhánh nested `gateway.platforms.telegram.botToken`.

Sau nhiều lần `hermes config set` không cẩn thận, `config.yaml` có thể sinh ra **3 key `platforms:` ở các cấp khác nhau** (top-level, nested dưới `gateway:`, và có thể duplicate) → token bị kẹt ở nhánh sai, log hiện `No messaging platforms enabled` / `No bot token configured` dù gateway `running`.

**Bài học áp dụng cho plugin bất kỳ:** khi thêm 1 platform mới cho profile `default`, luôn kiểm tra xem giá trị `enabled`/token đang đọc từ **top-level `platforms.<name>.*`** hay nhánh nested — verify bằng:
```bash
python -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c.get('platforms',{}).get('<name>'))"
```

## 4. Self-loop / chống lặp bot — sai không gian ID khi nối backend kiểu Odoo (XML-RPC)

Nếu platform adapter nối vào backend kiểu Odoo qua XML-RPC (`common.authenticate()` trả về **`res.users` ID**) và dùng field `author_id` của `mail.message` để lọc tin nhắn của chính bot (chống lặp) — **`mail.message.author_id` trỏ tới `res.partner`, KHÔNG phải `res.users`**. Đây là 2 bảng với 2 chuỗi ID độc lập.

So sánh trực tiếp `author_id == self.uid` gần như **không bao giờ đúng**, khiến việc chống lặp phải dựa vào fallback yếu (so sánh substring tên hiển thị) — nếu display name khác login, bot có thể **tự trả lời chính mình vô hạn**.

**Fix đúng:** sau `authenticate()`, đọc thêm `partner_id` của user đó:
```python
user_data = models.execute_kw(db, uid, api_key, 'res.users', 'read', [[uid]], {'fields': ['partner_id']})
self.partner_id = user_data[0]['partner_id'][0]
# ... rồi so author_id == self.partner_id, không phải == self.uid
```

Bài học tổng quát: **khi 1 backend ngoài có 2 khái niệm "user" khác nhau (auth user vs. actor/partner), không bao giờ giả định 2 ID trùng nhau** — luôn resolve tường minh trước khi so sánh.

## 5. Format tin nhắn — mất xuống dòng khi backend render body là HTML

Nếu gửi tin nhắn qua `message_post`/API tương tự mà body được backend hiển thị dưới dạng HTML, `html.escape(text)` chỉ escape ký tự đặc biệt (`<`, `&`) — **không** convert `\n` thành `<br/>`. Kết quả: câu trả lời nhiều dòng của agent bị dồn thành 1 dòng khi hiển thị cho khách hàng.

**Fix:** `html.escape(text).replace("\n", "<br/>")` trước khi gửi, nếu platform yêu cầu plain-text nhưng render qua HTML widget. **Nếu backend là Odoo:** riêng `<br/>` thôi chưa đủ — xem mục 8, còn cần `body_is_html=True` nếu không Odoo sẽ escape lại lần 2 khiến `<br/>` hiện literal.

## 6. "Provider authentication failed" — thường ở tầng router phía sau, không phải plugin/Hermes

Nếu Hermes đứng sau 1 router nội bộ kiểu fallback-chain (đa nhà cung cấp LLM), lỗi auth thường **không nằm trong code plugin** mà ở tầng router — log Hermes hiện raw upstream error (`[401]: IDE token expired`), router log riêng hiện provider nào còn sống/chết. Trước khi debug sâu vào code plugin do nghi lỗi provider, kiểm tra tầng router trước — tiết kiệm thời gian đáng kể.

## 7. `send()` phải khớp CHÍNH XÁC chữ ký thật, không phải bản rút gọn trong docs

Gateway thật (`gateway/platforms/base.py`, hàm `send_with_retry`) gọi adapter bằng **toàn bộ keyword arguments**: `self.send(chat_id=chat_id, content=content, reply_to=reply_to, metadata=metadata)`. Nếu adapter định nghĩa `send(self, chat_id, text, **kwargs)` (tên tham số `text` thay vì `content`) — giá trị `content=` rơi vào `**kwargs`, tham số `text` không có giá trị → `TypeError: missing 1 required positional argument: 'text'` ngay khi gateway cố gửi phản hồi, **mọi phản hồi thật đều thất bại** dù Agent vẫn tạo được câu trả lời bình thường (log `response ready...` vẫn hiện). Luôn định nghĩa đúng `send(self, chat_id: str, content: str, reply_to=None, metadata=None) -> SendResult` — copy chính xác tên tham số, không tự đặt tên khác dù nghĩa tương đương.

## 8. `message_post()` của Odoo escape lại `body` lần 2 nếu thiếu `body_is_html=True`

Nếu platform adapter nối Odoo qua XML-RPC và tự chèn HTML (vd `<br/>` để giữ xuống dòng) vào `body` trước khi gọi `discuss.channel.message_post`/`mail.thread.message_post`: docstring thật của `message_post()` ghi rõ tham số `body_is_html: bool = False` — **"indicates body should be treated as HTML even if str — to be used only for RPC calls"**. Gọi qua XML-RPC luôn truyền `body` dạng `str` (không có `Markup`), nên nếu không set `body_is_html=True`, Odoo **escape lại toàn bộ `body` lần 2**, biến `<br/>` tự chèn thành `&lt;br/&gt;` hiển thị literal cho người dùng thay vì xuống dòng thật. Luôn thêm `'body_is_html': True` vào kwargs khi tự dựng HTML cho `body`.

**Bài học tổng quát:** khi 1 fix về format/hiển thị không có tác dụng đúng như mong đợi, đừng thử biến thể khác của cùng giả thuyết (bỏ tag này, thêm tag kia) — dừng lại tra thẳng docstring/source thật của method đang gọi trước khi thử lần 2. Xem thêm [[feedback-verify-source-not-guess-twice]].

## 9. Docs mô tả "per-platform config override" không đồng nghĩa runtime thật có wiring

`hermes_cli/config.py` có thể ghi comment kiểu "Per-platform overrides via `display.platforms.<platform>.<setting>`" cho 1 setting, nhưng không phải mọi setting đều thực sự được code gateway (`gateway/run.py`) gọi qua `resolve_display_setting()` (per-platform) — 1 số setting (vd `memory_notifications` tính đến bản đang chạy) chỉ đọc flat `display.<setting>` toàn cục, bất kể có nested `display.platforms.<platform>.<setting>` hay không. Trước khi set 1 config tưởng là per-platform, `grep` xem đúng biến đó có thật sự đi qua `resolve_display_setting(user_config, platform_key, setting, ...)` trong code đang chạy hay không — nếu không, set per-platform sẽ vô tác dụng (không lỗi, chỉ im lặng không có effect).

## 11. Đồng bộ và vá lỗi: Bắt buộc dọn dẹp và cấp lại Permission (Clean & Re-grant Permissions)

Khi đồng bộ (rsync) mã nguồn từ máy local (như macOS) lên server Linux, các tham số bảo toàn quyền (như `rsync -a`) có thể giữ nguyên ownership lệch (ví dụ `501:admin` của macOS) và quyền hạn hạn chế (ví dụ `-rw-------`), khiến user `ubuntu` (hoặc UID `1000` chạy bên trong docker container) không có quyền đọc/ghi file đó (ví dụ file `adapter.py` hoặc các file cấu hình). Điều này sẽ dẫn đến lỗi gateway không thể khởi chạy hoặc load plugin thất bại:
```
Failed to load plugin 'vuahethong-gateway': [Errno 13] Permission denied: '.../adapter.py'
```

**Quy trình bắt buộc khi đồng bộ / vá lỗi lên Production:**
1.  **Dọn dẹp cache / file tạm:** Loại bỏ các file log cũ không cần thiết hoặc file `__pycache__` nếu có thể.
2.  **Cấp lại đúng ownership:** Gán lại quyền sở hữu cho đúng user vận hành trên server (`ubuntu:ubuntu` hoặc UID `1000`).
    ```bash
    sudo chown -R ubuntu:ubuntu /opt/hermes/data/plugins/
    ```
3.  **Cấp lại đúng permission:** Đảm bảo thư mục là `755` (đọc, ghi, thực thi) và các file code (`.py`, `.yaml`, `.json`) là `644` (đọc, ghi cho owner; đọc cho group và user khác).
    ```bash
    # Đặt quyền cho thư mục
    chmod -R 755 /opt/hermes/data/plugins/platforms/vuahethong_gateway
    # Đặt quyền 644 cho tất cả file
    find /opt/hermes/data/plugins/platforms/vuahethong_gateway -type f -exec chmod 644 {} \;
    ```
4.  **Restart & Verify logs:** Khởi động lại container (ví dụ `docker compose restart gateway` hoặc service profile tương ứng) và kiểm tra log ngay lập tức để xác nhận không còn lỗi `Permission denied`.
