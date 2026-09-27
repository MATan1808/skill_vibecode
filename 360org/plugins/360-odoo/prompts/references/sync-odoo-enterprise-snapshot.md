---
name: odoo-sync-enterprise-snapshot
description: |
  Đồng bộ mã nguồn Odoo Enterprise snapshot mới vào addons/ và merge backend_ui (v17/v18/v19+),
  tự động đổi dependency web_enterprise -> backend_ui, xử lý version skew core Python, và verify gate.
  Trigger: "sync odoo ee snapshot", "đồng bộ snapshot odoo enterprise", "move code odoo ee",
  "thay thế addons odoo ee", "merge web_enterprise vào backend_ui", "sync snapshot 19.0",
  "lấy toàn bộ code odoo-ee thay thế cho backend_ui".
metadata:
  origin: AIAC
---

# Quy Trình Đồng Bộ Odoo Enterprise Snapshot & Merge Backend UI

Tài liệu chuẩn hóa quy trình tiếp nhận và cập nhật mã nguồn từ một bản phát hành Odoo Enterprise snapshot mới (ví dụ: `odoo-19.0+e.20260913`) vào hệ sinh thái phát triển của 360 CORP.

---

## 1. Bản chất Kiến trúc & Vấn đề Cốt lõi

Hệ sinh thái Odoo của 360 CORP sử dụng kiến trúc phân tầng:
- **`themes/backend_ui`**: Là bản fork độc lập của `web_enterprise`, mang thương hiệu VUAHETHONG/360 CORP, loại bỏ phone-home, bỏ license check Odoo, tùy biến Navbar, Systray, Dark mode, App Switcher, v.v.
- **`addons/`**: Kho lưu trữ toàn bộ các addons Odoo Enterprise và Community chuẩn.
- **`default/`, `themes/`, `extra/`**: Các thư mục overlay ưu tiên cao hơn `addons/`.

### 3 Cạm bẫy Kỹ thuật then chốt khi cập nhật Snapshot:
1. **Vendor Merge thủ công gây sót/mất tính năng**:
   - Nếu copy đè thủ công `web_enterprise` vào `backend_ui`, toàn bộ tính năng đã dev của `backend_ui` sẽ bị mất.
   - **Giải pháp**: Dùng **Git 3-way Merge với Vendor Branch** (lấy commit import gốc `fe547f7` làm merge base). Git sẽ tự động ghép >80% số file, chỉ giữ lại vài conflict thật sự để AI xử lý với nguyên tắc: **Ưu tiên giữ HEAD (backend_ui)**.
2. **Version Skew giữa Core Python và Addons mới**:
   - Image Docker `odoo:19.0` thường được build từ một bản snapshot cũ hơn (ví dụ build tháng 08/2026).
   - Snapshot mới (tháng 09/2026) có thể bổ sung các hàm nội bộ trong core (ví dụ `_ignore_tax_lock_date` trong `account_move_line.py`).
   - Nếu chỉ rsync `addons/` mà không cập nhật `odoo/` core trong container, các module mới sẽ văng lỗi `ImportError` hoặc `AttributeError` ngay khi khởi động.
   - **Giải pháp**: Replace thư mục `odoo/` trong container bằng core từ snapshot mới.
3. **Mất .gitignore và module bổ trợ khi rsync `--delete`**:
   - Snapshot Odoo tải về không có file `.gitignore` và không có module custom của team (như `l10n_it_xml_export`).
   - **Giải pháp**: Luôn exclude `.git/`, khôi phục `.gitignore` sau khi rsync, và exclude các module custom.

---

## 2. Quy Trình 7 Bước Chuẩn

### Bước 1 — Tag An Toàn & Backup
Trước khi thực hiện bất kỳ thay đổi nào:
```bash
# Tag an toàn trên các repo
cd /mnt/DATA/work/19.0/themes/backend_ui && git tag -f pre-vendor-merge-19.0 19.0
cd /mnt/DATA/work/19.0/addons && git tag -f pre-ee-sync-19.0 19.0

# Backup thư mục overlay
TS=$(date +%Y%m%d-%H%M%S)
tar czf /mnt/DATA/work/19.0/overlay-backup-$TS.tgz -C /mnt/DATA/work/19.0 default themes extra 2>/dev/null
```

### Bước 2 — Vendor 3-way Merge `web_enterprise` → `backend_ui`
1. Dựng nhánh vendor tạm dựa trên commit import gốc:
   ```bash
   cd /mnt/DATA/work/19.0/themes/backend_ui
   git checkout -B vendor/web_enterprise-19.0 <base_commit_id>
   ```
2. Đưa code `web_enterprise` từ snapshot vào, đổi tên namespace:
   ```bash
   SRC_WE="/mnt/DATA/Resources/odoo-ee/.../odoo/addons/web_enterprise"
   rsync -a --delete --exclude=.git "$SRC_WE/" ./
   # Replace chuỗi web_enterprise -> backend_ui cho text file
   find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.xml" -o -name "*.scss" \) \
     -exec sed -i 's/web_enterprise/backend_ui/g; s/Web Enterprise/Backend UI/g' {} +
   git add -A && git commit -m "vendor: import web_enterprise <version>"
   ```
