# Odoo Performance Optimization & Database Indexing (v14 - v19)

Tài liệu hướng dẫn tối ưu hóa hiệu năng, xử lý các truy vấn cơ sở dữ liệu tốc độ cao, tránh nghẽn luồng và thiết lập chỉ mục (Indexes) trong Odoo.

---

## 1. Tránh bẫy hiệu năng: Vấn đề N+1 Query

Vấn đề N+1 Query xảy ra khi bạn lặp qua một tập hợp bản ghi và trong mỗi vòng lặp lại thực hiện một truy vấn ORM/SQL riêng lẻ tới cơ sở dữ liệu để lấy thông tin liên quan.

### ❌ Cách viết TỒI (Gây chậm hệ thống nghiêm trọng):
```python
# Thực hiện 1 truy vấn lấy patients + N truy vấn lấy thông tin bác sĩ của từng patient
patients = self.env['hms.patient'].search([])
for patient in patients:
    doctor_name = patient.doctor_id.name # N lần truy vấn SQL phụ
```

### ✅ Cách viết TỐT (Tối ưu hóa gộp nhóm):
Odoo ORM có cơ chế tự động nạp trước dữ liệu (**Prefetching**). Khi bạn truy cập một trường của bản ghi đầu tiên trong danh sách, Odoo sẽ tự động tải trường đó cho toàn bộ các bản ghi còn lại trong tập hợp bản ghi (`Recordset`) bằng một truy vấn duy nhất.

```python
patients = self.env['hms.patient'].search([])
# Chỉ tốn 2 truy vấn SQL nhờ Prefetching
for patient in patients:
    doctor_name = patient.doctor_id.name
```

Nếu bạn cần gom danh sách các giá trị liên kết từ One2many hoặc Many2one, hãy sử dụng phương thức `mapped()`:
```python
# Lấy tất cả tên của bác sĩ điều trị cho bệnh nhân (1 truy vấn duy nhất, tự động loại bỏ trùng lặp)
doctor_names = patients.mapped('doctor_id.name')
```

---

## 2. Sử dụng `read_group()` thay cho vòng lặp tính toán

Khi cần thống kê số lượng hoặc tính tổng dữ liệu, tuyệt đối không dùng `search()` rồi đếm hoặc tính tổng trong Python. Hãy sử dụng hàm `read_group()` của ORM để thực thi câu lệnh `GROUP BY` trực tiếp ở PostgreSQL.

### ✅ Ví dụ tính tổng tiền hóa đơn theo từng bác sĩ:
```python
# Thực hiện GROUP BY ở PostgreSQL, trả về kết quả ngay lập tức
result = self.env['hms.prescription.line'].read_group(
    domain=[('date', '>=', '2026-01-01')], # Điều kiện lọc
    fields=['price_subtotal:sum'],         # Trường cần tính tổng
    groupby=['doctor_id']                  # Trường gom nhóm
)
# Kết quả trả về: [{'doctor_id': (1, 'Dr. A'), 'doctor_id_count': 12, 'price_subtotal': 12500.0}, ...]
```

---

## 3. Khai báo Indexes thông minh trên Cơ sở dữ liệu

Database Index giúp tăng tốc độ tìm kiếm bản ghi đáng kể, nhưng làm giảm tốc độ Ghi/Tạo mới dữ liệu. Chỉ đánh chỉ mục cho các trường thường xuyên làm điều kiện lọc (`domain`), sắp xếp (`order`) hoặc liên kết bảng.

### Các loại Indexes thường dùng:
- **Many2one fields:** Odoo mặc định tự động tạo B-tree index cho các trường Many2one (ví dụ: `doctor_id`).
- **Các trường tìm kiếm thường xuyên:** Đánh dấu `index=True` khi khai báo trường.
- **🚀 Odoo 17+ (Composite Index phức hợp):** Đánh chỉ mục trên nhiều cột đồng thời.
  ```python
  class HospitalPatient(models.Model):
      _name = 'hms.patient'
      
      # Đánh composite index cho các trường thường đi chung trong domain search
      _table_indexes = [
          models.Index(fields=['doctor_id', 'active']),
      ]
  ```

---

## 4. Viết SQL thô và làm sạch bộ nhớ đệm (Cache Invalidation)

Trong các bài toán xử lý dữ liệu lớn (Big Data / Data Migration) với hàng triệu dòng, việc sử dụng ORM có thể gây tràn RAM và chạy rất chậm. Khi đó, viết câu lệnh SQL trực tiếp qua `cr.execute()` là bắt buộc.

> [!CAUTION]
> **Xung đột Cache:** Khi bạn chạy SQL thô để thay đổi dữ liệu trong DB (`UPDATE`, `INSERT`, `DELETE`), bộ nhớ đệm (Cache) của ORM Odoo sẽ không tự nhận biết được sự thay đổi đó. Bạn **bắt buộc phải xóa cache** ngay sau khi chạy SQL thô để tránh AI hoặc hệ thống đọc dữ liệu cũ từ cache.

