# Backport / Refactor / Integrate module — nâng CODE custom giữa version

> Scope #2 & #3. Bổ trợ cho [migrate DB](migration-and-upgrade.md): migrate DB lo **dữ liệu**, tài liệu này lo **code custom module** (adapt API deprecated, đổi cú pháp theo version). Engine: [`scripts/odoo_code_migrate.py`](../scripts/odoo_code_migrate.py) + [`scripts/odoo_linter.py`](../scripts/odoo_linter.py). Nguồn luật chung: [`scripts/odoo_version_rules.py`](../scripts/odoo_version_rules.py). Lệnh entry: `/odoo-backport`.

---

## 1. Nguyên tắc

- **Tự động chỉ phần máy móc chắc chắn**, phần mơ hồ **flag** cho người — rewrite sai `attrs` là đổi hành vi UI, nguy hiểm hơn để nguyên.
- Sau mỗi lần `--write`: **luôn chạy `odoo_linter.py --version <to>`** để kiểm còn sót không.
- Backup/commit git **trước** khi `--write` (mặc định script chỉ preview).
- Ponytail: diff nhỏ nhất, không refactor thừa. Chỉ đổi cái version bắt buộc đổi.

## 2. Bảng deprecation theo version (nguồn: `odoo_version_rules.py`)

| id | Từ version | Đổi gì | Tự động? |
|:---|:---:|:---|:---|
| `t-raw` | 15 | `t-raw` → `t-out` (bảo mật) | ✅ auto |
| `attrs` | 17 | `attrs="{...}"` → `invisible=`/`readonly=`/`required=` trực tiếp | ⚙️ đơn giản: auto; phức tạp: flag |
| `states_attr` | 17 | `states=` trên field XML → invisible/readonly theo state | ⚑ flag |
| `sql_constraints` | 18 | `_sql_constraints` → `models.Constraint()` | ⚑ flag |
| `index_true` | 18 | `index=True` → `models.Index()` | ⚑ flag |
| `tree_tag` | 18 | `<tree>` → `<list>` (tree còn alias) | ⚑ flag |
| `osv` | (cũ) | `odoo.osv` → `models.Model` | ⚑ flag |

`odoo_code_migrate.py --from X --to Y` chỉ kích hoạt rule có `changed_in ∈ (X, Y]` — nâng 16→18 sẽ không đụng `t-raw` (đã đổi ở 15).

## 3. Quy trình backport 1 module

```
1. python odoo_code_migrate.py --path <mod> --from <X> --to <Y>          # preview
2. Xem chỗ ✅ (auto) và ⚑ (cần tay). Commit/backup.
3. python odoo_code_migrate.py --path <mod> --from <X> --to <Y> --write  # áp phần auto
4. Sửa tay các chỗ ⚑ (attrs phức tạp, Constraint/Index, states, tree).
5. python odoo_linter.py --path <mod> --version <Y>                      # kiểm sạch
6. Bump 'version' trong __manifest__.py (template upgrade_manifest.py.tmpl).
7. Nếu có đổi schema/dữ liệu → viết migration script (migration_script.py.tmpl).
8. Test (TDD, references/testing-and-debugging.md) → review (final-audit-guide.md).
```

### Chuyển `attrs` — ví dụ tự động được
```xml
<!-- v16 -->
<field name="note" attrs="{'invisible': [('state', '=', 'draft')]}"/>
<!-- v17+ (auto) -->
<field name="note" invisible="state == 'draft'"/>
```
Đa điều kiện `|`/`&` → chuyển thành `or`/`and`; `('f','=',False)` → `not f`. Toán tử lạ (`like`, `child_of`...) hoặc key ngoài invisible/readonly/required/column_invisible → **flag** để chuyển tay.

## 4. Integrate feature module (gộp tính năng)

Mượn pattern từ deprecation-and-migration (đã hút vào bộ này):

- **Adapter:** khi tích hợp module B vào hệ A có interface khác — viết lớp adapter (`_inherit` model, map field/method) thay vì sửa thẳng B. Giữ B nâng cấp được độc lập.
- **Strangler:** thay dần tính năng cũ bằng mới — chạy song song, chuyển traffic/luồng nghiệp vụ từng phần, xoá phần cũ khi 0% còn dùng.
- **Feature flag:** bật/tắt tính năng mới qua `ir.config_parameter` hoặc group để rollout từng bước.
- **KHÔNG** fork sửa module gốc (OCA/EE/CE) — luôn `_inherit` ở module cầu nối để nâng cấp upstream không vỡ.

## 5. Backport ngược (hạ version)

Hạ version code (vd viết ở v18 cần chạy v16): làm ngược bảng trên (thêm lại `attrs`, `<tree>`, `_sql_constraints`...). `odoo_code_migrate.py` hiện tối ưu cho **nâng**; hạ version nhiều chỗ phải tay — dùng linter `--version <lower>` để soi chỗ cần sửa, cộng review thủ công. (Migrate **DB** thì không hạ được — xem [migration-and-upgrade.md §1](migration-and-upgrade.md).)
