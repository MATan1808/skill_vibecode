---
name: 360-instance-arch
description: |
  Kiến trúc thư mục chuẩn cho MỘT INSTANCE KHÁCH HÀNG dev dài hạn (Odoo v14-v19).
  MUST load khi user nói: "khởi tạo instance khách hàng", "dựng repo cho khách", "kiến trúc project odoo",
  "gộp 2 bản checkout", "sync dev với local server", "layout addons_path", "chuẩn hoá thư mục project",
  "instance master của 360", "dev → local server → production",
  "sync cái gì về máy dev", "filestore để đâu", "backup để đâu", "dump có cần kéo về mac không",
  "production nên có gì", "loại trừ gì khi deploy", "ignore-list sync", "ma trận sync".
  Áp dụng cho repo chứa addons + docs + config của một khách hàng, dev liên tục theo thời gian —
  KHÔNG áp cho repo một module đơn lẻ (dùng `360-odoo` cho việc đó).
  Quy định: 7 thư mục gốc, 4 nhánh modules khớp 1-1 addons_path, luồng 3 tầng dev/local-server/production,
  ranh giới backups vs resources vs work, docs 2 tầng (instance vs module), ignore-list sync.
metadata:
  origin: 360org
---

# 360org — Instance Architecture

Kiến trúc repo cho **một instance khách hàng** dev dài hạn. Đọc kèm `instance-arch-standards.md`.

## Khi nào dùng

| Tình huống | Skill |
|---|---|
| Repo instance khách hàng (nhiều module + docs + config) | **360-instance-arch** ← đây |
| Một module Odoo đơn lẻ | `360-odoo` |
| Project không phải Odoo | `360-dev-workflow` |

## 1. Bảy thư mục gốc

```
<khach-hang>/
├── modules/     code addons — 4 nhánh khớp 1-1 addons_path
├── docs/        changelog · roadmap · history · kiến trúc TOÀN INSTANCE
├── work/        file & script do agent tạo ra
├── backups/     DB dump · module backup · view backup
├── upgrade/     thông tin & artifacts upgrade theo target version
│   └── <target_version>/    vd: 19.0/
│       ├── modules/         modules target phục vụ upgrade (extra/, themes/, default/)
│       └── data/            dump.sql, upgraded.zip, filestore, upgrade.log, upgrade-report
├── resources/   file lưu trữ vĩnh viễn: zip, bản gốc
└── config/      odoo.conf(.template) · .env — PRIVATE
```

Không tạo thêm thư mục gốc mới nếu nội dung khớp một trong bảy cái trên.

## 2. `modules/` — 4 nhánh, khớp 1-1 `addons_path`

| Thư mục | Mount point | Vai trò |
|---|---|---|
| `modules/extra/` | `/var/lib/extra-addons` | Nghiệp vụ: CRM, HR, sale, subscription |
| `modules/default/` | `/var/lib/default-addons` | Nền tảng: branding, SSO, hạ tầng cloud |
| `modules/addons/` | `/var/lib/addons-addons` | Addon bên thứ ba |
| `modules/themes/` | `/var/lib/themes-addons` | Theme backend |

Thứ tự trong `addons_path`: **`extra` → `default` → `addons` → `themes` → core**.
Entry đứng trước thắng khi trùng tên module — đây là cơ chế override, không phải ngẫu nhiên.

Sửa số nhánh thì phải sửa đồng thời: `odoo.conf.template`, `odoo.conf`, volume mount k8s. Đừng đổi tên nhánh chỉ vì thẩm mỹ.

## 3. Luồng 3 tầng

```
Máy dev (đĩa local)
  │  dev + chạy command đọc dữ liệu — nhanh
  │  ↕ sync 2 chiều (Unison)
Local server (mount)
  │  build env giống production, test
  │  ↓ deploy/update
Production (k8s)
```

**Mỗi tầng giữ đúng phần việc của nó — không tầng nào là bản sao của tầng kia:**

| Tầng | Giữ cái gì | KHÔNG giữ |
|---|---|---|
| Máy dev | thứ cần để *viết code*: `modules/{extra,default,themes}`, `docs`, `work`, `config/*.template` | dump, filestore, zip, artifact upgrade |
| Local server | **bản đầy đủ**: mọi thứ trên + `backups/`, `resources/`, `upgrade/*/data/`, `modules/addons` | — |
| Production | chỉ thứ *sạch nhất để chạy*: code addon + config | docs, tests, backup, artifact, file rác |

