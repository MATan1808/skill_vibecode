---
name: avada-builder-design
description: Thiết kế UI Avada/Fusion Builder bằng Avada shortcode và Fusion Builder element API; dùng cho layout, section, shortcode syntax, hoặc custom element nhẹ.
---

# Avada Builder Design

Dùng skill này khi Sếp cần thiết kế/chỉnh giao diện Avada, Fusion Builder, Fusion Core, hoặc shortcode layout trong WordPress.

## Nguồn kiểm chứng

- `https://avada.com/help-center/`
  - Official docs hub. Nhánh đã đọc: Layouts, Layout Basics, Header Layouts, Other Layouts, Builder, Basics, Library Basics, Mega Menus, Post Cards, Performance, Off Canvas.
  - URL chính: `https://avada.com/documentation/how-to-use-avada-layouts/`, `https://avada.com/documentation/category/layout-basics/`, `https://avada.com/documentation/category/header-layouts/`, `https://avada.com/documentation/category/other-layouts/`, `https://avada.com/documentation/category/builder/`, `https://avada.com/documentation/category/basics/`, `https://avada.com/documentation/category/library-basics/`, `https://avada.com/documentation/category/mega-menus/`, `https://avada.com/documentation/category/post-cards/`, `https://avada.com/documentation/category/performance/`, `https://avada.com/documentation/category/layouts/`, `https://avada.com/documentation/category/off-canvas/`.
  - Khi cần bước UI chi tiết, fetch bài cụ thể trong category trước; category index không đủ option name/setting name.
- `/Volumes/DATA/WORDPRESS/CLIENTS/vuahethong.com/Avada_Full_Package/Avada Theme/Avada/`
  - Avada theme local Sếp cung cấp. Không copy code proprietary vào skill.
  - `wpml-config.xml` xác nhận page-builder detector và whitelist shortcode Avada/Fusion chính.
- `https://github.com/Theme-Fusion/Fusion-Builder-Sample-Add-On`
  - Repo mẫu official cho Fusion Builder add-on.
  - Xác nhận hook/API: `fusion_builder_shortcodes_init`, `fusion_builder_before_init`, `Fusion_Element`, `fusion_builder_map()`, `fusion_builder_frontend_data()`, `FusionPageBuilder.ElementView`, template `tmpl-<shortcode>-shortcode`.
- `https://dev.to/andreata/i-open-sourced-a-figma-to-avada-shortcode-converter-ai-claude-code-4fdn`
  - Bài giới thiệu pipeline Figma/SVG + Claude Code → Avada shortcode; repo liên quan là `https://github.com/andreata/figma-to-avada`.
- `/Volumes/DATA/DEV/SKILLS/figma-to-avada`
  - Repo local đã đọc: Figma API client, section grouper, layout detector, fraction snapper, node classifier, brief extractor, image/WebP pipeline, WP media ID sync, legacy shortcode generator, knowledge base shortcode thật.
  - Rule cốt lõi: sinh shortcode theo section, giữ một container một row, single-line parser-safe, ảnh có media ID, validator trước khi paste.
- `https://github.com/Theme-Fusion/avada-vue`
  - Đã grep nhưng không thấy API shortcode/builder phù hợp để đưa vào skill này.

## Khi nào dùng

- Sếp nói: “thiết kế home theo phong cách ...”, “làm giống link này”, “làm giống hình này”, “từ Figma này dựng Avada”.
- Tạo/chỉnh section Avada bằng shortcode.
- Chuyển ý tưởng UI thành cấu trúc Fusion Builder: container → row → column → element.
- Tạo shortcode/element nhỏ cho site Avada child theme/plugin.
- Sửa preview front-end builder cho element custom.

## Input bất kỳ → Avada page

### 1. Sếp đưa mô tả style

- Hỏi tối đa phần thiếu thật sự: ngành, CTA chính, màu/brand, số section, asset hiện có.
- Nếu không đủ, dựng homepage chuẩn: hero, social proof, benefits, services/features, process, testimonials/case, FAQ, final CTA.
- Output shortcode theo từng section, tên rõ `hero`, `benefits`, `services`, `cta`.

