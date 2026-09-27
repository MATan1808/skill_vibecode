# Ma trận Thích ứng UI theo Nền tảng (Platform Adapters)

> **Nguyên tắc cốt lõi**: Mang thẩm mỹ cao cấp, design tokens, spacing, typography và a11y của `ui-ux-pro-max` vào mọi sản phẩm, nhưng **BẮT BUỘC 100% tuân thủ cấu trúc kỹ thuật và parser riêng của từng nền tảng**, tuyệt đối không gây lỗi cú pháp hay phá vỡ engine gốc.

---

## 1. Bảng ma trận chuyển đổi (Platform Adaptation Matrix)

| Nền tảng | Thẩm mỹ mang sang (Từ UI/UX Pro Max) | Ràng buộc kỹ thuật BẮT BUỘC (Host Platform) | Anti-Patterns (CẤM LÀM) |
|---|---|---|---|
| **Odoo (v14–v19)** | - Spacing hệ 4px/8px sạch sẽ<br>- Bảng dữ liệu (List view) high-density<br>- Màu trạng thái badge rõ ràng<br>- Form validation inline | - Bọc trong XML QWeb / OWL component chuẩn<br>- Dùng class `s_*` và `oe_structure` cho Website Building Blocks<br>- Kế thừa biến SCSS `$o-theme-*`<br>- Khai báo thuộc tính XML mới (`invisible`, `readonly`, `required`, không dùng `attrs=`) | - Inject HTML/JS trần phá vỡ OWL reactivity<br>- Viết XML sai cú pháp làm chết lxml parser<br>- Hardcode style inline làm mất khả năng kéo thả của Odoo Builder |
| **VuaAssistant / V-Assistant (Tauri macOS)** | - High-density dashboard<br>- Phối màu Dark Mode OLED/Slate sâu<br>- Micro-interaction mượt (150–200ms)<br>- Typography phân cấp sắc nét | - macOS Human Interface Guidelines (HIG)<br>- Chừa vùng drag titlebar (`data-tauri-drag-region`)<br>- Phím tắt macOS (`Cmd+...` thay vì `Ctrl+...`)<br>- Tối ưu DOM nhẹ, tránh tràn RAM Webview | - Dùng layout web cồng kềnh cho desktop app<br>- Mất focus bàn phím khi chuyển native window<br>- Nút bấm nhỏ hơn 32px trên desktop app |
| **WordPress (Avada / Fusion Builder)** | - Hero section typography ấn tượng<br>- Bento grid card layout<br>- Hiệu ứng chuyển động scroll nhẹ<br>- Tương phản màu chuẩn WCAG | - Xuất đúng shortcode Avada `[fusion_builder_container]`, `[fusion_text]`...<br>- CSS phải scoped vào custom class hoặc Avada Custom CSS<br>- Tương thích hoàn toàn với Fusion Page Builder kéo thả | - Viết thẻ `<div>` thô ngoài shortcode làm vỡ parser của Fusion Builder<br>- CSS đè làm vỡ header/footer của Avada Theme<br>- Dùng JS lạ xung đột với jQuery/Avada scripts |
| **Flutter / Mobile** | - Touch target chuẩn ≥ 44×44px<br>- Bottom sheet / Drawer vuốt mượt<br>- Spacing & safe-area bo góc chuẩn | - Dùng widget hierarchy chuẩn (`Theme.of(context)` / Design Tokens)<br>- Clean Architecture (tách Data / Domain / Presentation)<br>- Bọc `SafeArea`, check `context.mounted` sau async | - Hardcode pixel cố định không co giãn theo screen size<br>- Dùng emoji thay cho Vector Icons / Material Icons<br>- Nhồi nhét layout desktop vào màn hình dọc mobile |
| **Payload CMS + Next.js (360 CORP / vuaai.net)** | - Modern SaaS Landing Page<br>- Interactive component (Radix UI / shadcn)<br>- Dynamic theming / dark mode toggle | - Tailwind CSS utility-first<br>- React Server Component (RSC) vs Client Component (`'use client'`)<br>- Next.js Image component (tự tối ưu WebP/AVIF, tránh CLS) | - Dùng client component tràn lan làm mất SEO<br>- Layout shift do không set aspect-ratio/width-height cho ảnh<br>- Dùng CSS thuần không đồng bộ với Tailwind config |

---

## 2. Quy trình 4 bước khi sinh/sửa UI trên từng nền tảng

```
1. Nhận diện nền tảng đích (Odoo / Tauri / WordPress Avada / Next.js / Flutter)
   ↓
2. Lấy nguyên tắc thẩm mỹ từ references/ui-ux-rules.md (Màu, font, spacing, a11y)
   ↓
3. Dịch sang cú pháp/block chuẩn của nền tảng đó (XML QWeb, Avada Shortcode, Tauri JSX, Flutter Widget)
   ↓
4. Kiểm thử an toàn parser & runtime:
   - Odoo: Validate cú pháp XML/lxml không lỗi
   - WordPress: Đảm bảo shortcode render hợp lệ trong Avada
   - Tauri: Check macOS dark/light mode & native drag region
   - Web/Next.js: Check zero console error, zero CLS
```