**Luật cứng:**
- Không deploy thẳng từ máy dev lên production. Luôn qua local server test trước.
- **Dữ liệu nặng nằm lại local server.** DB dump, filestore, zip, artifact upgrade **không sync về máy dev**. Cần thì kéo đúng file, xong việc xoá — không đưa vào sync tự động.
- `modules/addons/` **không sync về máy dev** — nặng, mà test/review chạy trên local server.
- **Production chỉ nhận code sạch.** Package bằng `git ls-files`, loại `docs/`, `tests/`, `.claude/`, `__pycache__/`, `*.dump`, `*.zip`.
- `config/odoo.conf` và `config/.env` **không bao giờ sync, không bao giờ commit** — render tại chỗ ở từng tầng.

Ignore-list sync tối thiểu (máy dev ↔ local server):
```
modules/addons/  backups/  resources/  upgrade/*/data/
*.dump  *.sql  *.zip  filestore/
__pycache__/  *.pyc  .DS_Store
config/odoo.conf  config/.env  .git/index.lock
```

> Số thật đo trên `davita.vn`: `upgraded/` 2.4 G + `db_backup/` 1.1 G, trong khi `modules/` chỉ 118 M. Gộp chung một dòng ✓ là kéo 3.5 GB về Mac để dùng 118 M.

Lấy file lẻ khi cần:
```bash
rsync -avP local:/mnt/DATA/work/<client>/db_backup/<file>.dump ./
```

## 4. Ranh giới `backups/` vs `resources/` vs `work/`

| | Bản chất | Vòng đời |
|---|---|---|
| `backups/` | ảnh chụp trạng thái, sinh ra định kỳ | cũ thì bỏ |
| `resources/` | bản gốc, **không sinh lại được** | giữ vĩnh viễn |
| `work/` | file & script agent tạo trong lúc làm | dọn khi xong việc |

Zip theme, asset gốc, installer → `resources/`. DB dump, view backup → `backups/`.
Phân vân thì hỏi: *mất file này có tạo lại được không?* Không → `resources/`.

## 5. Docs 2 tầng

**Root `docs/`** — toàn instance:
`README` · `ARCHITECTURE` · `MODULES` · `SETUP` · `DEPLOYMENT` · `CONVENTIONS` · `SECURITY`
Cộng thêm changelog / roadmap / history cấp instance.

**`modules/<tên>/`** — chuẩn Odoo/OCA:
- **Bắt buộc**: `README.md` + `changelog` trong `__manifest__.py`
- **Tuỳ chọn** (module phức tạp): `docs/` với `ARCH` · `IDEA` · `SPEC` · `REQUIREMENTS` · `CHANGELOGS` · `DEPLOY_GUIDE` · `CONTEXT`

Không gom docs module về root — chúng đi theo git repo riêng của module khi push.
Không áp bộ 7 file cho mọi module: docs rỗng hại hơn không có docs.

## 6. Git

Mỗi module là **một git repo riêng**, remote riêng, branch theo version Odoo (`17.0`).
Root **không** phải git repo → `.gitignore` ở root không có hiệu lực, đừng dựa vào nó để bảo vệ secret. Bảo vệ thật nằm ở ignore-list của tool sync.

## 7. Checklist khởi tạo instance mới

1. Dựng 7 thư mục gốc + 4 nhánh `modules/`
2. `config/odoo.conf.template` commit được; `odoo.conf` + `.env` render tại chỗ, không commit
3. Viết `docs/` 7 file cấp instance
4. Cấu hình sync 2 chiều với ignore-list ở §3
5. Xác minh `addons_path` khớp đúng 4 nhánh
6. Mỗi module: README + version chuẩn `<odoo>.<major>.<minor>.<patch>`

## 8. Bẫy thường gặp

- **Version manifest dạng `1.0` trần** — Odoo không so sánh được với bản trong DB, migration bị bỏ qua âm thầm. Luôn dùng `17.0.x.y.z`.
- **Doc lỗi thời hơn cả không có doc** — số liệu trong `MODULES.md`/`CONVENTIONS.md` phải verify lại bằng lệnh trước khi tin.
- **`.env` sai format dotenv** (`key: value` thay vì `KEY=VALUE`) — `source` sẽ lỗi.
- **Module stub** — manifest trỏ tới file không tồn tại thì module không cài được; kiểm `data`/`assets` khớp file thật.
- **Backup trước mọi `-u <module>`** — migration Odoo không tự rollback.
