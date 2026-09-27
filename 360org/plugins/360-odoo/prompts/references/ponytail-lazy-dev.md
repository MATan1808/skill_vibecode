# Ponytail — Bộ tính năng đầy đủ, đã copy 100% vào odoo-dev-skills

> File này thay thế hoàn toàn việc cài/gọi skill `ponytail` rời cho dự án Odoo. Đủ **cả 6 năng lực gốc** của ponytail (ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain, ponytail-help), ánh xạ vào đúng bước trong vòng đời `/idea → /ship` của odoo-dev-skills. Không lấy một phần cho có — thiếu bất kỳ mục nào bên dưới là chưa đúng tinh thần "combine hoàn toàn".

## Bản đồ trigger — không cần gõ `/ponytail*`

| User nói (tự nhiên, không cần cú pháp riêng) | Agent làm gì | Tương đương ponytail gốc |
|---|---|---|
| (mặc định, không cần nói gì) | Áp dụng ladder mức **full** cho mọi code sinh ra | `ponytail` (full) |
| "làm tối giản hơn nữa", "ultra", "chặt chẽ hết mức" | Chuyển mức **ultra** — xem mục Cường độ | `/ponytail ultra` |
| "làm nhanh bản thô trước", "lite" | Chuyển mức **lite** | `/ponytail lite` |
| "tắt ponytail", "bỏ qua nguyên tắc lười" | Tắt ladder, code theo yêu cầu thuần | "stop ponytail" |
| "review xem có over-engineering không", "cái gì có thể xoá bớt" (trên diff vừa sửa) | Chạy **Review over-engineering** (mục 2) | `/ponytail-review` |
| "audit cả module/repo xem thừa gì", "tìm bloat trong module" | Chạy **Audit toàn module** (mục 3) | `/ponytail-audit` |
| "liệt kê nợ kỹ thuật ponytail", "những chỗ nào đã note tắt trước đó" | Chạy **Debt ledger** (mục 4) | `/ponytail-debt` |
| "ponytail tiết kiệm được gì", "cho xem hiệu quả" | Hiện **Scoreboard** (mục 5) | `/ponytail-gain` |
| "ponytail có những gì", "hướng dẫn nhanh" | Hiện **bảng này** (mục 6) | `/ponytail-help` |

---

## 1. Ladder mặc định (chế độ `ponytail` gốc) — ACTIVE mọi lúc, mức mặc định: **full**

Trước khi viết bất kỳ dòng code Odoo nào, dừng ở nấc đầu tiên còn hợp lệ:

1. **Có thực sự cần build không?** (YAGNI) — nhu cầu suy đoán thì bỏ, nói rõ 1 dòng vì sao bỏ.
2. **Đã có sẵn trong module/Odoo core chưa?** Field, method, mixin (`mail.thread`, `mail.activity.mixin`...), view kế thừa `_inherit` — tái dùng, đừng viết lại.
3. **Odoo ORM / Python stdlib đã có sẵn chưa?** Dùng nó (`related=` thay vì tự `_compute`/`_inverse`; `fields.Date.today()` thay vì tự parse).
4. **Convention chuẩn Odoo có cover không?** `_inherit` thay vì copy model; `ir.actions.server`/`ir.cron` có sẵn thay vì tự viết job runner.
5. **Dependency/module đã có trong `depends` giải quyết được không?** Dùng nó, đừng thêm dependency mới nếu tránh được.
6. **Có thể gói gọn 1 dòng / 1 decorator field không?** Làm gọn nhất.
7. **Chỉ khi hết nấc:** viết code tối thiểu, đúng chuẩn version target (xem `orm-basics.md`, `views-and-actions.md`, `owl-frontend.md`).

Ladder chạy **sau khi** đã hiểu đúng bài toán — đọc REQUIREMENTS/SPEC, trace luồng ORM/view thật trước khi leo nấc. Diff ngắn nhất thắng, nhưng chỉ khi đặt đúng chỗ.

**Bug fix = sửa root cause:** grep hết `_inherit`/caller liên quan đến model/method đang sửa, sửa chung 1 chỗ (model gốc/mixin) thay vì vá từng module con.

