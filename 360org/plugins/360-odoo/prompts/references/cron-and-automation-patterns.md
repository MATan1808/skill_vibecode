# Odoo Scheduled Actions & Automation Rules (v14 - v19)

---

## 1. `ir.cron` — bảng thuộc tính tra nhanh

```xml
<record id="ir_cron_sync_patients" model="ir.cron">
    <field name="name">Đồng bộ bệnh nhân từ hệ thống ngoài</field>
    <field name="model_id" ref="model_hms_patient"/>
    <field name="state">code</field>
    <field name="code">model._cron_sync_external()</field>
    <field name="interval_number">1</field>
    <field name="interval_type">hours</field>
    <field name="numbercall">-1</field>
    <field name="doall" eval="False"/>
    <field name="priority">5</field>
</record>
```

| Thuộc tính | Ý nghĩa |
|---|---|
| `interval_number` + `interval_type` | Chu kỳ chạy (`minutes`/`hours`/`days`/`weeks`/`months`) |
| `numbercall` | Số lần chạy còn lại, `-1` = vô hạn |
| `doall` | `True` = chạy bù các lần bị miss lúc server tắt (hiếm khi cần `True`) |
| `priority` | Số nhỏ hơn chạy trước khi nhiều cron cùng đến hạn |
| `active` | Tắt cron mà không xoá record (dùng khi maintenance) |

---

## 2. Cron xử lý theo giới hạn thời gian (time-limited), không chỉ giới hạn batch size

Cron chạy quá lâu sẽ chiếm worker, làm nghẽn các cron/request khác. Giới hạn theo **wall-clock time** đáng
tin cậy hơn giới hạn số bản ghi (vì mỗi bản ghi có thể nặng nhẹ khác nhau):

```python
import time

@api.model
def _cron_time_limited_process(self):
    max_duration = 300  # 5 phút
    start_time = time.time()
    processed = 0
    records = self.search([('needs_sync', '=', True)])
    for record in records:
        if time.time() - start_time > max_duration:
            _logger.warning("Dừng cron sau %s bản ghi do chạm giới hạn thời gian.", processed)
            break
        record._sync_external()
        processed += 1
        if processed % 50 == 0:
            self.env.cr.commit()   # commit theo batch nhỏ, không giữ transaction quá lâu
```

---

## 3. `base.automation` — trigger theo sự kiện, không cần code Python riêng

| `trigger` | Kích hoạt khi |
|---|---|
| `on_create` | Tạo record mới |
| `on_write` | Cập nhật record |
| `on_create_or_write` | Cả 2 |
| `on_unlink` | Xoá record |
| `on_time` | Đến 1 mốc thời gian tương đối theo field ngày/giờ trên record |

Trigger `on_time` dùng `trg_date_id`/`trg_date_range`/`trg_date_range_type` để tính mốc — ví dụ cảnh báo
trước hạn 1 ngày:

```xml
<record id="automation_overdue_check" model="base.automation">
    <field name="name">Đánh dấu quá hạn</field>
    <field name="model_id" ref="model_hms_appointment"/>
    <field name="trigger">on_time</field>
    <field name="trg_date_id" ref="field_hms_appointment__deadline"/>
    <field name="trg_date_range">1</field>
    <field name="trg_date_range_type">day</field>
    <field name="filter_domain">[('state', 'not in', ['done', 'cancel'])]</field>
    <field name="state">code</field>
    <field name="code">records.write({'is_overdue': True})</field>
</record>
```

`base.automation` phù hợp cho rule nghiệp vụ đơn giản, cấu hình qua UI, không cần deploy code — dùng
`ir.cron` khi logic phức tạp hơn cần code Python có test riêng.

---

## 4. Giả lập hàng đợi xử lý bất đồng bộ (không cần `queue_job`)

Khi không có (hoặc không muốn phụ thuộc) module `queue_job` của OCA, có thể giả lập bằng field trạng thái +
cron polling — pattern chuẩn cho "xử lý nền" nhẹ:

```python
process_state = fields.Selection([
    ('pending', 'Chờ xử lý'), ('processing', 'Đang xử lý'),
    ('done', 'Hoàn tất'), ('error', 'Lỗi'),
], default='pending')
process_error = fields.Text()

@api.model
def _cron_process_queue(self):
    records = self.search([('process_state', '=', 'pending')], limit=20)
    for record in records:
        record.process_state = 'processing'
        self.env.cr.commit()             # chốt trạng thái trước khi làm việc nặng, tránh xử lý trùng
        try:
            record._do_heavy_work()
            record.process_state = 'done'
        except Exception as e:
            record.process_state = 'error'
            record.process_error = str(e)
        self.env.cr.commit()
```

Chạy cron dưới danh nghĩa 1 user dịch vụ riêng (không phải Admin) để đúng phạm vi quyền và dễ audit log:
```python
self.with_user(self.env.ref('my_module.user_cron_service'))._do_heavy_work()
```

Khi cần xử lý song song nhiều worker Odoo cùng lúc mà không giành nhau 1 bản ghi, dùng
`FOR UPDATE SKIP LOCKED` ở tầng SQL — xem
[orm-basics.md §9](orm-basics.md).
