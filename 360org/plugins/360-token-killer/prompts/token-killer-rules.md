# 360 Token Killer — Zero-Waste Optimization Rules

Áp dụng quy tắc kiểm soát token nghiêm ngặt cho toàn bộ các công cụ và agent:

1. **Output Trimming & Sanitization**:
   - Khi chạy lệnh Bash, tuyệt đối không dùng `cat`, `head`, `tail`, `echo` để in file lớn. Dùng công cụ `Read` với `offset` và `limit` đúng phạm vi cần xem.
   - Khi chạy test hoặc build log, dùng grep/filter để chỉ giữ lại các dòng lỗi (traceback, ERROR, FAIL).

2. **AST & Slicing First**:
   - Tham chiếu `360-agent-map` để xác định chính xác số dòng của symbol trước khi đọc file.
   - Giới hạn đọc file tối đa 100-200 dòng quanh vị trí cần sửa. Không đọc tràn lan toàn bộ file nếu không cần thiết.

3. **Compact & Turn Efficiency**:
   - Hoàn thành tác vụ trong tối đa 2-3 turns. Tránh giao tiếp rườm rà.
   - Khi phát hiện context dài hoặc kết quả log quá lớn, kích hoạt `/compact` để làm sạch KV-cache.
