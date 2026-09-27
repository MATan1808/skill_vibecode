# 360-graphify Skill

Kỹ năng điều phối Code Knowledge Graph và Semantic AST Indexing cho Claude Code trong hệ thống AIaC.

## 1. Mục đích
- Tránh việc Agent phải quét ngang (grep/find) hoặc đọc lại toàn bộ file nguồn (`Read`) nhiều lần trên codebase lớn.
- Cho phép tra cứu quan hệ gọi hàm (`calls`), liên kết nhập xuất (`imports`), vị trí chính xác của Class/Function/Model và tính toán mức độ ảnh hưởng (blast radius) tức thì.

## 2. Lệnh & Cách sử dụng

### Trích xuất Index đồ thị mã nguồn (Code-only AST)
```bash
/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh extract <project-path> --code-only --output <project-path>/graphify-out
```

### Tra cứu quan hệ qua đồ thị
```bash
/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh query "<question>" --graph <project-path>/graphify-out/graph.json
```

### Kiểm tra các điểm nút chịu ảnh hưởng (Affected nodes / Blast radius)
```bash
/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh affected "<Symbol>" --graph <project-path>/graphify-out/graph.json
```

### Khởi chạy MCP Server cho dự án
Khai báo trong `.mcp.json` của dự án:
```json
{
  "mcpServers": {
    "graphify": {
      "command": "/Volumes/DATA/DEV/aiac/360org/plugins/360-graphify/scripts/graphify-run.sh",
      "args": ["serve", "<project-path>/graphify-out/graph.json"]
    }
  }
}
```
