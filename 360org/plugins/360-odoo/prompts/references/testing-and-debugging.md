# Odoo Testing, Debugging & Gỡ Lỗi Nhanh (v14 - v19)

Tài liệu hướng dẫn viết test cases (Unittest, Tour, Playwright) và các phương pháp gỡ lỗi hệ thống trong Odoo.

---

## 0. TDD — Iron Law (hút từ superpowers)

**Luật sắt:** `KHÔNG CÓ CODE PRODUCTION KHI CHƯA CÓ TEST FAIL TRƯỚC`. Nếu chưa thấy test **fail**, ta không biết nó có test đúng thứ cần test không.

Chu trình **RED → GREEN → REFACTOR** cho mỗi tính năng/bugfix Odoo:

1. **RED** — viết `TransactionCase` mô tả hành vi mong muốn (hoặc tái hiện bug), chạy → **phải fail** đúng lý do. Chưa fail đúng lý do thì test sai.
2. **GREEN** — viết **mã tối thiểu** để test pass (đúng ponytail: đừng viết thừa).
3. **REFACTOR** — dọn code khi test còn xanh; chạy lại test.

Áp dụng cho: tính năng mới, bugfix (test tái hiện lỗi trước khi sửa — xem [debugging §0 pha 4](debugging-and-bugfixing.md#systematic-debugging)), refactor, migrate (test smoke sau mỗi hop).

**Ngoại lệ (hỏi PO):** prototype vứt đi, code sinh tự động, file cấu hình. Nghĩ "lần này bỏ TDD thôi" = đang hợp lý hoá, dừng lại.

> Với Odoo, "watch it fail" = chạy `odoo-bin -d <db> -i <module> --test-enable --stop-after-init` (hoặc `--test-tags`) và thấy test đỏ trước khi code.
> Lưu ý nhịp: vòng test Odoo chậm (restart + install), nên áp **nguyên tắc** RED→GREEN theo từng lát cắt, không áp nhịp "chạy test sau mỗi dòng code".

### 0.1 Seam — test Ở ĐÂU (hút từ mattpocock/skills `tdd`)

**Seam** = ranh giới public nơi quan sát được hành vi mà không thò tay vào ruột: method public của model, controller endpoint, luồng UI qua tour. Test sống ở seam, **không bao giờ** test internals (method `_private`, biến trung gian).

**Chốt seam TRƯỚC khi viết test.** Không thể test hết mọi thứ — trước khi viết test đầu tiên, Tester/Coder liệt kê các seam định test và xác nhận với Architect/PO: *"Public interface là gì, test ở seam nào?"* Nhờ vậy công sức test dồn vào critical path + logic phức tạp, không rải đều vào mọi edge case vụn. Không viết test ở seam chưa được chốt.

**Lát cắt dọc (vertical slice / tracer bullet):** 1 test → 1 implementation tối thiểu → lặp. **CẤM** viết cả loạt test trước rồi mới code (horizontal slicing) — loạt test đó verify hành vi *tưởng tượng*, khoá cứng cấu trúc test trước khi hiểu implementation.

### 0.2 Chống-mẫu test (nhận diện & loại ngay khi review)

- **Dính implementation:** mock collaborator nội bộ, test method private, hoặc verify qua kênh phụ (query thẳng DB thay vì gọi interface). Dấu hiệu: refactor xong behavior không đổi mà test vỡ.
- **Tautological (tự chứng minh):** assertion tính lại expected y hệt cách code tính — `self.assertEqual(rec.total, rec.qty * rec.price)` pass by construction, không bao giờ cãi được code. Expected phải đến từ **nguồn độc lập**: literal đã biết đúng, ví dụ tính tay, con số trong SPEC.
- **Test tên mơ hồ:** tên test phải đọc như đặc tả — `test_khong_cho_chot_so_khi_con_phieu_draft` nói rõ năng lực gì tồn tại; `test_write_01` thì không. Tên test dùng đúng term trong `CONTEXT.md`.

---

## 1. Viết Python Unittest (Backend Testing)

Mọi module chất lượng cao đều phải có thư mục `tests/` chứa các tệp python kiểm thử. Các file test phải bắt đầu bằng tiền tố `test_` và được import trong `tests/__init__.py`.

### Sử dụng `TransactionCase` (Kiểm thử nghiệp vụ thông thường)
Mỗi phương thức test chạy trong một transaction (giao dịch) cơ sở dữ liệu riêng biệt và tự động rollback khi hoàn thành, không làm ảnh hưởng đến dữ liệu thật.

```python
# tests/test_patient.py
from odoo.tests.common import TransactionCase
from odoo.exceptions import ValidationError

class TestHospitalPatient(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super(TestHospitalPatient, cls).setUpClass()
        # Tạo dữ liệu mẫu dùng chung cho các test cases
        cls.doctor = cls.env['hms.doctor'].create({
            'name': 'Bác sĩ A',
            'specialty': 'Nội khoa'
        })
        cls.patient = cls.env['hms.patient'].create({
            'name': 'Nguyễn Văn B',
            'age': 30,
            'doctor_id': cls.doctor.id
        })

    def test_01_patient_creation(self):
        """Kiểm tra thông tin bệnh nhân khởi tạo thành công"""
        self.assertEqual(self.patient.name, 'Nguyễn Văn B')
        self.assertEqual(self.patient.age, 30)

    def test_02_patient_age_constraint(self):
        """Kiểm tra ràng buộc Python Constraint tuổi không hợp lệ"""
        with self.assertRaises(ValidationError):
            self.env['hms.patient'].create({
                'name': 'Bệnh nhân lỗi',
                'age': -5 # Tuổi âm -> Phải ném ra lỗi ValidationError
            })
```

---

## 2. Viết Odoo Web Tours (Frontend & JS Testing)

Odoo sử dụng hệ thống "Tour" để giả lập hành vi người dùng click chuột và điền thông tin trên giao diện.

### Định nghĩa Tour Javascript (Odoo 16+):
```javascript
// static/src/js/tours/patient_tour.js
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("hms_patient_tour", {
    url: "/web",
    steps: () => [
        {
            trigger: '.o_app[data-menu-xmlid="hms_hospital.menu_hms_root"]',
            content: 'Nhấn vào ứng dụng Hospital Management',
            run: 'click',
        },
        {
            trigger: '.o_list_button_add',
            content: 'Nhấn nút tạo bệnh nhân mới',
            run: 'click',
        },
        {
            trigger: '.o_field_widget[name="name"] input',
            content: 'Điền tên bệnh nhân',
            run: 'text Trần Văn C',
        },
        {
            trigger: '.o_form_button_save',
            content: 'Nhấn Lưu bệnh án',
            run: 'click',
        }
    ]
});
```

---

## 3. Tích hợp Playwright độc lập cho UI Testing

Đối với các ứng dụng OWL phức tạp hoặc khi muốn thực hiện End-to-End (E2E) testing độc lập không thông qua runner của Odoo, viết kịch bản Playwright là giải pháp cao cấp nhất.

### Kịch bản tự động hóa Playwright mẫu (Python):
```python
# scripts/test_ui_playwright.py
from playwright.sync_api import sync_playwright

def run_e2e_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 1. Truy cập trang đăng nhập Odoo
        page.goto("http://localhost:8069/web/login")
        
        # 2. Điền tài liệu đăng nhập
        page.fill("input#login", "admin")
        page.fill("input#password", "admin")
        page.click("button[type='submit']")
        page.wait_for_load_state("networkidle")
        
        # 3. Chuyển hướng đến module HMS
        page.goto("http://localhost:8069/web#action=hms_hospital.action_hms_patient")
        page.wait_for_load_state("networkidle")
        
        # 4. Kiểm tra sự tồn tại của nút "Create" hoặc "New"
        create_btn = page.locator(".o_list_button_add")
        assert create_btn.is_visible(), "Không tìm thấy nút tạo bản ghi mới!"
        
        # 5. Chụp ảnh màn hình làm bằng chứng test
        page.screenshot(path="/tmp/odoo_hms_dashboard.png")
        print("Playwright E2E Test: Thành công!")
        browser.close()

if __name__ == "__main__":
    run_e2e_test()
```

---

## 3b. Test nâng cao hay bị bỏ sót

### Test `@api.onchange` trực tiếp bằng `.new()` — không cần tour/browser

```python
def test_onchange_product(self):
    line = self.env['sale.order.line'].new({'order_id': self.order.id})
    line.product_id = self.product
    line._onchange_product_id()   # gọi thẳng hàm onchange
    self.assertEqual(line.name, self.product.name)
    self.assertEqual(line.price_unit, self.product.list_price)
```

`.new()` tạo record **trong bộ nhớ, chưa lưu DB**, `self.id` lúc này là object `NewId` chứ **không phải số
nguyên** — nếu log/debug thấy `id` trông lạ (không phải int) trong context onchange, đây là lý do, không
phải bug.

### Đo số lượng query — chống N+1 tái phát (xem thêm [performance-optimization.md §9](performance-optimization.md))
```python
from odoo.tests.common import QueryCounter
with QueryCounter(self.env.cr) as qc:
    records.some_method()
self.assertLessEqual(qc.count, 5)
```

### Test cách ly đa công ty (multi-company) — không chỉ tin vào code review
```python
def test_multi_company_isolation(self):
    company2 = self.env['res.company'].create({'name': 'Company 2'})
    user_c2 = self.env['res.users'].create({
        'name': 'User Company 2', 'login': 'user_c2',
        'company_id': company2.id, 'company_ids': [(6, 0, [company2.id])],
    })
    record = self.env['hms.patient'].create({'name': 'Main', 'company_id': self.company.id})
    visible = self.env['hms.patient'].with_user(user_c2).search([])
    self.assertNotIn(record, visible)   # user công ty khác không được thấy record này

def test_sudo_bypasses_rules(self):
    """Sanity check: sudo() thực sự bypass record rule — nếu test này fail nghĩa là rule đang chặn cả sudo, sai thiết kế."""
    record = self.env['hms.patient'].create({'name': 'Test'})
    self.assertTrue(record.sudo().exists())
```

### Test cho migration script (tách biệt với `pre-migrate.py`/`post-migrate.py` chạy lúc upgrade module)
```python
class TestMigration(TransactionCase):
    def test_field_migration(self):
        record = self.env['my.model'].create({'old_field': 'value'})
        record._migrate_field()   # hàm helper thuần, test được độc lập, không cần chạy cả quy trình upgrade
        self.assertEqual(record.new_field, 'value')
```

---

## 4. Phương pháp gỡ lỗi nhanh (Debugging)

- **Gỡ lỗi trong Python (Backend):** chèn dòng sau vào bất kỳ vị trí nào để dừng luồng chạy và mở terminal tương tác Debugger:
  ```python
  import pdb; pdb.set_trace()
  ```
- **Gỡ lỗi trong Javascript/OWL (Frontend):** sử dụng câu lệnh `debugger;` trong code JS và mở F12 Browser DevTools để bắt breakpoint.
- **Sử dụng Log chuẩn:**
  ```python
  import logging
  _logger = logging.getLogger(__name__)
  
  _logger.info("Giá trị biến x: %s", x)
  ```
