# Layouts — kích thước & bố cục theo loại ấn phẩm

Tất cả `product` key khớp với `product_sizes_px_300dpi` trong `resources/defaults.json`.
Nguyên tắc chung: hero headline lớn, nhiều khoảng trắng, chia khối rõ, hierarchy mạnh, không nhồi text. Nền sáng/sạch, thanh liên hệ xanh primary ở đáy.

## Khi prompt cho AI tạo nền
Luôn thêm: `no text, no words, no letters, no logo`. Mô tả nền chừa vùng trống đúng theo bố cục bên dưới để chữ không đè lên chi tiết rối.

| product | dùng cho | tỉ lệ | vùng chừa trống cho AI nền |
|---|---|---|---|
| `standee_60x160` | standee nhỏ | dọc cao | chừa 1/3 trên cho logo+headline, đáy cho contact |
| `standee_80x180` | standee lớn sự kiện | dọc cao | như trên, visual ngành ở giữa/phải |
| `poster_a3` / `poster_a2` | poster in | dọc A | hero trên, visual dưới giữa, contact đáy |
| `facebook_cover` | cover FB (820x312) | ngang rộng | chữ bên trái, visual bên phải; tránh vùng avatar góc trái dưới |
| `social_post` | post vuông 1080 | vuông | headline trên/giữa, CTA dưới, visual nền nhẹ |
| `social_story` | story/reel 9:16 | dọc | headline giữa trên, CTA dưới, chừa mép an toàn |
| `banner_web` | hero website | ngang | chữ trái, visual phải |
| `backdrop_4x2_5m` | backdrop sự kiện | ngang lớn | logo + tiêu đề trung tâm trên, vùng chụp hình giữa thoáng |

## Hierarchy chuẩn (trên → dưới)
1. Logo (góc trên trái) — chỉ từ file, không tạo mới.
2. Eyebrow (nhãn nhỏ, màu primary) — tên sự kiện/chuyên mục.
3. Headline (hero, in đậm, đọc từ xa) — màu text_dark trên nền sáng.
4. Subheadline (muted) — 1–2 dòng.
5. CTA pill (nền accent #00CE2C, chữ trắng).
6. Visual ngành (do AI nền đảm nhiệm).
7. Thanh liên hệ (nền primary #0077CD, chữ trắng) + QR bên phải — chỉ official contact.

## Lưu ý in lớn
Khổ > ~6000px sẽ được compose render ở tỉ lệ thu nhỏ (tự động) để tránh quá tải, nhưng PDF vẫn đặt DPI 300 → in đúng kích thước vật lý. Với backdrop cực lớn, ưu tiên xuất PDF vector-friendly và để xưởng in upscale.
