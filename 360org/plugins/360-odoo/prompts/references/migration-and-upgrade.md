# Migrate DB & Upgrade Version Odoo — Quy trình local (thay `upgrade.odoo.com`)

> ⭐ Đây là scope **quan trọng nhất**. Mục tiêu: **không** upload DB lên `upgrade.odoo.com` nữa. Thả DB vào folder local → ra 1 lệnh → agent tự dựng env từng version, nâng DB + custom module, lặp tới khi success, PO can thiệp tối thiểu. Engine: [`scripts/odoo_migrate.py`](../scripts/odoo_migrate.py). Lệnh entry: `/odoo-migrate`.

---

## 0. Luật an toàn CỨNG (vi phạm = dừng ngay)

1. **KHÔNG bao giờ đụng DB nguồn.** Luôn `pg_dump` bản gốc trước, mọi thao tác chạy trên **DB work riêng** (vd `<db>_mig`). DB/dump nguồn chỉ đọc.
2. **Mỗi hop = 1 snapshot.** Trước mỗi bước nâng version, dump DB work ra `workspace/backups/<db>_<version>.dump`. Hỏng ở hop nào thì rollback đúng hop đó, không làm lại từ đầu.
3. **Không sửa dữ liệu bằng tay trên UI/SQL** để "cho qua" migrate. Mọi biến đổi dữ liệu phải nằm trong migration script (versioned, qua git).
4. **Addons gốc dùng official**, không tự chế: core CE nâng bằng **OpenUpgrade (OCA)**; EE nâng bằng **migration script đi kèm source EE official** của anh. Ta chỉ tự viết migration cho **custom module**.
5. **Verify trước khi tuyên bố success** (mục 5). Chưa verify = chưa xong.

---

## 1. Kiến trúc tổng thể

```
[DB dump nguồn]  (chỉ đọc)
      │  pg_restore
      ▼
[DB work: <db>_mig] ──▶ hop 15→16 ──▶ hop 16→17 ──▶ ... ──▶ [version đích]
      │                    │             │                        │
   backup gốc          snapshot      snapshot                  VERIFY
                                                                  │
                                                          MIGRATION_REPORT.md
```

**Ba lớp addons nạp vào mỗi hop** (thứ tự `addons-path` quan trọng — OpenUpgrade phải đứng trước core):

```
--addons-path = <openupgrade>/addons , <odoo-ce>/addons , <enterprise> , <custom-modules>
```

- `openupgrade` = OCA/OpenUpgrade, branch đúng version đích của hop → chứa migration script cho **core CE**.
- `odoo-ce` = odoo/odoo, branch version đích.
- `enterprise` = source EE official (nếu DB có module EE), branch version đích → migration script EE nằm sẵn trong đây.
- `custom-modules` = module nhà, đã được backport code + có migration script (mục 4).

## 2. Ánh xạ version ↔ branch

| Odoo version | Branch (CE/EE/OpenUpgrade) | Python tối thiểu |
|:---|:---|:---|
| 14.0 | `14.0` | 3.6+ |
| 15.0 | `15.0` | 3.8+ |
| 16.0 | `16.0` | 3.8+ |
| 17.0 | `17.0` | 3.10+ |
| 18.0 | `18.0` | 3.10+ |
| 19.0 | `19.0` | 3.10+ |

> Cột "Python tối thiểu" là của **runtime Odoo trong container** (image `odoo:<v>` đã có sẵn đúng Python + postgres client). **Docker-first**: không cần cài Python đó lên máy host — host chỉ cần Docker + git + Python ≥ 3.8 để chạy orchestrator.

**Nâng bắt buộc tuần tự từng hop** — không nhảy thẳng 14→19. Chuỗi hop = mọi mốc `x.0` giữa nguồn và đích. VD nguồn 15.0, đích 18.0 → `[15→16, 16→17, 17→18]`.

## 3. Các bước orchestrator tự làm (`odoo_migrate.py`)

1. **Ingest & backup:** nhận DB dump (thả vào `workspace/input/` hoặc `--dump <path>` / `--db <name>`). `pg_dump` bản gốc ra `workspace/backups/`.
2. **Restore ra DB work** riêng (không bao giờ ghi vào nguồn).
3. **Detect version nguồn:** `SELECT latest_version FROM ir_module_module WHERE name='base'` trên DB work (hoặc lấy từ `--from`).
4. **Provision env từng hop:** clone/checkout `odoo`, `enterprise`, `OpenUpgrade` đúng branch (bootstrap tự động vào `workspace/src/`, cache lại cho lần sau). Chọn runtime: docker image `odoo:<v>` hoặc venv + `odoo-bin` local (`--use-docker` / `--odoo-bin`).
5. **Chạy upgrade mỗi hop:**
   ```
   odoo-bin -d <db>_mig -u all --stop-after-init \
     --addons-path <openupgrade>,<ce>,<ee>,<custom> \
     --load=base,web,openupgrade_framework
   ```
   Log lọc qua [`token_killer_proxy.py`](../scripts/token_killer_proxy.py) để tiết kiệm token.
