# Odoo Security, Access Rights & Record Rules (v14 - v19)

Tài liệu hướng dẫn thiết lập hệ thống bảo mật, phân quyền dữ liệu và các quy tắc truy cập trong Odoo từ phiên bản v14 đến v19.

---

## 1. Phân quyền mô hình (ir.model.access.csv)

Tất cả các model mới được định nghĩa trong Odoo (kế thừa từ `models.Model`) **bắt buộc phải được phân quyền** trong tệp `security/ir.model.access.csv`. Nếu thiếu phân quyền, các user (bao gồm cả Admin trừ khi chạy chế độ debug siêu quyền lực) sẽ không thể nhìn thấy hoặc tương tác với model đó.

### Định dạng chuẩn của file `ir.model.access.csv`:
```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_hms_patient_user,access.hms.patient.user,model_hms_patient,hms_hospital.group_hms_user,1,1,1,0
access_hms_patient_manager,access.hms.patient.manager,model_hms_patient,hms_hospital.group_hms_manager,1,1,1,1
```

### Các cột thuộc tính:
- **`id`:** Định danh duy nhất cho dòng phân quyền (thường đặt dạng `access_modelname_groupname`).
- **`name`:** Tên dòng phân quyền (để hiển thị).
- **`model_id:id`:** XML ID của model mục tiêu (bắt đầu bằng `model_` tiếp sau là tên model thay dấu chấm bằng dấu gạch dưới). Ví dụ: `model_hms_patient`.
- **`group_id:id`:** XML ID của nhóm người dùng được áp dụng phân quyền này (bỏ trống nếu muốn áp dụng cho toàn bộ người dùng trong hệ thống).
- **`perm_read`, `perm_write`, `perm_create`, `perm_unlink`:** Các quyền Đọc, Sửa, Tạo mới, Xóa (1 là cho phép, 0 là cấm).

---

## 2. Quy tắc truy cập bản ghi (Record Rules)

Record Rules (`ir.rule`) dùng để lọc dữ liệu ở mức độ bản ghi dựa trên điều kiện Domain. Ví dụ: *Bác sĩ chỉ được nhìn thấy bệnh án của bệnh nhân do mình điều trị.*

### Định nghĩa XML Record Rule chuẩn:
```xml
<record id="rule_hms_patient_doctor" model="ir.rule">
    <name>Bác sĩ chỉ xem bệnh nhân của mình</name>
    <model_id ref="model_hms_patient"/>
    <!-- Domain lọc bản ghi: so sánh doctor_id của bệnh nhân với đối tác liên kết của User hiện tại -->
    <domain_force>[('doctor_id.user_id', '=', user.id)]</domain_force>
    <groups eval="[(4, ref('hms_hospital.group_hms_doctor'))]"/>
    <perm_read eval="True"/>
    <perm_write eval="True"/>
    <perm_create eval="True"/>
    <perm_unlink eval="False"/>
</record>
```

> [!IMPORTANT]
> **Quy tắc Ghi đè (Rule Override):** 
> Các Record Rules của các nhóm khác nhau được kết hợp với nhau bằng toán tử **OR** (nếu thuộc các nhóm khác nhau) và toán tử **AND** (nếu thuộc cùng một nhóm). Tuy nhiên, quy tắc toàn cục (Global Rules - không gán nhóm cụ thể) sẽ luôn được áp dụng bằng toán tử **AND** với tất cả quy tắc khác.

---

## 3. Lập trình An toàn trong Python Backend

Khi viết code xử lý logic, đôi khi ta cần bypass phân quyền để thực hiện các thao tác mang tính hệ thống. Hãy sử dụng các phương thức sau một cách cẩn trọng.

### A. Sử dụng `sudo()`
`sudo()` chuyển đổi môi trường hiện tại sang quyền Superuser (admin hệ thống) giúp bypass toàn bộ Access Rights và Record Rules.

