---
name: odoo-database-upgrade
description: Chuẩn quy trình 10 bước nâng cấp toàn diện Odoo đa phiên bản (14.0/15.0 -> 19.0 Enterprise) qua Odoo Upgrade Platform và Docker Sandbox. Bao gồm Gate 1 phê duyệt gỡ bỏ/nâng cấp custom modules trước khi upgrade test, migrate code sang target version, kiểm thử sandbox đầy đủ cả frontend/backend/logs, backup DB mới & chạy upgrade production chính thức, và Gate 2 phê duyệt nghiêm ngặt trước khi deploy production.
metadata:
  origin: AIAC
---

# Quy Trình Nâng Cấp Odoo Toàn Diện (Chuẩn Hóa AIAC - 10 Bước)

Quy trình nâng cấp Odoo database & instance qua nền tảng chính thức `upgrade.odoo.com`. Áp dụng đồng bộ cho mọi khách hàng (`/mnt/DATA/work/<client-name>/` hoặc `/mnt/DATA/<client-name>/`).

## Định Nghĩa Môi Trường & Thuật Ngữ (LUẬT CỨNG BẮT BUỘC)
- **"local"**: Máy Mac (iMac) của Sếp (`/Volumes/DATA/...`, macOS).
- **"local server"**: Local Server nội bộ (`192.168.1.100`, user `root`, alias `ssh local`). Dữ liệu tại `/mnt/DATA/work/<client-name>/`.
- **"production server"**: Server Production Vua Hệ Thống (`ssh vuahethong`) và cụm Rancher / Kubernetes cluster `saas`.
- **"test db" / "upgrade test"**: Chạy lệnh upgrade portal ở chế độ `test` (`yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) test ...`). Kết quả trả về là bản database thử nghiệm (Odoo SA tự động neutralize dữ liệu, inject ribbon `TEST`).
- **"upgrade production" / "production db"**: Chạy lệnh upgrade portal ở chế độ `production` (`yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) production ...`). Kết quả trả về là bản database production hoàn chỉnh (không bị neutralize, không ribbon TEST) sẵn sàng đưa lên production server.

## Hàng Rào An Toàn Cốt Lõi (Guardrails)

1. **Zero-Production Touch**: Không chạy scripts dọn dẹp, lệnh drop hay upgrade trực tiếp trên pod/container production. Mọi thao tác xử lý lỗi chỉ diễn ra trong Docker Sandbox local server (`192.168.1.100`).
2. **Local Host Cleanliness**: Không cài đặt PostgreSQL hay Python package trực tiếp lên OS của local server. Toàn bộ công cụ chạy trong Docker sandbox (`postgres:17-alpine`, `odoo:<version>`).
3. **ORM Uninstall Over SQL Deletion**: Khi gỡ module bên thứ 3 hoặc custom modules không cần nâng cấp, bắt buộc dùng Odoo ORM (`button_immediate_uninstall()`) để cascade dọn sạch model, field, view, constraint và XML ID. Tuyệt đối không xóa thô bằng SQL.
4. **Hai Lần Upgrade (Test DB -> Production DB)**: Lần nâng cấp đầu tiên chạy ở chế độ `test` để phát hiện lỗi schema, orphan data và kiểm thử toàn diện cả frontend & backend. Sau khi sandbox nghiệm thu đạt chuẩn tuyệt đối, mới backup lại DB mới nhất từ production và chạy upgrade ở chế độ `production`.
5. **Dual Approval Gates**:
   - **Gate 1 (Bước 4 - Duyệt Module Trước Upgrade)**: Liệt kê danh sách toàn bộ custom module đã cài, trình bày để người dùng duyệt module nào giữ lại nâng cấp, module nào loại bỏ (`AskUserQuestion`).
   - **Gate 2 (Bước 10 - Duyệt Deploy Production)**: Triển khai production bắt buộc phải có sự xác nhận và phê duyệt rõ ràng từ người dùng (`AskUserQuestion`). Agent tuyệt đối không tự ý deploy.

---

## Cấu Trúc Thư Mục Tiêu Chuẩn

