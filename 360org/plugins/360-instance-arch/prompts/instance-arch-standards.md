# Instance Architecture — Standards

Quy chuẩn thư mục cho repo instance khách hàng dev dài hạn. Nạp cùng `SKILL.md`.

## Cây chuẩn

```
<khach-hang>/
├── modules/
│   ├── extra/       nghiệp vụ        → /var/lib/extra-addons
│   ├── default/     nền tảng         → /var/lib/default-addons
│   ├── addons/      bên thứ ba       → /var/lib/addons-addons
│   └── themes/      theme backend    → /var/lib/themes-addons
├── docs/            toàn instance
├── work/            file & script agent
├── backups/         DB dump · view backup
├── upgrade/         thông tin upgrade theo target version
│   └── <target_version>/    vd: 19.0/
│       ├── modules/         modules phục vụ upgrade (extra/, themes/, default/)
│       └── data/            dump.sql, upgraded.zip, filestore, upgrade-report
├── resources/       zip · bản gốc lưu vĩnh viễn
├── config/          odoo.conf(.template) · .env   PRIVATE
├── .claude/         AIaC config + MEMORY.md
├── .gitignore
└── AGENTS.md
```

## Ma trận sync

| Thư mục | Máy dev | Local server | Production | Sync |
|---|:---:|:---:|:---:|:---:|
| `modules/extra` `default` `themes` | ✓ | ✓ | ✓ | ✓ |
| `modules/addons` | ✗ | ✓ | ✓ | ✗ |
| `docs` `work` | ✓ | ✓ | ✗ | ✓ |
| `upgrade/<ver>/modules` | ✓ | ✓ | ✗ | ✓ |
| `upgrade/<ver>/data` (dump, filestore, zip) | **✗** | ✓ | ✗ | **✗** |
| `backups` (DB dump, filestore, view backup) | **✗** | ✓ | ✗ | **✗** |
| `resources` (zip, bản gốc) | **✗** | ✓ | ✗ | **✗** |
| `config/*.template` | ✓ | ✓ | ✗ | ✓ |
| `config/odoo.conf` `config/.env` | render tại chỗ | render tại chỗ | render tại chỗ | **✗** |

Ba tầng, ba mục đích — **không tầng nào là bản sao của tầng kia**:

- **Máy dev** = thứ cần để *viết code*: source + docs + template. Không chứa dữ liệu nặng.
- **Local server** = bản đầy đủ: mọi thứ trên, cộng dữ liệu vận hành (dump, filestore, artifact upgrade).
- **Production** = chỉ thứ *sạch nhất để chạy*: code + config. Không docs, không backup, không artifact.

**Luật:** dữ liệu nặng (dump, filestore, zip, artifact upgrade) **nằm lại local server**. Chỉ kéo về máy dev khi có yêu cầu cụ thể, kéo đúng file cần, xong việc thì xoá — không đưa vào sync tự động.

Số thật đo trên `davita.vn`: `upgraded/` 2.4 G + `db_backup/` 1.1 G so với `modules/` 118 M. Sync nguyên cụm về máy dev là kéo 3.5 GB để dùng 118 M.

Lấy file lẻ khi cần:
```bash
rsync -avP local:/mnt/DATA/work/<client>/db_backup/<file>.dump ./
```

## Ignore-list sync (máy dev ↔ local server)

```
modules/addons/
backups/
resources/
upgrade/*/data/
*.dump
*.sql
*.zip
filestore/
__pycache__/
*.pyc
.DS_Store
config/odoo.conf
config/.env
.git/index.lock
```

`.git/index.lock` bắt buộc có — sync file lock giữa 2 bên làm hỏng git repo module.

## Danh sách loại trừ khi deploy production

Production chỉ nhận code addon sạch. Package bằng `git ls-files` rồi loại thêm:

```
.git/  .claude/  docs/  tests/  __pycache__/  *.pyc  .DS_Store
*.dump  *.sql  *.zip  work/  backups/  resources/  upgrade/
```

Kiểm lại trước khi copy lên pod:
```bash
tar -tzf <module>.tgz | grep -E '(^\.git/|^\.claude/|^docs/|__pycache__|\.pyc$|\.DS_Store$|\.dump$|\.sql$)' || echo "✓ sạch"
```

## Quy tắc đặt file — quyết định nhanh

```
File mới cần đặt ở đâu?
│
├─ Là code addon?            → modules/<nhánh>/<module>/
├─ Agent tạo ra khi làm việc? → work/
├─ Ảnh chụp trạng thái, sinh lại được? → backups/
├─ Bản gốc, mất là mất luôn?  → resources/
├─ Liên quan upgrade?         → upgrade/
├─ Chứa secret?              → config/   (+ ignore-list)
└─ Tài liệu người đọc?
   ├─ Về cả instance?        → docs/
   └─ Về một module?         → modules/<nhánh>/<module>/  (README bắt buộc, docs/ tuỳ chọn)
```

## Manifest module

```python
{
    'name': 'Tên hiển thị',
    'version': '17.0.1.0.0',      # BẮT BUỘC prefix version Odoo
    'license': 'LGPL-3',
    'depends': ['base'],
}
```

Prefix `17.0` không phải trang trí — Odoo dùng nó để chọn migration script. Version `1.0` trần khiến module không so sánh được với bản cài trong DB, migration bị bỏ qua âm thầm.

Bump version **bắt buộc** mỗi lần đổi schema.

## Kiểm tra sức khoẻ instance

```bash
# module thiếu version hoặc version sai chuẩn
for m in modules/*/*/; do
  [ -f "$m/__manifest__.py" ] || continue
  v=$(grep -oE "['\"]version['\"][[:space:]]*:[[:space:]]*['\"][^'\"]+" "$m/__manifest__.py" | head -1 | sed "s/.*['\"]//")
  case "$v" in
    "")      echo "NO-VERSION: $m" ;;
    17.0.*)  ;;
    *)       echo "NON-STD   : $m = $v" ;;
  esac
done

# module thiếu README
for m in modules/*/*/; do [ -f "$m/README.md" ] || echo "NO-README: $m"; done

# module stub — manifest trỏ file không tồn tại
for m in modules/*/*/; do
  [ -f "$m/__manifest__.py" ] || continue
  grep -oE "['\"][a-z_]+/[^'\"]+\.(xml|csv)['\"]" "$m/__manifest__.py" | tr -d "\"'" | while read -r f; do
    [ -e "$m/$f" ] || echo "MISSING: $m$f"
  done
done
```

Chạy các lệnh này trước khi tin số liệu trong `docs/MODULES.md` — doc lỗi thời là chuyện thường.

## Deploy

Backup DB trước mọi `-u <module>`. Migration Odoo không tự rollback.

```bash
kubectl exec -n <ns> <pod> -- odoo -c /etc/odoo/odoo.conf -d <db> -u <module> --stop-after-init
```

Không chạy lệnh này từ máy dev khi chưa qua local server test.