### 2. Sếp gửi link page mẫu

- Đọc page mẫu nếu có quyền truy cập.
- Trích structure, visual rhythm, spacing, typography scale, CTA, section order, component pattern.
- Không copy text/ảnh/logo của site mẫu nếu Sếp không sở hữu; tạo bản tương tự về layout/phong cách bằng nội dung/asset của Sếp.
- Sinh Avada shortcode tương đương: hero, grid, card, gallery, pricing, FAQ, CTA.

### 3. Sếp gửi hình/screenshot

- Phân tích theo layer thủ công: nền, container, cột, typography, ảnh, CTA, khoảng cách.
- Ước lượng section height/padding và column fraction.
- Nếu có ảnh cần dùng thật: yêu cầu/nhận asset hoặc dùng placeholder rõ ràng; không bịa `image_id`.

### 4. Sếp gửi Figma/PDF hoặc repo `figma-to-avada`

- Ưu tiên chạy/đọc brief theo section nếu có `output/{site}/{page}/brief/sections/*.json`.
- Nếu chỉ có PDF/hình: dùng PDF/hình làm visual reference, sinh theo section.
- Nếu có `images.json` và `wpMediaId`, dùng `image_id="NNN|full"`; nếu chưa có ID, dùng URL và ghi cần sync/upload.

### 5. Trước khi trả kết quả

- Ghi shortcode ra file tạm.
- Chạy `scripts/validate-avada-shortcode.py <file>`.
- Nếu validator báo lỗi, sửa shortcode rồi chạy lại.
- Chỉ đưa Sếp shortcode khi validator pass hoặc nêu rõ phần chưa thể verify vì thiếu asset/WordPress live.

## Không dùng cho

- Malware, audit, hardening, cleanup server: chuyển sang `../../securities/SKILL.md`.
- Dev plugin WP không liên quan UI Avada: dùng `../../wp-dev/SKILL.md`.
- Thay theme Avada bằng theme khác khi Sếp chưa yêu cầu.

## Ladder trước khi sửa

1. Có thể làm bằng Avada UI/shortcode sẵn không? Dùng shortcode, không viết plugin.
2. Có child theme/template đang có không? Sửa đúng file đó.
3. Có element Avada/Fusion sẵn không? Tái dùng.
4. Chỉ khi shortcode có sẵn không đủ: tạo Fusion Builder element tối thiểu.

## Workflow Figma → Avada shortcode

Dùng khi Sếp đưa file Figma, PDF export, ảnh mockup hoặc repo `figma-to-avada`.

1. Đọc thiết kế theo section, không sinh cả trang nếu layout dài/phức tạp.
2. Với repo `figma-to-avada`: chạy pipeline nguồn nếu Sếp yêu cầu sinh thật; còn khi chỉ cập nhật skill thì chỉ dùng rule/knowledge base.
3. Input chính:
   - `output/{site}/{page}/brief/page-brief.json` cho toàn trang.
   - `output/{site}/{page}/brief/sections/*.json` cho từng section.
   - `output/{site}/{page}/brief/images.json` cho hash → filename → WP URL → `wpMediaId`.
   - `input/pdf/` nếu có PDF visual reference.
   - `base_di_conoscenza_shortcode_wordpress/` cho mẫu Avada thật.
4. Output nên ghi theo section vào `output/{site}/{page}/shortcode/` hoặc trả block shortcode rõ tên section.
5. Paste vào WordPress → Avada Builder → Code View → Save → xem Visual Builder rồi polish.

Kỳ vọng đúng: tool/prompt cho khoảng 70–90% layout; phần còn lại là polish spacing, hover, animation, responsive.

## Official Avada routing

Chọn native Avada feature trước khi sinh shortcode thủ công:

