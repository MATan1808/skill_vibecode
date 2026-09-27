---
name: odoo-migrate-web-enterprise
description: Chuyển đổi và tương thích toàn diện từ web_enterprise sang backend_ui trên database Odoo đã nâng cấp (v17/v18/v19). Tự động kiểm tra addons_path, ORM gỡ bỏ module Enterprise UI, remap dependencies, chuẩn hóa ir_model_data, dọn sạch orphaned ir_asset và reset asset bundles đảm bảo 100% không vỡ giao diện CSS.
metadata:
  origin: AIAC
---

# Quy Trình Chuyển Đổi web_enterprise Sang backend_ui Chuẩn Hóa

Skill chuyên biệt dùng để xử lý database Odoo khi chuyển giao sang sử dụng theme giao diện chuẩn `backend_ui` (thay thế hoàn toàn `web_enterprise`), đặc biệt sau khi nâng cấp từ các phiên bản cũ lên **Odoo 17.0, 18.0, 19.0**.

## Các Vấn Đề Thường Gặp Cần Giải Quyết Triệt Để
1. **Thiếu addons_path**: Odoo bỏ qua manifest `module backend_ui: not installable, skipped`, dẫn tới lỗi không tìm thấy view XML kế thừa (`Full path [backend_ui/views/...] cannot be found`).
2. **Xóa thô bằng SQL để lại rác**: Khi chỉ dùng SQL xóa record trong `ir_module_module`, các XML ID, views kế thừa (`webclient_bootstrap`, `webclient_login`, `color_scheme`), constraints và triggers của Enterprise vẫn còn active trong database, dẫn tới lỗi HTTP 500 hoặc conflict XPath.
3. **Lỗi API Odoo 19**: Trong Odoo 19, phương thức `api.Environment.manage()` đã bị loại bỏ. Các script cũ gọi method này sẽ bị crash với lỗi `AttributeError: type object 'Environment' has no attribute 'manage'`.
4. **Vỡ giao diện CSS ("css error occured, using an old style to render this page")**: Phát sinh khi Odoo biên dịch asset bundle nhưng bảng `ir_asset` vẫn còn các bản ghi active trỏ vào file SCSS/JS của module đã gỡ hoặc thiếu source code (như `mass_editing`, `web_enterprise`, `social_zalo`). Bundle biên dịch thất bại và Odoo rơi vào cơ chế fallback giao diện cũ.

---

## 6 Bước Chuyển Đổi Chuẩn Hóa

### Bước 1: Chuẩn Bị & Khai Báo Addons Path
Đảm bảo container Odoo hoặc file cấu hình `odoo.conf` đã bao gồm thư mục chứa theme `backend_ui` (thường là `/mnt/odoo-themes` hoặc `/mnt/themes`):
```ini
[options]
addons_path = /usr/lib/python3/dist-packages/odoo/addons,/mnt/odoo-addons,/mnt/odoo-themes,...
```
*Lưu ý: Nếu chạy trong Docker Sandbox, kiểm tra docker-compose.yml đã mount volume code `/mnt/DATA/work/19.0/themes:/mnt/odoo-themes:ro`.*

### Bước 2: Vị Trí Script Chuẩn Hóa
Script tự động hóa đã được đồng bộ tại:
- `/mnt/DATA/work/aiac/360org/scripts/odoo/migrate_web_enterprise_to_backend_ui.py`
- `/mnt/DATA/work/19.0/themes/backend_ui/scripts/migrate_web_enterprise_to_backend_ui.py`

### Bước 3: Thực Thi Chuyển Đổi ORM Trong Docker Sandbox
Chạy script chuẩn hóa trực tiếp bên trong container Odoo mục tiêu:
```bash
docker exec -i <CONTAINER_ODOO> python3 /mnt/odoo-themes/backend_ui/scripts/migrate_web_enterprise_to_backend_ui.py \
  -d <DB_NAME> \
  -c /etc/odoo/odoo.conf
```
*Hoặc nếu container mount script từ host:*
```bash
docker exec -i <CONTAINER_ODOO> python3 /mnt/DATA/work/aiac/360org/scripts/odoo/migrate_web_enterprise_to_backend_ui.py \
  -d <DB_NAME> \
  -c /etc/odoo/odoo.conf
```