```text
/mnt/DATA/work/<client-name>/
├── docs/                # [BẮT BUỘC] Hồ sơ tài liệu kỹ thuật & lịch sử nâng cấp
│   ├── README.md        # Tổng quan dự án, thông tin phiên bản nguồn/đích, hợp đồng nâng cấp
│   ├── ROADMAP.md       # Lộ trình nâng cấp chi tiết, kế hoạch phân kỳ, mốc thời gian hoàn thành
│   ├── CHANGELOGS.md    # Nhật ký thay đổi kỹ thuật, sửa đổi schema, gỡ bỏ/nâng cấp addons qua từng bước
│   └── AUDIT_UPGRADE.md # Kết quả audit toàn diện, lượng hóa giờ làm việc, chi phí và logs chi tiết
├── data/
│   └── filestore/
│       └── <db_name>/   # Cloned filestore từ production (đính kèm, hình ảnh, tài liệu)
├── db_backup/           # Dumps gốc từ production (raw_test.dump, raw_prod.dump, fixed_upgrade.dump)
├── upgraded/            # Kết quả từ upgrade.odoo.com (upgraded_test/, upgraded_prod/, logs, reports)
├── env/
│   ├── vXX_source/      # Sandbox nguồn mô phỏng 100% production để test, audit & gỡ bỏ module thừa
│   └── v19_target/      # Sandbox đích (v19.0) để nghiệm thu phiên bản nâng cấp đầy đủ
├── modules/             # Custom addons nguồn của khách hàng
└── work/
    └── <target_version>/
        └── <client-name>/ # Thư mục chứa custom modules đã migrate code sang version đích
```

## Quy Chuẩn Cứng Về Cập Nhật Tài Liệu Dự Án (`docs/*`)

Toàn bộ quy trình nâng cấp bắt buộc phải ghi nhận lịch sử xuyên suốt vào thư mục `docs/`. Tuyệt đối không bỏ sót bất kỳ bước nào:
1. **`docs/README.md`**: Ghi rõ khách hàng, version nguồn (v15.0) -> version đích (v19.0), ngày bắt đầu, trạng thái hiện tại, đường dẫn sandbox local và production ingress.
2. **`docs/ROADMAP.md`**: Cập nhật tiến độ 10 bước chuẩn hóa, đánh dấu checklist `[x]` ngay khi hoàn thành từng bước, ghi rõ người thực hiện và mốc thời gian.
3. **`docs/CHANGELOGS.md`**: Ghi chép chi tiết từng thay đổi kỹ thuật:
   - Các orphan Foreign Key đã xử lý và lệnh SQL/ORM khắc phục.
   - Danh sách custom modules bị gỡ bỏ kèm lý do (như trùng tính năng native Odoo 19 hoặc lỗi schema).
   - Danh sách custom modules đã migrate code sang v19 (thay đổi file, đổi cú pháp `<tree>` sang `<list>`, OWL 2 components).
   - Lịch sử chuyển đổi theme `web_enterprise` sang `backend_ui`.
4. **`docs/AUDIT_UPGRADE.md`**: Lưu giữ biên bản kiểm toán phân tích schema, thống kê số lượng bản ghi kế toán, đơn hàng, hóa đơn, thời gian nâng cấp thực tế và dự toán chi phí.

## Chính Sách Quản Lý Contract Key

- **Thứ tự ưu tiên cấu hình**:
  1. `/mnt/DATA/dev/.env`: `ODOO_UPGRADE_CONTRACT="M21063027984628"` (ưu tiên số 1, bảo vệ ổ cứng dữ liệu).
  2. Môi trường host: `/etc/environment` hoặc `/etc/profile.d/odoo_upgrade.sh`.
  3. Default Key: `M21063027984628`.
- **Nghiêm cấm**: Không lưu key phân mảnh trong `.env` của từng dự án và không lấy key từ bảng `ir_config_parameter` của DB.
- **Xử lý khi key hết hạn / từ chối**: Dừng lại ngay lập tức và gửi câu hỏi yêu cầu người dùng cung cấp key mới (`AskUserQuestion`) trước khi tiếp tục.

---

## Chi Tiết 10 Bước Nâng Cấp Chuẩn Hóa

