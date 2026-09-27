# 360-Agent-Device Plugin

Plugin điều khiển, tự động hoá và kiểm thử ứng dụng trên thiết bị (iOS Simulator, Android Emulator, macOS Desktop App, Web và Thiết bị vật lý) cho AI Agent trong hệ sinh thái AIaC.

## Thành Phần
- `prompts/SKILL.md`: Đặc tả quy chuẩn, bảng tra cứu lệnh nhanh và 4 nguyên tắc vàng kiểm thử.
- `prompts/references/`: Hướng dẫn chuyên sâu cho từng nền tảng (iOS, Android, macOS, Verification Loop, Maestro CI/CD).
- `scripts/`: Công cụ CLI wrapper (`agent-device-run.sh`) và kiểm tra môi trường (`device-doctor.sh`).

## Kích Hoạt
Tự động kích hoạt khi có các trigger phrase:
- `agent-device`, `device test`, `test trên simulator`, `test trên emulator`, `ios simulator`, `android emulator`, `mobile test`, `app automation`...
