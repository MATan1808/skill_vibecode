---
name: 360-codegraph
description: Tra cứu cấu trúc, luồng gọi và phạm vi ảnh hưởng trong codebase lớn bằng CodeGraph local-first; chỉ bật theo project sau khi index được kiểm chứng.
metadata:
  origin: 360org
  upstream: https://github.com/colbymchenry/codegraph
---

# 360org — CodeGraph

Dùng CodeGraph để thay thế chuỗi Grep/Read rộng khi cần hiểu **cấu trúc**, **call flow**, **caller/callee**, **blast radius** hoặc chọn test bị ảnh hưởng trong codebase lớn. Tool chạy local, index nằm tại `[project]/.codegraph/` và không cần API key.

## Khi dùng

Dùng cho câu hỏi như:

- “Luồng request này đi đến database thế nào?”
- “Sửa hàm/model/component này ảnh hưởng đâu?”
- “Caller nào gọi symbol này?”
- “Test nào nên chạy sau diff này?”
- Khảo sát area lớn trước khi sửa code.

Không dùng cho:

- Một tệp/hàm đã biết rõ, có thể đọc trực tiếp ngắn hơn.
- Nội dung runtime không thể suy ra tĩnh (data trong DB, network response, reflection chưa có resolver).
- Thay thế test, review, input validation hay kiểm chứng live/native.

## Cài đặt do AIaC quản lý

AIaC ghim release/checksum tại `config/codegraph/release.json` và cài **không chạy installer upstream**:

```bash
bash scripts/aiac/install-codegraph.sh
```

Cài đặt này không thêm MCP, permission, prompt hook, telemetry hay sửa `CLAUDE.md`. Telemetry luôn tắt ở cấu hình MCP AIaC.

## Kích hoạt theo project

Không bật toàn cục để tránh tốn process/context cho mọi repo. Chỉ khởi tạo khi project đủ lớn hoặc câu hỏi thực sự cần graph:

```bash
CODEGRAPH_TELEMETRY=0 codegraph init
```

Kiểm tra index:

```bash
CODEGRAPH_TELEMETRY=0 codegraph status
```

Kết quả index `.codegraph/` là cache local, không commit trừ khi project có quyết định khác.

## Dùng CLI trước khi có MCP

```bash
CODEGRAPH_TELEMETRY=0 codegraph explore "luồng xác thực đi từ route đến service thế nào?"
```

```bash
CODEGRAPH_TELEMETRY=0 codegraph impact "AuthService.login"
```

```bash
git diff --name-only | CODEGRAPH_TELEMETRY=0 codegraph affected --stdin
```

CLI là lựa chọn an toàn mặc định: đầu ra chỉ vào phiên hiện tại, không thay Claude Code config.

## MCP project-local (chỉ khi cần lặp lại)

Sau khi `codegraph init` thành công và đã xác nhận project cần truy vấn lặp lại, dùng catalog AIaC để merge vào `[project]/.mcp.json` mà vẫn giữ nguyên MCP server khác:

```bash
node scripts/aiac/merge-project-mcp.js --server codegraph --project /đường/dẫn/project
```

Catalog nằm tại `config/mcp/catalog.json`, không chứa secret và không tự thêm `mcp__codegraph__*` vào permission global. Chỉ cấp quyền theo cơ chế Claude Code khi Sếp đã xem được tool và phạm vi hoạt động.

## Kỷ luật token

- Gọi `codegraph_explore` trực tiếp cho câu hỏi structure/flow thay vì nhờ subagent đọc file tuần tự.
- Đọc output như source đã đọc; chỉ mở file trực tiếp nếu CodeGraph báo stale hoặc output thiếu dữ kiện.
- Với phiên dài, yêu cầu kết quả hẹp theo symbol/flow; tool có thể trả source dense và làm context resident tăng.
- Bản `.claude/codegraph.md` của AIaC là overview cực nhỏ; CodeGraph là index semantic đầy đủ. Hai thứ bổ sung, không thay nhau.

## Kiểm chứng tối thiểu

```bash
CODEGRAPH_TELEMETRY=0 codegraph status
```

```bash
CODEGRAPH_TELEMETRY=0 codegraph explore "<symbol hoặc luồng cần khảo sát>"
```

Nếu index không có hoặc lỗi, quay về Read/Grep thông thường; không coi CodeGraph là nguồn chân lý duy nhất.
