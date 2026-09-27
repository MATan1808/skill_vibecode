# Kiểm duyệt SKILL_SOURCES — 2026-09-03

## Phạm vi

- Nguồn tham chiếu: 67 Git repository trong `/Volumes/DATA/DEV/SKILL_SOURCES/`.
- Quy mô đã lập chỉ mục: 111.274 file, 29.093 file Markdown và 9.417 `SKILL.md`.
- AIaC đối chiếu: 28 plugin trong `/Volumes/DATA/DEV/aiac/360org/plugins/`.
- `SKILL_SOURCES` chỉ là nguồn nghiên cứu. Không có file runtime, hook, plugin hoặc manifest vận hành nào của AIaC được phụ thuộc đường dẫn local này.

## Trạng thái cập nhật nguồn

Các repository sạch có upstream đã được cập nhật bằng `git pull --ff-only`. Ba repository có thay đổi local được giữ nguyên, không reset/stash/pull:

- `Odoo-dev`
- `odoo-dev-skills`
- `vuaoffice-dev-skills`

## Quy tắc tích hợp

1. Không clone, rsync hoặc copy nguyên upstream vào runtime AIaC.
2. Mọi nâng cấp plugin là manual-selective: đọc diff, chọn capability, port tối thiểu, review bảo mật và chạy regression.
3. Runtime chỉ dùng nội dung đã đóng gói trong `360org/plugins/*`.
4. Manifest chỉ lưu provenance bất biến (repository, commit/version đã review và commit/version đã tích hợp), không lưu đường dẫn `/Volumes/DATA/DEV/SKILLS/*` hoặc `/Volumes/DATA/DEV/SKILL_SOURCES/*`.
5. Không tự commit, push, cài MCP, bật telemetry hoặc thay permission trong quy trình audit.

## Đánh giá và quyết định

| Nguồn | Delta đã review | Hiện trạng AIaC | Quyết định |
|---|---:|---|---|
| Graphify | `v0.9.48..v0.9.53`, 109 commit | `360-graphify` đang dùng core `0.9.48` | Chấp nhận có chọn lọc các sửa lỗi quan hệ kế thừa Go/C#/Kotlin/Scala/PHP/JS; không nhập toàn bộ CLI, installer, watch, export và dependency mới trong vòng này. |
| Ponytail | `v4.9.0-3-g2ed6c52`, 4 commit mới | AIaC có router zero-command và rules riêng | Không copy adapter/marketplace. Giữ behavior AIaC; cập nhật provenance và làm rõ version upstream khác package version. |
| Caveman | 240 commit mới, upstream `3b74643` | AIaC dùng prompt/rule/context discipline chọn lọc | Không nhập proxy/runtime/cache engine. Giữ plugin gọn; chỉ theo dõi các nguyên tắc fail-closed và validate-before-write cho vòng sau. |
| ECC | 216 commit mới, HEAD `22e8cf01` | AIaC fork/overlay có thay đổi riêng | Chưa merge trong vòng plugin upgrade này. Cần một audit ECC riêng vì ảnh hưởng installer, hook và toàn bộ test matrix. |
| Agent Browser | `v0.36.0`, 19 commit mới | `360-agent-browser` là adapter độc lập | Chưa nâng binary/runtime; ghi nhận WebMCP thử nghiệm và hardening origin để review riêng. |
| Flutter plugins | 6 commit mới | `360-flutter` đã có rule riêng | Chấp nhận bổ sung nguyên tắc proactive hot reload ở vòng sau; không nhập bộ plugin chính thức nguyên khối. |
| TencentDB Agent Memory / claude-mem | 11 / 132 commit mới | AIaC dùng ECC unified-memory | Từ chối thêm memory subsystem song song. Chỉ tham khảo cache-miss recovery và task-optional identity. |
| Headroom | 133 commit mới | AIaC có Caveman/token controls | Từ chối runtime compression phụ thuộc ngoài; ghi nhận circuit breaker khi AST compression liên tục sinh syntax lỗi. |
| OpenSpec / spec-kit | 163 / 542 commit mới | `360-dev-workflow` đã có quy trình spec | Không vendor nguyên bộ. Ghi nhận findings-only validation, archive delta preview và bảo vệ incomplete plan. |
| WordPress sources | `wp-audit-website` mới nhất; WordPress Playground + WPCS có delta | `360-securities` và `360-wordpress` đã chứa audit/hardening | Không thay runtime trong vòng này; không phát hiện capability P0 còn thiếu. |

## Phạm vi nâng cấp được chấp nhận

### P0 — Governance nguồn

- Thay manifest path-based bằng provenance manifest không phụ thuộc máy.
- Đổi `360-update-skill-resource` từ auto-sync/auto-push sang audit + manual-selective upgrade.
- Bổ sung gate chống runtime reference tới hai kho nguồn ngoài AIaC.

### P0 — Graphify parser correctness

Port thủ công các bản vá upstream sau:

- `588dc04`: không xem Go interface type-set constraint là embedded type.
- `9aeade7`: C# interface base phải là `inherits`, không phải `implements`.
- `c361189`: chuẩn hóa Kotlin qualified supertype.
- `bf385a5`: chuẩn hóa Scala qualified heritage.
- `88f5396`: nhận diện PHP interface/enum/trait như class-like heritage node.
- `6b2dfa0`: tạo inheritance edge cho JavaScript `class extends`.

Không port `43e63b1` trong vòng này vì Robot Framework chưa nằm trong capability mục tiêu của AIaC.

## Tiêu chí nghiệm thu

- Không còn runtime/config reference tới `/Volumes/DATA/DEV/SKILLS/*` hoặc `/Volumes/DATA/DEV/SKILL_SOURCES/*` trong manifest và plugin updater.
- Graphify regression pass cho Go, C#, Kotlin, Scala, PHP và JavaScript inheritance.
- Toàn bộ test plugin/manifest liên quan pass.
- `VERSION`, package version và `docs/CHANGELOGS.md` được đồng bộ sau khi verification hoàn tất.
