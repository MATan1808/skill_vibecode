# Quy trình Gỡ lỗi & Sửa lỗi chuyên sâu (Debugging & Bug-fixing)

Tài liệu này đặc tả quy trình gỡ lỗi chuyên nghiệp trong Odoo dành cho AI Agent và Lập trình viên, đảm bảo sửa đúng lỗi tận gốc, tránh phát sinh lỗi chéo (side effects), và hỗ trợ xử lý lỗi trực tiếp trên môi trường Production bằng SSH/XML-RPC sau khi đã sao lưu cơ sở dữ liệu an toàn.

> Engine tự động hoá quy trình này: [`scripts/odoo_doctor.py`](../scripts/odoo_doctor.py). Lệnh entry: `/odoo-fix`.

---

<a id="systematic-debugging"></a>
## 0. Systematic Debugging — 4 pha (Iron Law) — hút từ superpowers

**Luật sắt:** `KHÔNG SỬA KHI CHƯA TÌM RA ROOT CAUSE`. Vá triệu chứng = thất bại. Áp dụng cho **mọi** lỗi (test fail, bug production, hành vi lạ, lỗi migrate). Đặc biệt khi đang gấp — lúc gấp mới hay đoán mò.

| Pha | Tên | Bắt buộc làm gì | Cổng ra |
|:---:|:---|:---|:---|
| **1** | Điều tra (Investigate) | Tái hiện lỗi. Đọc traceback tới dòng cuối. Thu thập input/state gây lỗi. **Thu nhỏ (minimise) repro về ca nhỏ nhất còn lỗi** — bớt dần record/field/bước cho tới khi bỏ thêm 1 thứ là hết lỗi (hút từ mattpocock/skills `diagnosing-bugs`). **Chưa xong pha 1 thì cấm đề xuất fix.** | Có repro ổn định & tối giản |
| **2** | Truy gốc (Root cause) | Trace ngược tới **nguyên nhân gốc**, không dừng ở nơi lỗi *hiện ra*. Tham chiếu code core Odoo (grep source), không đoán. **Instrument để xác nhận giả thuyết bằng dữ liệu:** mỗi giả thuyết → gắn log/breakpoint/đo đạc kiểm chứng rồi mới kết luận, không kết luận chay. | Nêu được "vì sao" 1 câu, có bằng chứng |
| **3** | Sửa gốc (Fix at source) | `grep` **mọi caller** của hàm bị lỗi → sửa **1 chỗ chung** (không vá từng nơi). Đúng "3 Nguyên tắc Vàng" (§3). | Diff nhỏ nhất đúng root |
| **4** | Xác minh (Verify) | Viết test tái hiện (RED) → sửa → test PASS (GREEN). Regression các module kế thừa. Trace log runtime. | Test pass + không side-effect |

**Red flags = đang vá triệu chứng, dừng lại:** "thử thêm `sudo()` xem sao", "thêm `try/except` cho hết lỗi", "chắc do cache, restart là được", sửa đúng dòng traceback chỉ mà không hỏi vì sao giá trị đó tới đó, thêm `if x:` guard mà không biết vì sao `x` rỗng.

> 5 bước bên dưới (§1) là hiện thực hoá 4 pha này cho ngữ cảnh Odoo. §2 là quy trình an toàn khi can thiệp Production. §3 là 3 Nguyên tắc Vàng.

---

## 1. Quy trình 5 bước Sửa lỗi chuẩn (The 5-Step Bug-fixing Workflow)

Khi nhận được báo cáo lỗi (dạng log text, traceback hoặc hình ảnh chụp màn hình):

```text
[Báo cáo lỗi (Log/Ảnh)] ──▶ [Trích xuất thông tin] ──▶ [Tham chiếu Code Core Odoo]
                                                             │
[Báo cáo kết quả & Ship] ◀── [Kiểm thử Regression] ◀── [Đánh giá Tác động chéo (RCA)]
```

### Bước 1: Trích xuất & Định vị lỗi (Error Isolation)
- **Nếu là Text Log/Traceback:** Đọc dòng cuối cùng để xác định loại Exception (ví dụ: `ValueError`, `ValidationError`, `KeyError`, `AccessError`) và tìm file/dòng gây lỗi trong phần stack trace.
- **Nếu là Hình ảnh chụp màn hình (Multimodal):** AI sử dụng khả năng phân tích hình ảnh để trích xuất text thông báo lỗi hiển thị trên UI, nhận dạng màn hình đang bị crash để định vị đúng trường dữ liệu hoặc button gây lỗi.