- Một page/home riêng → dùng Avada Builder page content hoặc shortcode paste vào Code View.
- Header/footer/page title/archive/search/single/404/event/sidebar template → dùng Avada Layouts + Layout Sections.
- Vùng tái dùng nhiều nơi → dùng Avada Library; nếu cần đồng bộ, lưu Global Element/Column/Container.
- Header custom → dùng Header Layout/Header Builder; thiết kế riêng desktop/tablet/mobile, sticky và transparent state.
- Menu thường → dùng WordPress Menu có sẵn + Avada Menu Element. Menu Element không tự tạo menu.
- Mega menu → dùng Mega Menu Builder, nhưng không dùng được khi Legacy Headers đang bật.
- Card lặp cho post/product/archive → dùng Post Cards. Archive grid/list dùng Post Card Archives Element; cart item dùng Post Card Cart Element.
- Product quick view/panel động từ card → dùng dynamic Off Canvas từ Post Card khi phù hợp.
- Popup/sliding bar/flyout/push menu/top banner/floating CTA → dùng Off Canvas.
- Form/contact → dùng Avada Forms/Form Elements hoặc plugin form có sẵn, không viết raw HTML form nếu không cần.
- Performance → dùng Avada Performance Wizard/Optimization Guide trước khi thêm custom plugin/code.

## Layouts rule

- Layout = nơi quyết định áp dụng ở đâu; Layout Section = phần giao diện cụ thể.
- Global Layout áp dụng toàn site; Conditional Layout áp dụng theo condition cụ thể và có thể ghi đè.
- Layouts không merge; content dùng layout ưu tiên nhất. Sau khi kéo priority phải lưu order.
- Dùng Layout Elements cho template/dynamic data; dùng Design Elements cho nội dung/trình bày.
- Bật dynamic data preview khi thiết kế layout phụ thuộc bài/page/archive/product.
- Không dùng Layout cho sửa nhỏ một page đơn lẻ; sửa page content là đủ.

## Header rule

- Trước khi dựng header: xác định menu source, logo variant, sticky, transparent, mobile/tablet behavior.
- Header mobile/sticky nên có cấu hình riêng; không ép desktop header xuống mobile.
- Header transparent phải kiểm tra độ tương phản với hero/background.
- Side header/parallax chỉ dùng khi phù hợp concept; không bật vì đẹp.

## Library/Post Card/Off Canvas rule

- Kiểm tra Library trước khi tạo block mới. Có block lặp → lưu Element/Column/Container/page template.
- Card động → Post Card; archive/blog/CPT/product list → Post Card Archives hoặc Post Cards Element.
- Nhiều kiểu card xen kẽ cần Avada 7.12+ alternate post cards.
- Off Canvas dùng cho popup/panel/quick view/floating CTA; với Post Card có thể trigger dynamic panel theo từng item.

## Performance rule

- Không thêm plugin cache/lazy-load/minify khi Avada/WordPress đã có tính năng tương đương và chưa kiểm tra.
- Tối ưu above-the-fold trước: Critical CSS, hero image, font, render-blocking JS.
- Đo trước/sau bằng PageSpeed Insights, WebPageTest, GTmetrix hoặc Pingdom nếu task là performance.
- Khi lỗi builder/cache sau sửa: kiểm tra Avada Global Options → Performance và clear/reset cache trước khi sửa code.
- Kiểm tra Avada System Status khi gặp lỗi 500/builder/plugin/server requirement.

## Mapping Figma sang Avada

- Frame/section lớn → `[fusion_builder_container type="flex"]`.
- Mỗi container chỉ có một `[fusion_builder_row]` top-level.
- Auto Layout ngang → row nhiều column.
- Auto Layout dọc → nhiều row một column hoặc stack element trong column.
- Width 33% → `type="1_3"`; width 66% → `type="2_3"`; snap về fraction Avada gần nhất.
- Text font size ≥ 32 → title lớn; ≥ 24 → title h2; ≥ 20 → title h3; nhỏ hơn → text.
- Figma text heading → `[fusion_title]...[/fusion_title]`.
- Figma body text → `[fusion_text]<p>...</p>[/fusion_text]`.
- Image fill → `[fusion_imageframe]`, ưu tiên `image_id="NNN|full"` nếu `images.json` có `wpMediaId`.
- Button group có text ngắn + background/border/radius → `[fusion_button]...[/fusion_button]`.
- Thin line/rectangle → `[fusion_separator]`.
- Header/menu → `fusion_menu`, `fusion_imageframe` logo, `fusion_social_links` nếu cần.
- Form/contact → `fusion_form` hoặc form element family, không tự viết raw form nếu Avada Form có sẵn.
- Blog/news/cards → `fusion_post_cards`, `fusion_blog`, `fusion_recent_posts`.
- WooCommerce/product → `fusion_tb_woo_*`, `fusion_products_slider`, `fusion_featured_products_slider`.
- Repeated card/product/post section → cân nhắc shortcode động như `[fusion_post_cards]`, WooCommerce element, hoặc card list; không hard-code khi dữ liệu động rõ ràng.

