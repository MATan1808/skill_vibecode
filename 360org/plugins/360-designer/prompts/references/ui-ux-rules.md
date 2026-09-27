# UI/UX Intelligence Rules (360org)

Kế thừa các nguyên tắc thực chiến từ `ui-ux-pro-max-skill`, tinh gọn theo chuẩn **Ponytail** của 360org.

---

## 1. Bảng ưu tiên 10 tầng (Priority Ladder)

Tuân theo thứ tự 1 → 10 khi thiết kế hoặc review bất kỳ giao diện nào:

| Thứ tự | Tầng | Mức độ | Yêu cầu cốt lõi (BẮT BUỘC) | Anti-patterns (TRÁNH) |
|---|---|---|---|---|
| **1** | **Accessibility (a11y)** | CRITICAL | Tương phản tối thiểu 4.5:1, Alt text, Điều hướng bàn phím đầy đủ, `aria-label` cho icon button | Xoá focus ring (`outline: none`), icon button không có label |
| **2** | **Touch & Interaction** | CRITICAL | Kích thước chạm tối thiểu 44×44px, khoảng cách giữa các target ≥8px, feedback trạng thái loading/active | Phụ thuộc hoàn toàn vào hover, đổi trạng thái tức thì 0ms |
| **3** | **Performance** | HIGH | WebP/AVIF, Lazy loading ảnh, Đặt sẵn kích thước khung (CLS < 0.1) | Bố cục giật khi load ảnh (CLS), nạp toàn bộ ảnh cùng lúc |
| **4** | **Style Selection** | HIGH | Đúng phong cách sản phẩm (SaaS: clean/minimal; E-com: clear/product-first), icon SVG đồng nhất | Trộn lẫn flat và skeuomorphic, dùng emoji thay icon |
| **5** | **Layout & Responsive** | HIGH | Mobile-first breakpoint (sm/md/lg/xl), không bị thanh cuộn ngang, padding an toàn | Thanh cuộn ngang, fix cứng `width: Xpx`, khoá zoom viewport |
| **6** | **Typography & Color** | MEDIUM | Base font 16px, Line-height 1.5, Dùng semantic token (`--color-primary`) | Body text < 12px, chữ xám trên nền xám, dùng mã hex cứng trong component |
| **7** | **Animation & Motion** | MEDIUM | Thời gian chuyển cảnh có ngữ nghĩa (150–300ms), thoát nhanh hơn vào, hỗ trợ `prefers-reduced-motion` | Dùng cùng một duration cho mọi hiệu ứng, animate `width`/`height` (giật khung hình) |
| **8** | **Forms & Feedback** | MEDIUM | Label luôn nhìn thấy được (không chỉ dùng placeholder), báo lỗi ngay cạnh field, chia nhỏ form dài | Dùng placeholder thay label, báo lỗi dồn hết lên đầu trang |
| **9** | **Navigation** | HIGH | Nút Back hoạt động đúng ngữ cảnh, bottom nav tối đa 5 tab, hỗ trợ deep link | Quá nhiều mục menu cấp 1, nút Back đưa về sai trang |
| **10** | **Charts & Data** | LOW | Có chú giải (legend), tooltip rõ ràng, màu sắc phân biệt không chỉ bằng sắc độ | Chỉ dùng màu để phân biệt dữ liệu (người mù màu không đọc được) |

---

## 2. Design Dials — 3 thanh trượt điều chỉnh

Dùng 3 tham số này để định hình nhanh phong cách khi bắt đầu thiết kế mới:

| Dial | Thấp (1–3) | Vừa (4–7) — Mặc định | Cao (8–10) |
|---|---|---|---|
| **Variance** | Tối giản, đối xứng, tập trung nội dung | Cân bằng, hiện đại, bố cục rõ ràng | Phá cách, bất đối xứng, Bento Grid, đậm chất đồ hoạ |
| **Motion** | Tinh tế, chỉ đổi opacity/color (150ms) | Chuyển cảnh tiêu chuẩn, stagger list (200–300ms) | Biên đạo phức tạp, scroll-driven, pin element, split text |
| **Density** | Thoáng đãng (marketing, landing): spacing 24–96px | Tiêu chuẩn: spacing 16–64px | Đậm đặc (ERP, dashboard, data table): spacing 8–32px |

---

## 3. Quy chuẩn Font & Spacing cho 360org

### Font Scale (Chuẩn tỉ lệ 1.25 — Major Third)
```css
--text-xs:   0.75rem;  /* 12px - badge, caption */
--text-sm:   0.875rem; /* 14px - secondary text, table */
--text-base: 1rem;     /* 16px - body, input */
--text-lg:   1.125rem; /* 18px - lead, card title */
--text-xl:   1.25rem;  /* 20px - section subhead */
--text-2xl:  1.5rem;   /* 24px - modal title */
--text-3xl:  1.875rem; /* 30px - page title */
--text-4xl:  2.25rem;  /* 36px - hero headline */
```

### Spacing Scale (Hệ 4px)
```css
--space-1:  0.25rem; /* 4px */
--space-2:  0.5rem;  /* 8px */
--space-3:  0.75rem; /* 12px */
--space-4:  1rem;    /* 16px */
--space-6:  1.5rem;  /* 24px */
--space-8:  2rem;    /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

---

## 4. Pre-Delivery Checklist (Kiểm tra trước khi bàn giao UI)

- [ ] **Màu & Tương phản**: Tỉ lệ tương phản text/background ≥ 4.5:1 (đặc biệt dark mode)
- [ ] **Bàn phím & Focus**: Tất cả nút, link, input đều có focus ring rõ ràng khi dùng Tab
- [ ] **Touch Target**: Mọi element bấm được đều ≥ 44×44px (bao gồm padding)
- [ ] **Mobile Responsive**: Không có thanh cuộn ngang ở bất kỳ kích thước màn hình nào từ 375px trở lên
- [ ] **Loading & Error**: Mỗi trạng thái async đều có skeleton hoặc loading spinner, lỗi có nút retry
- [ ] **Form Validation**: Báo lỗi hiển thị ngay dưới ô input bị sai, focus tự động nhảy đến ô lỗi đầu tiên
- [ ] **Dark Mode**: Không có chữ đen trên nền tối hoặc chữ trắng trên nền sáng bị lẫn màu