### Bước 2: Tham chiếu Code Core Odoo (Core Referencing)
- Tuyệt đối không đoán mò cách sửa lỗi. Phải kiểm tra xem phương thức hoặc trường gây lỗi hoạt động như thế nào trong mã nguồn gốc của Odoo.
- **Cách thực hiện:** Sử dụng công cụ grep hoặc công cụ tìm kiếm trong thư mục mã nguồn Odoo để đọc trực tiếp định nghĩa hàm core bị lỗi. Nếu không có source local, dùng WebFetch trên
  `https://raw.githubusercontent.com/odoo/odoo/{version}.0/{path}` để đọc đúng code core cùng version thay vì
  suy diễn từ trí nhớ — xem [version-compatibility-matrix.md §0](version-compatibility-matrix.md).

### Bảng tra nhanh lỗi thường gặp theo version

| Thông báo lỗi (Error Pattern) | Nguyên nhân | Version | Cách sửa |
|---|---|---|---|
| `'api' has no attribute 'multi'` | Còn dùng `@api.multi` | v15+ | Bỏ decorator |
| `attrs attribute is no longer supported` | `attrs=` trong view | v17+ | Đổi `invisible=`/`readonly=`/`required=` trực tiếp |
| `create() takes 2 positional arguments` | `create()` cũ chỉ nhận 1 record | v17+ | Thêm `@api.model_create_multi`, nhận `vals_list` |
| `check_company failed` | Quan hệ Many2one khác company | v18+ | Thêm `check_company=True` trên field + `_check_company_auto` |
| `SQL string query deprecated` | Truyền string thô vào `cr.execute` | v19 (cảnh báo) | Dùng `SQL()` builder — xem [orm-basics.md §7](orm-basics.md) |
| `RecursionError` | `@api.depends` vòng lặp, hoặc `write()` tự gọi lại chính nó | mọi version | Xem 3 dạng bẫy vòng lặp bên dưới |
| `MissingError` | Truy cập record đã bị xoá | mọi version | Guard bằng `.exists()` trước khi thao tác |
| `ValueError: External ID not found` | XML data load sai thứ tự (group/view tham chiếu trước khi được định nghĩa) | mọi version | Xem mục thứ tự file bên dưới |
| `OwlError: "model"."field" is undefined` | Thêm field mới nhưng pod cũ chưa reload Python memory worker | v16+ (OWL) | Dùng zero-downtime pod rotation trong [module-production-update.md](module-production-update.md), không `rollout restart` production |

### 3 dạng bẫy vòng lặp vô hạn (`RecursionError`) hay gặp

```python
# Dạng 1: compute field depends chính nó
total = fields.Float(compute='_compute_total', store=True)
@api.depends('total')          # BUG: phụ thuộc chính field nó tính ra
def _compute_total(self): ...

# Dạng 2: write() tự gọi lại chính nó lần 2
def write(self, vals):
    res = super().write(vals)
    self.write({'computed_date': fields.Date.today()})   # gọi write() lần nữa → lặp vô hạn
    return res
# SỬA: gộp vào cùng 1 lần write(), không gọi write() lần 2
def write(self, vals):
    if 'computed_date' not in vals:
        vals['computed_date'] = fields.Date.today()
    return super().write(vals)

# Dạng 3: 2 computed field phụ thuộc chéo nhau
@api.depends('field_b')
def _compute_a(self): ...
@api.depends('field_a')        # phụ thuộc chéo với hàm trên → vòng lặp
def _compute_b(self): ...
```

### `RedirectWarning` — exception có nút điều hướng, tốt hơn `UserError` cho luồng "cần cấu hình trước"

```python
def action_process(self):
    if not self.env.company.x_config_complete:
        action = self.env.ref('my_module.action_config_wizard')
        raise RedirectWarning(
            _("Cấu hình chưa hoàn tất. Vui lòng cấu hình trước."),
            action.id,
            _("Đi tới Cấu hình"),
        )
```

### Debug `@api.onchange` — `self.id` là `NewId`, không phải số nguyên

```python
@api.onchange('field_name')
def _onchange_field_name(self):
    _logger.info("field=%s, self.id=%s", self.field_name, self.id)
    # self.id là object NewId (record chưa lưu) trong context onchange, không phải int — bình thường, không phải bug
```

### Thứ tự file trong `data` của `__manifest__.py` — nguồn lỗi "External ID not found" hay gặp nhất

```python
# SAI — view/menu tham chiếu group trước khi group được định nghĩa
'data': ['views/my_views.xml', 'security/my_security.xml']

# ĐÚNG — group/access trước, view/menu tham chiếu chúng sau
'data': [
    'security/my_security.xml',      # định nghĩa res.groups trước
    'security/ir.model.access.csv',  # tham chiếu group
    'data/sequences.xml',
    'views/my_views.xml',            # có thể tham chiếu group qua groups=
    'views/menuitems.xml',           # tham chiếu action
]
```
Quy tắc này áp dụng cả **bên trong 1 file XML** — định nghĩa `res.groups` trước `ir.rule` tham chiếu nó qua
`ref()`.

