# REQUIREMENTS — AI Infrastructure as Code (AIaC)

Yêu cầu sản phẩm cho AIaC, tối ưu cho Claude Code và các mảng công việc chính của Sếp: Odoo, V-Assistant, Flutter, Hermes, OpenClaw và website 360 CORP.

## 1. Yêu cầu nền tảng

- Claude Code là harness vận hành duy nhất.
- AIaC kế thừa ECC core và phải giữ khả năng cập nhật upstream mà không làm hỏng namespace `360org`.
- Mọi rule toàn cục đã xây phải được kế thừa/tái cấu trúc, không được rút gọn làm mất yêu cầu vận hành, bảo mật hoặc kiểm chứng.
- Không commit secret, API key hoặc cấu hình cá nhân.

## 2. Cấu hình Claude Code kế thừa

- Installer phải merge `settings.overlay.json` vào global `settings.json` theo cách idempotent.
- Không được thay hoặc xóa model, permissions, MCP, plugin, hook, `skillOverrides`, `settings.local.json` hay skill không thuộc `360-*`.
- AIaC chỉ sở hữu `360org/**`, các namespace skill `360-*`, Global `CLAUDE.md`, overlay settings và script installer/merge.
- Project-local generator chỉ được tạo file thiếu; file đã tồn tại phải được giữ nguyên.

## 3. Tự động hóa zero-command có kiểm soát

- Nhận diện Odoo, V-Assistant, Flutter, Hermes, OpenClaw/360 Web bằng dấu hiệu workspace.
- Tạo profile cục bộ, rules cục bộ, agent-map và codegraph cache để agent có điểm khởi đầu ngắn gọn.
- Không tự kích hoạt tác vụ ghi dữ liệu, deploy, cài plugin, thêm MCP, cấp quyền hay gửi dữ liệu sang dịch vụ ngoài.
- Tự cập nhật chỉ được phép khi worktree AIaC sạch và fast-forward được; không `pull` vào repo bẩn.

## 4. Hiệu suất token và context

- Không nạp nguyên `SKILL.md` lớn vào mọi SessionStart.
- Bắt buộc giới hạn context AIaC, agent-map và codegraph; chỉ đọc reference/skill đầy đủ theo nhu cầu công việc.
- Agent-map phải map symbol/domain/hotspot nhẹ bằng stdlib, không DB/daemon/MCP, để tránh đọc rộng và tránh viết trùng.
- Chỉ biểu diễn dependency cục bộ resolve được; loại vendor/build/cache/package ngoài.
- Với codebase lớn, hỗ trợ CodeGraph semantic local-first để truy vấn symbol/call flow/impact/affected test thay vì khám phá tệp tuần tự; chỉ index/bật MCP theo project.
- Tận dụng lifecycle có sẵn của ECC cho session summary, observation, instinct, learned skill, token/cost tracking và compaction; không dựng hệ nhớ trùng lặp.

## 5. Học và mở rộng kỹ năng

- AIaC phải ghi nhận tri thức theo project qua lifecycle ECC và hồ sơ `.claude/aiac/`.
- Khi thiếu capability, agent phải kiểm tra kho skill hiện có, nghiên cứu nguồn đáng tin, tạo draft cục bộ và kiểm chứng giá trị lặp lại trước khi đưa vào AIaC.
- Không tự động cài plugin hoặc biến draft chưa kiểm chứng thành global skill.
- Mọi skill mới phải có nguồn, phạm vi, dependency, hướng dẫn dùng, kiểm thử và quyết định chống trùng lặp.

## 6. Kiểm chứng bắt buộc

- Agent-map có self-check cho Odoo, WordPress và V-Assistant.
- Codegraph có self-check cho JS/TS, Python và Dart package import.
- Router có self-check cho Odoo detection, JSON hook payload, project config không dùng field tùy ý, agent-map và codegraph lần đầu.
- Installer/merge phải kiểm tra cú pháp và fixture preservation.
- V-Assistant, Odoo SaaS và production vẫn tuân thủ toàn bộ quy tắc native verification, worktree, SSH/Kubernetes và backup trong Global CLAUDE.md.
