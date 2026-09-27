# Helpdesk Intake & Ticket Reporting (vuahethong.net)

> **CANONICAL** — Đặc tả Giai đoạn 0 (tiếp nhận sự vụ) và Bước 12 (đóng ticket + ghi timesheet) của Quy trình 6 Giai Đoạn Fix Bug Odoo. Giai đoạn 4–5 xem `module-production-update.md`.

Mọi sự vụ lỗi của khách hàng SaaS **BẮT BUỘC** được ghi nhận thành ticket/task trên `vuahethong.net` **TRƯỚC** khi động vào code. Không fix chay rồi báo miệng — không có ticket thì không có lịch sử, không tính được thời gian, không quy trách nhiệm được.

## Credential

API key nằm ở `/Volumes/DATA/ENV/.env` (field `api_key`, site `vuahethong.net`). **TUYỆT ĐỐI KHÔNG** hardcode key vào script trong repo, không echo ra log, không commit.

```bash
API_KEY=$(grep '^api_key:' /Volumes/DATA/ENV/.env | cut -d' ' -f2)
```

Xác thực JSON-RPC (API key dùng thay password, `login` là user vận hành):

```python
import xmlrpc.client, os, re

URL = 'https://vuahethong.net'
DB  = '<dbname>'
LOGIN = '<user@360.org.vn>'
API_KEY = re.search(r'^api_key:\s*(\S+)', open('/Volumes/DATA/ENV/.env').read(), re.M).group(1)

common = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/common')
uid = common.authenticate(DB, LOGIN, API_KEY, {})
models = xmlrpc.client.ServerProxy(f'{URL}/xmlrpc/2/object')
```

---

## Giai đoạn 0 — Tiếp nhận, Phân tích & Ghi nhận

### Bước 0.1 — Tiếp nhận & sắp xếp thông tin

Thu thập đủ 5 mục trước khi mở ticket. Thiếu mục nào thì hỏi lại khách, không tự suy diễn:

| Mục | Nội dung |
|---|---|
| Khách hàng | Tên + `namespace` + `dbname` + domain |
| Hiện tượng | Khách thấy gì, thao tác nào ra lỗi, từ khi nào |
| Bằng chứng | Screenshot, traceback, `kubectl logs`, request ID |
| Phạm vi | 1 user hay toàn bộ? 1 màn hình hay cả module? |
| Mức độ | Chặn nghiệp vụ (P1) / khó chịu (P2) / cosmetic (P3) |

### Bước 0.2 — Xác định đúng khách hàng đang lỗi

Không được đoán namespace từ tên gọi tắt. Verify bằng cụm thật:

```bash
kubectl get ns --context saas | grep -i <từ-khóa-khách>
kubectl -n <namespace> get pods,ingress -o wide --context saas
```

Đối chiếu domain trong ingress khớp với domain khách báo.

### Bước 0.3 — Phân tích sơ bộ & root cause giả định

Đọc log đúng thời điểm khách báo lỗi, không đọc mò:

```bash
kubectl logs -n <namespace> <pod> --since=2h --context saas | rg -i 'traceback|error|critical' | tail -50
```

Ghi lại: traceback đầy đủ, module nghi vấn, giả thuyết root cause. Nếu codebase có Code Knowledge Graph thì dùng `graphify` định vị symbol thay vì quét file.

### Bước 0.4 — Tạo ticket/task trên vuahethong.net (BẮT BUỘC ĐẦY ĐỦ)

Chọn đúng model:
- **`helpdesk.ticket`** — khách hàng báo lỗi qua kênh hỗ trợ.
- **`project.task`** — việc nội bộ, dev chủ động, hoặc sự vụ đã chuyển thành task kỹ thuật.

Điền **đủ 8 trường**, cấm tạo hời hợt:

| # | Trường | Yêu cầu |
|---|---|---|
| 1 | `user_ids` / `user_id` | Gán đích danh người phụ trách |
| 2 | `allocated_hours` | Dự toán giờ (VD `2.0`), **cấm để `00:00`** |
| 3 | `date_deadline` | Hạn chót cụ thể theo mức độ ưu tiên |
| 4 | `tag_ids` | `Kỹ thuật`, `Fixed Issues`, `New Feature`... |
| 5 | `milestone_id` | Nếu project có cấu hình cột mốc |
| 6 | `mail.activity` | Lên lịch giao việc kèm `summary`, `note`, `date_deadline` |
| 7 | `description` | 4 mục: Mô tả sự vụ / Traceback / Root Cause / Hướng giải quyết |
| 8 | `partner_id` | Đúng khách hàng đang lỗi |

