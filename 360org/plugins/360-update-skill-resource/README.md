# 360-update-skill-resource

Audit-first workflow để theo dõi upstream và nâng cấp thủ công, có chọn lọc cho các plugin AIaC.

## Entry points

- Plugin manifest: `plugin.json`
- Prompts:
  - `prompts/updater-standards.md`
- Hooks: không khai báo

## Ghi chú vận hành

- Giữ tài sản plugin trong repo AIaC; không trỏ sang đường dẫn máy cá nhân.
- Kho nguồn ngoài AIaC chỉ dùng để pull và review; không phải runtime dependency.
- Viết báo cáo audit trước, port capability tối thiểu, thêm regression test rồi mới cập nhật changelog/version.
- Không sync mù, không tự cài, không tự commit hoặc push.
- Không commit dữ liệu runtime, cache, transcript hoặc secret.