6. **Iterate tới success (vòng lặp RCA):** parse lỗi mỗi hop. Bám [systematic-debugging 4-pha](debugging-and-bugfixing.md#systematic-debugging):
   - Lỗi từ **custom module** → sửa/viết migration script custom (mục 4) hoặc backport code qua [`odoo_code_migrate.py`](../scripts/odoo_code_migrate.py).
   - Lỗi từ **OpenUpgrade/EE** → kiểm tra branch đúng chưa, module dependency đủ chưa; nếu thật sự thiếu script EE → **flag "cần tay"**, không tự bịa dữ liệu.
   - Sửa xong → rollback snapshot hop đó → chạy lại hop. Lặp.
7. **Sang hop kế** khi hop hiện tại `installed` sạch. Hết chuỗi hop → sang verify.
8. **Verify + report** (mục 5).

## 4. Migration script cho custom module (phần ta tự viết)

Odoo chạy migration script theo cơ chế thư mục chuẩn trong module:

```
my_module/
├── __manifest__.py           # bump 'version' lên "<v>.x.y.z"
└── migrations/
    └── 18.0.1.0.0/
        ├── pre-migrate.py     # chạy TRƯỚC khi update schema (đổi cột, backup dữ liệu)
        ├── post-migrate.py    # chạy SAU update (map dữ liệu, tính lại field)
        └── end-migrate.py     # chạy cuối cùng (cleanup, ràng buộc chéo module)
```

Mỗi script có hàm `def migrate(cr, version):`. Dùng `openupgradelib` khi có (rename field/model an toàn). Template: [`templates/migration_script.py.tmpl`](../templates/migration_script.py.tmpl).

Nguyên tắc viết (mượn pattern Strangler/Adapter của deprecation-and-migration):
- **Đổi tên field/model:** dùng `openupgrade.rename_fields` / `rename_models`, **không** DROP rồi tạo mới (mất dữ liệu).
- **Đổi kiểu dữ liệu:** tạo cột mới → copy+transform → xoá cột cũ ở `end-migrate`, không đổi tại chỗ.
- **Xoá field:** chỉ ở `end-migrate` sau khi chắc chắn đã migrate hết consumer (Churn Rule).
- Mỗi migration script **idempotent** nếu có thể (chạy lại không hỏng).

## 5. Verify toàn vẹn dữ liệu (checklist bắt buộc trước khi báo success)

- [ ] Tất cả module `state = 'installed'`, không module nào `to upgrade`/`to install` treo.
- [ ] Đếm record các model trọng yếu **trước/sau** khớp kỳ vọng (`res.partner`, `sale.order`, `account.move`, `stock.move`, ...). Chênh lệch phải giải thích được.
- [ ] Không view/asset vỡ: khởi động Odoo, load các menu chính, kiểm `ir.ui.view` không lỗi parse.
- [ ] Sequence, `ir.config_parameter`, company/currency còn nguyên.
- [ ] Chạy smoke test / Odoo Tours cơ bản trên DB đã nâng.
- [ ] Xuất `MIGRATION_REPORT.md`: chuỗi hop, thời gian, diff số record, danh sách **"cần review tay"**, warning còn lại.

## 5b. Gotcha hay gặp khi migrate

**`_button_immediate_install()` fail trong migration script — dùng `button_install()`:**
```python
# SAI — raise "cannot be called on init or non loaded registries"
module._button_immediate_install()

# ĐÚNG trong context migration script (registry chưa load xong) — queue cài đặt, không cài ngay
module.button_install()
```
Lỗi này xảy ra vì lúc migration script chạy, registry Odoo chưa load hoàn tất — biến thể "immediate" đòi hỏi
registry đã sẵn sàng nên fail ngay lập tức.

**`allowed_company_ids` thay `company_ids` trong domain record rule (v17→v18):** đây là lỗi **âm thầm**, rule
không raise gì cả mà chỉ đơn giản ngừng lọc đúng — không phát hiện qua log, chỉ phát hiện khi test đa công ty
thủ công. Xem chi tiết ở
[security-and-rules.md](security-and-rules.md)
và [version-compatibility-matrix.md §1](version-compatibility-matrix.md).

**Khi không chắc 1 API còn tồn tại/đổi chữ ký giữa 2 version:** fetch trực tiếp cùng 1 file ở cả 2 branch
GitHub rồi so sánh, thay vì suy diễn từ trí nhớ — xem quy trình đầy đủ ở
[version-compatibility-matrix.md §0](version-compatibility-matrix.md).

---

## 6. Khi nào cần con người

- Module EE mà OpenUpgrade + EE official đều không có script phù hợp → agent **dừng, báo PO**, đề xuất phương án (viết script tay / bỏ module / thay bằng CE tương đương). Không tự chế dữ liệu.
- Custom module có logic nghiệp vụ phức tạp (kế toán, tồn kho) mà biến đổi dữ liệu không chắc chắn → trình PO duyệt migration script trước khi chạy trên bản có giá trị.

## 7. Bàn giao

Sau verify pass: DB đã nâng nằm ở `workspace/output/<db>_<version>.dump`. Custom module đã backport + có migration script được push qua git workflow ([git-workflow.md](git-workflow.md)). Báo cáo `MIGRATION_REPORT.md` gửi PO.
