# Quy chuẩn Phân nhánh Git & Bàn giao Sản phẩm (Git Workflow)

Tài liệu này đặc tả quy chuẩn phân nhánh bắt buộc trên Gitlab dành cho mọi dự án phát triển Odoo trong công ty. Quy chuẩn này đảm bảo tách biệt rõ ràng giữa môi trường phát triển (chứa đầy đủ tài liệu kiến trúc kỹ thuật) và môi trường vận hành (chứa mã nguồn siêu sạch).

---

## 1. Cấu trúc 2 nhánh bắt buộc (Two-Branch Architecture)

Đối với mỗi phiên bản Odoo mục tiêu (ví dụ: `15.0` hoặc `19.0`), mã nguồn trên Git bắt buộc phải được tổ chức thành 2 nhánh:

```text
               (Môi trường Dev chứa toàn bộ tài liệu kỹ thuật)
               ┌────────────────────────────────────────────────────────┐
               │ Nhánh: 15.0-dev                                        │
               │ Chứa: Code + SPEC.md + ARCH.md + task.md + walkthrough │
               └────────────────────────────────────────────────────────┘
                       │
                       ▼ (Tự động dọn dẹp qua git_cleaner.py)
               ┌────────────────────────────────────────────────────────┐
               │ Nhánh: 15.0 (Production)                               │
               │ Chứa: Code sạch (Chỉ giữ lại file chạy được, sạch log) │
               └────────────────────────────────────────────────────────┘
               (Môi trường Production siêu sạch, sẵn sàng deploy)
```

### Nhánh 1: Nhánh Phát triển (`<version>-dev` - Ví dụ: `15.0-dev`)
- **Mục đích:** Lưu trữ toàn bộ mã nguồn đang phát triển và các tài liệu kỹ thuật đi kèm.
- **Yêu cầu nội dung:** Phải chứa đầy đủ các tệp tin ghi nhận tư duy thiết kế của Agent:
  - `SPEC.md` và `ARCH.md`.
  - `task.md` (TODO list) và `implementation_plan.md`.
  - `walkthrough.md` (Báo cáo tổng kết).

### Nhánh 2: Nhánh Production (`<version>` - Ví dụ: `15.0`)
- **Mục đích:** Sẵn sàng triển khai lên server vận hành Staging/Production.
- **Yêu cầu nội dung:** Mã nguồn phải ở trạng thái **siêu sạch (Clean Production)**.
- **Các tệp tin bị loại bỏ hoàn toàn (phải xóa trước khi push):**
  - Các tệp cấu hình dự án của Agent (`.agents/`, `task.md`, `implementation_plan.md`).
  - Các tệp ghi chép kiểm thử (`eval_metadata.json`, `feedback.json`, `timing.json`).
  - Các tệp log tạm thời và python cache (`*.log`, `__pycache__/`).

---

## 2. Quy trình đẩy code lên Git (Git Push Workflow)

Khi người dùng ra lệnh: *"Hãy push code lên git"* (Ví dụ: cho phiên bản `15.0`), Sub-agent **Shipper** sẽ thực hiện tự động các bước sau:

### Bước 1: Push nhánh phát triển (`15.0-dev`)
1. Lưu trữ trạng thái code hiện tại (bao gồm cả tài liệu kỹ thuật).
2. Chuyển sang (hoặc tạo) nhánh `15.0-dev`.
3. Commit toàn bộ thay đổi và push lên Gitlab:
   ```bash
   git checkout -b 15.0-dev
   git add .
   git commit -m "feat(module): dev complete with full tech docs"
   git push origin 15.0-dev
   ```

### Bước 2: Tạo và dọn dẹp nhánh Production (`15.0`)
1. Tạo một nhánh tạm thời từ nhánh dev hoặc chuyển sang nhánh production `15.0`.
2. Thực thi script dọn dẹp tự động để loại bỏ các tệp tin rác:
   ```bash
   python /Volumes/DATA/DEV/aiac/360org/scripts/odoo/git_cleaner.py --path <path_to_module>
   ```
3. Commit phần mã nguồn siêu sạch và push lên nhánh production:
   ```bash
   git checkout -b 15.0
   git add .
   git commit -m "prod(module): clean release for production"
   git push origin 15.0
   ```
4. Quay trở lại nhánh `15.0-dev` để tiếp tục làm việc.

---

## 3. Quy trình Phát triển & Triển khai chuẩn 7 Bước (Feature/Bugfix Lifecycle)

Để quản lý công việc và đảm bảo an toàn tuyệt đối khi vận hành Odoo SaaS, mọi tác vụ phát triển tính năng mới (Feature) hoặc sửa lỗi (Bugfix) bắt buộc phải đi qua đầy đủ 7 bước sau. 