### Mẫu viết SQL thô an toàn và tối ưu:
```python
def action_mass_update_stage(self):
    query = """
        UPDATE hms_patient 
        SET state = %s 
        WHERE active = %s
    """
    # Sử dụng tham số hóa để tránh SQL Injection
    self.env.cr.execute(query, ('recovered', True))
    
    # CRITICAL: Xóa sạch cache của ORM để đồng bộ lại dữ liệu mới từ DB
    self.env.invalidate_all()
```
*Lưu ý: Ở các phiên bản cũ hơn (v14-v15), thay vì `self.env.invalidate_all()`, sử dụng `self.env.cache.invalidate()` hoặc `self.invalidate_cache()`.*

**Invalidate đúng phạm vi thay vì luôn xoá sạch toàn bộ:** `invalidate_all()` xoá cache của **mọi** model,
nặng hơn cần thiết khi chỉ 1 model bị ảnh hưởng:

```python
self.browse(updated_ids).invalidate_recordset()   # chỉ các record vừa update — rẻ nhất
self.invalidate_model()                            # toàn bộ cache của riêng model này
self.env.invalidate_all()                          # toàn bộ cache mọi model — chỉ dùng khi thực sự cần
```

---

## 5. Loại Index nâng cao (không chỉ `index=True` = boolean)

Từ v16+, tham số `index` trên field nhận **string** để chọn loại index chuyên biệt, không chỉ `True`/`False`:

```python
code = fields.Char(index='btree_not_null')   # loại trừ NULL khỏi index — nhỏ gọn hơn cho field optional hay được search
name = fields.Char(index='trigram')          # bắt buộc cần cho ILIKE '%từ khoá%' nhanh (full pattern match)
```

Không dùng `trigram` tràn lan — chỉ field thực sự cần search dạng `ilike '%...%'` (không phải prefix match)
mới cần, vì trigram index tốn nhiều dung lượng hơn B-tree thường.

---

## 6. `read_group()` để batch tính computed field kiểu đếm/tổng (chống N+1 trong chính hàm compute)

Khác với "N+1 do vòng lặp thường" ở §1 — đây là N+1 **ẩn trong hàm `_compute_*`** khi mỗi record tự
`search_count()` riêng:

```python
# ✗ N+1 ẩn trong compute — mỗi patient 1 query search_count riêng
@api.depends('doctor_id')
def _compute_doctor_patient_count(self):
    for rec in self:
        rec.doctor_patient_count = self.env['hms.patient'].search_count([('doctor_id', '=', rec.doctor_id.id)])

# ✓ 1 query duy nhất cho cả recordset, dùng read_group rồi map lại
@api.depends('doctor_id')
def _compute_doctor_patient_count(self):
    if not self:
        return
    data = self.env['hms.patient'].read_group(
        [('doctor_id', 'in', self.mapped('doctor_id').ids)], ['doctor_id'], ['doctor_id'],
    )
    counts = {d['doctor_id'][0]: d['doctor_id_count'] for d in data}
    for rec in self:
        rec.doctor_patient_count = counts.get(rec.doctor_id.id, 0)
```

---

## 7. Cron xử lý theo giới hạn thời gian (không chỉ giới hạn batch size)

Xem [cron-and-automation-patterns.md §2](cron-and-automation-patterns.md)
— giới hạn theo wall-clock time đúng chuẩn hơn giới hạn số bản ghi, tránh 1 cron chiếm worker quá lâu làm
nghẽn cron/request khác.

---

## 8. `_check_company_auto` (v18+) cũng là tối ưu hiệu năng, không chỉ đúng nghiệp vụ

```python
_check_company_auto = True
partner_id = fields.Many2one('res.partner', check_company=True)
```
Thay hẳn việc tự viết `@api.constrains` kiểm tra công ty chéo bằng tay (chạy Python từng record) bằng cơ chế
check tối ưu sẵn của ORM — xem chi tiết ở
[security-and-rules.md](security-and-rules.md).

---

## 9. Đo số lượng query bằng `QueryCounter` — chống N+1 tái phát

```python
from odoo.tests.common import QueryCounter

with QueryCounter(self.env.cr) as qc:
    records.some_method()
self.assertLessEqual(qc.count, 5)   # test fail ngay nếu sau này ai đó vô tình đưa N+1 quay lại
```

Dùng trong unittest (xem thêm [testing-and-debugging.md](testing-and-debugging.md))
để "khoá" số lượng query của 1 method quan trọng — không chỉ optimize 1 lần rồi để ai đó vô tình phá lại sau
này mà không ai biết.
