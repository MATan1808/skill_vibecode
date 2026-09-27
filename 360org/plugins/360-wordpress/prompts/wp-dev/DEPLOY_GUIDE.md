# DEPLOY GUIDE — WordPress Dev

## Cài skill

Skill được đăng ký qua `360-wordpres`, không link trực tiếp `wp-dev`:

```bash
bash /Volumes/DATA/DEV/aiac/install-aiac.sh
```

## Sử dụng

- Claude Code load `360-wordpres` khi workspace có `wp-config.php` hoặc `wp-content`.
- Với dev/fix bug, đọc `wp-dev/SKILL.md`.
- Với security/audit/malware/hardening, đọc `securities/SKILL.md`.

## Kiểm tra dev tối thiểu

```bash
php -l path/to/file.php
```

Chỉ chạy trên file đã sửa. Nếu không có PHP CLI hoặc môi trường local, ghi rõ đã skip và lý do.
