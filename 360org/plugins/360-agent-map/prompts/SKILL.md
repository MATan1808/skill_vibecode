---
name: 360-agent-map
description: Lightweight project map cho Claude Code; tự sinh trong SessionStart để chọn file/symbol trước khi đọc sâu hoặc sửa code.
---

# 360 Agent Map

Dùng `360-agent-map` làm lớp index mặc định trước khi code/audit/fix bug/fix feature.

## Khi nào dùng

- Mọi task code không chỉ rõ đúng một file/hàm nhỏ.
- Audit module/project, trước khi đọc rộng.
- Fix bug có nhiều caller/file hoặc có nguy cơ sửa symptom.
- Thêm feature cần biết module/component/model nào đã có.

## File sinh tự động

```text
[project]/.claude/aiac/index/agent-map.md
[project]/.claude/aiac/index/agent-map.json
[project]/.claude/aiac/index/domain-graph.json
[project]/.claude/aiac/index/feature-map.json
[project]/.claude/aiac/index/checksums.json
```

## Quy tắc làm việc

1. Đọc `agent-map.md` trước để chọn hotspot/file/symbol.
2. Tìm khả năng tái dùng trước khi tạo helper/class/function mới.
3. Nếu cần flow/caller/callee/impact hoặc audit lớn, dùng `360-codegraph` deep mode.
4. Nếu bug fix fail 2 lần, lần 3 bắt buộc dừng vá symptom, dùng CodeGraph/RCA rồi mới sửa.
5. Sau thay đổi có ý nghĩa, cập nhật `feature-map.json` hoặc để SessionStart sau sinh lại map.

## Phạm vi parser

- Generic: Python, JS/TS, Dart, PHP, Rust class/function/component.
- Odoo: `_name`, `_inherit`, fields, controller route, XML record/menu, security CSV.
- WordPress: action/filter/shortcode/CPT/taxonomy/REST route.
- V-Assistant: React component, Tauri `invoke`, Rust `#[tauri::command]`.

## Giới hạn

`360-agent-map` không thay thế test, review, runtime log hoặc CodeGraph semantic. Nó là bản đồ chọn đúng điểm đọc/sửa để tiết kiệm token.
