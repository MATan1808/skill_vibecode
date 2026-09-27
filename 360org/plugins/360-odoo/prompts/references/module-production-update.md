# Odoo Module Production Update

> **CANONICAL** — Đây là nguồn chân lý duy nhất cho Giai đoạn 4 & 5 của Quy trình 6 Giai Đoạn Fix Bug & Upgrade Module Odoo SaaS. `CLAUDE.md` và `360-odoo/prompts/SKILL.md` chỉ giữ sơ đồ 6 giai đoạn và trỏ về file này. Không nhân bản nội dung chi tiết sang nơi khác.

Dùng cho cập nhật addon/module Odoo trên production **cùng version hiện tại** (ví dụ `-u v_mobile` trên Odoo 17). Không dùng cho major database/version upgrade qua `upgrade.odoo.com` — việc đó xem `references/database-upgrade.md`.

## Bối cảnh: Quy trình 6 Giai Đoạn

```
[GĐ0: Tiếp nhận & Ghi nhận Ticket] ➔ [GĐ1: Fix Bug & Dev Test] ➔ [GĐ2: Commit & Push GitLab]
   ➔ [GĐ3: Pull/Deploy Local Server & Final Review]
   ➔ [GĐ4: Deploy Production & Backup DB — mục 1-8 dưới đây]
   ➔ [GĐ5: Verify, Report & Đóng Ticket — mục 9-10 dưới đây + Bước 12]
```

GĐ1–GĐ3 xem `SKILL.md`. GĐ0 và Bước 12 (đóng ticket + ghi timesheet) xem `helpdesk-intake-and-reporting.md`. File này đặc tả chi tiết GĐ4 và GĐ5.

## Đường dẫn addons chuẩn theo instance khách hàng

Module phải nằm đúng nhánh tương ứng với `addons_path` của instance:

| Loại module | Đường dẫn trên server |
|---|---|
| Module nền tảng core 360 | `/home/instances/<namespace>/modules/default/<module_name>` |
| Module tính năng mở rộng/custom | `/home/instances/<namespace>/modules/extra/<module_name>` |
| Website Themes/Snippets | `/home/instances/<namespace>/modules/themes/<module_name>` |

Sau khi sync code, phân quyền bắt buộc:

```bash
chown -R 101:101 /home/instances/<namespace>/modules/<type>/<module_name>
```

## Nguyên tắc

1. **GitLab-first, production pull-only (BẮT BUỘC)**: mọi thay đổi module phải được kiểm thử, commit và push lên GitLab `origin` trước khi triển khai. Production chỉ được `git fetch` + `git pull --ff-only` hoặc `git checkout --detach <commit-đã-push>` từ remote đã xác minh; ghi lại SHA triển khai. **Cấm tuyệt đối** `rsync`, `scp`, `kubectl cp`, `tar`/`cp`/`sync` code local trực tiếp lên production, kể cả "hotfix". Không có commit đã push thì dừng deploy.
2. **Update != Upgrade**: update module là backup DB, pull đúng commit GitLab, chạy `odoo -d <db> -u <module>`; upgrade/migrate version là quy trình khác.
3. **Backup DB trước khi update module**: bắt buộc có dump mới và verify được bằng `pg_restore -l` trước mọi lệnh `-u`. **BẮT BUỘC có 1 bản lưu về Local Server** tại `/mnt/DATA/work/<client-name>/db_backup/` — dump chỉ nằm trên volume production là chưa đủ, pod chết hoặc volume hỏng là mất trắng.
4. **Backup code về local server theo client-name**: stream tar từ production pod về `/mnt/DATA/work/<client-name>/code_backup/` để rollback. Đây là bản đề phòng bất trắc — deploy hỏng mà không có bản này thì không khôi phục được code cũ đang chạy.
5. **Không deploy rác local**: production worktree chỉ chứa source đã track Git; không copy `.git/`, `.claude/`, `__pycache__/`, `*.pyc`, `.DS_Store`, transcript/cache/secret.
6. **Zero-downtime bằng pod rotation**: từ iMac/terminal điều khiển `kubectl`, scale deployment lên thêm 1 pod, chờ pod mới Ready, rồi scale down/delete pod cũ. Không dùng `rollout restart` cho production module update vì dễ tạo downtime.
7. **Không cần temp pod chuẩn**: dùng pod production hiện tại để chạy module update sau khi Git pull; sau đó tạo pod mới bằng scale up để nạp Python registry/code mới.

## Quy trình chuẩn

### 1. Xác nhận source GitLab đúng — gate không được bỏ qua