### Quy tắc
- Không thêm field/model/method/abstraction ngoài yêu cầu trong SPEC/REQUIREMENTS.
- Không thêm Python package / Odoo module dependency mới nếu tránh được.
- Không boilerplate thừa (không tự sinh CRUD controller nếu view chuẩn đủ).
- Xoá ưu tiên hơn thêm. Ít file, ít tầng kế thừa chồng chéo nhất có thể.
- 2 cách ORM/stdlib ngang nhau về độ dài? Chọn cách đúng edge-case (timezone, multi-company) — lười là ít code hơn, không phải thuật toán yếu hơn.
- Đơn giản hoá có chủ đích → comment `# ponytail: <giới hạn>, <hướng nâng cấp>` (vd: `# ponytail: sudo() tạm thời, thêm record rule khi multi-company`).

### Output khi sinh code
Code trước. Sau đó tối đa 3 dòng ngắn: bỏ gì, khi nào thêm lại. Không viết essay giải thích dài hơn code.
Mẫu: `[code] → bỏ qua: [X], thêm khi [Y].`

### Cường độ (chọn theo yêu cầu, mặc định **full**)

| Mức | Hành vi |
|---|---|
| **lite** | Build đúng cái được yêu cầu, nhưng nêu 1 dòng phương án lười hơn để user chọn. |
| **full** (mặc định) | Ladder được ép dùng. ORM/stdlib/convention Odoo trước. Diff & giải thích ngắn nhất. |
| **ultra** | YAGNI cực đoan. Xoá trước khi thêm. Vừa ship bản 1-dòng vừa thách thức lại yêu cầu ngay trong cùng câu trả lời. |

### Không được lười ở
Hiểu đúng vấn đề trước khi code; security & access rules (`ir.model.access.csv`, record rules, `sudo()` phải có lý do); validation ở boundary (API/controller/webhook); error handling chống mất dữ liệu (transaction, rollback); migration dữ liệu khi đổi schema; bất kỳ điều PO yêu cầu rõ ràng. Logic không tầm thường phải để lại 1 check chạy được (assert/self-check nhỏ hoặc 1 test nhỏ trong `tests/`).

---

## 2. Review over-engineering trên diff (tương đương `ponytail-review`)

**Khi dùng:** ngay sau `/build`, trước khi merge diff — bổ sung cho `/review` (đánh giá đúng/sai) bằng lớp riêng chỉ soi "có gì thừa".

**Phạm vi:** CHỈ over-engineering & độ phức tạp. Bug đúng/sai, bảo mật, hiệu năng → thuộc `/review` chuẩn + `final-audit-guide.md`, không trộn vào đây.

**Định dạng, mỗi dòng 1 phát hiện:**
`<file>:L<dòng>: <tag> <cái gì>. <thay bằng gì>.`

Tag:
- `delete:` code chết, field/tham số không dùng, tính năng suy đoán. Thay bằng: không có gì.
- `stdlib:` tự viết lại cái ORM/Python stdlib đã có. Nêu tên hàm/field chuẩn.
- `native:` dependency/code làm việc mà Odoo core/convention đã làm. Nêu tên feature.
- `yagni:` abstraction 1 implementation, config không ai set, mixin/layer chỉ 1 caller.
- `shrink:` cùng logic, ít dòng hơn. Nêu dạng ngắn hơn.

**Ví dụ:**
- `models/sale_order.py:L40-58: stdlib: tự viết vòng lặp tính tổng dòng. Dùng mapped('amount_total') / sum().`
- `models/res_partner.py:L12: yagni: abstract model 1 implementation duy nhất. Inline vào model chính tới khi có cái thứ 2.`
- `views/sale_view.xml:L20: delete: field ẩn (invisible="1") không ai đọc, dead flexibility.`

**Kết thúc:** `net: -<N> dòng có thể giảm.` Không có gì để cắt: `Sạch rồi. Ship.`

Không tự áp fix, chỉ liệt kê. 1 self-check/smoke test theo mức ponytail-minimum không bị coi là thừa.

---

## 3. Audit toàn module/repo (tương đương `ponytail-audit`)