```python
from markupsafe import Markup  # nếu chạy trong Odoo env

desc = Markup("""
<h3>1. Mô tả sự vụ</h3><p>...</p>
<h3>2. Traceback</h3><pre>...</pre>
<h3>3. Root Cause</h3><p>...</p>
<h3>4. Hướng giải quyết</h3><ul><li>...</li></ul>
""")

ticket_id = models.execute_kw(DB, uid, API_KEY, 'project.task', 'create', [{
    'name': '[<Khách>] <Tóm tắt lỗi>',
    'project_id': <project_id>,
    'partner_id': <partner_id>,
    'user_ids': [(6, 0, [<uid_phu_trach>])],
    'allocated_hours': 2.0,
    'date_deadline': '2026-09-12',
    'tag_ids': [(6, 0, [<tag_ky_thuat>, <tag_fixed_issues>])],
    'description': str(desc),
}])
```

> ⚠️ Khi post chatter qua `message_post()`, **BẮT BUỘC** bọc HTML bằng `Markup(...)`. Truyền raw string làm Odoo escape entity, UI lộ thẻ `<p>`, `<li>` cho khách nhìn thấy.

Tạo activity giao việc:

```python
models.execute_kw(DB, uid, API_KEY, 'mail.activity', 'create', [{
    'res_model_id': <id_of_ir_model_project_task>,
    'res_id': ticket_id,
    'activity_type_id': <to_do_type_id>,
    'user_id': <uid_phu_trach>,
    'summary': 'Fix <tóm tắt>',
    'note': '<hướng dẫn chi tiết>',
    'date_deadline': '2026-09-12',
}])
```

**Ghi lại `ticket_id`** — cần dùng ở Bước 12.

---

## Bước 12 — Đóng ticket & Ghi nhận Timesheet

Chạy sau Bước 11 (Report), khi đã verify production sạch.

### 12.1 — Ghi Timesheet (BẮT BUỘC)

Mọi báo cáo hoàn thành **bắt buộc** kèm dòng timesheet. Ghi giờ thực tế đã bỏ ra, không làm tròn khống:

```python
models.execute_kw(DB, uid, API_KEY, 'account.analytic.line', 'create', [{
    'task_id': ticket_id,
    'project_id': <project_id>,
    'name': 'Fix <tóm tắt> — deploy production, verify HTTP 200 + log sạch',
    'unit_amount': 1.5,          # số giờ thực hiện
    'date': '2026-09-11',
    'employee_id': <employee_id>,
}])
```

### 12.2 — Cập nhật trạng thái

```python
models.execute_kw(DB, uid, API_KEY, 'project.task', 'write', [[ticket_id], {
    'stage_id': <stage_done_id>,
    'state': '1_done',
}])
```

Với `helpdesk.ticket`: set `stage_id` sang stage Solved/Closed tương ứng của team.

### 12.3 — Post chatter kết quả

```python
body = Markup("""
<p><b>✅ Đã xử lý xong</b></p>
<ul>
  <li><b>Root cause:</b> ...</li>
  <li><b>Thay đổi:</b> module <code>&lt;module&gt;</code> v&lt;version&gt;, commit <code>&lt;sha&gt;</code></li>
  <li><b>Verify:</b> HTTP 200 OK, pod log 0 traceback</li>
  <li><b>Thời gian thực hiện:</b> 1.5 giờ</li>
</ul>
""")
models.execute_kw(DB, uid, API_KEY, 'project.task', 'message_post', [[ticket_id]], {
    'body': str(body), 'message_type': 'comment', 'subtype_xmlid': 'mail.mt_comment',
})
```

### 12.4 — Đóng activity còn treo

```python
act_ids = models.execute_kw(DB, uid, API_KEY, 'mail.activity', 'search',
    [[('res_id', '=', ticket_id), ('res_model', '=', 'project.task')]])
if act_ids:
    models.execute_kw(DB, uid, API_KEY, 'mail.activity', 'action_feedback', [act_ids],
        {'feedback': 'Đã fix và deploy production, verify OK.'})
```

---

## Checklist đóng sự vụ

- [ ] Ticket/task tồn tại, đủ 8 trường, đúng `partner_id` khách đang lỗi
- [ ] Timesheet đã ghi, `unit_amount` > 0
- [ ] Stage = Done/Solved
- [ ] Chatter có kết quả kèm commit sha + bằng chứng verify
- [ ] Activity không còn treo
- [ ] Backup DB + backup code còn nguyên ở local (`/mnt/DATA/work/<client-name>/`)
