# Ma trận tương thích & Deprecation Odoo v14 → v19 (tra cứu nhanh + cách tự verify)

> Nguồn: tổng hợp/cross-check từ repo cộng đồng
> [`fhidalgodev/odoo-development-skill`](https://github.com/fhidalgodev/odoo-development-skill) (bảng
> deprecation timeline) — các claim về v18/v19 (SQL() builder, type hints) chưa có tài liệu chính thức Odoo
> công khai đầy đủ ở thời điểm viết, nên **PHẢI tự verify bằng §0 trước khi assert cứng** với PO/khách hàng.

Dùng file này để tra nhanh "tính năng X còn dùng được ở version Y không", KHÔNG thay thế
[references/orm-basics.md](orm-basics.md),
[references/views-and-actions.md](views-and-actions.md),
[references/owl-frontend.md](owl-frontend.md) —
những file đó có ví dụ code đầy đủ, file này chỉ là bảng tra + quy trình verify.

---

## 0. Cách tự verify 1 pattern trước khi khẳng định với PO (BẮT BUỘC khi không chắc)

Không đoán theo "số version nghe hợp lý" — Odoo core là nguồn sự thật duy nhất. Tra trực tiếp qua raw GitHub:

```
https://raw.githubusercontent.com/odoo/odoo/{branch}/{path}
```

| Version | Branch |
|---|---|
| 14.0 | `14.0` |
| 15.0 | `15.0` |
| 16.0 | `16.0` |
| 17.0 | `17.0` |
| 18.0 | `18.0` |
| 19.0 | `19.0` (hoặc `master` nếu chưa cắt nhánh chính thức — kiểm tra trước) |

File tham chiếu hay dùng nhất khi cần xác minh 1 pattern:

| Muốn kiểm | File |
|---|---|
| Chữ ký `create()`, decorator ORM | `odoo/models.py` |
| Field API mới | `odoo/fields.py` |
| Decorator (`@api.*`) | `odoo/api.py` |
| Ví dụ model thật, có business logic | `addons/sale/models/sale_order.py` |
| Ví dụ view XML thật (invisible/attrs) | `addons/sale/views/sale_order_views.xml` |
| Record rule thật (company_ids/allowed_company_ids) | `addons/sale/security/sale_security.xml` |
| Hooks OWL core dùng | `addons/web/static/src/core/utils/hooks.js` |
| SQL builder có được dùng thật chưa | grep `SQL(` trong bất kỳ model core nào của version đó |

Quy trình: WebFetch file ở version nguồn → WebFetch cùng file ở version đích → so sánh trực tiếp thay vì suy
diễn từ bảng dưới. Bảng dưới là **điểm khởi đầu tra cứu nhanh**, không phải chân lý tuyệt đối — Odoo có thể
lùi/đẩy timeline một tính năng giữa các bản SaaS/point-release.

---

## 1. Bảng Deprecation Timeline

Ký hiệu: ✅ hỗ trợ · ⚠️DEP deprecated (còn chạy, có warning) · ❌REM đã gỡ (code sẽ lỗi) · ✅REQ bắt buộc từ
version này · ➖ chưa tồn tại.

### Decorator

| Decorator | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| `@api.multi` | ⚠️DEP | ❌REM | ❌ | ❌ | ❌ | ❌ |
| `@api.one` | ⚠️DEP | ❌REM | ❌ | ❌ | ❌ | ❌ |
| `@api.model_create_multi` | ➖ | ⚠️khuyến nghị | ⚠️khuyến nghị | ✅REQ | ✅REQ | ✅REQ |

### View / XML

| Thuộc tính | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| `attrs="..."` | ✅ | ✅ | ⚠️DEP | ❌REM | ❌ | ❌ |
| `states="..."` | ✅ | ✅ | ⚠️DEP | ❌REM | ❌ | ❌ |
| `invisible=`/`readonly=`/`required=` trực tiếp (Python expr) | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ |
| `<tree>` | ✅ | ✅ | ✅ | ✅ | ⚠️đổi tên `<list>` (tree vẫn alias) | như v18 |

### x2many Commands

| Pattern | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| Tuple `(0, 0, {...})` | ✅ | ✅ | ⚠️DEP | ⚠️DEP | ⚠️DEP | ❌REM (theo repo cộng đồng — **verify §0 trước khi khẳng định**) |
| `Command.create/update/delete/unlink/link/clear/set` | ➖ | ➖ | ✅ | ✅REQ | ✅REQ | ✅REQ |

### Model / SQL

| Pattern | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| `_sql_constraints = [...]` (list cũ) | ✅ | ✅ | ✅ | ✅ | ⚠️khuyến nghị đổi `models.Constraint()` | ⚠️/❌ tuỳ bản — xem [orm-basics.md §4](orm-basics.md) |
| `index=True` trên field | ✅ | ✅ | ✅ | ✅ | ⚠️khuyến nghị đổi `models.Index()` | như v18 |
| Raw SQL string (`cr.execute("...")`) | ✅ | ✅ | ✅ | ✅ | ⚠️khuyến nghị `SQL()` builder | claim "bắt buộc SQL()" từ repo cộng đồng — **CHƯA xác nhận chính thức, verify §0** |
| Type hints trên method/field | ➖ | ➖ | ➖ | ➖ | ⚠️khuyến nghị | claim "bắt buộc" từ repo cộng đồng — **verify §0** |
| `_check_company_auto` | ➖ | ➖ | ➖ | ➖ | ✅ | ✅ |

