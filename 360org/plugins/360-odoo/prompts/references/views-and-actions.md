# Odoo XML Views, Actions & Menus (v14 - v19)

Tài liệu hướng dẫn thiết kế giao diện XML, Actions và Menus trong Odoo, hỗ trợ đa phiên bản từ v14 đến v19.0.

---

## 1. Sự khác biệt cốt lõi về XML Views (v14-16 vs v17-19)

Từ Odoo phiên bản 17.0 trở đi, Odoo đã **loại bỏ hoàn toàn thuộc tính `attrs`** trong các thẻ XML và thay thế bằng việc khai báo trực tiếp điều kiện. Điều này giúp XML ngắn gọn và dễ đọc hơn rất nhiều.

### A. So sánh trực quan cú pháp thuộc tính ẩn hiện/chỉ đọc/bắt buộc:

#### ⚠️ Phiên bản Odoo 14.0 - 16.0 (Dùng `attrs` và domain):
```xml
<!-- Ẩn trường khi trạng thái là 'draft' -->
<field name="doctor_id" attrs="{'invisible': [('state', '=', 'draft')]}"/>

<!-- Chỉ đọc khi trường 'is_locked' bằng True -->
<field name="notes" attrs="{'readonly': [('is_locked', '=', True)]}"/>

<!-- Bắt buộc nhập khi giới tính là 'female' -->
<field name="pregnancy_details" attrs="{'required': [('gender', '=', 'female')]}"/>
```

#### 🚀 Phiên bản Odoo 17.0 - 19.0 (Khai báo trực tiếp dạng biểu thức Javascript):
```xml
<!-- Ẩn trường khi trạng thái là 'draft' -->
<field name="doctor_id" invisible="state == 'draft'"/>

<!-- Chỉ đọc khi trường 'is_locked' bằng True -->
<field name="notes" readonly="is_locked"/>

<!-- Bắt buộc nhập khi giới tính là 'female' -->
<field name="pregnancy_details" required="gender == 'female'"/>
```

*Lưu ý cho AI: Khi sinh code XML, bắt buộc phải kiểm tra phiên bản Odoo để chọn đúng cấu trúc trên. Sử dụng sai cú pháp sẽ làm crash hệ thống khi cài đặt module.*

---

## 2. Khai báo Window Actions & Server Actions

### Window Action (Mở view giao diện)
```xml
<record id="action_hms_patient" model="ir.actions.act_window">
    <name>Patients</name>
    <type>ir.actions.act_window</type>
    <res_model>hms.patient</res_model>
    <view_mode>tree,form,kanban</view_mode>
    <context>{'search_default_filter_active': 1}</context>
    <help type="html">
        <p class="o_view_nocontent_smiling_face">
            Tạo bệnh nhân mới đầu tiên của bạn!
        </p>
    </help>
</record>
```

### Server Action (Chạy code Python từ UI)
```xml
<record id="action_server_archive_patient" model="ir.actions.server">
    <name>Lưu trữ bệnh nhân nhanh</name>
    <model_id ref="model_hms_patient"/>
    <binding_model_id ref="model_hms_patient"/>
    <binding_view_types>list,form</binding_view_types>
    <state>code</state>
    <code/>
</record>
```
*(Lưu ý: Đoạn code Python thực thi sẽ được viết trong thẻ `<code/>` hoặc liên kết trực tiếp tới một phương thức trong model).*

---

## 3. Cấu trúc Menus & Định tuyến điều hướng

Để menu hiển thị đẹp mắt và khoa học, hãy tuân thủ cấu trúc phân cấp 3 lớp:
1. **Root Menu:** Menu cha ngoài cùng (Hiển thị trên App Switcher).
2. **Category Menu:** Menu phân nhóm (Hiển thị ở cột bên trái hoặc thanh ngang phía trên).
3. **Action Menu:** Menu kích hoạt hành động (Mở ra View cụ thể).

```xml
<!-- 1. Root Menu -->
<menuitem id="menu_hms_root"
          name="Hospital Management"
          web_icon="hms_hospital,static/description/icon.png"
          sequence="10"/>

<!-- 2. Category Menu (Con của Root) -->
<menuitem id="menu_hms_operations"
          name="Operations"
          parent="menu_hms_root"
          sequence="10"/>

<!-- 3. Action Menu (Con của Category, liên kết với Action) -->
<menuitem id="menu_hms_patient"
          name="Patients"
          parent="menu_hms_operations"
          action="action_hms_patient"
          sequence="10"/>
```

---

## 4. QWeb Templating Engine (v14 vs v15+)

QWeb được dùng để viết các báo cáo PDF và render HTML dynamic.