Production phải là Git worktree sạch; kiểm tra remote, SHA đã được push và chỉ fast-forward tới SHA đó. Nếu `git status --porcelain` có output, `origin/<branch>` chưa có commit cần deploy, hoặc `pull --ff-only` thất bại: **dừng deploy**, không copy/sync để lách gate.

```bash
REPO=/home/odoo-src/<client-repo>
BRANCH=main
git -C "$REPO" fetch --prune origin
git -C "$REPO" status --short --branch
git -C "$REPO" remote get-url origin
git -C "$REPO" rev-parse HEAD
git -C "$REPO" rev-parse "origin/$BRANCH"
git -C "$REPO" pull --ff-only origin "$BRANCH"
DEPLOY_SHA=$(git -C "$REPO" rev-parse HEAD)
printf 'Deploying GitLab commit: %s\n' "$DEPLOY_SHA"
```

Với setup addon symlink, xác nhận module live trỏ vào worktree vừa pull:

```bash
LIVE=/home/addons/<module_name>
test -L "$LIVE"
test "$(readlink -f "$LIVE")" = "$REPO/modules/<default|extra|themes>/<module_name>"
git -C "$LIVE" diff --quiet "$DEPLOY_SHA" -- modules/<default|extra|themes>/<module_name>
```

Rollback cũng chỉ dùng Git: `git -C "$REPO" checkout --detach <sha-đã-từng-push>` rồi chạy lại update module/pod rotation; **không phục hồi source bằng copy backup**. Backup code chỉ dùng điều tra hoặc khôi phục khẩn cấp khi repository/GitLab mất dữ liệu.

### 2. Dò production read-only

```bash
kubectl config current-context
kubectl -n <namespace> get pods,deploy,svc,ingress -o wide
kubectl -n <namespace> get deploy <odoo-deploy> -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}{.spec.template.spec.containers[0].envFrom}{"\n"}{range .spec.template.spec.containers[0].volumeMounts[*]}{.name}:{.mountPath}:ro={.readOnly}{"\n"}{end}'
```

### 3. Backup DB bắt buộc trước update

Kiểm tra backup hiện có:

```bash
kubectl -n <namespace> exec deploy/<odoo-deploy> -- bash -lc 'find /host/instances/<client-name>/data/db_backup -maxdepth 1 -type f -printf "%TY-%Tm-%Td %TH:%TM %s %p\n" | sort | tail -20'
```

Verify backup:

```bash
kubectl -n <namespace> exec deploy/<odoo-deploy> -- bash -lc 'pg_restore -l /host/instances/<client-name>/data/db_backup/<backup>.dump >/tmp/<client-name>_backup_toc.txt && wc -l /tmp/<client-name>_backup_toc.txt'
```

Nếu chưa có backup mới, stream backup về local server:

```bash
mkdir -p /mnt/DATA/work/<client-name>/db_backup
kubectl -n <namespace> exec deploy/<postgres-deploy> -- bash -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -b' > /mnt/DATA/work/<client-name>/db_backup/<client-name>_<ts>_before_module_update.dump
pg_restore -l /mnt/DATA/work/<client-name>/db_backup/<client-name>_<ts>_before_module_update.dump >/tmp/<client-name>_<ts>_toc.txt
```

### 4. Backup code đang chạy về local server/client-name

```bash
mkdir -p /mnt/DATA/work/<client-name>/code_backup
kubectl -n <namespace> exec deploy/<odoo-deploy> -- tar -C <addons-parent> -czf - <module_dir> > /mnt/DATA/work/<client-name>/code_backup/<module>_code_before_<ts>.tgz
tar -tzf /mnt/DATA/work/<client-name>/code_backup/<module>_code_before_<ts>.tgz >/dev/null
```

### 5. Pull source GitLab vào production worktree

Đây là **cách duy nhất** được phép đưa code module mới lên production. Không đóng gói hay truyền source từ local; `rsync`, `scp`, `kubectl cp`, `tar`/`cp`/`sync` source vào addon volume đều bị cấm. Worktree/symlink đã xác minh ở mục 1 phải là source mà Odoo nạp.

```bash
REPO=/home/odoo-src/<client-repo>
BRANCH=main
git -C "$REPO" fetch --prune origin
git -C "$REPO" pull --ff-only origin "$BRANCH"
DEPLOY_SHA=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" status --porcelain  # bắt buộc rỗng
```