### Bước 3: Phân tích Nguyên nhân Gốc rễ & Đánh giá Tác động (Root Cause Analysis - RCA)
Để tránh tình trạng **"sửa chỗ này lủng chỗ kia"**, trước khi viết bất kỳ dòng code vá lỗi nào, Agent phải tự trả lời 3 câu hỏi:
1. **Tại sao lỗi xảy ra?** (Do dữ liệu đầu vào trống, lỗi logic xử lý, hay lỗi phân quyền?).
2. **Bản vá này có làm thay đổi hành vi mặc định của hàm không?** (Nếu sửa hàm compute, các trường phụ thuộc khác có bị tính toán sai không?).
3. **Bản vá có ảnh hưởng đến các phân hệ khác kế thừa từ model này không?** (Đặc biệt là các model core như `res.partner`, `sale.order`, `account.move`).

### Bước 4: Viết Test case tái hiện & Sửa lỗi (Regression Testing)
- **Quy tắc:** Viết một unittest (hoặc kịch bản test) truyền vào đúng dữ liệu gây lỗi để chứng minh lỗi xảy ra.
- Tiến hành sửa lỗi trong code.
- Chạy lại unittest đó để xác nhận test đã pass.

### Bước 5: Trace logs Docker & Chờ PO xác nhận (Docker Log Tracing & PO Confirmation - MANDATORY)
- **Hành động sau khi vá lỗi:** Ngay sau khi đã code xong và restart container, Agent **bắt buộc phải thực hiện trace logs trực tiếp từ Docker** để theo dõi lỗi phát sinh trong thời gian thực.
- **Duy trì trạng thái:** Giữ kết nối log hoạt động và duy trì trạng thái sẵn sàng xử lý các lỗi phát sinh tiếp theo.
- **Quy tắc kết thúc:** Không được tự ý đóng task hay chuyển trạng thái. Agent phải sẵn sàng chờ lệnh xử lý cho đến khi Product Owner (người dùng) trực tiếp kiểm tra và gửi tin nhắn xác nhận lỗi đã được khắc phục hoàn toàn (fixed).
- **Bàn giao:** Sau khi được xác nhận, sử dụng `git_cleaner.py` để làm sạch code vá lỗi và push lên nhánh dev/production theo đúng quy chuẩn Git workflow.

---

## 2. Quy trình Sửa lỗi & Triển khai Production chuẩn 7 Bước (Feature/Bugfix Lifecycle)

Khi người dùng hoặc Agent tiếp nhận yêu cầu sửa lỗi (Bugfix) hoặc phát triển tính năng (Feature) can thiệp Odoo SaaS (`vuahethong`), bắt buộc phải tuân thủ nghiêm ngặt quy trình 7 bước sau không được bỏ bước:

### 📌 Bước 1: Tiếp nhận & Đẩy yêu cầu lên GitLab
*   **Tạo Issue**: Tạo Issue/Work Item tương ứng trên GitLab. **Bắt buộc** đính kèm log lỗi và **hình ảnh / screenshot hiện trạng lỗi** vào phần mô tả.
*   **Checklist rà soát**: Đăng ký task và tạo bảng checklist rà soát 7 bước vào tệp `dev_workspace/task_checklist.md` local (thư mục này được ignore trong `.gitignore` của nhánh Production để tránh rác code live).
*   **Nhánh phát triển**: Checkout nhánh con: `git checkout -b <issue_id>-ten-kebab-case-cong-viec` (ví dụ: `123-fix-im-livechat-overlap`).

### 📌 Bước 2: Sửa lỗi / Viết code ở Local (Fix Local)
*   Thực hiện code và sửa lỗi trực tiếp trên môi trường local.
*   Chỉ khi code chạy ổn định dưới local mới chuyển sang bước tiếp theo.

### 📌 Bước 3: Kiểm thử local hoàn chỉnh (Test Local)
*   Chạy kiểm thử local (linter, unit tests) đảm bảo tính năng chạy đúng 100% và không phát sinh lỗi chéo.
*   Tích chọn `[x]` các bước đã hoàn thành vào file `task_checklist.md`.

### 📌 Bước 4: Commit & Merge Request (GitLab)
*   Nâng minor version trong file manifest.
*   Cập nhật **Changelog kép** (đồng thời tại file `CHANGELOG.md` và key `description` của `__manifest__.py`).
*   Commit code gắn kèm Issue ID (`Closes #issue_id`) -> Tạo và merge MR từ nhánh con vào nhánh `<version>-dev` (ví dụ: `19.0-dev`).

### 📌 Bước 5: Backup Production (Go Production & Backup)
*   Thực hiện backup theo chuẩn duy nhất tại [module-production-update.md](module-production-update.md): backup DB trước khi update module, verify dump bằng `pg_restore -l`, và backup code đang chạy bằng stream tar về local server theo `client-name`.

