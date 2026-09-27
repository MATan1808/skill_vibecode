# Design System Architecture (360org)

Kế thừa mô hình token 3 tầng từ `ui-ux-pro-max-skill`, tương thích với Tailwind CSS và shadcn/ui.

---

## 1. Mô hình Token 3 Tầng (Three-Layer Structure)

```
Primitive Tokens (Giá trị thô - Hex/Pixel)
       ↓
Semantic Tokens (Tên theo mục đích sử dụng)
       ↓
Component Tokens (Tên gắn với từng UI element)
```

### Ví dụ ánh xạ:

```css
/* Layer 1: Primitive (Không dùng trực tiếp trong code giao diện) */
--color-brand-blue-500: #3b82f6;
--color-brand-blue-600: #2563eb;
--color-brand-blue-700: #1d4ed8;
--color-neutral-100:    #f3f4f6;
--color-neutral-900:    #111827;

/* Layer 2: Semantic (Dùng làm biến chủ đạo toàn app) */
--color-primary:        var(--color-brand-blue-600);
--color-primary-hover:  var(--color-brand-blue-700);
--color-bg-base:        #ffffff;
--color-bg-surface:     var(--color-neutral-100);
--color-text-main:      var(--color-neutral-900);
--color-text-muted:     #6b7280;

/* Layer 3: Component (Dành riêng cho component phức tạp) */
--btn-primary-bg:       var(--color-primary);
--btn-primary-hover:    var(--color-primary-hover);
--card-bg:              var(--color-bg-base);
--card-border:          #e5e7eb;
```

---

## 2. Thiết lập Tailwind CSS + shadcn/ui cho dự án

Khi khởi tạo UI trong Next.js / Vite / Nuxt:

```bash
# Cài đặt shadcn/ui
npx shadcn@latest init

# Thêm các component cốt lõi
npx shadcn@latest add button card dialog form input select table toast
```

---

## 3. Quản lý Dark Mode với CSS Variables

Luôn định nghĩa cặp biến tương ứng giữa `:root` và `.dark`:

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --border-color: #e2e8f0;
}

.dark {
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border-color: #1e293b;
}
```

---

## 4. Quản lý Thư viện Icon & Vector UI

Khi triển khai icon hoặc asset vector trong UI:

1. **Nguồn chuẩn**: Tra cứu tại [SVGRepo](https://www.svgrepo.com/) hoặc bộ icon mã nguồn mở (Lucide, Tabler, Heroicons).
2. **Quy tắc**:
   - Sử dụng vector thủ công sạch, nhẹ (< 5 KB/icon).
   - Tinh chỉnh SVG: thay màu cứng bằng `currentColor` hoặc token semantic (`var(--color-primary)`).
   - Tuyệt đối KHÔNG auto-trace ảnh raster sang SVG vì sinh ra hàng nghìn điểm kiểm soát gây nặng DOM.

