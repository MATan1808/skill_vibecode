# Odoo ORM Basics & Best Practices (v14 - v19)

Tài liệu hướng dẫn phát triển backend ORM Odoo từ phiên bản v14 đến v19.0.

---

## 1. Khai báo Model & Kế thừa (Inheritance)

### Cú pháp khai báo chuẩn
```python
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class HospitalPatient(models.Model):
    _name = 'hms.patient'
    _description = 'Hospital Patient'
    _inherit = ['mail.thread', 'mail.activity.mixin'] # Kế thừa chatter (nếu có dùng module mail)
    _order = 'name, id desc'

    name = fields.Char(string='Name', required=True, tracking=True)
    active = fields.Boolean(string='Active', default=True, tracking=True)
    sequence = fields.Integer(string='Sequence', default=10)
```

### Các kiểu kế thừa
- **Class Inheritance (Extension - `_inherit` không có `_name` mới):** Thêm trường hoặc override method của model gốc (ví dụ: kế thừa `res.partner`).
- **Prototype Inheritance (`_inherit` đi kèm `_name` mới):** Sao chép hành vi và cấu trúc bảng của model cũ sang bảng mới hoàn toàn độc lập.
- **Delegation Inheritance (`_inherits`):** Liên kết đa hình kiểu 1-1 (Ví dụ: `res.users` kế thừa delegation từ `res.partner` thông qua trường `partner_id`).

---

## 2. Trường dữ liệu (Fields) & Biến đổi

### Basic Fields
```python
age = fields.Integer(string='Age', group_operator='avg')
weight = fields.Float(string='Weight', digits=(6, 2))
gender = fields.Selection([
    ('male', 'Male'),
    ('female', 'Female'),
    ('other', 'Other')
], string='Gender', default='male')
date_of_birth = fields.Date(string='Date of Birth')
appointment_time = fields.Datetime(string='Appointment Time', default=fields.Datetime.now)
biography = fields.Html(string='Biography')
```

### Relational Fields
```python
# Many2one
doctor_id = fields.Many2one('hms.doctor', string='Doctor', ondelete='restrict', index=True)

# One2many (bắt buộc phải có một trường Many2one tương ứng ở model đích)
prescription_line_ids = fields.One2many('hms.prescription.line', 'patient_id', string='Prescription Lines')

# Many2many (bắt buộc tạo bảng trung gian tự động hoặc thủ công)
tag_ids = fields.Many2many(
    'hms.patient.tag', 
    'hms_patient_tag_rel', # Tên bảng trung gian
    'patient_id',          # Cột liên kết model hiện tại
    'tag_id',              # Cột liên kết model đích
    string='Tags'
)
```

---

## 3. Trường tính toán (Computed Fields) & Trực tiếp (Onchange)

### Computed Fields & Depends
Computed fields mặc định không được lưu trữ trong Database (không thể search hoặc filter trừ khi viết thêm phương thức `_search`). Khuyên dùng `store=True` để tăng hiệu năng đọc.

```python
prescription_count = fields.Integer(
    string='Prescription Count', 
    compute='_compute_prescription_count', 
    store=True
)

@api.depends('prescription_line_ids')
def _compute_prescription_count(self):
    for rec in self:
        rec.prescription_count = len(rec.prescription_line_ids)
```

> [!WARNING]
> **Lỗi SingletonError:** Luôn luôn lặp qua `self` (ví dụ: `for rec in self:`) trong các hàm compute và onchange để tránh lỗi khi Odoo xử lý danh sách nhiều bản ghi cùng lúc.

### Computed Fields với hàm Inverse (Cho phép chỉnh sửa trường compute)
```python
age = fields.Integer(compute='_compute_age', inverse='_inverse_age', store=True)

@api.depends('date_of_birth')
def _compute_age(self):
    for rec in self:
        if rec.date_of_birth:
            rec.age = fields.Date.today().year - rec.date_of_birth.year
        else:
            rec.age = 0

def _inverse_age(self):
    for rec in self:
        if rec.age:
            rec.date_of_birth = fields.Date.today().replace(year=fields.Date.today().year - rec.age)
```