Nếu code addon dùng shared volume của Kubernetes, volume đó phải mount từ worktree Git production hoặc được quản lý bằng cơ chế Git pull phía server; không được thay bằng cơ chế copy source. Nếu kiến trúc hiện tại chưa có Git worktree trên volume, **dừng deploy và chuyển kiến trúc sang Git worktree/symlink trước**.

### 6. Update module DB/schema

```bash
kubectl -n <namespace> exec <current-odoo-pod> -c <odoo-container> -- bash -lc 'set -euo pipefail; export PATH="$PATH:/var/lib/odoo/.local/bin"; odoo -d "$POSTGRES_DB" -u <module_name> --stop-after-init --without-demo=all --config /etc/odoo/odoo.conf'
```

#### Trường hợp Install module MỚI (chưa từng cài trên DB)

Lệnh `-u` chỉ update module đã cài. Với module mới phải `update_list()` rồi install:

```bash
kubectl exec -n <namespace> <pod-odoo> --context saas -- python3 -c "import odoo; from odoo import api, SUPERUSER_ID; registry = odoo.registry('<dbname>'); \
with registry.cursor() as cr: env = api.Environment(cr, SUPERUSER_ID, {}); env['ir.module.module'].update_list(); \
mod = env['ir.module.module'].search([('name', '=', '<module_name>')]); mod.button_immediate_install()"
```

#### ⚠️ BẮT BUỘC khi module thêm Model hoặc Field Python mới

Worker Odoo (gevent/WSGI) trên pod live vẫn giữ Python registry cũ trong RAM sau khi chạy `-u`. Nếu không nạp lại, frontend OWL sẽ lỗi `"<model>"."<field>" is undefined`.

Pod rotation ở mục 7 dưới đây đã xử lý việc này (pod mới nạp registry mới). Chỉ khi không thể scale up/down mới dùng:

```bash
kubectl rollout restart deployment <namespace>-deploy-odoo -n <namespace> --context saas
```

Lưu ý: `rollout restart` gây downtime ngắn — ưu tiên pod rotation ở mục 8.

### 7. Zero-downtime scale up/down

Ghi nhận pod cũ:

```bash
kubectl -n <namespace> get pods -l app=odoo,name=<client-name> -o wide
OLD_POD=<old-running-pod-name>
```

Scale thêm một pod mới:

```bash
CURRENT=$(kubectl -n <namespace> get deploy <odoo-deploy> -o jsonpath='{.spec.replicas}')
TARGET=$((CURRENT + 1))
kubectl -n <namespace> scale deploy/<odoo-deploy> --replicas="$TARGET"
kubectl -n <namespace> wait --for=condition=Ready pod -l app=odoo,name=<client-name> --timeout=180s
kubectl -n <namespace> get pods -l app=odoo,name=<client-name> -o wide
```

Xác nhận pod mới đã nạp code mới:

```bash
NEW_POD=$(kubectl -n <namespace> get pods -l app=odoo,name=<client-name> --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}')
kubectl -n <namespace> exec "$NEW_POD" -c <odoo-container> -- python3 - <<'PY'
import ast
p='<module_path>/__manifest__.py'
with open(p, encoding='utf-8') as f:
    print(ast.literal_eval(f.read()).get('version'))
PY
```

Scale về số replica ban đầu và loại pod cũ:

```bash
kubectl -n <namespace> scale deploy/<odoo-deploy> --replicas="$CURRENT"
kubectl -n <namespace> delete pod "$OLD_POD" --wait=false
kubectl -n <namespace> get pods -l app=odoo,name=<client-name> -o wide
```

Nếu controller scale down chọn nhầm pod mới, ưu tiên giữ ít nhất một pod Ready và xoá pod cũ có kiểm soát.

### 8. Verify production

```bash
kubectl -n <namespace> exec deploy/<postgres-deploy> -- bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT name,state,latest_version FROM ir_module_module WHERE name='"'"'<module_name>'"'"';"'
curl -k -sS -o /tmp/<client-name>_login.html -w 'login %{http_code} %{time_total}\n' https://<domain>/web/login
curl -k -sS -o /tmp/<client-name>_openapi.json -w 'openapi %{http_code} %{time_total}\n' https://<domain>/api/v1/openapi.json
kubectl -n <namespace> logs deploy/<odoo-deploy> --tail=120 | rg -i 'traceback|critical|exception|failed|error' || true
```

## Report

Báo ngắn gọn: GitLab remote + source commit/version đã pull, DB backup + verify, code backup path, module DB version, pod rotation result, HTTP checks/log scan. Không báo hoàn thành nếu không chứng minh được SHA triển khai nằm trên GitLab.
