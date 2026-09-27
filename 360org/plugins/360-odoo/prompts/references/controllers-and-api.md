# Odoo Controllers, REST & JSON-RPC APIs (v14 - v19)

Tài liệu hướng dẫn xây dựng cổng HTTP routes, tích hợp API REST/JSON-RPC và Webhooks trong Odoo từ phiên bản v14 đến v19.

---

## 1. Xây dựng HTTP Controllers (`@http.route`)

Odoo cung cấp cơ chế routing mạnh mẽ thông qua class `Controller`.

### Cú pháp Controller cơ bản (Hỗ trợ v14 - v19):
```python
from odoo import http
from odoo.http import request

class HMSPatientController(http.Controller):

    # Route trả về HTML (HTTP type)
    @http.route('/hospital/patients', type='http', auth='public', website=True)
    def list_patients(self, **kwargs):
        # Lấy môi trường ORM thông qua request.env
        patients = request.env['hms.patient'].sudo().search([])
        return request.render('hms_hospital.portal_patients_list', {
            'patients': patients
        })

    # API Route trả về JSON (JSON-RPC type)
    @http.route('/api/v1/patient/detail', type='json', auth='user', methods=['POST'], csrf=False)
    def get_patient_detail(self, patient_id, **kwargs):
        patient = request.env['hms.patient'].browse(int(patient_id))
        if not patient.exists():
            return {'status': 'error', 'message': 'Không tìm thấy bệnh nhân'}
        return {
            'status': 'success',
            'data': {
                'id': patient.id,
                'name': patient.name,
                'age': patient.age,
                'gender': patient.gender
            }
        }
```

---

## 2. Xác thực (Authentication) & Bảo mật APIs

### Các mức độ xác thực (`auth` parameter):
1. **`auth='none'`**: Bypass hoàn toàn cơ chế xác thực và không khởi tạo database registry trong môi trường request (trừ khi truyền database header). Thường chỉ dùng cho trang chọn database hoặc server health check.
2. **`auth='public'`**: Nếu user chưa đăng nhập, request sẽ chạy dưới danh nghĩa User `public`. Thường dùng cho website, landing page công cộng.
3. **`auth='user'`**: Yêu cầu người dùng đăng nhập hệ thống. Môi trường request sẽ chạy dưới danh nghĩa User đăng nhập đó.

### CSRF Protection (Cross-Site Request Forgery)
Mặc định, Odoo bật bảo mật CSRF cho tất cả route `type='http'`.
- Khi xây dựng API cho các hệ thống bên thứ ba gọi vào (ví dụ: Webhook từ VNPay, Stripe), ta phải tắt CSRF bằng cách thiết lập: `csrf=False`.

---

## 3. Tích hợp REST API (JSON Response thủ công)

Vì Odoo mặc định sử dụng JSON-RPC, nếu muốn xây dựng một cổng REST API chuẩn trả về mã JSON thô cùng với HTTP Status Code (200, 400, 500, v.v.), ta phải viết Controller dạng `type='http'` và tự đóng gói Response.

### Mẫu REST API Controller cao cấp:
```python
import json
from odoo import http
from odoo.http import request

class HMSRestController(http.Controller):

    @http.route('/api/patients', type='http', auth='none', methods=['GET'], csrf=False, cors='*')
    def get_patients_rest(self, **kwargs):
        # Thiết lập header phản hồi JSON
        headers = [('Content-Type', 'application/json')]
        
        try:
            # Lấy quyền quản trị hệ thống ngầm để đọc dữ liệu
            patients = request.env['hms.patient'].sudo().search([])
            data = []
            for p in patients:
                data.append({
                    'id': p.id,
                    'name': p.name,
                    'age': p.age
                })
            
            # Trả về mã 200 OK
            return request.make_response(
                json.dumps({'success': True, 'data': data}),
                headers=headers,
                status=200
            )
            
        except Exception as e:
            # Trả về mã 500 Internal Server Error
            return request.make_response(
                json.dumps({'success': False, 'error': str(e)}),
                headers=headers,
                status=500
            )
```

---

## 4. Xác thực chữ ký Webhook (HMAC) — bắt buộc khi nhận request từ hệ thống ngoài

Không tự tính lại request body từ `request.jsonrequest` (đã re-serialize, có thể lệch byte-for-byte so với
body gốc bên gửi ký) — **luôn verify trên raw bytes** của request:

```python
import hmac
import hashlib

class WebhookController(http.Controller):

    def _verify_signature(self, signature, secret):
        if not signature or not secret:
            return False
        raw_body = request.httprequest.get_data()   # bytes gốc, KHÔNG dùng request.jsonrequest
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)   # so sánh an toàn chống timing attack

    @http.route('/webhook/payment', type='http', auth='public', methods=['POST'], csrf=False)
    def payment_webhook(self, **kwargs):
        signature = request.httprequest.headers.get('X-Signature')
        secret = self.env['ir.config_parameter'].sudo().get_param('my_module.webhook_secret')
        if not self._verify_signature(signature, secret):
            return request.make_response(json.dumps({'error': 'invalid signature'}), status=401)
        # xử lý payload đã xác thực...
```

Dùng `hmac.compare_digest()` chứ không dùng `==` để so sánh chữ ký — `==` so sánh string dừng sớm khi gặp
ký tự sai đầu tiên, tạo timing side-channel giúp kẻ tấn công dò từng ký tự chữ ký đúng.

---

## 5. URL công khai có chữ ký + hết hạn (an toàn hơn `access_token` tĩnh của `portal.mixin`)

`portal.mixin` mặc định sinh `access_token` không có hạn — dùng mãi mãi nếu bị lộ. Khi cần link chia sẻ công
khai có thời hạn (xem báo cáo, tải file...), tự ký + hết hạn:

```python
import time
from urllib.parse import urlencode

def generate_signed_url(self, base_path, params, validity_seconds=3600):
    expires = int(time.time()) + validity_seconds
    params = {**params, 'expires': expires}
    message = f"{base_path}?{urlencode(sorted(params.items()))}"
    signature = hmac.new(self._get_signing_key().encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{base_path}?{urlencode({**params, 'signature': signature})}"

def verify_signed_url(self, base_path, params):
    params = dict(params)
    signature = params.pop('signature', None)
    if not signature or int(params.get('expires', 0)) < time.time():
        return False
    message = f"{base_path}?{urlencode(sorted(params.items()))}"
    expected = hmac.new(self._get_signing_key().encode(), message.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```