### Bước 1: Backup DB về Local Server (`db_backup/`)
- Kiểm tra thư mục `<project-dir>/db_backup/`.
- Kết nối an toàn đến production node/pod để stream bản backup về local server:
  ```bash
  ssh root@<PROD_HOST> "cat <LATEST_BACKUP_PATH>" > /mnt/DATA/work/<client-name>/db_backup/<client-name>_raw_test.dump
  ```
- Kiểm tra dung lượng và đối chiếu checksum `md5sum` giữa production và local server để đảm bảo dữ liệu toàn vẹn.

### Bước 2: Sync Custom Modules về Local Server (`modules/`)
- Đồng bộ toàn bộ custom modules của khách hàng về thư mục `<project-dir>/modules/`:
  ```bash
  rsync -avz --partial root@<PROD_HOST>:/home/instances/<client-name>/data/addons/ /mnt/DATA/work/<client-name>/modules/
  ```

### Bước 3: Build Local Sandbox Nguồn & Test Môi Trường Gốc
- Chuẩn bị thư mục filestore bên ngoài theo chuẩn cấu trúc:
  ```text
  /mnt/DATA/work/<client-name>/data/filestore/<db_name>/
  ```
- Clone filestore từ production host về máy cục bộ:
  ```bash
  rsync -avz --partial root@<PROD_HOST>:/home/instances/<client-name>/data/filestore/<db_name>/ /mnt/DATA/work/<client-name>/data/filestore/<db_name>/
  ```
- Khởi động môi trường sandbox nguồn tại `env/vXX_source/docker-compose.yml`:
  - Mount DB volume và volume backup: `../../db_backup:/mnt/backup:ro`.
  - Mount filestore từ bên ngoài vào docker container:
    - **Cấu hình volume compose**: `/mnt/DATA/work/<client-name>/data/filestore/<db_name>:/var/lib/odoo/.local/share/Odoo/filestore/<db_name>` (hoặc `/mnt/DATA/work/<client-name>/data/filestore:/var/lib/odoo/.local/share/Odoo/filestore`).
  - Mount custom modules: `../../modules:/mnt/client-addons`.
- Restore database vào sandbox PostgreSQL nguồn:
  ```bash
  docker exec -i <CONTAINER_DB_SOURCE> dropdb -U odoo --if-exists <DB_NAME>
  docker exec -i <CONTAINER_DB_SOURCE> createdb -U odoo -O odoo <DB_NAME>
  docker exec -i <CONTAINER_DB_SOURCE> pg_restore -U odoo -d <DB_NAME> --no-owner --no-privileges /mnt/backup/<client-name>_raw_test.dump
  ```
- Khởi động Odoo web nguồn, đăng nhập kiểm tra toàn diện (giao diện, hình ảnh sản phẩm, file đính kèm hóa đơn) để đảm bảo sandbox hoạt động 100% giống production.

### Bước 4: Audit Custom Modules & Duyệt Danh Sách Nâng Cấp / Loại Bỏ (GATE DUYỆT 1)
- **Quét toàn bộ custom modules đang cài đặt trong database**:
  ```bash
  docker exec -i <CONTAINER_DB_SOURCE> psql -U odoo -d <DB_NAME> -c "
  SELECT m.name, m.shortdesc, m.author, m.installed_version 
  FROM ir_module_module m 
  WHERE m.state = 'installed' 
    AND m.name NOT IN (SELECT name FROM ir_module_module WHERE author LIKE '%Odoo%')
  ORDER BY m.name;
  "
  ```
- **Phân loại module thành 3 nhóm rõ ràng**:
  1. *Nhóm 1 - Giữ lại & Nâng cấp*: Các custom modules đặc thù nghiệp vụ cốt lõi của khách hàng cần migrate lên target version.
  2. *Nhóm 2 - Đã có tính năng gốc ở bản đích*: Các module bên thứ 3 giải quyết tính năng mà target version đã có sẵn chuẩn (ví dụ: native Gantt view, Map view, Storno accounting).
  3. *Nhóm 3 - Gỡ bỏ hoàn toàn*: Các module không còn dùng, không tương thích, hoặc bên thứ 3 gây xung đột schema.
- **Dừng lại xin duyệt (`AskUserQuestion`)**:
  - Trình bày bảng danh sách 3 nhóm cho người dùng phê duyệt chi tiết.