**Quy tắc bắt buộc về Checklist**: Mọi đầu việc khi thực hiện phải có 1 file checklist đặt tại `dev_workspace/task_checklist.md` của chính project (thư mục `dev_workspace/` phải được ignore trong `.gitignore` của nhánh Production để tránh rác code live). File này lưu lại chi tiết trạng thái tích chọn `[x]` của từng bước để phục vụ việc rà soát và nghiệm thu.

### 📌 Bước 1: Tiếp nhận & Đẩy yêu cầu lên GitLab
*   Khi nhận được yêu cầu mới hoặc phát hiện bug, Agent/Developer bắt buộc phải tạo Issue/Work Item tương ứng trên GitLab.
*   **Bắt buộc**: Phần mô tả (description) của Issue phải đính kèm đầy đủ log lỗi và **hình ảnh minh họa / screenshot hiện trạng lỗi** (Sếp/BA gửi ảnh qua chat thì Agent phải upload ảnh này lên GitLab Issue).
*   Đăng ký task mới vào tệp `dev_workspace/task_checklist.md` local theo mẫu quy định.
*   Lấy Issue ID vừa tạo (ví dụ: `#123`) để đặt tên nhánh phát triển con:
    ```bash
    git checkout -b 123-ten-kebab-case-cong-viec
    ```

### 📌 Bước 2: Sửa lỗi / Viết code dưới Local (Fix Local)
*   Thực hiện code và sửa lỗi trực tiếp trên môi trường local.
*   Chỉ khi code chạy ổn định dưới local mới chuyển sang bước tiếp theo.

### 📌 Bước 3: Kiểm thử hoàn chỉnh (Local Test Verification)
*   Chạy kiểm thử kỹ lưỡng (linter, unit tests, verify giao diện) để đảm bảo:
    1.  Tính năng/lỗi đã được giải quyết triệt để.
    2.  Không phát sinh thêm bất kỳ lỗi phụ hay tác động chéo nào khác.

### 📌 Bước 4: Commit và Đẩy lên GitLab (Commit & Sync Branch)
*   Cập nhật **Changelog kép** (đồng thời tại file `CHANGELOG.md` và key `description` của `__manifest__.py`), sau đó nâng minor version.
*   Commit code với thông điệp liên kết Issue ID (Sử dụng từ khóa đóng tự động `Closes #issue_id` cho commit cuối):
    ```bash
    git add .
    git commit -m "fix(widget): [#123] mô tả ngắn bằng tiếng Việt
    
    Closes #123
    Co-Authored-By: Claude <noreply@anthropic.com>"
    ```
*   Push nhánh dev lên GitLab và tạo Merge Request (MR) vào nhánh `<version>-dev` (ví dụ: `19.0-dev`).
*   Tiến hành merge MR sau khi đã được Lead/PO duyệt báo cáo Audit.

### 📌 Bước 5: Chuẩn bị Production & Backup offsite (Go Production & Backup)
*   **GitLab-first, production pull-only**: Sau khi nhánh Production `<version>` đã được commit/push và xác minh SHA có trên GitLab, production chỉ `git fetch` + `git pull --ff-only` (hoặc checkout SHA đã push) trong worktree Git đã cấu hình. **Cấm tuyệt đối** `rsync`, `scp`, `kubectl cp`, `tar`, `cp` hoặc sync source local trực tiếp lên thư mục module production. Worktree Git/symlink phải là source Odoo đang nạp để luôn rollback được bằng Git.
*   **Backup database bắt buộc trước khi deploy**:
    *   Exec vào pod live của instance để chạy script `/var/lib/odoo/manual_backup.sh` tạo file dump database (lưu trữ cố định tại `/home/instances/<instance>/data/db_backup/`).
    *   **Quy tắc an toàn thư mục**: Không copy file backup tạm thời sang thư mục của bất kỳ instance nào khác (kể cả `/home/instances/vuahethong/`). Bắt buộc copy file tạm sang thư mục làm việc chung của server host là `/home/backups/` để đổi tên và thực hiện upload:
        `cp /home/instances/<instance>/data/db_backup/<file_gốc>.dump /home/backups/backup_before_<tên_công_việc>_<tên_instance>_<timestamp>.dump`
    *   Sử dụng cấu hình Azure App Credentials tại `/etc/vuahethong-backup.env` trên server `vuahethong` để tự động upload file backup tạm này lên SharePoint tại thư mục tương ứng `vuahethong/<tên_instance>/`.
    *   **Bắt buộc dọn dẹp**: Ngay sau khi upload thành công, bắt buộc phải xóa cả file backup tạm trong `/home/backups/` và file backup gốc trong `/home/instances/<tên_instance>/data/db_backup/` để tránh chiếm dụng tài nguyên ổ cứng của server.

### 📌 Bước 6: Triển khai an toàn lên Production (Safe Deploy)
*   Thực hiện cập nhật module theo chuẩn duy nhất tại [module-production-update.md](module-production-update.md): production pull đúng SHA GitLab, backup DB verified, backup code về local server theo `client-name`, chạy `odoo -d "$POSTGRES_DB" -u <tên_module> --stop-after-init`, scale up pod mới rồi scale down/delete pod cũ. Không copy/sync source local và không dùng `rollout restart` cho production module update.

