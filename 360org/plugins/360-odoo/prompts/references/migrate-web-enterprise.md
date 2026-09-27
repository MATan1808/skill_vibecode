---
name: odoo-migrate-web-enterprise
description: |
  Chuyển đổi database Odoo từ web_enterprise sang backend_ui (v17/v18/v19+), an toàn qua ORM, lặp lại được cho nhiều DB.
  Trigger: "migrate web_enterprise sang backend_ui", "web_enterprise to backend_ui", "chuyển sang backend_ui",
  "gỡ web_enterprise", "lỗi css sau upgrade", "css error occured using an old style", "vỡ giao diện sau nâng cấp",
  "Could not get content for", "asset bundle lỗi sau migrate", "decouple odoo license", "ẩn version odoo".
  Dùng SAU khi đã upgrade version xong (xem database-upgrade.md) — đây là bước xử lý giao diện hậu upgrade.
metadata:
  origin: AIAC
---

# Migrate `web_enterprise` → `backend_ui`

Quy trình chuẩn hoá, **chạy lại được cho từng database khác nhau** mà không cần sửa script. Áp dụng sau khi database đã nâng cấp lên Odoo 17.0 / 18.0 / 19.0.

**Script canonical** (một bản duy nhất, không nhân bản):
- macOS (máy Sếp): `/Volumes/DATA/DEV/aiac/360org/scripts/odoo/migrate_web_enterprise_to_backend_ui.py`
- Local server: `/mnt/DATA/work/aiac/360org/scripts/odoo/migrate_web_enterprise_to_backend_ui.py`

> ⚠️ **Script mặc định là DRY-RUN.** Không có `--apply` thì không ghi gì vào database. Chạy thiếu `--apply` rồi tưởng đã migrate là lỗi thường gặp nhất.

---

## 5 vấn đề script này giải quyết

1. **Thiếu `addons_path`** → Odoo skip manifest (`module backend_ui: not installable, skipped`) → lỗi `Full path [backend_ui/views/...] cannot be found`.
2. **Xoá thô bằng SQL để lại rác** → XML ID, view kế thừa (`webclient_bootstrap`, `webclient_login`, `color_scheme`), constraint, trigger của Enterprise vẫn active → HTTP 500 hoặc conflict XPath.
3. **Odoo 19 bỏ `api.Environment.manage()`** → script cũ crash `AttributeError: type object 'Environment' has no attribute 'manage'`.
4. **Vỡ CSS** (`css error occured, using an old style to render this page`) → `ir_asset` còn bản ghi active trỏ vào module đã gỡ hoặc thiếu source (`mass_editing`, `web_enterprise`, `social_zalo`) → bundle biên dịch fail → Odoo fallback giao diện cũ.
5. **Rò rỉ metadata & phone-home license** → `publisher_warranty` gọi ra ngoài, `/website/info` lộ version + danh sách module.

---

## Quy trình 6 bước

### Bước 1 — Tiền điều kiện (BẮT BUỘC kiểm đủ trước khi chạy)

| # | Kiểm tra | Lệnh / Cách xác minh |
|---|---|---|
| 1 | `backend_ui` có trong `addons_path` | `grep addons_path /etc/odoo/odoo.conf` — phải chứa thư mục themes |
| 2 | Volume đã mount (nếu Docker) | `docker inspect <CONTAINER> \| grep -A3 themes` |
| 3 | Xác định đúng DB đang xử lý | Đối chiếu domain/namespace, **cấm đoán từ tên gọi tắt** |
| 4 | Biết module nào đang phụ thuộc `web_enterprise` | Xem query bên dưới — để lường trước impact |

```sql
-- Module nào sẽ bị ảnh hưởng khi gỡ web_enterprise?
SELECT m.name, m.state
FROM ir_module_module_dependency d
JOIN ir_module_module m ON m.id = d.module_id
WHERE d.name = 'web_enterprise' AND m.state = 'installed'
ORDER BY m.name;
```

Cấu hình `addons_path` mẫu:
```ini
[options]
addons_path = /usr/lib/python3/dist-packages/odoo/addons,/mnt/odoo-addons,/mnt/odoo-themes
```

### Bước 2 — Backup database (BẮT BUỘC, KHÔNG BỎ QUA)