- **Tiến hành gỡ bỏ sạch sẽ qua ORM trong Sandbox Nguồn**:
  - Đối với các module người dùng duyệt **Loại bỏ**:
    ```bash
    docker exec -i <CONTAINER_ODOO_SOURCE> python3 -c "
    import odoo; from odoo import api, SUPERUSER_ID
    registry = odoo.registry('<DB_NAME>')
    with registry.cursor() as cr:
        env = api.Environment(cr, SUPERUSER_ID, {})
        for mod_name in ['<MODULE_TO_REMOVE_1>', '<MODULE_TO_REMOVE_2>']:
            mod = env['ir.module.module'].search([('name', '=', mod_name), ('state', '=', 'installed')])
            if mod:
                print(f'[*] Đang gỡ bỏ module: {mod_name}')
                mod.button_immediate_uninstall()
    "
    ```
- **Xuất bản Dump sạch đã loại bỏ module thừa**:
  ```bash
  docker exec -i <CONTAINER_DB_SOURCE> pg_dump -U odoo -d <DB_NAME> -F c -b > /mnt/DATA/work/<client-name>/db_backup/<client-name>_fixed_upgrade_test.dump
  ```

### Bước 5: Nâng Cấp Database Thử Nghiệm Bằng `upgrade.odoo.com` (Dạng Test)
- Đọc biến contract key tập trung từ `/mnt/DATA/dev/.env`:
  ```bash
  DEFAULT_KEY="M21063027984628"
  [ -f "/mnt/DATA/dev/.env" ] && CONTRACT_KEY=$(grep -E '^ODOO_UPGRADE_CONTRACT=' /mnt/DATA/dev/.env | cut -d '=' -f2 | tr -d '"\r\n')
  CONTRACT_KEY="${CONTRACT_KEY:-$DEFAULT_KEY}"
  ```
- Chuyển vào thư mục `upgraded/` và chạy lệnh nâng cấp CLI ở chế độ test mode:
  ```bash
  cd /mnt/DATA/work/<client-name>/upgraded
  yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) test \
    -i /mnt/DATA/work/<client-name>/db_backup/<client-name>_fixed_upgrade_test.dump \
    -c "${CONTRACT_KEY}" \
    -t <TARGET_VERSION> \
    -x
  ```
- Nếu phát sinh lỗi trong quá trình upgrade (Fix Loop):
  - Chạy script kiểm tra orphan FK trong sandbox nguồn:
    ```sql
    DO $$
    DECLARE
        r RECORD;
        v_count integer;
    BEGIN
        FOR r IN (
            SELECT c.conrelid::regclass AS tbl, c.conname AS cname, c.confrelid::regclass AS ref_tbl, kcu.column_name AS fk_col, ccu.column_name AS pk_col
            FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
            JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = c.conname AND kcu.constraint_schema = n.nspname
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = c.conname AND ccu.constraint_schema = n.nspname
            WHERE c.contype = 'f' AND n.nspname = 'public'
        ) LOOP
            BEGIN
                EXECUTE format('SELECT count(*) FROM %s t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s r WHERE r.%I = t.%I)', r.tbl, r.fk_col, r.ref_tbl, r.pk_col, r.fk_col) INTO v_count;
                IF v_count > 0 THEN
                    RAISE NOTICE 'Violation in %: % (col %, count: %)', r.tbl, r.cname, r.fk_col, v_count;
                END IF;
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END LOOP;
    END $$;
    ```
  - Dọn sạch quan hệ orphan trong sandbox nguồn, xuất lại dump và chạy lại lệnh nâng cấp cho đến khi thành công 100%.
- Toàn bộ kết quả tải về lưu vào `<project-dir>/upgraded/`: `upgraded.zip`, `upgrade.log`, `upgrade-report.html`.

