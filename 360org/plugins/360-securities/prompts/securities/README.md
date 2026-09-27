# 360org / Securities Skills

Danh mục chứa các skill bảo mật do AIaC quản lý.

## Skills hiện có

| Tên | Nguồn | Trigger |
|---|---|---|
| `wp-dev-skills` | `360org/skills/securities/wp-dev-skills` | WordPress dev/audit/hardening: "bị hack", "nhiễm mã độc", "500 error", "quét virus", "audit/scan WP site", "bịt lỗ hổng", phát triển theme/plugin/block/REST API |

## Quy tắc thêm skill mới

1. Skill phải có trigger rõ ràng (không overlap với skill khác).
2. Skill bảo mật nhạy cảm phải nằm trực tiếp trong repo AIaC; không map link ra `/Volumes/DATA/DEV/SKILLS`.
3. Cập nhật README này và `install-aiac.sh` khi thêm skill mới.
4. Chỉ đăng ký skill đã kiểm chứng trên production thật.