### 📌 Bước 7: Kiểm thử Production & Báo cáo ngắn gọn
*   **Bắt buộc (Kiểm thử thực tế & Check log)**: Ngay sau khi pod live khởi chạy lại, Agent/Developer bắt buộc phải truy cập trực tiếp vào URL website của instance (ví dụ: `https://gtline.vuahethong.com`), đăng nhập và tương tác thử với các tính năng vừa deploy (đóng/mở widget, gọi điện, chat thử...).
*   Ngay sau khi tương tác, chạy lệnh lấy logs của pod live mới (`kubectl logs -n <namespace> <pod_name> --tail=100`) để kiểm tra trực tiếp xem hệ thống có phát sinh bất kỳ lỗi QWeb, cảnh báo Python hay exception nào ở runtime hay không.
*   **Bắt buộc (Giải trình khi Closed)**: Trước khi đóng Issue trên GitLab, Agent/Developer phải viết một comment (note) ngắn gọn mô tả lại quá trình fixed lỗi và nguyên nhân (RCA) để làm bằng chứng và tư liệu tra cứu sau này:
    ```bash
    glab issue note <issue_id> --message "### Kết quả khắc phục lỗi
    * Nguyên nhân: [Mô tả RCA]
    * Cách xử lý: [Mô tả chi tiết cách xử lý]
    * Trạng thái: Đã verify hoạt động tốt trên website live."
    ```
*   Báo cáo ngắn gọn kết quả cho Product Owner (kèm theo File ID backup SharePoint, kết quả upgrade thành công).

---

## 4. Git Worktrees & Dọn dẹp môi trường (Git Worktrees & Cleanup)

### 4.1 Quy chuẩn Đặt tên & Quản lý Git Worktree
Khi thực hiện migrate DB, fix bug, hoặc phát triển tính năng mới song song, bắt buộc phải sử dụng **git worktree** để mỗi việc nằm trên 1 thư mục làm việc độc lập.

*   **Quy chuẩn đặt tên worktree & branch**: 
    Tên worktree và tên nhánh phát triển con bắt buộc phải đặt theo cấu trúc:
    ```text
    <version>/<module>-(bug/feature)-<kebab-case-mô-tả>
    ```
    *   *Ví dụ sửa lỗi:* `19.0/quick_contacts-bug-loader-plaintext` hoặc `19.0/quick_contacts-bug-owl-lifecycle-null`
    *   *Ví dụ tính năng:* `19.0/quick_contacts-feature-facebook-zalo-floating-button`
*   **Lệnh tạo worktree chuẩn**:
    ```bash
    git worktree add ../19.0-quick_contacts-bug-loader-plaintext -b 19.0/quick_contacts-bug-loader-plaintext
    ```
*   **Quy tắc baseline**: Sau khi setup worktree, bắt buộc phải verify **test baseline sạch** trước khi bắt đầu sửa code (không kế thừa lỗi sẵn có của môi trường).

### 4.2 Quy trình dọn dẹp worktree bắt buộc sau khi hoàn thành (Worktree Cleanup)
*   **Bắt buộc dọn dẹp**: Ngay sau khi công việc đã được deploy thành công lên Production, kiểm thử không phát sinh lỗi và Issue/Merge Request đã được merge/close thành công, Agent/Developer **phải tiến hành dọn dẹp (cleanup) ngay lập tức** để giải phóng tài nguyên hệ thống.
*   **Các bước dọn dẹp**:
    1.  Chuyển về thư mục chính của dự án.
    2.  Xóa bỏ thư mục worktree phụ:
        ```bash
        git worktree remove ../19.0-quick_contacts-bug-loader-plaintext --force
        ```
    3.  Xóa các nhánh local tạm thời đã được merge để giữ git tree sạch sẽ:
        ```bash
        git branch -D 19.0/quick_contacts-bug-loader-plaintext
        ```

### 4.3 Finishing a development branch — chốt nhánh có kiểm soát

Khi tính năng/migrate/fix xong, trước khi merge:

1. **Verify:** toàn bộ test pass (`--test-enable`), linter sạch (`odoo_linter.py`), không còn `# ponytail:` nợ chưa xử lý ([ponytail-lazy-dev.md](ponytail-lazy-dev.md) — debt ledger).
2. **Trình PO 4 lựa chọn:** (a) merge vào `<v>-dev` rồi cleaner → `<v>` production; (b) mở PR/MR; (c) giữ nhánh chờ; (d) huỷ nhánh.
3. **Chỉ khi PO chốt** mới `git_cleaner.py` + push lên 2 nhánh (mục 2). Không tự merge production.
4. Dọn worktree sau khi merge và hoàn tất quy trình (mục 4.2).
