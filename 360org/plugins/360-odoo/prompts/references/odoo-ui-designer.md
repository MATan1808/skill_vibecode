# 🏛️ Quy Chuẩn Phát Triển Odoo Theme, Page Layout & Snippets (Upgrade-Safe / Migration-Safe)

> **Tài liệu tham chiếu chuẩn hóa chính thức**: Dựa trên Odoo 19.0 Developer Documentation (*website_themes/building_blocks*, *website_themes/pages*, *reference/frontend/qweb*, *tutorials/website_theme*, *howtos/upgrade_custom_db*) và `claude-odoo-builder` framework.
> 
> **Mục tiêu cốt lõi**:
> 1. **Phát triển Odoo Theme**: Xây dựng theme, design system, SCSS palette, asset bundles, building blocks, snippets và snippet options chuẩn Odoo.
> 2. **Thiết kế Page & Layout**: Xây dựng layout, section, building block, snippet và web page trên Odoo đảm bảo tính nhất quán, khả năng tái sử dụng và mở rộng.
> 3. **Yêu cầu Upgrade-Safe / Migration-Safe 100%**: Mọi thành phần khi Odoo nâng cấp/migrate từ version cũ (v14-v18) lên v19+ **KHÔNG bị lỗi Outdated Block (Orange warning icon)**, không vỡ layout, không mất cấu trúc và tương thích tự động.

---

## 🎯 1. Nguyên Tắc Vàng Upgrade-Safe & Migration-Safe

### 🛡️ Nguyên tắc 1: Cấu Trúc Khung Trang Bắt Buộc (`oe_structure`)
Để tránh lỗi **"Outdated Snippet Block / Block out of date"** (biểu tượng cảnh báo cam) khi Odoo nâng cấp core/theme:
- Mọi trang `website.page` hoặc template trang web **BẮT BUỘC** chứa thẻ wrapper gốc:
  ```xml
  <div id="wrap" class="oe_structure oe_empty">
      <!-- Mọi section/snippet chèn vào đây -->
  </div>
  ```
- **Lý do kỹ thuật**: Odoo Website Builder dựa vào `id="wrap"` và `class="oe_structure"` để định vị vùng thả block. Nếu thiếu `oe_structure`, Odoo Builder sẽ coi trang bị nát cấu trúc khi upgrade database.

### 🛡️ Nguyên tắc 2: Không Bao Giờ Đè Hoặc Copy Core Template
- **KHÔNG COPY nguyên văn** các core templates (`website.layout`, `website_sale.products`, `website.header_default`).
- **BẮT BUỘC dùng `inherit_id` + `xpath`**:
  ```xml
  <template id="custom_header_extension" inherit_id="website.template_header_default">
      <xpath expr="//nav" position="after">
          <!-- Chỉ chèn phần bổ sung -->
      </xpath>
  </template>
  ```
- **Tắt View Mặc Định Đúng Cách**: Khi muốn thay thế hoàn toàn một view mặc định, dùng `data/presets.xml` với `active=False` thay vì xóa hoặc overwrite view gốc:
  ```xml
  <record id="website.template_header_default" model="ir.ui.view">
      <field name="active" eval="False"/>
  </record>
  ```

### 🛡️ Nguyên tắc 3: Quản Lý Phối Màu Động Qua Palette System (`o-color-1..5`)
- Không hardcode màu HEX (`#123456`) rải rác trong XML/SCSS.
- Khai báo 5 màu chủ đạo trong `static/src/scss/primary_variables.scss` để Website Builder tự động map và tự chuyển đổi khi nâng cấp version:
  ```scss
  $o-color-1: #111827; // Dark / Text
  $o-color-2: #F3F4F6; // Light Surface
  $o-color-3: #10B981; // Accent Soft
  $o-color-4: #FFFFFF; // Pure Light / Card
  $o-color-5: #2563EB; // Primary CTA
  ```

### 🛡️ Nguyên tắc 4: Snippet Metadata & Auto-Migration Standards
- Mọi `<section>` snippet custom phải khai báo đủ metadata:
  ```xml
  <section class="s_brand_hero o_colored_level py-5" 
           data-snippet="website_theme.s_brand_hero" 
           data-name="Brand Hero Section">
      <div class="container">
          <h1 class="display-4 fw-bold o_editable">Title</h1>
          <div class="o_editable">Description</div>
      </div>
  </section>
  ```
- `o_colored_level`: Bắt buộc trên `<section>` để Color Picker chọn màu an toàn mà không làm mất class khi migrate.
- `o_editable`: Đánh dấu vùng WYSIWYG editor.

---

## 🎨 2. Chuẩn Phát Triển Theme (Theme Development Standard)