### 📌 Bước 6: Triển khai an toàn lên Production (Safe Deploy)
*   Production bắt buộc `git fetch` + `git pull --ff-only`/checkout SHA đã push từ GitLab trước khi update. **Cấm tuyệt đối** `rsync`, `scp`, `kubectl cp`, `tar`, `cp` hoặc sync source local trực tiếp lên production. Sau Git pull, chạy `odoo -d "$POSTGRES_DB" -u <tên_module> --stop-after-init --without-demo=all --config /etc/odoo/odoo.conf`, scale up pod mới rồi scale down/delete pod cũ. Không dùng `rollout restart` cho production module update.

### 📌 Bước 7: Kiểm thử Production & Báo cáo ngắn gọn
*   **Bắt buộc (Kiểm thử thực tế & Check log)**: Ngay sau khi pod live khởi chạy lại, Agent/Developer bắt buộc phải truy cập trực tiếp vào URL website của instance (ví dụ: `https://gtline.vuahethong.com`), đăng nhập và tương tác thử với các tính năng vừa deploy (đóng/mở widget, gọi điện, chat thử...).
*   Ngay sau khi tương tác, chạy lệnh lấy logs của pod live mới (`kubectl logs -n <namespace> <pod_name> --tail=100`) để kiểm tra trực tiếp xem hệ thống có phát sinh bất kỳ lỗi QWeb, cảnh báo Python hay exception nào ở runtime hay không.
*   **Bắt buộc**: Viết một comment (note) ngắn gọn mô tả lại quá trình fixed lỗi và nguyên nhân (RCA) trên GitLab Issue trước khi đóng (Close) Issue để phục vụ tra cứu sau này:
    ```bash
    glab issue note <issue_id> --message "### Kết quả khắc phục lỗi
    * Nguyên nhân (RCA): [Mô tả chi tiết nguyên nhân]
    * Cách xử lý: [Mô tả chi tiết cách xử lý]
    * Trạng thái: Đã verify hoạt động tốt trên website live."
    ```
*   Báo cáo ngắn gọn kết quả cho Product Owner (kèm theo File ID backup SharePoint, kết quả upgrade thành công).

---

## 3. Nguyên tắc Vàng khi Phát triển & Sửa lỗi (Golden Rules)

Để tránh tối đa các sự cố sập hệ thống và xung đột mã nguồn khi cập nhật Odoo sau này, cả Developer và AI Agent bắt buộc phải tuân thủ 3 nguyên tắc vàng sau:

### 🥇 Nguyên tắc 1: Kiểm duyệt Phân quyền kỹ lưỡng (Access Rights Check)
- **Hành động:** Khi phân tích lỗi hoặc thiết kế tính năng mới, bắt buộc phải kiểm tra kỹ mức độ liên quan về phân quyền (Access Rights / Record Rules).
- **Yêu cầu:** AI Agent phải vẽ sơ đồ (bằng Mermaid) biểu diễn các nhóm người dùng (groups), mô hình phân quyền (ACL) và quy tắc bản ghi liên quan. **Bắt buộc phải trình bày sơ đồ này và xin ý kiến duyệt của người dùng trước khi tiến hành sửa lỗi.**

### 🥈 Nguyên tắc 2: Sửa bằng Mã nguồn - KHÔNG sửa trực tiếp trên DB/UI
- **Hành động:** **Đặc biệt lưu ý:** Fixed bug **không bao giờ** được phép chỉnh sửa trực tiếp giá trị trường dữ liệu (field) hoặc cấu hình giao diện (views) bằng tay trực tiếp trên Database (qua SQL/pgAdmin) hoặc qua giao diện UI (như Odoo Studio/Settings) trên môi trường Production.
- **Yêu cầu:** Mọi sửa lỗi hoặc thay đổi cấu hình phải được thực hiện thông qua việc sửa lại mã nguồn của module (XML file, Python file, CSV file) để đảm bảo toàn bộ thay đổi được lưu trữ lịch sử trên Gitlab.

### 🥉 Nguyên tắc 3: Chỉ sửa Custom Code - KHÔNG chạm vào Origin Code (Odoo Core)
- **Hành động:** Tuyệt đối **không bao giờ chỉnh sửa trực tiếp** vào mã nguồn gốc (Origin Code / Odoo Core) của Odoo.
- **Yêu cầu:** Khi cần sửa lỗi hoặc mở rộng hành vi của các tính năng mặc định trong Odoo Core:
  - Chỉ được sửa custom code (các module tùy chỉnh do công ty viết thêm).
  - Sử dụng cơ chế kế thừa (`_inherit` / `_inherits`) của Odoo để override hoặc bổ sung logic.
  - Sử dụng cơ chế vá JS (patch component) của OWL để mở rộng frontend, giữ cho mã nguồn gốc của Odoo luôn sạch 100%.
