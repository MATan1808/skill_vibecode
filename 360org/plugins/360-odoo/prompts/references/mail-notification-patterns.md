# Odoo Mail, Chatter & Notification Patterns (v14 - v19)

---

## 1. ⚠️ Thay đổi lớn v15: cú pháp Email Template Mako/Jinja2 → QWeb

**Trước Odoo 15:** `mail.template` dùng cú pháp Mako `${...}` cho cả `subject` lẫn `body_html`.

```xml
<!-- v14 trở về trước -->
<field name="subject">Đơn hàng ${object.name} - ${object.state}</field>
<field name="body_html" type="html"><![CDATA[
<p>Kính gửi ${object.partner_id.name},</p>
<p>Đơn hàng ${object.name} hiện đang ở trạng thái ${object.state}.</p>
]]></field>
```

**Từ Odoo 15+:** `body_html` chuyển sang QWeb (`<t t-out="...">`), nhưng — điểm dễ nhầm nhất — các field
"header" như `subject`/`email_to`/`email_from` **vẫn dùng cú pháp inline kiểu Jinja `{{ ... }}`**, khác với
`<t t-out>` bên trong `body_html`. Cả 2 cú pháp cùng tồn tại trong 1 record `mail.template`:

```xml
<!-- v15+ -->
<field name="subject">{{ object.name }} - Đã xác nhận</field>
<field name="email_to">{{ object.partner_id.email }}</field>
<field name="body_html" type="html"><![CDATA[
<p>Kính gửi <t t-out="object.partner_id.name"/>,</p>
<p>Đơn hàng <t t-out="object.name"/> hiện đang ở trạng thái <t t-out="object.state"/>.</p>
]]></field>
```

Quy tắc chuyển đổi bên trong `body_html`:
- `${expr}` → `<t t-out="expr"/>`
- `% if condition:` ... `% endif` → `<t t-if="condition">...</t>`
- `% for x in items:` ... `% endfor` → `<t t-foreach="items" t-as="x">...</t>`
- `t-out` **tự escape mặc định** — hành vi `t-raw` cũ (không escape) giờ đạt được bằng cách truyền giá trị đã
  bọc `markup()` từ Python, không phải bằng directive khác.

---

## 2. Điều hướng thông báo theo loại thay đổi (`_track_subtype`)

Mặc định `tracking=True` gộp mọi thay đổi field vào 1 luồng chatter chung. Muốn tách nhóm thông báo (vd.
"đổi trạng thái" khác với "đổi người phụ trách" để mỗi nhóm follower nhận đúng loại họ quan tâm), override
`_track_subtype()`:

```python
def _track_subtype(self, init_values):
    self.ensure_one()
    if 'state' in init_values:
        return self.env.ref('my_module.mt_state_changed')
    if 'user_id' in init_values:
        return self.env.ref('my_module.mt_assigned')
    return super()._track_subtype(init_values)
```

## 3. Thêm người nhận thông báo theo logic nghiệp vụ (`_notify_get_recipients`)

Ví dụ: chỉ báo cho quản lý khi giá trị đơn vượt ngưỡng, không phải mọi đơn:

```python
def _notify_get_recipients(self, message, msg_vals, **kwargs):
    recipients = super()._notify_get_recipients(message, msg_vals, **kwargs)
    if self.amount_total > 100000:
        manager = self.env.ref('my_module.group_sales_manager').users
        recipients += [{'partner_id': u.partner_id.id, 'is_active': True} for u in manager]
    return recipients
```

## 4. Push thông báo real-time qua `bus.bus` (khác `display_notification`)

`display_notification` (client action) chỉ hiện được trong chính request/response đang xử lý — muốn **server
chủ động đẩy** thông báo tới 1 user cụ thể đang mở trình duyệt (không phải do họ vừa bấm gì), dùng `bus.bus`:

```python
self.env['bus.bus']._sendone(
    self.user_id.partner_id,
    'simple_notification',
    {'title': _('Giao việc mới'), 'message': _('Bạn được giao: %s', self.name), 'type': 'info'},
)
```

Đây là cơ chế nền cho chat real-time, thông báo hệ thống, và cập nhật UI live của Odoo — dùng khi cần thông
báo bất đồng bộ (vd. từ 1 cron, hoặc từ hành động của user khác).

---

## 5. Chatter & tracking — lưu ý hiệu năng

Không bật `tracking=True` tràn lan trên field hay đổi giá trị liên tục (vd. field đếm/counter cập nhật mỗi
giây) — mỗi lần đổi tạo 1 message chatter, phình bảng `mail.message` rất nhanh. Chỉ tracking field mang ý
nghĩa nghiệp vụ cần audit (trạng thái, người phụ trách, số tiền quan trọng).