Script gỡ module qua ORM — thao tác **không tự rollback được**. Không có backup verify được thì không chạy tiếp.

```bash
# Dump + verify ngay, lưu theo client-name
mkdir -p /mnt/DATA/work/<client-name>/db_backup
TS=$(date +%Y%m%d_%H%M%S)
DUMP=/mnt/DATA/work/<client-name>/db_backup/<db>_${TS}_before_backend_ui.dump

docker exec -i <CONTAINER_PG> pg_dump -U odoo -d <db> -F c -b > "$DUMP"
pg_restore -l "$DUMP" | wc -l    # > 0 mới hợp lệ
```

> Backup chỉ nằm trên volume container là chưa đủ — container chết là mất trắng. Bắt buộc có bản ở Local Server theo `<client-name>`.

### Bước 3 — Chạy DRY-RUN trước (xem trước tác động)

```bash
docker exec -i <CONTAINER_ODOO> python3 \
  /mnt/odoo-themes/backend_ui/scripts/migrate_web_enterprise_to_backend_ui.py \
  -d <db> -c /etc/odoo/odoo.conf
```

Đọc kỹ output: số module sẽ uninstall, số dependency remap, số `ir_asset` vô hiệu hoá, số cache attachment xoá. Con số bất thường (vd. hàng nghìn asset) thì **dừng lại điều tra**, đừng apply.

### Bước 4 — Apply thật

```bash
docker exec -it <CONTAINER_ODOO> python3 \
  /mnt/odoo-themes/backend_ui/scripts/migrate_web_enterprise_to_backend_ui.py \
  -d <db> -c /etc/odoo/odoo.conf \
  --apply \
  --verify-url http://127.0.0.1:8069
```

- `--apply` — bật chế độ ghi. Script sẽ hỏi gõ lại tên database để xác nhận.
- `--yes` — bỏ qua xác nhận, **chỉ dùng khi chạy batch/CI**, không dùng tay.
- `--verify-url` — chạy luôn Verification Gate sau migrate.

**Script tự làm 5 việc** (`run_orm_conversion`):
1. `check_addons_path('backend_ui')` — dừng ngay nếu thiếu, tránh corrupt DB giữa chừng.
2. ORM cascading uninstall theo thứ tự: `web_mobile` → `website_enterprise` → `spreadsheet_edition` → `digest_enterprise` → `web_enterprise`, bằng `button_immediate_uninstall()` để ORM tự dọn model/field/view/FK/constraint/XML ID.
3. Remap `ir_module_module_dependency` từ `web_enterprise` sang `backend_ui`, tự xoá bản ghi trùng.
4. Install (hoặc upgrade nếu đã có) `backend_ui`; không thấy bản ghi thì `update_list()` rồi install.
5. Vô hiệu hoá `ir_asset` mồ côi + xoá cache `ir_attachment` có `url =like '/web/assets/%'`.

> 🔒 Lọc cache attachment **chỉ theo `url`, tuyệt đối không theo `name`**. Điều kiện `name =like '%assets%'` khớp cả file người dùng upload (vd. `bang_gia_assets.xlsx`) và `unlink()` là xoá vĩnh viễn.

### Bước 5 — Restart service

```bash
docker restart <CONTAINER_ODOO>
```

Bắt buộc: worker Odoo giữ Python registry cũ trong RAM, không restart thì asset/registry mới không có hiệu lực.

### Bước 6 — Verification Gate

`--verify-url` đã tự kiểm mục 1–3. Mục 4 kiểm tay nếu có bật privacy:

| # | Kiểm tra | Yêu cầu |
|---|---|---|
| 1 | `curl -sI http://<HOST>:<PORT>/web/login` | `HTTP/1.1 200 OK` |
| 2 | `curl -s .../web/login \| grep -i "css error occured"` | **Rỗng hoàn toàn** |
| 3 | Bundle `web.assets_web.min.js` | HTTP 200, > 1MB |
| 4 | `curl -sI http://<HOST>:<PORT>/website/info` | `HTTP/1.1 404` (nếu bật privacy) |

```bash
# Mục 3 kiểm tay
JS_URL=$(curl -s http://<HOST>:<PORT>/web/login | grep -oE '/web/assets/[^"]+/web\.assets_web\.min\.js' | head -1)
curl -sI "http://<HOST>:<PORT>${JS_URL}"
```