3. Merge vào nhánh chính `19.0`:
   ```bash
   git checkout 19.0
   git merge --no-commit --no-ff vendor/web_enterprise-19.0
   ```
4. **Giải quyết conflict (ƯU TIÊN BACKEND_UI)**:
   - Các file có logic/branding đã dev (`models/res_users_settings.py`, `webclient.js`, `promote_studio_*`): `git checkout --ours -- <file>`.
   - Các file test đồng bộ API mới của core (`home_menu.test.js`): `git checkout --theirs -- <file>`.
   - Kiểm tra lại: đảm bảo không còn conflict markers `<<<<<<<`.
   - Bump version trong `__manifest__.py` và cập nhật `docs/CHANGELOGS.md`.
   - Commit với trailer chuẩn `Authored-By: 360org <support@360.org.vn>`.

### Bước 3 — Rsync Addons Snapshot vào `addons/`
```bash
SRC="/mnt/DATA/Resources/odoo-ee/.../odoo/addons/"
DST="/mnt/DATA/work/19.0/addons/"

rsync -a --delete \
  --exclude=".git/" \
  --exclude="/web_enterprise/" \
  --exclude="/l10n_it_xml_export/" \
  "$SRC" "$DST"

# Khôi phục .gitignore
cd /mnt/DATA/work/19.0/addons && git checkout HEAD -- .gitignore
```

### Bước 4 — Đổi Dependency `web_enterprise` → `backend_ui`
Sử dụng script canonical `/Volumes/DATA/DEV/aiac/360org/scripts/odoo/sync_odoo_enterprise_snapshot.py` hoặc python một dòng:
```bash
python3 -c "
import os, re
PAT = re.compile(r'([\'\"])web_enterprise\1')
for root in ['/mnt/DATA/work/19.0/addons', '/mnt/DATA/work/19.0/themes']:
    for m in os.listdir(root):
        mf = os.path.join(root, m, '__manifest__.py')
        if os.path.isfile(mf):
            s = open(mf).read()
            if 'web_enterprise' in s:
                open(mf, 'w').write(PAT.sub(lambda mo: mo.group(1)+'backend_ui'+mo.group(1), s))
"
```

### Bước 5 — Dọn dẹp Duplicates & Overlays
1. **Xoá `addons/web_enterprise`**: Bắt buộc xoá để Odoo chỉ nạp `themes/backend_ui`.
2. **Kiểm tra overlays (`default/`, `themes/`)**:
   - Nếu module trong overlay chỉ sửa mỗi dòng `depends` mà không có custom code gì khác (như `digest_enterprise`, `spreadsheet_edition`, `web_mobile`, `website_enterprise` cũ) → **Xoá bỏ khỏi overlay**, để nạp trực tiếp từ `addons/` (đã được sửa dependency ở Bước 4).
   - Chỉ giữ trong overlay những module có custom nghiệp vụ thực sự.

### Bước 6 — Đồng Bộ Core Odoo Python (Nếu có Version Skew)
Nếu snapshot mới hơn base image Docker:
```bash
C="odoo_dev_v19"
ROOT="/mnt/DATA/Resources/odoo-ee/.../odoo"
D="/usr/lib/python3/dist-packages"

# Backup core cũ và copy core mới
docker exec -u 0 $C sh -c "rm -rf $D/odoo.old && mv $D/odoo $D/odoo.old"
cd $ROOT && tar cf - odoo | docker exec -u 0 -i $C tar xf - -C $D
docker exec -u 0 $C chown -R root:root $D/odoo

# Xóa web_enterprise trong core và đổi dependency trong core addons
docker exec -u 0 $C rm -rf $D/odoo/addons/web_enterprise
# Chạy script đổi dependency cho core addons trong container
```

### Bước 7 — Verification Gate & Commit GitLab
1. **Chạy test trên Database Rỗng mới hoàn toàn**:
   ```bash
   docker exec -e PGPASSWORD=odoo $C sh -c "
     dropdb -h db -U odoo --if-exists --force odoo_test_ee 2>&1
     createdb -h db -U odoo odoo_test_ee 2>&1
     odoo -d odoo_test_ee -i base,backend_ui,project_enterprise,web_studio,documents \
       --without-demo=all --stop-after-init --http-port=8199 --gevent-port=8299
   "
   # Kiểm tra exit code = 0 và log không có CRITICAL / ImportError
   ```
2. **Verify Database Dev Live (`odoo_19`)**:
   ```bash
   docker exec -e PGPASSWORD=odoo $C odoo -d odoo_19 -u backend_ui --stop-after-init --http-port=8199 --gevent-port=8299
   ```
3. **Commit & Push Remote**:
   - `themes/backend_ui`: Commit kèm trailer `Authored-By: 360org <support@360.org.vn>` → `git push origin 19.0`.
   - `addons/`: Stage toàn bộ (`git add -A`), commit chuẩn kèm trailer → `git push origin 19.0`.
