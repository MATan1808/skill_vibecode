# AIaC Multi-Agent Model Routing

Quy chuẩn phân mảnh model theo tác vụ để tối ưu hóa hiệu năng và chi phí. Sử dụng tính năng Agent Tool native của hệ thống với tham số model chính xác.

| Vai trò | Phân loại | Tên Model định tuyến trên AI Router |
| --- | --- | --- |
| **Reviewer / Planner** | Lên kế hoạch, khảo sát, ý tưởng | `Claude-Pro-Pack` |
| **Coder / Fixer** | Sinh mã nguồn, vá lỗi, fix bug, chạy test | `antigrafity-claude-3.8-flash` |
| **Architect / Verifier**| Duyệt cuối (VIP), nghiệm thu bảo mật Odoo | `claude-VIP` |

## Cách điều phối (Agent Dispatching)

Khi dùng Pipeline `agent()`, hệ thống sẽ truyền trực tiếp ID Model lên AI Router:

### 1. Code / Fix bug
```javascript
agent("Sửa lỗi và sinh mã nguồn Odoo module", { role: "code" })
// Workflow Engine sẽ tự động map role "code" thành chuỗi "antigrafity-claude-3.8-flash"
```

> **Lưu ý cấu hình Claude Desktop App:**
> Nếu bị lỗi `model_not_found` khi gọi subagent, Sếp cần vào màn hình **Configure third-party inference** > cuộn xuống phần **MODELS** > tắt `Model discovery` (tùy chọn) và bấm **`+ Add model`** để thêm thủ công 3 ID trên vào Model list. Việc này giúp Claude Desktop nhận diện các ID này là hợp lệ và không tự ý chặn request trước khi gửi lên AI Router.