**Fail bất kỳ mục nào → rollback ngay:**
```bash
docker exec -i <CONTAINER_PG> pg_restore -U odoo -d <db> --clean --if-exists < "$DUMP"
docker restart <CONTAINER_ODOO>
```

---

## Áp dụng cho nhiều database

Script nhận `-d <db>` nên lặp được. Vẫn phải **backup từng DB** và **dry-run từng DB** — cấu hình addons/module cài đặt mỗi client một khác.

```bash
for DB in client_a client_b client_c; do
  echo "=== $DB ==="
  TS=$(date +%Y%m%d_%H%M%S)
  DUMP=/mnt/DATA/work/$DB/db_backup/${DB}_${TS}_before_backend_ui.dump
  mkdir -p "$(dirname "$DUMP")"
  docker exec -i <CONTAINER_PG> pg_dump -U odoo -d "$DB" -F c -b > "$DUMP"
  pg_restore -l "$DUMP" >/dev/null || { echo "❌ backup $DB hỏng, bỏ qua"; continue; }

  docker exec -i <CONTAINER_ODOO> python3 <SCRIPT> -d "$DB" -c /etc/odoo/odoo.conf   # dry-run xem trước
done
```

Xem output dry-run của cả lô rồi mới apply từng DB một — **không apply hàng loạt không giám sát**.

---

## Decouple License, Expiration & Privacy (chuẩn Odoo 19+)

Phần này thuộc thiết kế module `backend_ui`, không phải script migrate. Ghi ở đây để khỏi thất lạc yêu cầu.

1. **Zero phone-home**: không gọi `publisher_warranty.contract.update_notification()`. Bỏ dialog đăng ký Enterprise Code, kiểm tra sau thanh toán, upsell, unlink database qua email.
2. **Khoá & cảnh báo bản quyền** (theo chuẩn `web_enterprise` local):
   - Còn ≤ 30 ngày và > 0: banner cảnh báo, cho ẩn 24h qua cookie `oe_instance_hide_panel`.
   - Hết hạn (≤ 0 ngày): overlay `.o_blockUI` khoá toàn bộ thao tác.
   - Nút Mua/Gia hạn → `https://vuahethong.net/myaccount/subscription`.
3. **Đồng bộ expiration từ Cloud Master**: `backend_ui` **không gọi ra ngoài**. Cloud Master kết nối vào DB client qua connector và ghi thẳng `database.expiration_date` trong `ir.config_parameter`. User reload trang là tự unblock.
4. **Privacy**:
   - Chặn `/website/info` (404) để bot/scanner không quét được version + danh sách module.
   - Lọc `server_version`, `server_version_info`, `database.uuid`, `enterprise_info` khỏi `ir.http.session_info()`.
   - **Không** monkey-patch toàn cục `odoo.release` hay `RPC_VERSION_1` — gây xung đột module khác.
   - Odoo Mobile phải vẫn đăng nhập và vận hành bình thường.

---

## Luật an toàn

- **Dry-run trước, apply sau.** Luôn đọc output dry-run trước khi `--apply`.
- **Không có backup verify được thì không chạy.** ORM uninstall không rollback được.
- **Zero-production touch khi chưa qua sandbox.** Chạy thử trên bản clone local trước khi động vào production của khách.
- **Không dùng SQL xoá thô.** Mọi thao tác gỡ module phải qua `button_immediate_uninstall()`.
- **Không gọi outbound.** Không thêm network call từ instance khách tới Cloud Master hay bên thứ ba.

## Giới hạn đã biết

`ponytail:` Bước quét `ir_asset` mồ côi chỉ bắt được path dạng `/module/static/...` (có leading slash) hoặc bundle chứa chuỗi `web_enterprise`/`mass_editing`. Asset lưu dạng `module/static/src/**/*.js` (**không** leading slash — dạng phổ biến hơn trong Odoo) sẽ **không bị bắt**. Nếu sau migrate vẫn còn `Could not get content for ...`, kiểm tay:

```sql
SELECT id, name, bundle, path, active FROM ir_asset WHERE active = true ORDER BY path;
```

Rồi đối chiếu prefix đầu của `path` với danh sách module `installed`. Nâng cấp khi gặp ca thật: normalize path (bỏ leading slash) trước khi tách prefix trong `run_orm_conversion`.
