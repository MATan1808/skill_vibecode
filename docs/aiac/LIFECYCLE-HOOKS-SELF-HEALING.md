# Lifecycle Hooks & Autonomous Self-Healing Pipeline

> Cơ chế bảo vệ thời gian thực và chu trình tự sửa lỗi tự động trong AIaC v3.x.

---

## 1. Cầu nối Vòng đời Hook (`aiac-hook-bridge.js`)

AIaC Hook Bridge tích hợp vào các lifecycle events của AI Client:

- **`PreToolUse` (Security Gating)**:
  * Ngăn chặn các câu lệnh nguy hiểm (`rm -rf /`, `mkfs`, leak credentials).
  * Chặn thao tác push/create repo public sang GitHub trái phép nếu chưa có lệnh từ Sếp.
- **`PostToolUse` (Quality Assurance & Formatting)**:
  * Tự động kích hoạt linter tương ứng với từng loại file vừa ghi (`odoo_linter.py`, `wpcs-linter`, `dart analyze`).
  * Ghi nhận log và cảnh báo nếu vi phạm quy chuẩn code.

---

## 2. Chu trình Tự sửa lỗi 3 Bước (Autonomous Self-Healing Loop)

Khi phát sinh lỗi kiểm thử hoặc build error trong quá trình thực thi, `AgentPipeline` tự động kích hoạt chu trình 3 bước:

```
+─────────────────────────────────────────────────────────────────────────────+
|                         Autonomous Self-Healing                             |
|                                                                             |
|  1. Observation    ──►   2. Hypothesis        ──►   3. Verification         |
|  (Bắt traceback,         (Phân tích Root-Cause      (Áp dụng bản vá         |
|   stdout/stderr)          theo Ponytail Rules)       & Re-test tự động)     |
+─────────────────────────────────────────────────────────────────────────────+
```

### Bước 1: Observation (Thu thập dữ liệu lỗi)
- Bắt trọn vẹn traceback, exit code và stderr từ sandbox provider.

### Bước 2: Hypothesis (Sinh giả thuyết sửa đổi)
- Đánh giá theo **Thang leo Ponytail (Climb the ladder)**:
  1. Kiểm tra lỗi cú pháp (SyntaxError, IndentationError).
  2. Kiểm tra phụ thuộc thiếu hoặc sai phiên bản.
  3. Kiểm tra quyền thực thi (Permission/Path).
  4. Sửa đúng nguyên nhân gốc rễ (Root cause), không vá phần ngọn (Symptom).

### Bước 3: Verification (Xác minh & Re-test)
- Tự động áp dụng bản vá tối giản (Shortest diff).
- Thực thi lại test suite để xác minh kết quả. Lặp lại tối đa 3 lần cho đến khi pass hoàn toàn.