---

## 4. Constraints & Indexes (Ràng buộc dữ liệu)

### Python Constraints (Ràng buộc logic)
```python
@api.constrains('age')
def _check_age(self):
    for rec in self:
        if rec.age < 0 or rec.age > 150:
            raise ValidationError(_("Tuổi của bệnh nhân phải nằm trong khoảng từ 0 đến 150!"))
```

### SQL Constraints & Indexes (Khác biệt v14-v16 so với v17-v19)

#### ⚠️ Phiên bản v14 - v16:
Cấu hình trực tiếp bằng thuộc tính lớp `_sql_constraints` và `index=True` trên field:
```python
_sql_constraints = [
    ('name_uniq', 'unique(name)', 'Tên bệnh nhân đã tồn tại!')
]
doctor_id = fields.Many2one('hms.doctor', string='Doctor', index=True)
```

#### 🚀 Phiên bản v17 - v19:
Odoo 17+ giới thiệu các lớp định nghĩa Constraint và Index tường minh thông qua thuộc tính model:
```python
from odoo.addons.base.models.ir_model import Constraint, Index

class HospitalPatient(models.Model):
    _name = 'hms.patient'
    
    # Định nghĩa SQL Constraints hiện đại
    _sql_constraints = [
        ('name_uniq', 'UNIQUE(name)', 'Tên bệnh nhân đã tồn tại!')
    ]
    
    # Định nghĩa B-tree Index phức hợp
    _table_indexes = [
        models.Index(fields=['doctor_id', 'active']),
    ]
```

---

## 5. Domain & Các toán tử ORM mới của Odoo 19.0

### Cú pháp Domain động
Domain dùng để lọc bản ghi, có cấu trúc dạng Ba-lê ngược: `[(trường, toán tử, giá trị)]`.

```python
# Tìm bệnh nhân nam hoạt động hoặc bệnh nhân nữ dưới 18 tuổi
domain = ['|', 
    ('&', ('gender', '=', 'male'), ('active', '=', True)), 
    ('&', ('gender', '=', 'female'), ('age', '<', 18))
]
```

### 🚀 Điểm mới của Odoo 19.0: Toán tử `any!` và `not any!`
Odoo 19.0 giới thiệu hai toán tử mới chuyên dùng cho quan hệ One2many/Many2many khi truy vấn ORM:
- **`any!`**: Kiểm tra xem **có bất kỳ** bản ghi liên kết nào thỏa mãn điều kiện, nhưng điểm đặc biệt là nó **bỏ qua cơ chế Record Rules và Access Rights** đối với các model liên kết đó để tăng tốc độ truy vấn cấp hệ thống.
- **`not any!`**: Phủ định của `any!`.

```python
# v19.0 ORM query dùng any! (chỉ dùng nội bộ ở server, không gọi được qua RPC)
# Lấy ra các bác sĩ có bất kỳ bệnh nhân nào hoạt động mà không bị chặn bởi phân quyền bản ghi bệnh nhân
doctors = self.env['hms.doctor'].search([('patient_ids', 'any!', [('active', '=', True)])])
```
*Lưu ý: Luôn sử dụng toán tử này trong các tác vụ tính toán ngầm của hệ thống (cron, compute) để tối ưu hóa hiệu năng, tránh lỗi truy cập do phân quyền chéo.*

---

## 6. Toán tử x2many hiện đại: `Command` class (thay tuple cổ điển)

Từ v16, Odoo cung cấp class `Command` để thao tác One2many/Many2many trong `write()`/`create()`, thay cho cú
pháp tuple `(0, 0, {...})` khó đọc kiểu cũ. **Bắt buộc dùng `Command` khi viết code mới cho v16+** — tuple vẫn
chạy được (deprecated) tới v18 nhưng nên tránh vì kém rõ nghĩa và có nguy cơ bị gỡ ở bản sau (xem
[version-compatibility-matrix.md §1](version-compatibility-matrix.md) — verify trước khi khẳng định "đã gỡ" ở 1 bản cụ thể).

