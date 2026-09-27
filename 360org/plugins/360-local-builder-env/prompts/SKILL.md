---
name: 360-local-builder-env
description: Tự động khởi tạo, quản lý môi trường dev Odoo Docker cô lập theo 99 ports range, auto restore DB, auto GitLab private backup cho từng client
author: 360org <support@360.org.vn>
---

# 360-local-builder-env: Odoo Docker Dev & Migration Environment Builder

Skill này kích hoạt khi Sếp Châu yêu cầu:
- "build up [client]", "build env [client]", "dựng env cho [client]"
- "build cho anh project migrade: [client] với db lấy ở: [path]"
- "build up cho anh upgraded version [version] của [client]"
- "shutdown [client]", "tắt env [client]", "xong [client] rồi tắt đi em"
- "list env", "danh sách env đang chạy", "ports đang dùng"
- "push gitlab [client]", "sync gitlab [client]"

## 1. Nguyên Tắc Cấu Trúc Khách Hàng (Client Workspace)
Mỗi khách hàng nằm tại `/mnt/DATA/work/<client-name>/`:
- `modules/` (chứa `default/`, `extra/`, `themes/` của source code hiện tại)
- `upgraded/` (chứa modules đang port/nâng cấp sang version mới)
- `db_backup/` (chứa các file dump DB)
- `env/` (chứa các env Docker cô lập sinh động: `v15_source`, `v19_target`...)
- `.git` kết nối private repo: `git@gitlab.com:v-clients/<client-name>.git`
- `.gitignore` CHỈ ignore:
  ```gitignore
  env/*/sessions/
  *.log
  .DS_Store
  cache*
  ```
  *(Toàn bộ mã nguồn, cấu hình và dữ liệu dev được đưa lên git để bảo vệ phòng sự cố hỏng ổ cứng).*

## 2. Dải 99 Ports Theo Version Odoo
Quét port trống đầu tiên trong dải:
- v14.0: `1400` – `1499`
- v15.0: `1500` – `1599`
- v16.0: `1600` – `1699`
- v17.0: `1700` – `1799`
- v18.0: `1800` – `1899`
- v19.0: `1900` – `1999`
Port DB Host = `50000 + Port_Web`

## 3. Lệnh Thực Thi Nội Bộ
AI sẽ chạy script `local_env_ctl.py` qua SSH vào Host `local` (192.168.1.100):
```bash
ssh -o BatchMode=yes local "python3 /mnt/DATA/work/aiac/360org/plugins/360-local-builder-env/scripts/local_env_ctl.py <subcommand> [args]"
```
Các subcommand:
- `up`: Dựng môi trường (`--client`, `--version`, `--db`, `--role`, `--source-dir`)
- `down`: Hạ môi trường (`--client`, `--version`, `--role`)
- `status`: Xem danh sách các container/env đang active
- `gitlab-sync`: Commit và push toàn bộ dữ liệu dự án lên GitLab private repo

## 4. Chuẩn Docker Image & External Dependencies (v16 trở lên)
Toàn bộ Docker image Odoo từ phiên bản 15.0 đến 19.0 đều được đóng gói theo cơ chế **override image** và lưu trữ đồng bộ trên GitLab Container Registry (`registry.gitlab.com/vuahethong/demo/odoo:<version>`):
- Đã cài đặt sẵn đầy đủ các thư viện phụ thuộc bắt buộc:
  * `google-auth` (Thỏa mãn ràng buộc external dependencies Odoo `google_auth`)
  * `google-auth-oauthlib`
  * `google-auth-httplib2`
  * `boto3` (Hỗ trợ lưu trữ S3 / Cloudflare R2 / AWS)
- **Quy tắc khi bổ sung thư viện mới**:
  Không bao giờ build lại image từ đầu. Chỉ cần build image override kế thừa từ base image hiện tại:
  ```dockerfile
  FROM odoo:<version>
  USER root
  RUN pip3 install --no-cache-dir <thư-viện-cần-thêm>
  USER odoo
  ```
  Sau đó tag và push lên `registry.gitlab.com/vuahethong/demo/odoo:<version>`.
- Token GitLab Registry được cấu hình tự động tại `~/.bashrc` của Host Local Server (`user: localserver`).


### 5. Quy tắc Chuẩn Hóa Addons & Enterprise UI (`default` vs `addons`):
Toàn bộ hạ tầng dev và project client thừa hưởng chung cấu trúc core version `/mnt/DATA/work/<version>/`:
- `addons/`: Chứa toàn bộ các Enterprise addons (`account_accountant`, `sale_subscription`, `helpdesk`,...).
- `default/`: Chứa các module Enterprise có dependency chuyển tiếp sang `backend_ui` (thay vì `web_enterprise`), bao gồm: `web_studio`, `project_enterprise`, `digest_enterprise`, `pos_enterprise`, `documents`, `sign`,... Toàn bộ manifest của các module này được chuẩn hóa dependency: `depends: [backend_ui]`.
- `themes/`: Chứa `backend_ui` (hoặc theme base).
- `extra/`: Chứa các addon phụ trợ dùng chung (boto3, cloud storage...).

**Quy tắc nạp addons khi build môi trường:**
- Bất kỳ môi trường nào (kể cả sandbox mặc định `xx00` hay project client `xx01`-`xx99`) đều tự động nạp `default` vào `addons_path` (`/mnt/default` hoặc `/mnt/odoo-default`) trước `addons` để nhận diện đầy đủ hệ sinh thái Enterprise UI.
- Thư mục `modules/default`, `modules/extra`, `modules/themes` trên project client chỉ là phần add thêm riêng biệt của khách hàng, không ảnh hưởng đến bộ core.

