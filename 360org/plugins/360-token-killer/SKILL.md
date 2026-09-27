---
name: 360-token-killer
description: Zero-waste token sanitizer and context guard rules for AIaC sessions.
---

# 360 Token Killer

Dùng khi cần giảm log/context thừa trong Claude Code và các editor AI nối với AIaC.

## Quy tắc chính

- Không in file lớn bằng shell khi `Read` đủ dùng.
- Lọc log build/test theo lỗi thật: `ERROR`, `FAIL`, `Traceback`, stack trace.
- Đọc đúng lát cắt quanh symbol thay vì nạp toàn bộ file.
- Giữ kết quả tool đủ chứng cứ, không dump dữ liệu runtime/transcript.

## Hook

`hooks/post-tool-token-trimmer.js` chạy sau `Bash|Read` theo `plugin.json`.

## Reference

Xem `prompts/token-killer-rules.md` khi cần rule chi tiết.