### Chuyển đổi cú pháp xuất dữ liệu (`t-raw` vs `t-out`):
- **Odoo 14:** Sử dụng `t-raw` để render mã HTML không an toàn.
- **Odoo 15 - 19:** Khai tử `t-raw` vì lý do bảo mật XSS. Thay thế hoàn toàn bằng `t-out` (hoặc `t-esc` cho dữ liệu text thuần túy).

#### Ví dụ QWeb v15+:
```xml
<template id="patient_card_template">
    <div class="card p-3 border rounded shadow-sm">
        <h4 class="text-primary"><span t-esc="o.name"/></h4>
        <p>Tuổi: <span t-esc="o.age"/></p>
        
        <!-- Render nội dung HTML mô tả bệnh án (an toàn) -->
        <div class="mt-2 text-muted">
            <t t-out="o.biography"/>
        </div>
    </div>
</template>
```

---

## 5. BẮT BUỘC: Đọc view thật trước khi viết XPath — không đoán theo "cấu trúc Odoo thường thấy"

Đây là nguồn lỗi phổ biến nhất khi kế thừa view: đoán cấu trúc DOM/XML theo trí nhớ hoặc theo pattern quen
thuộc từ view khác, trong khi view thật có thể khác hẳn. Ví dụ thực tế: view kanban `res.users.apikeys` ở
Odoo 19 dùng `<t t-name="card"><div><div>...` — **không phải** `<div class="flex-row">` như nhiều view kanban
khác. XPath `//div[hasclass('flex-row')]` sẽ **âm thầm không match gì cả** (Odoo không báo lỗi, chỉ đơn giản
không chèn được), còn `//t[@t-name='card']/div/div` mới đúng.

**Luôn đọc arch thật trước khi viết xpath:**
```python
view = self.env.ref('base.res_users_apikeys_view_kanban', raise_if_not_found=False)
print(view.arch)   # xem đúng cấu trúc trước khi viết xpath, không đoán
```

**Không phải model nào cũng có đủ mọi loại view** — 1 số model core/Enterprise chỉ có kanban, không có
form/tree. Kế thừa `inherit_id` vào 1 view form không tồn tại sẽ lỗi cài đặt thẳng. Kiểm tra trước:
```python
views = self.env['ir.ui.view'].search([('model', '=', 'model.name'), ('type', '!=', False)])
{v.type for v in views}   # vd chỉ {'kanban'} — không có form để kế thừa
```

### Không bao giờ dùng `string=` làm selector trong XPath

```xml
<!-- SAI: string bị dịch theo ngôn ngữ, có thể đổi tên giữa các version/module khác -->
<xpath expr="//page[@string='Other Information']" position="inside">
<xpath expr="//button[@string='Confirm']" position="before">

<!-- ĐÚNG: name= là định danh kỹ thuật ổn định -->
<xpath expr="//page[@name='other_info']" position="inside">
<xpath expr="//button[@name='action_confirm']" position="before">
```

---

## 6. Ẩn field/menu tuỳ theo module Enterprise có cài hay không (graceful degradation)

```xml
<field name="helpdesk_ticket_id" groups="helpdesk.group_helpdesk_user"/>
```
Nếu module `helpdesk` chưa cài, group này không tồn tại → field tự động ẩn thay vì báo lỗi. Cách kiểm tra
tương đương trong Python khi cần rẽ nhánh logic theo edition:
```python
def _has_enterprise_feature(self):
    return 'helpdesk' in self.env.registry._init_modules
```

---

## 7. Manifest asset directive nâng cao (không chỉ liệt kê glob path, v16+)

```python
'assets': {
    'web.assets_backend': [
        ('prepend', 'my_module/static/src/js/early_load.js'),
        ('after', 'web/static/src/core/main.js', 'my_module/static/src/js/after_main.js'),
        ('before', 'web/static/src/core/main.js', 'my_module/static/src/js/before_main.js'),
        ('replace', 'other_module/static/src/js/old.js', 'my_module/static/src/js/new.js'),
        ('remove', 'other_module/static/src/js/unwanted.js'),
    ],
},
```
Dùng khi cần kiểm soát **thứ tự load** chính xác (thư viện phải load trước module dùng nó) hoặc **thay thế/gỡ**
1 asset của module khác — không chỉ append vào cuối danh sách như cách viết glob thông thường.

---

## 8. Model phân tích/BI không có bảng riêng (`_auto = False`)

Cho dashboard/pivot/graph hiệu năng cao — xem chi tiết đầy đủ ở
[reporting-and-print-patterns.md §4](reporting-and-print-patterns.md).