### Bước 6: Migrate Toàn Bộ Custom Modules Sang Targeted Version
- **BẮT BUỘC THỰC HIỆN TRƯỚC KHI RESTORE SANDBOX ĐÍCH**:
  - Không mount code cũ của custom module vào container version mới.
  - Chuẩn bị thư mục code phiên bản đích: `/mnt/DATA/work/<target_version>/<client-name>/`.
  - Đối với các custom modules đã được duyệt **Giữ lại & Nâng cấp** ở Bước 4:
    1. Phân tích cú pháp code bằng công cụ tự động của AIAC:
       ```bash
       python3 /mnt/DATA/work/aiac/360org/scripts/odoo/odoo_code_migrate.py \
         --path /mnt/DATA/work/<client-name>/modules/<module_name> \
         --from <SOURCE_VER> \
         --to <TARGET_VER> \
         --write
       ```
    2. Nâng cấp API Python: Cập nhật imports (`tools`, `Manifest`), bỏ các hàm/thuộc tính đã deprecated (như `@api.returns`, `_sql_constraints` syntax mới, OWL component lifecycle).
    3. Chuyển đổi Views XML: Thay thế `<tree>` bằng `<list>`, thuộc tính `attrs="..."` sang `invisible="..."`, `readonly="..."`, `required="..."` trực tiếp.
    4. Cập nhật `__manifest__.py`: Đổi số version (`<TARGET_VER>.1.0.0`), cập nhật dependency tương thích.
    5. Lưu trữ modules đã migrate vào thư mục: `/mnt/DATA/work/<target_version>/<client-name>/`.

### Bước 7: Restore Sandbox Đích (Target Version Sandbox) & Chuyển Đổi Theme
- Giải nén gói nâng cấp test:
  ```bash
  cd /mnt/DATA/work/<client-name>/upgraded
  unzip -q upgraded.zip -d extracted_target
  ```
- Đồng bộ bổ sung các assets mới từ `extracted_target/filestore/` vào thư mục filestore chung `/mnt/DATA/work/<client-name>/data/filestore/<db_name>/`.
- Cấu hình file `docker-compose.yml` của `env/vXX_target/`:
  - Mount core version target: `/mnt/DATA/work/<target_version>/addons`, `themes`, `default`.
  - Mount các custom module vừa migrate ở Bước 6: `/mnt/DATA/work/<target_version>/<client-name>/:/mnt/client-addons`.
  - Mount filestore từ bên ngoài vào docker container:
    - **Cấu hình volume compose**: `/mnt/DATA/work/<client-name>/data/filestore/<db_name>:/var/lib/odoo/.local/share/Odoo/filestore/<db_name>` (hoặc mount trỏ vào `/var/lib/odoo/filestore/<db_name>`).
- Restore database vào sandbox target:
  ```bash
  docker exec -i <TARGET_DB> psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS <DB_NAME>; CREATE DATABASE <DB_NAME> OWNER odoo;"
  docker exec -i <TARGET_DB> psql -U odoo -d <DB_NAME> < /mnt/DATA/work/<client-name>/upgraded/extracted_target/dump.sql
  ```
- **Chuyển đổi tương thích web_enterprise -> backend_ui (nếu dùng theme backend_ui)**:
  ```bash
  docker exec -i <TARGET_ODOO> python3 /mnt/DATA/work/aiac/360org/scripts/odoo/migrate_web_enterprise_to_backend_ui.py \
    -d <DB_NAME> -H db -p 5432 -U odoo -W odoo
  docker exec -i <TARGET_ODOO> odoo -d <DB_NAME> -u backend_ui --stop-after-init --config /etc/odoo/odoo.conf
  ```
- Nâng cấp và cập nhật schema cho toàn bộ custom modules đã migrate:
  ```bash
  docker exec -i <TARGET_ODOO> odoo -d <DB_NAME> -u <MIGRATED_MODULE_1>,<MIGRATED_MODULE_2> --stop-after-init --config /etc/odoo/odoo.conf
  ```
- Khởi động lại service Odoo target:
  ```bash
  docker restart <TARGET_ODOO>
  ```

### Bước 8: Test & Review Toàn Diện Cả Frontend, Backend & Logs
- **Frontend Verification**:
  - Truy cập `/web/login`, kiểm tra HTTP status code `200 OK`.
  - Đảm bảo giao diện CSS sạch, không vỡ layout, không có cảnh báo `"css error occured"`.
  - Kiểm tra bundle JS: `/web/assets/.../web.assets_web.min.js` tải thành công (> 1MB), không có JavaScript error trong browser console.
  - Test responsive layout trên Desktop, Tablet và Mobile.