```python
from odoo import Command

# Cũ (tuple, tránh dùng cho code mới v16+)
self.write({'line_ids': [(0, 0, {'name': 'Line A'}), (2, old_line_id, 0)]})

# Mới — Command class (v16+)
self.write({'line_ids': [
    Command.create({'name': 'Line A'}),   # (0, 0, vals)
    Command.update(line_id, {'qty': 2}),  # (1, id, vals)
    Command.delete(old_line_id),          # (2, id, 0) — xoá hẳn record liên kết
    Command.unlink(other_line_id),        # (3, id, 0) — chỉ gỡ liên kết (One2many: coi như delete)
    Command.link(existing_id),            # (4, id, 0)
    Command.clear(),                      # (5, 0, 0) — gỡ hết liên kết hiện có
    Command.set([id1, id2, id3]),         # (6, 0, ids) — thay toàn bộ bằng danh sách này
]})
```

`Command.delete()` xoá thẳng record ở model liên kết (chỉ hợp lý cho One2many); `Command.unlink()` chỉ gỡ
liên kết mà không xoá record (đúng ngữ nghĩa cho Many2many). Nhầm 2 cái này là lỗi hay gặp nhất khi mới
chuyển từ tuple sang `Command`.

---

## 7. `SQL()` query builder — thay raw SQL string (khuyến nghị v18+)

Odoo giới thiệu `odoo.tools.sql.SQL` để build câu SQL an toàn kiểu template, thay cho nối chuỗi/f-string
(nguy cơ SQL injection) hoặc truyền tham số rời rạc dễ nhầm thứ tự:

```python
from odoo.tools import SQL

# ✗ Tránh: f-string trực tiếp vào execute — rủi ro injection nếu giá trị từ user input
self.env.cr.execute(f"SELECT id FROM res_partner WHERE name = '{name}'")

# ⚠️ Chấp nhận được nhưng cũ: %s rời rạc, dễ sai thứ tự khi câu SQL phức tạp/lồng nhau
self.env.cr.execute("SELECT id FROM res_partner WHERE name = %s", [name])

# ✅ Khuyến nghị v18+: SQL() builder — compose an toàn, lồng được nhiều SQL() với nhau
query = SQL(
    "SELECT id FROM %(table)s WHERE %(field)s = %(value)s",
    table=SQL.identifier("res_partner"),
    field=SQL.identifier("name"),
    value=name,
)
self.env.cr.execute(query)
```

`SQL.identifier()` dùng khi tên bảng/cột cũng động (không thể tham số hoá bằng `%s` thông thường vì đó là
identifier chứ không phải value) — đây chính là chỗ hay bị injection nếu tự nối chuỗi tay.

> ⚠️ Mức độ "bắt buộc" của `SQL()` ở v19 (raw SQL bị chặn hoàn toàn) là claim từ tài liệu cộng đồng, **chưa
> xác nhận chính thức** — xem quy trình verify ở
> [version-compatibility-matrix.md §0](version-compatibility-matrix.md)
> trước khi báo cứng với PO. Dù verify ra sao, `SQL()` vẫn là lựa chọn an toàn hơn hẳn f-string/nối chuỗi nên
> nên ưu tiên dùng ngay cả khi chưa bắt buộc.

---

## 8. Pattern trả về Action & tìm kiếm nâng cao

### Mở Form/List/Wizard từ 1 method
```python
def action_view_form(self):
    self.ensure_one()
    return {
        'type': 'ir.actions.act_window',
        'res_model': 'hms.patient',
        'res_id': self.id,
        'view_mode': 'form',
        'target': 'current',
    }

def action_open_wizard(self):
    return {
        'type': 'ir.actions.act_window',
        'res_model': 'hms.wizard',
        'view_mode': 'form',
        'target': 'new',                       # mở dạng dialog/modal
        'context': {'active_ids': self.ids},
    }
```

### Override `_name_search` (autocomplete Many2one tìm theo nhiều field)
```python
@api.model
def _name_search(self, name='', domain=None, operator='ilike', limit=100, order=None):
    domain = domain or []
    if name:
        domain = ['|', ('name', operator, name), ('code', operator, name)] + domain
    return self._search(domain, limit=limit, order=order)
```