### Security / Multi-company

| Pattern | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| `company_ids` trong domain record rule | ✅ | ✅ | ✅ | ⚠️DEP | claim ❌REM (repo cộng đồng) — **verify §0** | như v18 |
| `allowed_company_ids` | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ |

### JavaScript / OWL

| Pattern | v14 | v15 | v16 | v17 | v18 | v19 |
|---|---|---|---|---|---|---|
| `odoo.define(...)` | ✅ | ⚠️DEP | ❌REM | ❌ | ❌ | ❌ |
| `@odoo-module` + ES import | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OWL 1.x | ➖ | ✅ | ❌ | ❌ | ❌ | ❌ |
| OWL 2.x | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ **ĐÃ VERIFY (2026-07-10): v19.0 stable ship OWL 2.8.0** — `const version = "2.8.0"` trong `addons/web/static/lib/owl/owl.js` của source v19 thật, vẫn có `useState` + `t-esc`. Viết OWL 2.x cho v19 stable. |
| OWL 3.x | ➖ | ➖ | ➖ | ➖ | ➖ | ❌ CHƯA vào v19 stable — chỉ ở nhánh master `odoo/owl` (migration guide tự ghi DRAFT). Chỉ dùng cú pháp signal/proxy sau khi tự grep lại `owl.js` của instance đích ra version 3.x |

### Python runtime

| Odoo | Python tối thiểu | Khuyến nghị |
|---|---|---|
| 14.0 | 3.6 | 3.8 |
| 15.0 | 3.8 | 3.10 |
| 16.0 | 3.8 | 3.10 |
| 17.0 | 3.10 | 3.11 |
| 18.0 | 3.11 | 3.12 |
| 19.0 | 3.12 (chưa xác nhận chính thức — verify trước khi cấu hình CI/deploy) | 3.12 |

---

## 2. Lộ trình migrate rút gọn theo từng bước version liền kề

Dùng cùng với [migration-and-upgrade.md](migration-and-upgrade.md)
(engine `odoo_migrate.py` lo phần DB/OpenUpgrade) — bảng này là checklist phần **code** đi kèm mỗi hop.

**v14 → v15:** gỡ `@api.multi`; `track_visibility` → `tracking`; bắt đầu viết component mới bằng OWL 1.x thay
vì widget jQuery thuần; Python ≥3.8.

**v15 → v16:** bắt đầu dùng `Command` cho x2many thay vì tuple; `attrs`/`states` chuyển sang deprecated (vẫn
chạy được, không cần rush); asset chuyển hẳn vào `__manifest__.py['assets']`; component mới viết theo OWL 2.x.

**v16 → v17:** **bắt buộc** gỡ hết `attrs`/`states` (code sẽ lỗi cài đặt nếu còn) → dùng biểu thức Python trực
tiếp; **bắt buộc** `@api.model_create_multi` trên mọi override `create()`; Python ≥3.10.

**v17 → v18:** thêm `_check_company_auto = True` + `check_company=True` trên field liên quan company; đổi
`company_ids` → `allowed_company_ids` trong record rule; cân nhắc bắt đầu dùng `SQL()` builder và type hints
(khuyến nghị, chưa bắt buộc — verify §0 trước khi báo PO là "bắt buộc").

**v18 → v19:** verify kỹ theo §0 trước khi đổi bất cứ gì mang tính "bắt buộc" — nhiều claim (SQL() bắt buộc,
type hints bắt buộc, OWL 3 bắt buộc) đến từ suy luận cộng đồng, chưa xác nhận 100% ở mọi bản v19.0 tại thời
điểm viết tài liệu này.Luôn chạy migration test trên bản copy trước (xem
[migration-and-upgrade.md](migration-and-upgrade.md)).

---

## 3. Checklist Code Review theo version (dùng khi review PR/module)

Rà đúng thứ tự, dừng ở mục nào fail thì flag nghiêm trọng nhất trước:

1. **Manifest:** version string đúng format `X.0.Y.Z.W`, `depends` đủ, `assets` khai đúng (v15+), license hợp lệ.
2. **Model:** decorator đúng version (bảng §1), field/constraint theo đúng convention version, CRUD override
   gọi `super()` đúng chữ ký.
3. **Security:** mọi model mới có `ir.model.access.csv`; model nhạy cảm có record rule; không `sudo()` bừa bãi
   (xem [security-and-rules.md](security-and-rules.md)).
4. **View:** cú pháp visibility đúng version; nhóm quyền (`groups=`) áp đúng chỗ nhạy cảm.
5. **Performance:** field search hay dùng có index; computed field truy vấn nhiều nên `store=True`; không N+1
   query (dùng `mapped()`/`prefetch` — xem
   [performance-optimization.md](performance-optimization.md)).
6. **OWL/JS (nếu có):** đúng cú pháp OWL version (§0 file owl-frontend.md), dùng registry đúng, không patch
   internal API không tài liệu hoá.
7. **Test:** có unittest cho logic nghiệp vụ chính; test riêng cho access rights nếu model có record rule.

Thứ tự ưu tiên báo cáo lỗi: Security > Correctness (breaking version) > Performance > Style.