- **Backend & Data Integrity Verification**:
  - Đối chiếu số liệu kế toán: Bảng cân đối kế toán, bút toán sổ nhật ký (`account_move`), dòng bút toán (`account_move_line`), Storno Accounting.
  - Nghiệp vụ cốt lõi: Đơn bán hàng (`sale_order`), mua hàng (`purchase_order`), cho thuê (`rental`), dự án (`project_project`), kho vận & định giá kho (`stock_valuation_layer`).
  - Custom addons: Mở các form view, list view, wizard của custom modules đã migrate để xác nhận hoạt động bình thường, không crash ORM.
- **Log Inspection & Health Check**:
  - Quét toàn bộ server logs: `docker logs --tail 500 <TARGET_ODOO> | grep -E "ERROR|CRITICAL|Traceback"`.
  - Xác nhận 0 lỗi nghiêm trọng, 0 Traceback chưa được xử lý, server hoạt động mượt mà, phản hồi API < 500ms.
- Tổng hợp biên bản UAT chi tiết (kèm metrics so sánh trước & sau nâng cấp).

### Bước 9: Backup Lại DB Mới Nhất & Upgrade Dạng Production (`production mode`)
- Sau khi Bước 8 nghiệm thu đạt chuẩn 100%:
- **Backup DB mới nhất từ Production Host**:
  ```bash
  ssh root@<PROD_HOST> "cat <LATEST_BACKUP_PATH>" > /mnt/DATA/work/<client-name>/db_backup/<client-name>_raw_prod.dump
  ```
- **Thực hiện script gỡ bỏ các module đã duyệt ở Bước 4 và clean orphan data tự động** (áp dụng các bản vá đã được kiểm chứng thành công ở Bước 4 & 5).
- Xuất dump sạch chuẩn bị cho production: `/mnt/DATA/work/<client-name>/db_backup/<client-name>_fixed_prod.dump`.
- **Nâng cấp Database chính thức ở chế độ `production`**:
  ```bash
  cd /mnt/DATA/work/<client-name>/upgraded
  yes y | python3 <(curl -s https://upgrade.odoo.com/upgrade) production \
    -i /mnt/DATA/work/<client-name>/db_backup/<client-name>_fixed_prod.dump \
    -c "${CONTRACT_KEY}" \
    -t <TARGET_VERSION> \
    -x
  ```
- Lưu kết quả chính thức vào thư mục `upgraded/production/`.

### Bước 10: Triển Khai Production (BẮT BUỘC ANH DUYỆT - GATE DUYỆT 2)
- **GATE PHÊ DUYỆT BẮT BUỘC**:
  - Agent **KHÔNG ĐƯỢC PHÉP** tự ý kết nối hay thay đổi bất kỳ tài nguyên nào trên Kubernetes / Production Host.
  - Trình bày báo cáo tóm tắt:
    - Trạng thái UAT Frontend & Backend (0 error log).
    - Kết quả nâng cấp database dạng production (`success`).
    - Dung lượng DB và filestore delta cần đồng bộ.
    - Thời gian downtime dự kiến.
  - Gửi yêu cầu người dùng duyệt qua `AskUserQuestion`:
    > *"Bản nâng cấp Production chính thức đã hoàn tất và vượt qua toàn bộ bài kiểm tra UAT. Bạn có đồng ý phê duyệt chuyển đổi dữ liệu và kích hoạt instance mới lên Production không? (Yes/No)"*
- **Sau khi được người dùng phê duyệt rõ ràng**:
  1. Đặt thông báo bảo trì trên instance cũ.
  2. Đồng bộ filestore delta phát sinh trong ngày: `rsync -avz --partial ...`.
  3. Triển khai Odoo Pod/Instance mới trên hạ tầng Production.
  4. Restore database production đã nâng cấp từ Bước 9.
  5. Deploy custom modules đã migrate (Bước 6) lên production addons path.
  6. Chạy script chuyển đổi theme `migrate_web_enterprise_to_backend_ui.py` trên DB production.
  7. Cập nhật Ingress / Reverse Proxy trỏ domain chính thức sang instance mới.
  8. Kiểm tra live health check, tắt chế độ bảo trì, nghiệm thu và bàn giao.