### Chuyển company khi thao tác đa công ty
```python
other_company = self.env['res.company'].browse(company_id)
records = self.with_company(other_company)   # context + company_id đồng bộ đúng cho toàn bộ chain gọi sau
```

### `RedirectWarning` — báo lỗi kèm nút điều hướng tới cấu hình
```python
from odoo.exceptions import RedirectWarning

action = self.env.ref('base_setup.action_general_configuration')
raise RedirectWarning(
    _("Chưa cấu hình đơn vị tiền tệ mặc định."),
    action.id,
    _("Đi tới Cài đặt"),
)
```

---

## 9. Field lưu riêng theo từng company mà không cần record rule (`company_dependent`)

Khác với pattern "field `company_id` + record rule lọc theo company" (mỗi company thấy record riêng) —
`company_dependent=True` cho phép **cùng 1 record** có **giá trị khác nhau theo từng company đang xem** (lưu
ngầm qua `ir.property`), không cần compute/inverse tự viết:

```python
x_internal_code = fields.Char(company_dependent=True)
x_local_price = fields.Float(company_dependent=True, digits='Product Price')
```
```python
code = self.x_internal_code                                   # giá trị theo company hiện tại (self.env.company)
code_other = self.with_company(other_company).x_internal_code # đọc tường minh theo 1 company khác
```

---

## 10. Savepoint — cô lập lỗi từng record trong vòng lặp batch, không phá cả transaction

```python
for record in self:
    try:
        with self.env.cr.savepoint():
            record._process_single()
    except Exception as e:
        _logger.error("Lỗi xử lý record %s: %s", record.id, e)
        continue   # chỉ rollback riêng phần của record này, các record trước đó vẫn giữ nguyên
```
Tốt hơn hẳn cách `cr.commit()` sau mỗi record (phá tính atomic của transaction, không rollback được nếu user
huỷ giữa chừng) khi mục tiêu là "bỏ qua record lỗi, giữ lại record thành công" trong cùng 1 lần chạy.

## 11. Nhận batch song song an toàn nhiều worker cùng lúc — `FOR UPDATE SKIP LOCKED`

Khi nhiều Odoo worker/cron cùng cố lấy 1 lô record để xử lý (worker queue tự chế — xem
[cron-and-automation-patterns.md](cron-and-automation-patterns.md)),
dùng `SKIP LOCKED` để mỗi worker tự động bỏ qua record đang bị worker khác khoá, không cần tự viết cơ chế
lock riêng:

```sql
WITH to_update AS (
    SELECT id FROM my_model
    WHERE migrated = false
    LIMIT 100
    FOR UPDATE SKIP LOCKED
)
UPDATE my_model m
SET new_field = old_field * 1.1, migrated = true
FROM to_update
WHERE m.id = to_update.id
RETURNING m.id
```

## 12. `ir.sequence` — placeholder & lưu ý không "vá" số bị hụt

```xml
<record id="sequence_invoice" model="ir.sequence">
    <field name="prefix">INV/%(year)s/</field>
    <field name="use_date_range">True</field>  <!-- tự tạo sub-counter riêng theo từng năm, không cần code -->
</record>
```

| Placeholder | Ý nghĩa |
|---|---|
| `%(year)s` / `%(y)s` | Năm 4 số / 2 số |
| `%(month)s` | Tháng |
| `%(doy)s` / `%(woy)s` | Ngày trong năm / Tuần trong năm |
| `%(h24)s` | Giờ dạng 24h |

Sinh số theo 1 ngày cụ thể (nhập liệu hồi tố) thay vì ngày hôm nay:
```python
vals['name'] = self.env['ir.sequence'].with_context(
    ir_sequence_date=vals.get('date') or fields.Date.today()
).next_by_code('my.model') or _('New')
```

**Không bao giờ "vá" số bị hụt trong dãy sequence** — số hụt là bình thường (giao dịch lỗi/rollback), tự đánh
số lại phá vỡ tính liên tục cần cho audit trail. Nếu khách hàng phàn nàn về số hụt, giải thích đây là hành vi
đúng, không phải bug.
