# 360-local-builder-env Plugin

Plugin tự động hoá việc tạo và điều phối các môi trường Odoo Docker Dev cô lập theo dải 99 ports trên Local Server (`192.168.1.100`), hỗ trợ quy trình Migration đa version song song và đồng bộ an toàn lên GitLab Private Repositories.

## 1. Cấu trúc Client Chuẩn
Mỗi client nằm tại `/mnt/DATA/work/<client-name>/`:
- `modules/`: Chứa các modules nghiệp vụ bản hiện tại (`default/`, `extra/`, `themes/`).
- `upgraded/`: Chứa các modules đang nâng cấp lên version mới.
- `db_backup/`: Chứa file dump DB (`.dump`, `.sql`, `.zip`).
- `env/`: Chứa các container Docker do hệ thống tự sinh (`v15_source/`, `v19_target/`...).
- `.git`: Kết nối tới `git@gitlab.com:v-clients/<client-name>.git`.
- `.gitignore`: Chỉ ignore `env/*/sessions/`, `*.log`, `.DS_Store`, `cache*`. Toàn bộ dữ liệu dev được lưu trữ đầy đủ.

## 2. Quy hoạch Dải 99 Ports Theo Odoo Version
- Odoo 14.0: `1400` – `1499`
- Odoo 15.0: `1500` – `1599`
- Odoo 16.0: `1600` – `1699`
- Odoo 17.0: `1700` – `1799`
- Odoo 18.0: `1800` – `1899`
- Odoo 19.0: `1900` – `1999`
- Port DB Host truy cập trực tiếp: `50000 + Port_Web` (VD: `51501`).

## 3. Cách Sử Dụng CLI
```bash
# 1. Dựng môi trường nguồn Odoo 15.0 với DB từ thư mục backup
python3 scripts/local_env_ctl.py up --client davita.vn --version 15.0 --role source

# 2. Dựng môi trường nâng cấp Odoo 19.0 chạy song song
python3 scripts/local_env_ctl.py up --client davita.vn --version 19.0 --role target

# 3. Xem danh sách các env đang active
python3 scripts/local_env_ctl.py status

# 4. Hạ môi trường và giải phóng port
python3 scripts/local_env_ctl.py down --client davita.vn

# 5. Đồng bộ Git và push GitLab
python3 scripts/local_env_ctl.py gitlab-sync --client davita.vn
```
