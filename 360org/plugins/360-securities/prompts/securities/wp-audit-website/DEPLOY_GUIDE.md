# Hướng dẫn Triển khai (DEPLOY_GUIDE.md)

Tài liệu hướng dẫn cài đặt và tích hợp skill `wp-audit-website` vào hệ thống AIaC/Claude Code.

---

## 1. Phân quyền thực thi Scripts local
Trước khi chạy, cần đảm bảo toàn bộ các script local trên iMac có quyền thực thi:
```bash
chmod +x /Volumes/DATA/DEV/SKILLS/wp-audit-website/scripts/*.sh
```

---

## 2. Liên kết vào Claude Code (Symlink Registration)
Để Claude Code nhận diện được skill này khi Sếp ra lệnh, thực hiện tạo liên kết tượng trưng (symlink):
```bash
ln -s /Volumes/DATA/DEV/SKILLS/wp-audit-website ~/.claude/skills/wp-audit-website
```

---

## 3. Cấu hình SSH CloudPanel
Để các script kết nối trực tiếp đến server mà không cần hỏi password, Sếp cần đảm bảo file `~/.ssh/config` có alias `cloudpanel`:
```text
Host cloudpanel
     HostName 15.235.229.7
     User root
     Port 22
     IdentityFile ~/.ssh/imac
```
Kiểm tra kết nối SSH trước khi chạy:
```bash
ssh cloudpanel 'uptime'
```