## Tag Avada nên ưu tiên

- Layout: `fusion_builder_container`, `fusion_builder_row`, `fusion_builder_column`, `fusion_builder_row_inner`, `fusion_builder_column_inner`.
- Content: `fusion_title`, `fusion_text`, `fusion_button`, `fusion_imageframe`, `fusion_separator`, `fusion_checklist`, `fusion_li_item`.
- Nav/social: `fusion_menu`, `fusion_social_links`, `fusion_breadcrumbs`.
- Dynamic: `fusion_post_cards`, `fusion_blog`, `fusion_recent_posts`, `fusion_tb_content`.
- WooCommerce/theme builder: `fusion_tb_woo_price`, `fusion_tb_woo_product_images`, `fusion_tb_woo_short_description`, `fusion_tb_woo_cart`, `fusion_tb_woo_upsells`, `fusion_tb_post_card_archives`.
- Advanced chỉ khi cần: `fusion_form`, `fusion_tabs`, `fusion_accordion`, `fusion_toggle`, `fusion_testimonials`, `fusion_pricing_table`, `fusion_slider`, `fusion_video`.

Nguồn whitelist: Avada theme local `wpml-config.xml` + knowledge base shortcode thật trong `figma-to-avada`.

## Avada shortcode syntax

Cú pháp cơ bản:

```text
[tag attr="value"]Nội dung[/tag]
[tag attr="value" /]
```

Quy ước layout phổ biến:

```text
[fusion_builder_container type="flex" hundred_percent="yes" padding_top="80px" padding_bottom="80px"][fusion_builder_row][fusion_builder_column type="1_2" layout="1_2" first="true" last="false" type_small="1_1"][fusion_title size="2" content_align="left"]Tiêu đề[/fusion_title][fusion_text]<p>Nội dung.</p>[/fusion_text][fusion_button link="https://example.com" color="custom" stretch="no"]CTA[/fusion_button][/fusion_builder_column][fusion_builder_column type="1_2" layout="1_2" first="false" last="true" type_small="1_1"][fusion_imageframe image_id="123|full" max_width="100%"]https://example.com/wp-content/uploads/image.webp[/fusion_imageframe][/fusion_builder_column][/fusion_builder_row][/fusion_builder_container]
```

Checklist shortcode:

- Đóng tag đủ cặp, không lồng sai `container/row/column`.
- Attribute có dấu nháy kép.
- `type` column dùng tỷ lệ Avada hỗ trợ: `1_1`, `1_2`, `1_3`, `2_3`, `1_4`, `3_4`, `1_5`, `2_5`, `3_5`, `4_5`, `1_6`.
- `type_small="1_1"` cho mobile stacking.
- `first="true"` và `last="true"` trên column đầu/cuối khi sinh layout nhiều cột.
- Không đặt comment HTML giữa shortcode; parser Avada có thể lỗi.
- Không xuống dòng/rỗng trong `fusion_text` và `fusion_title`.
- `fusion_text`: `[fusion_text]<p>Nội dung.</p>[/fusion_text]`.
- `fusion_title`: `[fusion_title]Tiêu đề[/fusion_title]`, không bọc `<p>`.
- `animation_delay` dùng giây thập phân: `0.2`, không dùng `200` vì Avada hiểu là 200 giây.
- Không ghi attribute rỗng như `type_medium=""`, `dimension_spacing=""`.
- Nội dung HTML phải qua editor/shortcode an toàn; không chèn script inline nếu không cần.
- CTA phải có text rõ, link hợp lệ, trạng thái hover đủ tương phản.

