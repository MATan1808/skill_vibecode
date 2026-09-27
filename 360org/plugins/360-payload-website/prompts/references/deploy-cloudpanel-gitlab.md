# Deploy: Dev Docker → GitLab CI/CD → CloudPanel Native

## Sơ đồ luồng

```
Local Mac (docker compose up)
   │ git push develop        → CI: LINT only
   │ git push 1.0-dev        → CI: lint + build Docker image → GitLab Registry
   ▼
merge *-dev / develop → main → CI: SSH cloudpanel → native deploy + pm2 reload
```

- `develop` = **lint only** (không build image, không deploy) — commit thoải mái.
- `*-dev` (vd `1.0-dev`) = **build Docker image** push GitLab Container Registry (chỉ để dev nhanh, không dùng cho prod).
- `main` (protected) = **deploy native CloudPanel** — repo prod chạy Node/PM2, KHÔNG Docker.

## Dev local (Mac — KHÔNG cài Node native)

```bash
cp .env.example .env
openssl rand -hex 32   # gán PAYLOAD_SECRET, CRON_SECRET, PREVIEW_SECRET
docker compose up      # → http://localhost:3001 (host map 3001:3000)
```
Xem template `templates/docker-compose.yml`. Container Node 22 Alpine, SQLite ở volume `sqlite_data`, hot reload qua bind mount.

## Production CloudPanel (native, một lần setup)

1. **Node 20 LTS** qua nvm (server cũ hay dính Node 18 — Payload 3.85 cần ≥20.9):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   nvm install 20 && nvm alias default 20
   corepack enable && corepack prepare pnpm@9 --activate
   ```
2. **Clone repo** vào `/home/<site>/htdocs/<domain>` (CloudPanel site root).
3. **`.env` production** + `pnpm install --frozen-lockfile=false && pnpm build`.
4. **PM2 cluster** — xem `templates/ecosystem.config.cjs`:
   ```bash
   mkdir -p /home/<site>/logs
   pm2 start ecosystem.config.cjs && pm2 save
   pm2 startup systemd -u root --hp /root   # chạy lệnh nó in ra
   ```
5. **nginx reverse proxy** (CloudPanel UI → Sites → domain → Vhost, block `server`):
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
       proxy_read_timeout 300;
       client_max_body_size 50M;
   }
   location /_next/static/ {
       proxy_pass http://127.0.0.1:3000;
       proxy_cache_valid 200 365d;
       add_header Cache-Control "public, max-age=31536000, immutable";
   }
   ```
6. **SSL Let's Encrypt:** `clpctl lets-encrypt:install:certificate --domainName=<domain>` (hoặc UI).
7. **Super admin:** mở `https://<domain>/admin` → "Create first user".

## CI/CD GitLab — biến cần set (Settings → CI/CD → Variables, masked+protected)

| Biến | Giá trị |
|---|---|
| `SSH_PRIVATE_KEY` | deploy key (ed25519) pair với `~/.ssh/authorized_keys` trên server |
| `KNOWN_HOSTS` | output `ssh-keyscan <server-ip>` |
| `SERVER_HOST` | IP CloudPanel |
| `SERVER_USER` | user deploy (vd `root`) |
| `DEPLOY_PATH` | `/home/<site>/htdocs/<domain>` |

Pipeline: xem `templates/gitlab-ci.yml`. Stage `deploy-production` chỉ chạy trên `main`, SSH vào server chạy: `git reset --hard origin/main → pnpm install → generate:importmap → build → pm2 reload`.

## Manual deploy khẩn cấp

```bash
ssh cloudpanel "cd /home/<site>/htdocs/<domain> && git pull && pnpm install --frozen-lockfile=false && pnpm build && pm2 reload <appname>"
```

## Backup SQLite (cron daily)

```bash
0 2 * * * cp /home/<site>/htdocs/<domain>/app.db /home/<site>/backups/app-$(date +\%Y\%m\%d).db
```
Giữ 30 ngày.