**Khi dùng:** trước khi ship module lớn, hoặc PO yêu cầu "audit cả module xem thừa gì" — quét toàn bộ cây thư mục module thay vì chỉ diff. Chạy song song, không thay thế, 9 khía cạnh đúng/sai trong `final-audit-guide.md`.

**Săn tìm:** dependency Odoo/Python đã có sẵn nhưng bị tự viết lại; interface/abstract model 1 implementation; factory 1 sản phẩm; wrapper chỉ delegate; file `__init__.py`/model chỉ export 1 thứ; flag/config chết trong `__manifest__.py`; view kế thừa chồng chéo không cần thiết.

**Output, xếp hạng theo mức độ cắt được nhiều nhất trước:**
`<tag> <cái gì nên cắt>. <thay bằng gì>. [đường dẫn]`

Kết thúc: `net: -<N> dòng, -<M> dependency có thể giảm.` Không có gì: `Sạch rồi. Ship.`

Chỉ liệt kê, không tự sửa. One-shot — chạy 1 lần ra báo cáo, không giữ trạng thái.

---

## 4. Debt ledger — theo dõi các chỗ đã cố ý đơn giản hoá (tương đương `ponytail-debt`)

Mỗi lần cố ý đơn giản hoá theo ladder ở mục 1, để lại comment `# ponytail: <giới hạn>, <hướng nâng cấp>`. Mục này gom chúng lại thành 1 ledger để không bị quên vĩnh viễn.

**Quét:**
```bash
grep -rnE '(#|//) ?ponytail:' --include="*.py" --include="*.js" --include="*.xml" <path_module>
```

**Output, mỗi dòng 1 marker, gom theo file:**
`<file>:<dòng>, <cái gì bị đơn giản hoá>. giới hạn: <ceiling>. nâng cấp khi: <trigger>.`

Marker nào không nêu rõ giới hạn/trigger → gắn thẻ `no-trigger` (nguy cơ bị lãng quên vĩnh viễn).

Kết thúc: `<N> markers, <M> không có trigger.` Không tìm thấy: `Không có nợ ponytail. Ledger sạch.`

Chỉ đọc & báo cáo, không sửa gì. Nếu PO muốn lưu lại, ghi ra file `PONYTAIL-DEBT.md` ở root module (tương tự `CHANGELOGS.md`).

---

## 5. Scoreboard hiệu quả (tương đương `ponytail-gain`)

Số liệu benchmark gốc (median 5 task mẫu, 3 model — không phải số đo riêng cho từng module Odoo, không được bịa số "tiết kiệm X dòng ở module này"):

```
  ponytail gain                     benchmark median · 5 tasks · 3 models

  Số dòng code    không dùng  ████████████████████  100%
                  ponytail    ██▌·················    6–20%   ▼ giảm 80–94%
  Chi phí         không dùng  ████████████████████  100%
                  ponytail    █████⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·   23–53%  ▼ giảm 47–77%
  Tốc độ          ponytail    ▸ nhanh hơn 3–6×
```

Số liệu thật per-module chỉ có ở mục 4 (Debt ledger — đếm được thật). Không phát minh số cho repo hiện tại.

---

## 6. Bảng tra nhanh (tương đương `ponytail-help`)

Xem bảng "Bản đồ trigger" ở đầu file này — đó là help card, không cần gõ `/ponytail-help` riêng vì đã nằm sẵn trong odoo-dev-skills.

---

## Ghi chú

Toàn bộ 6 năng lực trên đã nhúng thẳng vào `odoo-dev-skills` (`/build` dùng mục 1, `/review` dùng mục 2, final audit dùng mục 3, kiểm tra định kỳ dùng mục 4). Với dự án **Odoo, không cần cài/gọi skill `ponytail` rời** — mọi trigger phrase gốc của ponytail đều được ánh xạ lại ở bảng đầu file. Skill `ponytail`/`ponytail-review`/`ponytail-audit`/`ponytail-debt`/`ponytail-gain`/`ponytail-help` độc lập (nếu có cài) chỉ còn cần thiết cho các **project không phải Odoo**.
