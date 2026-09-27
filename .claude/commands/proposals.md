---
description: Xem danh sách đề xuất bài học tự học (AutoHarness) và phê duyệt / từ chối trước khi áp dụng vào AIaC.
---

# /proposals — Quản Lý & Duyệt Đề Xuất Bài Học Tự Học (AutoHarness)

Lệnh quản lý hàng đợi các bài học, quy chuẩn và bẫy lỗi do AutoHarness tự động chắt lọc trong các phiên làm việc.
**Toàn bộ bài học chỉ được áp dụng vào AIaC khi có sự phê duyệt của Sếp (Approval Gate).**

## Cú pháp sử dụng

```text
/proposals                  # Liệt kê danh sách các bài học đang chờ duyệt
/proposals list             # Liệt kê chi tiết danh sách đề xuất
/proposals approve all      # Phê duyệt toàn bộ đề xuất và áp dụng vào plugin tương ứng
/proposals approve <id>     # Phê duyệt một bài học cụ thể theo mã ID
/proposals reject all       # Từ chối toàn bộ đề xuất đang chờ
/proposals reject <id>      # Từ chối một đề xuất cụ thể theo mã ID
```

## Lệnh thực thi trực tiếp bằng Bash

```bash
node /Volumes/DATA/DEV/aiac/360org/plugins/360-harness/scripts/aiac-auto-distiller.js list
```