```python
# Cách viết KHÔNG AN TOÀN: bypass toàn bộ các bước tiếp theo
def update_patient_status(self):
    self.sudo().write({'state': 'treated'})

# Cách viết AN TOÀN (Tinh gọn phạm vi): Chỉ sudo trên tập dữ liệu cần thiết
def update_patient_status(self):
    patient_sudo = self.sudo()
    patient_sudo.write({'state': 'treated'})
    # self ban đầu vẫn giữ nguyên quyền của người dùng hiện tại
```

### B. Sử dụng `with_context()` và `with_user()`
- **`with_context()`:** Thay đổi ngữ cảnh xử lý (ví dụ: tắt theo dõi hoạt động gửi mail chatter tạm thời để tăng hiệu năng).
- **`with_user()`:** Chuyển đổi ngữ cảnh thực thi sang một User cụ thể.

```python
# Tắt gửi tracking email khi cập nhật trạng thái hàng loạt
self.with_context(mail_notrack=True).write({'state': 'archived'})

# Chạy code dưới danh nghĩa của bác sĩ trưởng khoa
head_doctor_user = self.env.ref('hms_hospital.user_head_doctor')
self.with_user(head_doctor_user).action_approve_surgery()
```

### C. Bypass bảo mật an toàn ở Odoo 19.0 với `any!` / `not any!`
Khi cần thực hiện tìm kiếm trong các model phụ thuộc mà không muốn bị dính lỗi quyền truy cập ở model phụ thuộc đó, hãy dùng toán tử `any!` hoặc `not any!` trong domain như đã hướng dẫn ở [orm-basics.md](orm-basics.md#L141-L151).

---

## 4. Chống IDOR (Insecure Direct Object Reference) khi nhận ID từ bên ngoài

`browse(id)` **không tự kiểm tra quyền** — nếu `id` đến từ user input (URL param, JSON-RPC, controller) mà
không gọi thêm kiểm tra, user có thể đọc/sửa record của người khác chỉ bằng cách đổi số ID trên URL.

```python
# ✗ NGUY HIỂM: browse thẳng theo ID từ request, không kiểm tra quyền/quyền sở hữu
@http.route('/my/invoice/<int:invoice_id>', auth='user')
def view_invoice(self, invoice_id):
    invoice = request.env['account.move'].browse(invoice_id)
    return request.render('...', {'invoice': invoice})  # user A có thể xem hoá đơn của user B

# ✓ AN TOÀN: để ORM tự raise AccessError/MissingError nếu không có quyền/không sở hữu
@http.route('/my/invoice/<int:invoice_id>', auth='user')
def view_invoice(self, invoice_id):
    invoice = request.env['account.move'].browse(invoice_id).exists()
    invoice.check_access_rights('read')
    invoice.check_access_rule('read')   # record rule sẽ raise nếu invoice không thuộc user hiện tại
    return request.render('...', {'invoice': invoice})
```

Với model có `portal.mixin`, ưu tiên dùng pattern `_document_check_access()` sẵn có của portal thay vì tự
viết lại 2 dòng check ở trên.

---

## 5. Checklist bảo mật trước khi ship (rà đủ, không bỏ bước)

- [ ] Mọi model mới có dòng trong `ir.model.access.csv` (thiếu = không ai truy cập được, kể cả bug im lặng).
- [ ] Model chứa dữ liệu nhạy cảm/theo user có `ir.rule` record rule tương ứng.
- [ ] Đa công ty: domain rule dùng `allowed_company_ids` (v17+), không còn `company_ids` (deprecated v17,
      claim đã gỡ ở v18 — verify theo [version-compatibility-matrix.md §0](version-compatibility-matrix.md) trước khi khẳng định).
- [ ] Không có `sudo()` bao trùm cả method — chỉ sudo đúng phần cần, giữ nguyên `self` gốc cho phần còn lại.
- [ ] Controller nhận ID từ user input đều gọi `check_access_rights`/`check_access_rule` hoặc dùng
      `portal.mixin`/`sudo()` có kiểm soát rõ ràng (xem §4).
- [ ] Không nối chuỗi/f-string trực tiếp vào `cr.execute()` — dùng ORM hoặc `SQL()` builder (xem
      [orm-basics.md §7](orm-basics.md)).
- [ ] View không dùng `t-raw`/`t-out` với dữ liệu chưa được đánh dấu `markup()` một cách có chủ đích (XSS).
- [ ] Không hardcode ID số (`browse(7)`) — luôn `env.ref('module.xml_id')`.
- [ ] Field nhạy cảm (lương, thông tin cá nhân) có `groups=` giới hạn đúng nhóm.
- [ ] Đã test thử với ít nhất 3 vai trò khác nhau (admin, user thường, portal/public nếu có liên quan) —
      không chỉ test bằng tài khoản admin rồi coi là xong.

---

## 6. Kiểm tra công ty tự động (`_check_company_auto` + `check_company=True`, v18+)

2 thuộc tính phải đi cùng nhau — thiếu 1 trong 2 thì check không có tác dụng:

```python
class MyModel(models.Model):
    _check_company_auto = True                 # bật cơ chế check ở cấp model
    company_id = fields.Many2one('res.company', required=True, index=True)
    partner_id = fields.Many2one('res.partner', check_company=True)   # opt-in từng field liên quan company
```

Trước v18 phải tự viết constraint thủ công, kém tối ưu hơn (chạy Python từng record thay vì ORM-level check):
```python
@api.constrains('partner_id', 'company_id')
def _check_company(self):
    for record in self:
        if record.partner_id.company_id and record.partner_id.company_id != record.company_id:
            raise ValidationError(_("Công ty của đối tác phải khớp công ty của bản ghi."))
```

## 7. Token chia sẻ công khai có hạn (an toàn hơn `access_token` tĩnh của `portal.mixin`)

`portal.mixin` mặc định sinh token **không hết hạn**. Khi cần link chia sẻ có kiểm soát thời gian sống (báo
giá gửi khách, link tải file tạm...), dùng model token riêng có `expires_at` + cron dọn định kỳ:

```python
class TimedAccessToken(models.Model):
    _name = 'timed.access.token'
    _description = 'Token truy cập công khai có hạn'

    document_id = fields.Many2one('my.document', required=True)
    token = fields.Char(required=True, index=True)
    expires_at = fields.Datetime(required=True)

    @api.model
    def create_token(self, document_id, validity_hours=24):
        token = hashlib.sha256(f"{document_id}-{time.time()}-{self.env.uid}".encode()).hexdigest()
        return self.create({
            'document_id': document_id, 'token': token,
            'expires_at': fields.Datetime.now() + timedelta(hours=validity_hours),
        })

    @api.model
    def validate_token(self, token):
        access = self.search([('token', '=', token), ('expires_at', '>', fields.Datetime.now())], limit=1)
        return access.document_id if access else False

    @api.model
    def _cron_cleanup_expired(self):
        self.search([('expires_at', '<', fields.Datetime.now())]).unlink()
```

Xem thêm biến thể "URL có chữ ký HMAC + hết hạn" (không cần lưu token trong DB) ở
[controllers-and-api.md §5](controllers-and-api.md).

## 8. `sudo()` — thu hẹp phạm vi theo từng thao tác, không theo cả method

```python
# ✓ Tốt: sudo() đúng chỗ cần, phần còn lại giữ nguyên quyền user hiện tại
partner = self.sudo().partner_id
partner.sudo().write({'internal': True})

# ✗ Tránh: sudo() cả method rồi làm mọi thứ dưới quyền admin, mất khả năng audit ai thực sự làm gì
def action_process(self):
    self = self.sudo()
    ... # toàn bộ logic chạy dưới quyền admin, kể cả phần không cần
```

## 9. Kiểm tra XML ID/group tồn tại trước khi tham chiếu (phụ thuộc chéo module tuỳ chọn)

```python
group = self.env.ref('helpdesk.group_helpdesk_user', raise_if_not_found=False)
if group:
    # chỉ áp dụng logic liên quan khi module helpdesk có cài
    ...
```
Dùng khi module tham chiếu tới group/view của 1 module khác **không phải dependency bắt buộc** (tích hợp tuỳ
chọn) — tránh lỗi cài đặt cứng khi module kia không được cài.
