---
name: 360-wordpres-securities
description: WordPress security/audit/hardening cho CloudPanel: scan malware, IOC, clean backdoor, harden server/site. Không dùng cho dev theme/plugin thường.
---

# WordPress Securities

Dùng nhánh này cho audit, quét mã độc, hardening và incident response WordPress trên CloudPanel.

## Khi nào dùng

- Site WordPress bị hack, nhiễm mã độc, có webshell/backdoor/admin giả.
- Site 500/down nghi do malware, OOM, file lạ, DB injection, cron/plugin/theme giả.
- Cần audit/scan/clean/harden, kiểm tra log, storage, IOC, doorway SEO.
- Cần chạy các script trong `scripts/` hoặc đọc playbook cũ `wp-audit-website/`.

## Cấu trúc

```text
securities/
├── SKILL.md
├── README.md
├── WP_DEV_SECURITY_LEGACY.md   # nội dung security-heavy từ wp-dev-skills cũ, giữ để không mất feature
├── references/
├── scripts/
└── wp-audit-website/           # playbook audit website cũ giữ nguyên
```

## Bất biến production

1. Audit read-only trước.
2. Không hardening/cleanup ghi dữ liệu nếu chưa có lệnh rõ của Sếp.
3. Lưu working files/report/backup tạm trên server trong `/audit-work/`.
4. Sync evidence/backup/report về `/Volumes/DATA/WORDPRESS/`.
5. Dọn sạch `/audit-work/` sau khi sync.
6. Không xoá file mù; backup/quarantine evidence trước.
7. Dọn malware phải tìm root cause và bịt vector tái nhiễm.

## Scripts

- `scripts/audit.sh`: audit site read-only.
- `scripts/audit-ioc-fleet.sh`: quét IOC fleet.
- `scripts/audit-storage.sh`: kiểm tra dung lượng fleet/site.
- `scripts/audit-invalid-htdocs.sh`: kiểm tra docroot bất thường.
- `scripts/harden.sh`: hardening có ghi, chỉ chạy khi được Sếp duyệt.
- `scripts/fleet_malware_cleanup.sh`: cleanup fleet, cần xác nhận rõ.
- `scripts/remove-default-themes.sh`: xoá theme mặc định không dùng, có backup.
- `scripts/scan-server-wide.sh`, `scripts/scan-suspicious-root.sh`: quét server/root nghi ngờ.
- `scripts/wp-malware-scan.sh`: scanner production hằng ngày; có điều kiện giữ `.htaccess` hợp lệ do WPForms/Contact Form 7 sinh ra và chỉ xoá `.htaccess` mở quyền/bật PHP.
- `scripts/cleanup-macosx-license-readme.sh`: xoá `__MACOSX` và file fingerprint public của WordPress (`readme.html`, `license.txt`, `licencia.txt`) ở root/wp-admin/wp-includes, không xoá license trong plugin/theme/vendor để tránh lệch checksum.

## Tham khảo

- `references/cloudpanel-env.md`
- `references/interpreting-results.md`
- `references/malware-cleanup.md`
- `skills/wp-audit-hardening/SKILL.md`
- `wp-audit-website/SKILL.md`
- `WP_DEV_SECURITY_LEGACY.md`
