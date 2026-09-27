# Website Builder — Thiết kế giao diện Drag & Drop (Snippets/Building Blocks, v14–v19)

> Nguồn: §1–10 tổng hợp từ tutorial chính thức Odoo 17 *"Build a Website Theme"*
> (`odoo.com/documentation/17.0/vi/developer/tutorials/website_theme/*`, 6 chương: 01_theming → 06_going_live).
> §11–13 tổng hợp/tinh gọn từ repo cộng đồng [`19prince/claude-odoo-builder`](https://github.com/19prince/claude-odoo-builder)
> (kỹ thuật push nội dung qua RPC cho Odoo Online/SaaS + checklist theming + quy ước Bootstrap).
> Tài liệu này hướng dẫn xây **module Theme cho app Website** — nơi người dùng cuối thiết kế trang bằng cách
> kéo-thả (drag & drop) các "building block" (snippet) trong Website Builder, không cần biết code.

---

## 0. Khi nào dùng reference này

Dùng file này khi task liên quan: tạo/tuỳ biến **Theme Website**, thêm **snippet (building block)** mới vào
panel kéo-thả, thêm **snippet options** (bảng tuỳ chỉnh màu/layout khi click chọn block), custom
header/footer, background shape/gradient/animation, hoặc chỉnh trang Shop/Product của `website_sale`
theo phong cách riêng. Đây là mảng **khác hẳn** OWL backend component ([owl-frontend.md](owl-frontend.md)) —
Website Builder là editor frontend công khai (public-facing), không phải giao diện quản trị nội bộ.

---

## 1. Kiến trúc Module Theme Website

Cấu trúc thư mục chuẩn của 1 module theme (ví dụ `website_<ten_theme>`):

```
website_<theme>/
├── __init__.py
├── __manifest__.py
├── data/
│   └── presets.xml            # bật/tắt view mặc định, cấu hình palette
├── views/
│   ├── website_templates.xml  # header/footer/page tuỳ biến
│   └── snippets/
│       └── s_<theme>_<block>.xml   # từng snippet 1 file riêng
├── static/src/
│   ├── scss/
│   │   ├── primary_variables.scss     # biến Odoo (màu, font)
│   │   ├── bootstrap_overridden.scss  # override biến Bootstrap
│   │   └── pages/                     # scss riêng cho shop.scss, product_page.scss...
│   ├── js/
│   └── img/
│       ├── content/            # ảnh dùng trong trang, khai báo qua images.xml
│       └── wbuilder/           # thumbnail SVG cho snippet trong panel
└── i18n/
    └── fr_BE.po                # bản dịch
```

`__manifest__.py` mẫu — chú ý 2 bundle asset quan trọng:

```python
{
    'name': 'Theme Name',
    'category': 'Theme',
    'depends': ['website', 'website_sale', 'website_sale_wishlist'],
    'data': [
        'data/presets.xml',
        'views/website_templates.xml',
        'views/snippets/s_theme_carousel.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'website_theme/static/src/scss/primary_variables.scss',
            'website_theme/static/src/scss/bootstrap_overridden.scss',
            'website_theme/static/src/js/*.js',
        ],
    },
}
```

Cài đặt: thêm module vào `--addons-path`, chạy `-i website_<theme>` rồi vào **Website ▸ Configuration ▸ Themes**
để kích hoạt (theme xuất hiện trong danh sách theme chọn được, giống theme chính thức của Odoo).

---

## 2. Biến SCSS & hệ màu Preset (Palette)

`primary_variables.scss` khai báo font và **5 màu chủ đạo o-color-1 → o-color-5** (đây chính là bảng màu
mà Website Builder hiển thị cho end-user chọn khi họ đổi màu block bằng UI, không cần sửa code):

```scss
$headings-font-family: 'Space Grotesk';
$font-family-base: 'Lato';

$o-color-1: #000000;   // thường dùng cho Dark / text nhấn mạnh
$o-color-2: #BBE1FA;
$o-color-3: #CEF8A1;
$o-color-4: #FFFFFF;   // Light / nền
$o-color-5: #0B8EE6;   // Primary / nút CTA
```

Danh sách đầy đủ biến gốc: `odoo/addons/website/static/src/scss/primary_variables.scss`.

`bootstrap_overridden.scss` override biến Bootstrap 4.6/5 (tuỳ version) mà Odoo dùng, ví dụ:

```scss
$h1-font-size: 3.125rem;
$input-border-radius: 10px;
$btn-border-radius-lg: 0px 10px 10px 10px;
```

Nguồn biến gốc: `web/static/lib/bootstrap/scss/_variables.scss`.

`data/presets.xml` bật/tắt view mặc định của Odoo bằng `active=False` — đây là cách chuẩn để "xoá" 1 phần
UI có sẵn (header CTA, footer copyright...) mà không phải ghi đè XML:

```xml
<record id="website.header_call_to_action" model="ir.ui.view">
    <field name="active" eval="False"/>
</record>
```

---

## 3. Trang Website & Vùng cho phép kéo-thả (`oe_structure`)

Trang được lưu dưới dạng record `website.page`, chứa 1 QWeb template gọi `website.layout`:

```xml
<record id="page_home" model="website.page">
    <field name="name">Home</field>
    <field name="is_published" eval="True"/>
    <field name="key">website_theme.page_home</field>
    <field name="url">/</field>
    <field name="type">qweb</field>
    <field name="arch" type="xml">
        <t t-name="website_theme.page_home">
            <t t-call="website.layout">
                <t t-set="additional_title">Page Title</t>
                <div id="wrap" class="oe_structure">
                    <!-- Snippet kéo-thả vào đây -->
                </div>
            </t>
        </t>
    </field>
</record>
```

Class **`oe_structure`** là điểm mấu chốt: đánh dấu vùng cho phép **thêm/xoá/sắp xếp block bằng kéo-thả**
trong Website Builder. Ảnh dùng lại nhiều nơi (client re-editable) nên khai báo qua `images.xml` riêng,
để trong `static/src/img/content/`, không hardcode trực tiếp trong template khác.

---

## 4. Building Block (Snippet) — đơn vị kéo-thả

Mỗi snippet là 1 `<template>` chứa `<section>` gốc, gắn `data-snippet` để định danh duy nhất:

```xml
<template id="s_theme_carousel" name="Theme Carousel">
    <section class="s_carousel" data-snippet="website_theme.s_theme_carousel">
        <!-- nội dung, dùng data-oe-* để cho phép inline-edit text/ảnh -->
    </section>
</template>
```

Quy ước:
- **Prefix `s_`** cho mọi class CSS/tên snippet (đồng bộ với chuẩn snippet lõi của Odoo).
- `data-snippet="<module>.<template_id>"` — bắt buộc, dùng để Builder nhận diện loại block khi re-render.
- Thêm `data-no-drag="True"` trên phần tử con nếu muốn **khoá không cho user kéo/xoá** phần tử đó (ví dụ logo cố định trong header).

---

## 5. Đăng ký Snippet vào Panel kéo-thả

Snippet chỉ xuất hiện trong sidebar Builder khi được khai báo trong `website.snippets` (kế thừa `xpath`):

```xml
<template id="snippets" inherit_id="website.snippets" name="Theme - Custom Snippets">
    <xpath expr="//*[@id='default_snippets']" position="before">
        <t id="x_theme_snippets">
            <div id="x_theme_snippets_panel" class="o_panel">
                <div class="o_panel_header">Theme</div>
                <div class="o_panel_body">
                    <t t-snippet="website_theme.s_theme_carousel"
                       t-thumbnail="/website_theme/static/src/img/wbuilder/s-theme-carousel.svg">
                        <keywords>Carousel block</keywords>
                    </t>
                </div>
            </div>
        </t>
    </xpath>
</template>
```

- `o_panel` / `o_panel_header` / `o_panel_body` → tạo 1 nhóm riêng (category) trong sidebar, ví dụ nhóm
  "Theme" tách biệt với "Structure"/"Features"/"Dynamic Content" mặc định của Odoo.
- `t-snippet` trỏ tới `template id` ở bước 4; `t-thumbnail` là ảnh preview SVG/PNG hiển thị khi hover;
  `<keywords>` giúp tính năng tìm kiếm snippet trong panel match đúng block.

---

## 6. Snippet Options — Panel tuỳ chỉnh khi chọn block

Khi user click vào 1 block đã thả vào trang, panel bên phải hiện các tuỳ chọn (đổi màu, đổi layout...).
Khai báo bằng cách kế thừa `website.snippet_options`:

```xml
<template id="snippet_options" inherit_id="website.snippet_options" name="Theme - Snippets Options">
    <xpath expr="." position="inside">
        <div data-selector=".x_bubble_item">
            <we-button-group string="Bubble shadow">
                <we-button data-select-class="x_bubble1">Blue</we-button>
                <we-button data-select-class="x_bubble2">Green</we-button>
            </we-button-group>
        </div>
    </xpath>
</template>
```

- `data-selector` — CSS selector xác định option này áp dụng cho phần tử nào trong DOM của snippet.
- `we-button-group` / `we-button` — widget UI chuẩn của Builder (checkbox `we-checkbox`, color picker
  `we-colorpicker`, input `we-input`... đều theo namespace `we-*`).
- `data-select-class="<class>"` — cách **khai báo thuần XML/CSS**: khi user bấm nút, Builder tự toggle class
  đó lên phần tử match `data-selector`. Đây là cơ chế cơ bản nhất, đủ cho hầu hết theme.

> ⚠️ **Giới hạn tư liệu:** tutorial gốc (chương 3) chỉ minh hoạ option kiểu `data-select-class` thuần khai
> báo. Muốn hành vi phức tạp hơn (gọi RPC, tính toán động, custom widget JS) phải viết thêm class Option
> trong `static/src/js/` theo pattern lõi của Odoo (`@web_editor/js/editor/snippets.options`,
> `registry.category("website.snippet.options")` ở v17+). Trang tutorial bị cắt ở đúng đoạn
> "Create a new dynamic snippets template" nên phần snippet động (server-side data binding, ví dụ carousel
> hiển thị blog post/sản phẩm mới nhất — xem core `website/static/src/snippets/s_dynamic_snippet/`) **chưa
> được đưa vào đây đầy đủ**. Nếu cần loại snippet này, đọc trực tiếp source code core module tương ứng
> (`website/models/ir_ui_view.py` + `s_dynamic_snippet_*` trong `website/data/snippets/`) trước khi code.

---

## 7. Custom Header & Footer

Vô hiệu hoá header/footer mặc định bằng `active=False`, rồi định nghĩa view riêng:

```xml
<record id="website.template_header_default" model="ir.ui.view">
    <field name="active" eval="False"/>
</record>
<record id="website.footer_custom" model="ir.ui.view">
    <field name="active" eval="False"/>
</record>
```

Logo ghi trực tiếp vào record `website` để tự động áp dụng, không cần sửa template:

```xml
<record id="website.default_website" model="website">
    <field name="logo" type="base64" file="website_theme/static/src/img/content/branding/logo.svg"/>
</record>
```

Chỉnh phần tử nhỏ trong header/footer core (icon giỏ hàng, nút login...) dùng **xpath** trên view gốc
tương ứng (`website_sale_templates.xml` cho icon cart, v.v.), không copy-paste nguyên template lõi.

---

## 8. Hiệu ứng nâng cao: Shape nền, Gradient, Animation, Form

**Background shape (SVG):** đặt file SVG dùng đúng mã màu palette lõi của Odoo (không phải màu theme của
bạn) trong SVG gốc — Builder sẽ tự re-color theo palette hiện tại của trang khi render:

```
data-oe-shape-data="{'shape': 'illustration/theme/waves', 'colors': {'c1': '#BBE1FA'}, 'flip': ['x']}"
```

Khi custom namespace shape, đổi `web_editor` → `illustration` trong class để Builder nhận diện đúng thư mục.

**Gradient nền:** áp trực tiếp qua inline style trên section, không cần JS:

```html
<section style="background-image: linear-gradient(0deg, rgb(41,128,187) 0%, rgb(11,142,230) 100%) !important;">
```

**Animation khi cuộn trang:** gắn class `o_animate` + 1 hiệu ứng (`o_anim_fade_in`, `o_anim_rotate_in`,
`o_anim_zoom_out`...), tinh chỉnh độ trễ/cường độ bằng biến CSS:

```html
<div class="o_animate o_anim_fade_in" style="animation-delay: 0.8s; --wanim-intensity: 30;">
```

**Form:** builder có sẵn snippet form (`s_website_form`) hỗ trợ field bắt buộc, field hiện có điều kiện
(vd. field VAT chỉ hiện khi đã nhập tên công ty), gửi email khi submit, thông báo cảm ơn. Tham khảo template
lõi `addons/website/views/snippets/s_website_form.xml` trước khi viết form riêng — thường chỉ cần kế thừa
+ xpath thay vì viết lại từ đầu.

---

## 9. Tuỳ biến trang eCommerce (Shop & Product) bằng XPath

Không viết lại template Shop/Product — luôn **kế thừa (`inherit_id`) + xpath** trên view gốc của
`website_sale` (ví dụ `website_sale.products` cho trang Shop):

```xml
<template id="shop_custom" inherit_id="website_sale.products">
    <xpath expr="//div[@id='products_grid']" position="before">
        <!-- banner, bộ lọc category tuỳ biến -->
    </xpath>
</template>
```

Các điểm hay tuỳ biến: banner đầu trang Shop, bố cục filter category bên trái, ẩn thanh search (xpath 1 chỗ
áp dụng chung cho cả Shop lẫn Product), vị trí breadcrumb, ẩn nút chuyển list/grid, thiết kế lại product
card, ẩn bộ chọn số lượng/checkbox điều khoản/nút share ở trang Product, đổi icon nút "Add to cart".

**Drop zone** — vùng `oe_structure` chèn thêm dưới chi tiết sản phẩm để đội marketing tự kéo-thả nội dung
(không cần dev) mà không đụng code mỗi lần đổi nội dung. Mặc định 1 drop zone áp dụng cho **toàn bộ sản
phẩm**; muốn khác nhau theo từng sản phẩm phải thêm field riêng trên `product.template` rồi render field đó
trong `oe_structure` (mỗi sản phẩm có 1 vùng structure độc lập gắn theo `res_id`).

Tổ chức file theo trang: `website_sale_templates.xml` (mục Shop riêng, mục Product riêng), SCSS tách theo
`static/src/scss/pages/shop.scss` và `product_page.scss` — không gộp chung 1 file lớn.

---

## 10. Đa ngôn ngữ & Bàn giao (Going Live)

- Nội dung nhập qua Website Builder (vd. carousel trang chủ) dịch **qua backend** (Website ▸ đổi ngôn ngữ ▸
  sửa trực tiếp) hoặc **qua frontend** (bật language switcher, sửa ngay trên trang — phù hợp cho menu).
- Chuỗi dịch của riêng module code (label cố định trong template) xuất ra `.po`, đặt vào `i18n/<lang>.po`
  (vd. `i18n/fr_BE.po`), khai báo để tự load khi cài module.
- ⚠️ Poedit xử lý tag có style không tốt, có thể sinh sai `.mo` — nếu sửa trực tiếp `.po` bằng tay/editor
  code thì phải **import lại thủ công**, không tự áp dụng.
- Trước khi import module theme vào DB mới: đảm bảo **`base_import_module`** đã cài, đủ app phụ thuộc đã
  cài trước (đặc biệt `website_sale`, `website_blog` nếu theme có snippet dùng tới).
- Sau khi cài, **dịch không tự áp dụng** — phải import file `.po` thủ công 1 lần nữa.

**Checklist trước khi ship theme:**
- [ ] Module cấu trúc đủ: manifest khai đúng asset bundle (`web.assets_frontend`), data files theo đúng thứ tự (presets trước, snippet sau).
- [ ] Mọi snippet mới đã có: template snippet (§4) + đăng ký panel (§5) + options nếu cần (§6) + thumbnail SVG.
- [ ] Header/footer custom đã tắt view mặc định tương ứng (`active=False`), không để trùng 2 header cùng hiện.
- [ ] Trang Shop/Product chỉ sửa bằng xpath/inherit, không copy nguyên template lõi (tránh vỡ khi Odoo update core).
- [ ] Đã test kéo-thả thực tế trong Website Builder (không chỉ đọc code) — xem [references/testing-and-debugging.md](testing-and-debugging.md) cho Odoo Tours/Playwright chạy UI Builder.
- [ ] File `.po` đã export, đặt đúng `i18n/`, đã import thủ công sau khi cài module trên DB đích.

---

## 11. Kỹ thuật thay thế — Push trực tiếp qua RPC (Odoo Online/SaaS không cài được module)

§1–10 giả định bạn có quyền cài module (self-hosted hoặc Odoo.sh có git deploy). Với **Odoo Online SaaS thuần**
(gói không cho cài module custom, không SSH, không filesystem), vẫn có thể thiết kế trang bằng cách **ghi thẳng
qua JSON-RPC/XML-RPC** vào các field mà chính Website Builder cũng ghi khi user kéo-thả. Dùng
[scripts/odoo_rpc_client.py](../../../../scripts/odoo/odoo_rpc_client.py) (chỉ
stdlib, không phụ thuộc `requests`/`python-dotenv`) cho việc này.

### Khi nào dùng §11 thay vì §1–10

| Tình huống | Dùng |
|---|---|
| Có quyền cài module (self-hosted / Odoo.sh) | §1–10 (module Theme + snippet chuẩn) |
| Odoo Online SaaS, không cài được module custom | §11 (RPC trực tiếp) |
| Element dùng lại ở ≥2 trang, cần SCSS/JS scoped riêng | §1–10 — RPC không đóng gói được asset bundle |
| Chỉ cần 1 trang nội dung hoặc vá CSS nhanh | §11 — nhanh hơn nhiều, không cần chờ deploy |

### Cấu hình

Tạo `.env` (không commit) với `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`. Script tự chặn nếu
`ODOO_URL` là `http://` thuần (mật khẩu gửi cleartext) trừ khi đặt `ODOO_ALLOW_HTTP=true`.

```bash
python3 scripts/odoo_rpc_client.py --list-pages
python3 scripts/odoo_rpc_client.py --get-page /about
python3 scripts/odoo_rpc_client.py --push-page --create --url /pricing --name "Pricing" --file draft_pricing.html
python3 scripts/odoo_rpc_client.py --push-page --update --url /pricing --file draft_pricing.html
python3 scripts/odoo_rpc_client.py --publish /pricing
python3 scripts/odoo_rpc_client.py --push-css site.css --marker hero-fix
```

Mọi lệnh ghi (`--push-page`, `--push-css`) **tự động backup** nội dung cũ vào `.tmp/` trước khi ghi đè — không
cần cờ riêng, không có chế độ "quên backup".

### Quy ước arch khi push trực tiếp (không đóng gói module)

Không viết `<html>`/`<head>`/`<body>`, không viết `<t t-name=...>` (script tự bọc) — chỉ viết nội dung bên
trong, mỗi phần là 1 `<section>`:

```html
<section class="s_banner o_colored_level py-5 bg-dark text-white">
  <div class="container py-4">
    <h1 class="display-4 fw-bold o_editable">Tiêu đề chính</h1>
    <p class="lead o_editable">Mô tả ngắn gọn.</p>
    <a href="/contactus" class="btn btn-primary btn-lg o_editable">Liên hệ</a>
  </div>
</section>
```

Quy tắc bắt buộc: mọi `<section>` gắn `o_colored_level` (bật color-picker trong editor); mọi vùng text/nút
gắn `o_editable`; mọi `<img>` gắn `img-fluid`; dùng `<a class="btn ...">` thay `<button>` cho nút bấm; không
gắn `id=""` trên phần tử lặp lại; không nhúng `<script>` (editor Odoo tự strip) — cần JS thì quay lại §1–10
(module + snippet.js).

### Bơm CSS nhanh qua `custom_code_head` (không đụng page arch)

Field `custom_code_head` trên model `website` được chèn vào `<head>` của **mọi trang**. Đây là cách vá CSS
nhanh nhất khi không muốn/không thể sửa arch hay đóng gói module:

```python
sites = c.search_read("website", [], ["id", "custom_code_head"])
head  = sites[0].get("custom_code_head") or ""
c.write("website", [sites[0]["id"]], {"custom_code_head": head + "\n<style>...</style>"})
```

**Luật bắt buộc:**
1. **Luôn scope theo class cấp trang** (`.o_wblog_index`, `.o_wsale_wishlist`...) — không viết rule trần kiểu
   `h1 { color: white }`, sẽ vỡ toàn site.
2. **Dùng `!important`** cho color/background — độ đặc hiệu CSS mặc định của Odoo rất cao.
3. **Đánh dấu mỗi block bằng comment marker** `/* == <ten-block> start == */` ... `/* == end == */` **bên
   trong** thẻ `<style>` (marker đặt ngoài `<style>` sẽ hiện chữ thật trên trang). `push_css` trong
   `odoo_rpc_client.py` tự làm việc này qua `--marker`, tự xoá block cũ bằng regex trước khi nối block mới —
   không bao giờ append trùng lặp.
4. **Không sửa `ir.ui.view` arch để đổi màu** — CSS-only cho mọi thay đổi thị giác thuần tuý.

### 3 gotcha hay gặp khi làm việc trực tiếp với Odoo Online SaaS

1. **`search_read` trên `website`/`website.page` có thể trả rỗng dù có data** — quirk đã biết của Odoo Online
   SaaS. Nếu thấy "0 pages" trên site chắc chắn có trang, đọc theo domain cụ thể hơn hoặc theo ID trực tiếp
   thay vì tin domain rỗng `[[]]`.
2. **Trang chủ `/` không phải `website.page`** — nó được render bởi `ir.ui.view` có `key = "website.homepage"`.
   Đừng dùng `--push-page --create --url /`: sẽ tạo ra 1 trang `website.page` trùng lặp, không published, và
   **không bao giờ được serve**. Muốn sửa trang chủ, tìm đúng view: tra
   `website.page` với domain `[['url','=','/']]`, lấy field `view_id`, rồi ghi `arch` thẳng vào
   `ir.ui.view` đó.
3. **Panel Blocks hiện icon cảnh báo màu cam trên hầu hết snippet** → nguyên nhân hầu như luôn là
   `website.theme_id = False` (chưa có theme nào được link vào website). Cài + link 1 theme tối giản (vd.
   module lõi `theme_clean`) để panel render đúng:
   ```python
   c._execute_kw("ir.module.module", "button_immediate_install",
                 [c.search("ir.module.module", [["name", "=", "theme_clean"]])], {})
   theme_id = c.search("ir.module.module", [["name", "=", "theme_clean"]])[0]
   c.write("website", [1], {"theme_id": theme_id})
   ```
   Sau khi cài theme, **push lại mọi CSS đã đẩy vào `custom_code_head` trước đó** — cài theme có thể reset field
   này. Nếu editor hiện đúng toolbar nhưng có lỗi JS trong console, kiểm `custom_code_head` — thẻ `<script>`
   trong đó phá vỡ panel editor; bỏ hết `<script>`, chỉ giữ CSS.

---

## 12. Quy ước Bootstrap theo phiên bản Odoo

| Odoo | Bootstrap | Lưu ý |
|---|---|---|
| 17.0, 16.0 | Bootstrap 5.1 | Dùng đầy đủ utility BS5 |
| 15.0 | Bootstrap 4.6 | Tránh utility chỉ có ở BS5 |
| 14.0 trở xuống | Bootstrap 4.5 | Cú pháp grid/utility cũ hơn |

**Utility chỉ có ở BS5 — tránh dùng trên Odoo 14/15:** `gap-*`, `d-grid`, `fs-*` (dùng `font-size` inline thay
thế), gutter `g-*` (dùng `gutter`), `me-*`/`ms-*` (dùng `mr-*`/`ml-*` — margin-end/start đổi tên ở BS5). Không
chắc version → hỏi trước khi viết HTML; mặc định coi như v17 (Bootstrap 5) nếu không có thông tin khác.

**Bảng class Odoo-specific hay dùng khi viết arch (module lẫn push trực tiếp):**

| Class | Vai trò |
|---|---|
| `o_colored_level` | Bật color-picker nền trong sidebar editor. Gắn trên mọi `<section>`. |
| `o_editable` | Đánh dấu vùng user được sửa trực tiếp trong WYSIWYG. Gắn trên mọi text/nút. |
| `o_we_bg_filter` | Lớp phủ màu lên trên background image. |
| `s_banner`, `s_text_block`, `s_three_columns`, `s_call_to_action`, `s_text_image`, `s_quotes_carousel`, `s_website_form` | Class định danh snippet lõi của Odoo — dùng lại được cho section tự viết để thừa hưởng style nền có sẵn. |

---

## 13. Checklist Theming toàn diện (mọi bề mặt cần rà khi đổi theme/màu)

Dùng khi nhận task "đổi theme toàn site" hoặc "áp bảng màu mới" — rà từng dòng, không chỉ sửa trang chủ rồi coi
là xong. Copy bảng này vào `.tmp/theming_checklist.md`, đánh dấu `[x]` khi đã style, `[—]` khi cố tình bỏ qua.

### Trang (full-page)

| Bề mặt | URL | Class/selector body |
|---|---|---|
| Trang chủ | `/` | — (xem gotcha §11.3 — không phải `website.page`) |
| Danh sách Shop | `/shop` | `.oe_website_sale` |
| Shop theo category | `/shop?category=N` | `.oe_website_sale` |
| Chi tiết sản phẩm | `/shop/product/…` | `#product_detail` |
| Giỏ hàng | `/shop/cart` | `.o_cart_summary`, `#cart_total` |
| Checkout | `/shop/checkout` | `.o_website_sale_checkout` |
| Xác nhận đơn hàng | `/shop/confirmation` | `.o_website_sale_confirmation` |
| Form liên hệ | `/contactus` | `.o_wcontact` |
| Trang cảm ơn liên hệ | `/contactus-thank-you` | `.o_wcontact` |
| 404 | `/web/404` | `.o_website_error` |
| Danh sách Blog | `/blog` | `.o_wblog_index` |
| Bài Blog | `/blog/…/…` | `.o_wblog_post_page` |
| Đăng nhập | `/web/login` | `.o_login_form` (layout tách biệt website, cần CSS riêng) |
| Đăng ký | `/web/signup` | `.o_signup_form` (như trên) |
| Portal khách hàng | `/my/home` | `.o_portal_wrap` (layout tách biệt website) |
| Đơn hàng của tôi | `/my/orders` | `.o_portal_wrap` |
| Chi tiết đơn hàng | `/my/orders/N` | `.o_portal_wrap` |
| Tài khoản của tôi | `/my/account` | `.o_portal_wrap` |
| Wishlist | `/shop/wishlist` | `.o_wsale_wishlist` (chỉ khi cài module Wishlist) |

### UI Elements (overlay, modal, popup, widget)

| Thành phần | Selector | Ghi chú |
|---|---|---|
| Cookie banner | `.o_cookies_bar`, `.o_cookies_popup` | Hiện lần đầu ghé site |
| Toast "đã thêm vào giỏ" | `.o_notification_manager`, `.o_cart_notification` | Trigger khi add-to-cart |
| Modal quick-view sản phẩm | `.o_wsale_product_modal` | Nếu bật quick-view ở Shop |
| Overlay tìm kiếm | `.o_searchbar_autocomplete`, `.o_search_modal` | Search toàn site |
| Popup newsletter | `.o_newsletter_popup` | Nếu có đặt snippet Newsletter popup |
| Menu mobile (hamburger) | `#o_offcanvas_menu` | |
| Widget live chat | `.o_livechat_button`, `#im_livechat` | Nếu cài module Livechat |
| Dropdown "Tài khoản của tôi" | `.o_user_additional_menu` | Góc trên phải khi đã đăng nhập |

Không được coi task "đổi theme" là hoàn thành khi còn dòng `[ ]` chưa đánh dấu ở bảng trên (trừ khi PO xác nhận
`[—]` bỏ qua có chủ đích).
