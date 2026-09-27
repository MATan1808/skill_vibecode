# Ponytail — Bộ tính năng đầy đủ, tích hợp vào hermes-dev-skills

> File này thay thế hoàn toàn việc cài/gọi skill `ponytail` rời cho dự án Hermes plugin. Đủ cả 6 năng lực gốc, ánh xạ vào đúng bước trong vòng đời `/idea → /ship` của `hermes-dev-skills`.

## Bản đồ trigger

| User nói | Agent làm gì | Tương đương ponytail gốc |
|---|---|---|
| (mặc định) | Ladder mức **full** cho mọi code sinh ra | `ponytail` (full) |
| "làm tối giản hơn nữa", "ultra" | Mức **ultra** | `/ponytail ultra` |
| "làm nhanh bản thô trước", "lite" | Mức **lite** | `/ponytail lite` |
| "review over-engineering" (trên diff vừa sửa) | Mục 2 | `/ponytail-review` |
| "audit cả plugin xem thừa gì" | Mục 3 | `/ponytail-audit` |
| "liệt kê nợ kỹ thuật ponytail" | Mục 4 | `/ponytail-debt` |
| "ponytail tiết kiệm được gì" | Mục 5 | `/ponytail-gain` |
| "ponytail có những gì" | Bảng này | `/ponytail-help` |

---

## 1. Ladder mặc định — ACTIVE mọi lúc, mức mặc định **full**

Trước khi viết bất kỳ dòng code plugin Hermes nào, dừng ở nấc đầu tiên còn hợp lệ:

1. **Có thực sự cần build không?** (YAGNI) — Skill (SKILL.md) giải quyết được thì đừng viết Tool.
2. **Đã có reference implementation trong repo Hermes chưa?** (vd `plugins/platforms/irc/`, `weixin.py`, `teams/`, `google_chat/`, `line/`) — tái dùng pattern, đừng phát minh lại long-poll/webhook loop.
3. **`BasePlatformAdapter`/`registry`/`PluginContext` đã cung cấp sẵn method/hook chưa?** (`build_source()`, `_keep_typing()`, `acquire_scoped_lock()`) — dùng nó thay vì tự viết lại.
4. **Python stdlib đã đủ chưa?** (`xmlrpc.client`, `asyncio`, `re`) — dùng trước khi thêm dependency.
5. **Dependency đã khai trong `plugin.yaml`/`requirements` giải quyết được không?** Dùng nó.
6. **Có thể gói gọn 1 dòng không?** Làm gọn nhất.
7. **Chỉ khi hết nấc:** viết code tối thiểu, đúng chuẩn `references/platform-adapters.md` / `tools-and-hooks.md`.

**Bug fix = sửa root cause:** grep hết nơi gọi hàm/field đang sửa trong plugin, sửa 1 chỗ thay vì vá từng nơi.

### Quy tắc
- Không thêm tham số `register_platform()`/`register_tool()` ngoài SPEC yêu cầu.
- Không thêm dependency Python mới nếu tránh được (ưu tiên stdlib — `xmlrpc.client`, `http.server`, `asyncio` đã đủ cho hầu hết platform adapter).
- Xoá ưu tiên hơn thêm. Ít file nhất có thể.
- Đơn giản hoá có chủ đích → comment `# ponytail: <giới hạn>, <hướng nâng cấp>`.

### Cường độ
| Mức | Hành vi |
|---|---|
| **lite** | Build đúng yêu cầu, nêu 1 dòng phương án lười hơn. |
| **full** (mặc định) | Ladder ép dùng, ưu tiên reference implementation có sẵn trong repo Hermes. |
| **ultra** | YAGNI cực đoan, thách thức lại yêu cầu ngay trong câu trả lời. |

### Không được lười ở
Hiểu đúng vấn đề trước khi code (đọc đúng reference loại plugin); token lock khi giữ credential persistent; validation ở boundary (env vars, config.yaml); error handling không để crash cả gateway process; bất kỳ điều PO yêu cầu rõ ràng. Logic không tầm thường (vd poll loop, self-loop check) phải có 1 test nhỏ chạy được.

---

## 2. Review over-engineering trên diff

Định dạng mỗi dòng: `<file>:L<dòng>: <tag> <cái gì>. <thay bằng gì>.`

Tag: `delete:` (code chết/param không dùng), `stdlib:` (tự viết lại cái stdlib đã có), `native:` (tự làm việc Hermes core/BasePlatformAdapter đã làm — vd tự viết typing indicator thay vì override `_keep_typing`), `yagni:` (abstraction 1 implementation), `shrink:` (cùng logic, ít dòng hơn).

Kết thúc: `net: -<N> dòng có thể giảm.` Không có gì: `Sạch rồi. Ship.`

---

## 3. Audit toàn plugin/repo

Quét toàn cây thư mục plugin, không chỉ diff. Săn tìm: hook/helper của `BasePlatformAdapter` bị tự viết lại; wrapper chỉ delegate; env var khai trong `plugin.yaml` nhưng không đọc ở đâu; file `__init__.py` chỉ export 1 thứ không cần thiết.

Output: `<tag> <cái gì nên cắt>. <thay bằng gì>. [đường dẫn]`. Kết thúc: `net: -<N> dòng.` Không có gì: `Sạch rồi. Ship.`

---

## 4. Debt ledger

```bash
grep -rnE '(#) ?ponytail:' --include="*.py" <path_plugin>
```

Output mỗi dòng: `<file>:<dòng>, <cái gì bị đơn giản hoá>. giới hạn: <ceiling>. nâng cấp khi: <trigger>.` Không tìm thấy: `Không có nợ ponytail.`

---

## 5. Scoreboard hiệu quả

Số liệu benchmark gốc (median 5 task mẫu, 3 model — không bịa số riêng cho plugin hiện tại):

```
  ponytail gain                     benchmark median · 5 tasks · 3 models
  Số dòng code    không dùng  ████████████████████  100%
                  ponytail    ██▌·················    6–20%   ▼ giảm 80–94%
  Chi phí         không dùng  ████████████████████  100%
                  ponytail    █████⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·⁠·   23–53%  ▼ giảm 47–77%
```

## 6. Bảng tra nhanh

Xem "Bản đồ trigger" ở đầu file.
