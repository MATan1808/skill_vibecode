# Odoo Wizard & TransientModel Patterns (v14 - v19)

Wizard dùng cho thao tác nhiều bước, xác nhận, hoặc form tạm không cần lưu vĩnh viễn. Model kế thừa
`models.TransientModel` thay vì `models.Model` — record tự động dọn sau 1 khoảng thời gian, không cần
`unlink()` thủ công.

---

## 1. Wizard đơn giản (xác nhận 1 bước)

```python
class ArchivePatientWizard(models.TransientModel):
    _name = 'hms.archive.wizard'
    _description = 'Xác nhận lưu trữ bệnh nhân'

    patient_ids = fields.Many2many('hms.patient', string='Bệnh nhân')
    reason = fields.Text(string='Lý do', required=True)

    def action_confirm(self):
        self.patient_ids.write({'active': False})
        for patient in self.patient_ids:
            patient.message_post(body=_("Lưu trữ: %s", self.reason))
        return {'type': 'ir.actions.act_window_close'}
```

Mở wizard từ 1 action button trên model gốc, truyền `active_ids` qua context:
```python
def action_open_archive_wizard(self):
    return {
        'type': 'ir.actions.act_window',
        'res_model': 'hms.archive.wizard',
        'view_mode': 'form',
        'target': 'new',                       # bắt buộc 'new' để hiện dạng dialog
        'context': {'default_patient_ids': self.ids},
    }
```

---

## 2. Wizard nhiều bước (Multi-step state machine)

```python
class ImportWizard(models.TransientModel):
    _name = 'hms.import.wizard'
    _description = 'Import bệnh nhân nhiều bước'

    step = fields.Selection([
        ('select', 'Chọn file'), ('preview', 'Xem trước'), ('confirm', 'Xác nhận'),
    ], default='select')
    file_data = fields.Binary(string='File')

    def action_next(self):
        self.ensure_one()
        if self.step == 'select' and not self.file_data:
            raise UserError(_("Vui lòng chọn file."))
        steps = ['select', 'preview', 'confirm']
        self.step = steps[steps.index(self.step) + 1]
        return self._reopen()

    def action_previous(self):
        self.ensure_one()
        steps = ['select', 'preview', 'confirm']
        self.step = steps[steps.index(self.step) - 1]
        return self._reopen()

    def _reopen(self):
        """Trả về cùng 1 wizard record để re-render ở bước mới — không tạo record mới."""
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
```

View form dùng `invisible="step != 'select'"` (v17+) trên từng nhóm field để hiện đúng bước hiện tại — không
tạo nhiều view riêng cho từng bước.

---

## 3. Gắn Wizard vào menu "⚙ Actions" của 1 model (binding)

Cơ chế khiến wizard xuất hiện trong dropdown Actions của list/form view — không tự nhiên có, phải khai báo
tường minh qua `binding_model_id` + `binding_view_types`:

```xml
<record id="action_archive_patient_wizard" model="ir.actions.act_window">
    <field name="name">Lưu trữ bệnh nhân</field>
    <field name="res_model">hms.archive.wizard</field>
    <field name="view_mode">form</field>
    <field name="target">new</field>
    <field name="binding_model_id" ref="model_hms_patient"/>
    <field name="binding_view_types">list,form</field>
</record>
```

---

## 4. Các dạng giá trị trả về của `action_confirm()` (bảng tra nhanh)

| Muốn làm gì | Return |
|---|---|
| Đóng dialog, không làm gì thêm | `{'type': 'ir.actions.act_window_close'}` |
| Đóng dialog + báo thông báo | `{'type': 'ir.actions.client', 'tag': 'display_notification', 'params': {'message': _("Xong!"), 'type': 'success'}}` |
| Mở lại chính wizard (đổi bước) | Xem `_reopen()` ở §2 |
| Mở form 1 record vừa tạo | `{'type': 'ir.actions.act_window', 'res_model': ..., 'res_id': new_id, 'view_mode': 'form'}` |
| Mở list đã lọc | `{'type': 'ir.actions.act_window', 'res_model': ..., 'view_mode': 'list,form', 'domain': [...]}` |
| Tải file/report | `self.env.ref('module.report_action').report_action(records)` |
| Reload toàn trang hiện tại | `{'type': 'ir.actions.client', 'tag': 'reload'}` |

---

## 5. Wizard import dữ liệu — thu lỗi theo dòng, không fail cả batch

```python
class ImportWizard(models.TransientModel):
    _name = 'hms.import.wizard'

    skip_errors = fields.Boolean(string='Bỏ qua dòng lỗi', default=True)

    def action_import(self):
        rows = self._parse_file()
        errors = []
        created = self.env['hms.patient']
        for i, row in enumerate(rows, start=1):
            try:
                with self.env.cr.savepoint():   # rollback riêng dòng lỗi, không huỷ cả transaction
                    created |= self.env['hms.patient'].create(self._row_to_vals(row))
            except Exception as e:
                errors.append(f"Dòng {i}: {e}")
                if not self.skip_errors:
                    raise UserError(_("Import dừng tại dòng %s: %s") % (i, e))
        if errors:
            self.message_post(body=_("Import xong với %s lỗi:\n%s", len(errors), "\n".join(errors)))
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hms.patient',
            'view_mode': 'list,form',
            'domain': [('id', 'in', created.ids)],
        }
```

`self.env.cr.savepoint()` là cách đúng để "bỏ qua dòng lỗi, giữ nguyên dòng đã thành công" trong cùng 1
transaction — không dùng `cr.commit()` từng dòng (phá vỡ tính atomic, khó rollback toàn bộ nếu người dùng
huỷ giữa chừng).