## Fusion Builder custom element tối thiểu

Khi phải tạo element mới, bám mẫu Theme-Fusion:

```php
add_action( 'fusion_builder_shortcodes_init', function () {
    include_once __DIR__ . '/elements/hero-card.php';
}, 10 );
```

Trong class element:

```php
class Hero_Card extends Fusion_Element {
    public function __construct() {
        parent::__construct();
        add_shortcode( 'hero_card', [ $this, 'render' ] );
    }

    public static function get_element_defaults() {
        return [ 'title' => '', 'text' => '' ];
    }

    public function render( $args, $content = '' ) {
        $args = FusionBuilder::set_shortcode_defaults( self::get_element_defaults(), $args, 'hero_card' );
        return '<section class="hero-card"><h2>' . esc_html( $args['title'] ) . '</h2>' . wp_kses_post( $content ) . '</section>';
    }
}

new Hero_Card();
```

Map element vào builder:

```php
add_action( 'fusion_builder_before_init', function () {
    fusion_builder_map(
        fusion_builder_frontend_data(
            'Hero_Card',
            [
                'name'      => esc_attr__( 'Hero Card', 'textdomain' ),
                'shortcode' => 'hero_card',
                'params'    => [
                    [
                        'type'       => 'textfield',
                        'heading'    => esc_attr__( 'Title', 'textdomain' ),
                        'param_name' => 'title',
                        'default'    => '',
                    ],
                    [
                        'type'       => 'tinymce',
                        'heading'    => esc_attr__( 'Content', 'textdomain' ),
                        'param_name' => 'element_content',
                        'value'      => '',
                    ],
                ],
            ]
        )
    );
} );
```

## Front-end builder preview

Nếu element cần preview realtime:

- Thêm `front_end_custom_settings_view_js` trỏ JS view.
- Thêm `front-end` trỏ template PHP có `id="tmpl-<shortcode>-shortcode"`.
- JS extend `FusionPageBuilder.ElementView`.
- Dùng `filterTemplateAtts()` để đưa `cid`, `wrapperAttributes`, `mainContent` vào template.
- Dùng `_.fusionInlineEditor()` khi cần inline edit.

Mẫu template:

```php
<script type="text/html" id="tmpl-hero_card-shortcode">
    <section {{{ _.fusionGetAttributes( wrapperAttributes ) }}}>
        {{{ FusionPageBuilderApp.renderContent( mainContent, cid, false ) }}}
    </section>
</script>
```

## Quy tắc UI

- Mobile-first: kiểm tra container padding, column stacking, font size và CTA trên mobile.
- Dùng global options/design tokens Avada trước khi hard-code CSS.
- Ưu tiên child theme CSS nhỏ; không sửa theme/plugin vendor trực tiếp.
- Giữ accessibility: heading order, alt text, link text, focus state, contrast.
- Performance: tránh slider/video nặng trong hero nếu ảnh tĩnh đủ đạt mục tiêu.

## Verify tối thiểu

- Preview page bằng Avada/Fusion Builder sau khi lưu.
- Kiểm tra desktop + mobile.
- Nếu đi từ Figma: so đối chiếu section với PDF/mockup, không chỉ nhìn shortcode.
- Nếu dùng ảnh: xác nhận ảnh upload xong và `image_id="NNN|full"` đúng media library; nếu thiếu `wpMediaId` thì dùng URL trực tiếp và ghi rõ cần sync sau.
- Nếu có shortcode custom: test render page không PHP fatal, shortcode output không HTML vỡ.
- Nếu có CSS/JS mới: kiểm tra console không lỗi và cache/minify không giữ bản cũ.

## Giới hạn đã biết

- Figma layer đặt tên xấu kiểu `Frame 123` hoặc thiếu Auto Layout làm AI phải đoán nhiều.
- Animation phức tạp, mega menu, dynamic content và custom CSS nặng cần làm tay trong WordPress/Avada.
- Avada chỉ nên inner nesting một cấp: `fusion_builder_row_inner` + `fusion_builder_column_inner`.
- Không sửa theme/plugin vendor trực tiếp; dùng child theme hoặc plugin nhỏ.
