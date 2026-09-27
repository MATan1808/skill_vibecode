# Odoo Reports (QWeb PDF) & Model Phân tích BI (v14 - v19)

---

## 1. Cấu trúc báo cáo QWeb PDF chuẩn

```xml
<record id="action_report_patient_card" model="ir.actions.report">
    <field name="name">Thẻ bệnh nhân</field>
    <field name="model">hms.patient</field>
    <field name="report_type">qweb-pdf</field>
    <field name="report_name">hms_hospital.report_patient_card</field>
    <field name="report_file">hms_hospital.report_patient_card</field>
    <field name="binding_model_id" ref="model_hms_patient"/>
    <field name="binding_type">report</field>
</record>

<template id="report_patient_card">
    <t t-call="web.html_container">
        <t t-foreach="docs" t-as="doc">
            <t t-call="web.external_layout">    <!-- có letterhead, logo, địa chỉ công ty -->
                <div class="page">
                    <h2><t t-out="doc.name"/></h2>
                    <p>Tuổi: <t t-out="doc.age"/></p>
                </div>
            </t>
        </t>
    </t>
</template>
```

**2 layout gốc khác nhau, chọn đúng mục đích:**
- `web.external_layout` — có header/footer công ty (logo, địa chỉ, mã số thuế) — dùng cho tài liệu chính thức
  gửi khách hàng (hoá đơn, hợp đồng).
- `web.basic_layout` — không header/footer — dùng cho phiếu nội bộ, tem nhãn, báo cáo không cần letterhead.

## 2. Đưa logic tính toán ra khỏi QWeb — dùng report data provider

Không nhồi tính toán phức tạp (tổng hợp, group, format) trực tiếp trong biểu thức QWeb — viết 1
`AbstractModel` tên đúng convention `report.<module>.<template_id>`, override `_get_report_values()`:

```python
class ReportPatientCard(models.AbstractModel):
    _name = 'report.hms_hospital.report_patient_card'
    _description = 'Báo cáo Thẻ bệnh nhân'

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = self.env['hms.patient'].browse(docids)
        return {
            'doc_ids': docids,
            'doc_model': 'hms.patient',
            'docs': docs,
            'total_prescriptions': sum(docs.mapped('prescription_count')),  # tính sẵn, template chỉ hiển thị
        }
```

## 3. Sinh mã vạch/QR ngay trong report

```xml
<img t-att-src="'/report/barcode/?barcode_type=Code128&amp;value=%s&amp;width=200&amp;height=50' % doc.code"/>
<img t-att-src="'/report/barcode/?barcode_type=QR&amp;value=%s&amp;width=100&amp;height=100' % doc.reference"/>
```

---

## 4. Model phân tích/BI không có bảng riêng (`_auto = False`) — nền cho Dashboard/Pivot/Graph

Đây là pattern chuẩn của các model `*.report`/`*.analysis` trong core Odoo — thay vì computed field tính
trong Python (chậm với dữ liệu lớn), định nghĩa 1 SQL VIEW ở DB, ORM chỉ đọc:

```python
class SaleAnalysis(models.Model):
    _name = 'hms.appointment.analysis'
    _description = 'Phân tích lịch hẹn'
    _auto = False              # KHÔNG tạo bảng — đây là DB view
    _order = 'date desc'

    date = fields.Date(readonly=True)
    doctor_id = fields.Many2one('hms.doctor', readonly=True)
    appointment_count = fields.Integer(readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT row_number() OVER () AS id,
                       a.date_start::date AS date,
                       a.doctor_id,
                       COUNT(*) AS appointment_count
                FROM hms_appointment a
                GROUP BY a.date_start::date, a.doctor_id
            )
        """ % self._table)
```

View XML cho model dạng này (`pivot`/`graph`, `cohort` là Enterprise):
```xml
<record id="view_appointment_analysis_pivot" model="ir.ui.view">
    <field name="name">hms.appointment.analysis.pivot</field>
    <field name="model">hms.appointment.analysis</field>
    <field name="arch" type="xml">
        <pivot string="Phân tích lịch hẹn">
            <field name="doctor_id" type="row"/>
            <field name="date" type="col" interval="month"/>
            <field name="appointment_count" type="measure"/>
        </pivot>
    </field>
</record>
```

Model `_auto = False` luôn `readonly` từ góc nhìn ORM (không `create`/`write`/`unlink` trực tiếp được) — chỉ
dùng cho mục đích đọc/báo cáo, không phải model nghiệp vụ.
