# Gotchas — Lỗi đã gặp & cách sửa (ĐỌC TRƯỚC KHI DEBUG)

Tất cả đã xảy ra thật khi build vuaai.net. Gặp lại → áp dụng ngay, đừng debug lại từ đầu.

## 1. ESLint 9 crash: "Converting circular structure to JSON"

**Triệu chứng:** `pnpm lint` fail với `TypeError: Converting circular structure to JSON ... property 'react' closes the circle`, exit code 2. Xảy ra trên CI lẫn local.

**Nguyên nhân:** `@eslint/eslintrc@3.3.5` cố `JSON.stringify` config để validate; `FlatCompat` wrap `next/core-web-vitals` → `eslint-plugin-react` tạo circular reference.

**Fix:** pin `@eslint/eslintrc` xuống `3.2.0` qua `pnpm.overrides` trong `package.json`:
```json
"pnpm": {
  "overrides": { "@eslint/eslintrc": "3.2.0" }
}
```
Không cần đổi `eslint.config.mjs`.

## 2. develop branch vô tình build image / deploy

**Triệu chứng:** push `develop` mà CI chạy cả build-image (tốn thời gian, tốn registry).

**Fix:** trong `.gitlab-ci.yml`, rule của `build-image` chỉ để `/-dev$/`, KHÔNG để `develop`. `develop` chỉ nằm trong rule của job `lint`. Xem `templates/gitlab-ci.yml`.

## 3. Node version mismatch trên server

**Triệu chứng:** `pnpm install`/`build` fail, Payload báo cần Node ≥18.20.2 hoặc ≥20.9.0. Server CloudPanel cũ hay có Node 18.19.x.

**Fix:** nvm install Node 20 LTS, `nvm alias default 20`. CI job deploy phải `nvm use 20` trước khi build (đã có trong template).

## 4. Docker port conflict local

**Triệu chứng:** cổng 3000 bận trên Mac.

**Fix:** `docker-compose.yml` map `3001:3000` (host 3001 → container 3000). Truy cập `http://localhost:3001`. (Đây là lý do template dùng 3001.)

## 5. Quên `output: 'standalone'`

**Triệu chứng:** PM2/standalone build thiếu file, `next start` lỗi.

**Fix:** giữ `output: 'standalone'` trong `next.config.ts` — KHÔNG xóa. Cần cho cả Docker image lẫn native build.

## 6. TS lỗi "BlockName không tồn tại" sau khi thêm block

**Nguyên nhân:** quên regenerate types.

**Fix:** `pnpm generate:types` sau mỗi lần đổi schema/thêm block. Import interface từ `@/payload-types`.

## 7. Package manager lẫn lộn (npm/yarn/pnpm)

**Quy tắc cứng:** chỉ dùng **pnpm 9 qua corepack**. Template gốc Payload có thể ref `yarn` — chuẩn hoá về pnpm. Trên Mac không cài pnpm native, luôn qua container (`corepack enable` trong compose command).

## 8. Naming thương hiệu & ẩn "Odoo" ở marketing copy

- Tên thương hiệu viết liền: `VuaAI`, `VuaHệThống` (không space) trong nội dung; chỉ tách `Vua AI` ở tiêu đề lớn nếu cần.
- Marketing-facing copy **không lộ "Odoo"** — gọi VuaHệThống là "Cloud Enterprise / ERP-CRM toàn diện". Chỉ nhắc Odoo ở tài liệu kỹ thuật nội bộ.

## 9. Domain VuaBranding

`vuasangtao.com` (KHÔNG phải `vuabranding.net`). Dễ ghi nhầm trong footer/ecosystem.

## 10. Build phải làm LOCAL trước rồi mới push

Không SSH vào server build tay. Luôn: build/test local (container) → commit → push → CI/CD lo phần deploy. Không sửa code trực tiếp trên prod.