### Bước 4: Cơ Chế Xử Lý Tự Động Của Script (Zero-Downtime / Zero-Error)
1. **Kiểm tra `addons_path`**: Gọi `odoo.modules.load_manifest('backend_ui')`. Dừng ngay lập tức nếu thiếu cấu hình để tránh corrupt DB.
2. **Khởi tạo ORM Registry Tương Thích Odoo 17/18/19**: Khởi tạo cursor trực tiếp không qua `Environment.manage()`:
   ```python
   registry = Registry.new(db_name)
   with registry.cursor() as cr:
       env = api.Environment(cr, SUPERUSER_ID, {})
   ```
3. **ORM Cascading Uninstall Modules Enterprise UI**:
   - Gỡ bỏ tuần tự: `web_mobile`, `website_enterprise`, `spreadsheet_edition`, `digest_enterprise`, `web_enterprise`.
   - Sử dụng `mod.button_immediate_uninstall()` để ORM tự cascade xóa sạch models, fields, views, foreign keys, constraints và XML ID mồ côi.
4. **Remap Dependencies (`ir_module_module_dependency`)**:
   - Chuyển toàn bộ phụ thuộc từ `web_enterprise` sang `backend_ui`.
   - Tự động xóa bản ghi trùng lặp nếu module đã phụ thuộc `backend_ui`.
5. **Cài Đặt / Nâng Cấp `backend_ui`**:
   - Kích hoạt `backend_ui.button_immediate_install()` (hoặc `button_immediate_upgrade()`).
6. **Quét & Vô Hiệu Hóa `ir_asset` Mồ Côi**:
   - Quét tất cả bản ghi trong bảng `ir_asset`.
   - Tắt `active = False` cho các asset trỏ vào module không còn installed hoặc chứa đường dẫn không tồn tại.
7. **Dọn Sạch Cache Assets (`ir_attachment`)**:
   - Xóa bỏ toàn bộ attachments cache `/web/assets/%` để kích hoạt Odoo biên dịch bundle mới tinh sạch.

### Bước 5: Khởi Động Lại Service Odoo
```bash
docker restart <CONTAINER_ODOO>
```

### Bước 6: Automated Verification Gate (Kiểm Thử Tự Động)
1. **Kiểm tra HTTP Login**:
   ```bash
   curl -sI http://<HOST>:<PORT>/web/login
   ```
   *Yêu cầu*: Trả về `HTTP/1.1 200 OK`.
2. **Kiểm tra CSS Error Warning**:
   ```bash
   curl -s http://<HOST>:<PORT>/web/login | grep -i "css error occured"
   ```
   *Yêu cầu*: Hoàn toàn rỗng (không có cảnh báo lỗi CSS).
3. **Kiểm tra Bundle JavaScript Quản Trị**:
   ```bash
   JS_URL=$(curl -s http://<HOST>:<PORT>/web/login | grep -oE '/web/assets/[^"]+/web\.assets_web\.min\.js' | head -1)
   curl -sI "http://<HOST>:<PORT>${JS_URL}"
   ```
   *Yêu cầu*: Trả về `HTTP/1.1 200 OK`, dung lượng > 1MB, chứa đầy đủ các khai báo của `backend_ui`.

---

## Quy Định An Toàn Cốt Lõi
- **Zero-Production Touch**: Toàn bộ thao tác chạy trong môi trường Docker Sandbox local, tuyệt đối không thao tác trực tiếp trên live production.
- **Không dùng SQL Xóa Thô**: Mọi thao tác gỡ bỏ module UI phải qua ORM `button_immediate_uninstall()` để bảo đảm toàn vẹn cấu trúc cơ sở dữ liệu.