### A. Cấu trúc thư mục Module Theme chuẩn Odoo 19
```text
website_<theme_name>/
├── __manifest__.py
├── data/
│   └── presets.xml                  # Tắt/bật view core
├── views/
│   ├── website_templates.xml        # Custom Header/Footer & Layouts
│   └── snippets/
│       ├── s_hero_banner.xml        # Định nghĩa Snippet Arch
│       └── options.xml              # Snippet Options XML
└── static/src/
    ├── scss/
    │   ├── primary_variables.scss   # Biến màu & font Odoo
    │   ├── bootstrap_overridden.scss# Override Bootstrap
    │   └── snippets/
    │       └── s_hero_banner.scss   # Scoped SCSS
    ├── img/
    │   ├── content/                 # Dynamic images
    │   └── wbuilder/                # Thumbnails SVG cho Snippet Sidebar
    └── js/
        └── snippets/                # Modern JS Snippet Options
```

### B. Asset Bundles Khai Báo Trong `__manifest__.py`
```python
{
    'name': '360 Premium Theme',
    'category': 'Theme/Website',
    'version': '19.0.1.0.0',
    'depends': ['website', 'website_sale'],
    'data': [
        'data/presets.xml',
        'views/website_templates.xml',
        'views/snippets/s_hero_banner.xml',
        'views/snippets/options.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'website_theme/static/src/scss/primary_variables.scss',
            'website_theme/static/src/scss/bootstrap_overridden.scss',
            'website_theme/static/src/scss/snippets/*.scss',
        ],
        'website.assets_editor': [
            'website_theme/static/src/js/snippets/*.js',
        ],
    },
    'installable': True,
    'auto_install': False,
}
```

---

## 🏗️ 3. Chuẩn Thiết Kế Building Block (Snippets) & Layout Pages

### A. Snippet Template & Registration Into Sidebar
```xml
<!-- 1. Snippet Arch Definition -->
<template id="s_hero_banner" name="360 Hero Banner">
    <section class="s_hero_banner o_colored_level py-5" data-snippet="website_theme.s_hero_banner">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-7">
                    <h1 class="display-3 fw-bold o_editable">Tiêu đề Chuyên Nghiệp</h1>
                    <p class="lead o_editable text-muted">Mô tả giải pháp doanh nghiệp.</p>
                    <a href="/contactus" class="btn btn-primary btn-lg o_editable">Khám Phá Ngay</a>
                </div>
                <div class="col-lg-5">
                    <img src="/web/image/website.s_banner_default_image" class="img-fluid rounded shadow o_editable" alt="Hero Image"/>
                </div>
            </div>
        </div>
    </section>
</template>

<!-- 2. Registry into Website Builder Sidebar -->
<template id="snippets" inherit_id="website.snippets" name="360 Theme Snippets">
    <xpath expr="//div[@id='snippet_structure']//t[@t-snippet]" position="after">
        <t t-snippet="website_theme.s_hero_banner"
           t-thumbnail="/website_theme/static/src/img/wbuilder/s_hero_banner.svg">
            <keywords>hero banner 360 professional</keywords>
        </t>
    </xpath>
</template>
```

### B. Snippet Options Configuration (Declarative & Upgrade-Safe)
```xml
<template id="snippet_options" inherit_id="website.snippet_options" name="360 Snippet Options">
    <xpath expr="." position="inside">
        <div data-selector=".s_hero_banner">
            <we-select string="Layout Style">
                <we-button data-select-class="s_hero_style_1">Style 1 (Modern)</we-button>
                <we-button data-select-class="s_hero_style_2">Style 2 (Centered)</we-button>
            </we-select>
        </div>
    </xpath>
</template>
```

---

## ⚡ 4. RPC Client Mode (Odoo Online / SaaS Upgrade-Safe Push)

Đối với Odoo SaaS/Online không cài được module, sử dụng script RPC `scripts/odoo_rpc_client.py`:

```bash
# Get existing page with auto backup
python3 scripts/odoo_rpc_client.py --get-page /about

# Push page safely with QWeb wrapping
python3 scripts/odoo_rpc_client.py --push-page --update --url /about --file .tmp/draft_about.html

# Push CSS using scoped comment markers
python3 scripts/odoo_rpc_client.py --push-css static/src/css/custom.css --marker theme-overrides
```

---

## 📋 5. Migration & Upgrade Compatibility Audit Checklist

Trước khi release hoặc khi nâng cấp version Odoo (v14-v18 ➔ v19):
- [ ] Tất cả các page arch đều được bọc trong `<div id="wrap" class="oe_structure">`.
- [ ] Không có inline `<script>` nằm trong Page Arch hay `custom_code_head`.
- [ ] Không overwrite core view bằng copy-paste; 100% kế thừa qua `inherit_id` và `xpath`.
- [ ] Các lớp Bootstrap tuân thủ ma trận phiên bản (v16-v19 dùng BS5 `me-*`/`ms-*`/`gap-*`; v15- dùng BS4).
- [ ] Mọi `<section>` có class `o_colored_level` và attribute `data-snippet`.
- [ ] Đã chạy linter kiểm tra cú pháp QWeb & Odoo HTML Validator (`validate_html.py`).
