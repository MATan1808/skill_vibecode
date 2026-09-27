#!/usr/bin/env python3
"""Validate Avada/Fusion Builder shortcode for common parser-breaking mistakes."""

from __future__ import annotations

import re
import sys
from pathlib import Path

STRUCTURAL = {
    "fusion_builder_container",
    "fusion_builder_row",
    "fusion_builder_row_inner",
    "fusion_builder_column",
    "fusion_builder_column_inner",
}

KNOWN_TAGS = {
    "fusion_alert", "fusion_audio", "fusion_blog", "fusion_breadcrumbs", "fusion_builder_column",
    "fusion_builder_column_inner", "fusion_builder_container", "fusion_builder_row", "fusion_builder_row_inner",
    "fusion_button", "fusion_checklist", "fusion_code", "fusion_contact_form", "fusion_content_box",
    "fusion_content_boxes", "fusion_countdown", "fusion_counter_box", "fusion_counter_circle",
    "fusion_counters_box", "fusion_counters_circle", "fusion_dropcap", "fusion_events", "fusion_faq",
    "fusion_featured_products_slider", "fusion_flip_box", "fusion_flip_boxes", "fusion_fontawesome",
    "fusion_form", "fusion_fusionslider", "fusion_highlight", "fusion_image", "fusion_imageframe",
    "fusion_images", "fusion_li_item", "fusion_lightbox", "fusion_login", "fusion_lost_password",
    "fusion_map", "fusion_menu", "fusion_menu_anchor", "fusion_modal", "fusion_modal_text_link",
    "fusion_one_page_text_link", "fusion_person", "fusion_popover", "fusion_portfolio",
    "fusion_postslider", "fusion_pricing_column", "fusion_pricing_footer", "fusion_pricing_price",
    "fusion_pricing_row", "fusion_pricing_table", "fusion_privacy", "fusion_products_slider",
    "fusion_progress", "fusion_recent_posts", "fusion_register", "fusion_search", "fusion_section_separator",
    "fusion_separator", "fusion_sharing", "fusion_slider", "fusion_slide", "fusion_social_links",
    "fusion_soundcloud", "fusion_syntax_highlighter", "fusion_tabs", "fusion_tab", "fusion_tagline_box",
    "fusion_testimonial", "fusion_testimonials", "fusion_text", "fusion_title", "fusion_toggle",
    "fusion_tooltip", "fusion_vimeo", "fusion_video", "fusion_widget", "fusion_widget_area",
    "fusion_youtube", "fusion_tb_author", "fusion_tb_comments", "fusion_tb_content",
    "fusion_tb_featured_slider", "fusion_tb_pagination", "fusion_tb_related", "fusion_tb_results",
    "fusion_tb_project_details", "fusion_post_cards", "fusion_tb_post_card_archives",
    "fusion_tb_woo_cart", "fusion_tb_woo_checkout_billing", "fusion_tb_woo_checkout_order_review",
    "fusion_tb_woo_checkout_payment", "fusion_tb_woo_checkout_shipping", "fusion_tb_woo_checkout_tabs",
    "fusion_tb_woo_notices", "fusion_tb_woo_price", "fusion_tb_woo_product_images",
    "fusion_tb_woo_short_description", "fusion_tb_woo_upsells", "layerslider", "rev_slider",
}

SELF_CLOSING = {"fusion_separator"}
FRACTIONS = {"1_1", "1_2", "1_3", "2_3", "1_4", "3_4", "1_5", "2_5", "3_5", "4_5", "1_6"}
TOKEN_RE = re.compile(r"\[(?P<close>/)?(?P<tag>[a-zA-Z_][\w-]*)(?P<attrs>[^\]]*?)(?P<self>/)?\]")
ATTR_RE = re.compile(r"([\w:-]+)=\"([^\"]*)\"")


def line_col(text: str, index: int) -> str:
    line = text.count("\n", 0, index) + 1
    last = text.rfind("\n", 0, index)
    col = index + 1 if last < 0 else index - last
    return f"{line}:{col}"


def validate(text: str) -> list[str]:
    errors: list[str] = []
    stack: list[tuple[str, int]] = []

    if "<!--" in text or "-->" in text:
        errors.append("HTML comment có thể làm Avada parser lỗi")

    for match in TOKEN_RE.finditer(text):
        tag = match.group("tag")
        attrs_raw = match.group("attrs") or ""
        is_close = bool(match.group("close"))
        is_self = bool(match.group("self")) or tag in SELF_CLOSING
        where = line_col(text, match.start())

        if tag.startswith("fusion_") or tag in {"layerslider", "rev_slider"}:
            if tag not in KNOWN_TAGS:
                errors.append(f"{where}: shortcode chưa có trong whitelist Avada: {tag}")

        attrs = dict(ATTR_RE.findall(attrs_raw))
        for name, value in attrs.items():
            if value == "":
                errors.append(f"{where}: attribute rỗng: {tag}.{name}")

        if "type" in attrs and tag in {"fusion_builder_column", "fusion_builder_column_inner"} and attrs["type"] not in FRACTIONS:
            errors.append(f"{where}: column type không hợp lệ: {attrs['type']}")
        if "layout" in attrs and tag in {"fusion_builder_column", "fusion_builder_column_inner"} and attrs["layout"] not in FRACTIONS:
            errors.append(f"{where}: column layout không hợp lệ: {attrs['layout']}")
        if attrs.get("type_small") and attrs["type_small"] not in FRACTIONS:
            errors.append(f"{where}: type_small không hợp lệ: {attrs['type_small']}")
        if "animation_delay" in attrs:
            try:
                if float(attrs["animation_delay"]) > 5:
                    errors.append(f"{where}: animation_delay quá lớn, Avada tính bằng giây: {attrs['animation_delay']}")
            except ValueError:
                errors.append(f"{where}: animation_delay không phải số: {attrs['animation_delay']}")

        if is_close:
            if not stack:
                errors.append(f"{where}: tag đóng dư: {tag}")
            else:
                open_tag, open_pos = stack.pop()
                if open_tag != tag:
                    errors.append(f"{where}: tag đóng {tag} nhưng đang mở {open_tag} tại {line_col(text, open_pos)}")
            continue

        if not is_self and tag in KNOWN_TAGS:
            stack.append((tag, match.start()))

    for tag, pos in reversed(stack):
        errors.append(f"{line_col(text, pos)}: thiếu tag đóng: {tag}")

    for tag in ("fusion_text", "fusion_title"):
        for match in re.finditer(rf"\[{tag}[^\]]*\](.*?)\[/{tag}\]", text, re.S):
            body = match.group(1)
            where = line_col(text, match.start())
            if body.startswith("\n") or body.endswith("\n") or "\n\n" in body:
                errors.append(f"{where}: {tag} có newline/rỗng sát nội dung, dễ sinh <div>&nbsp;</div>")
            if tag == "fusion_text" and body.strip() and "<p" not in body and "<ul" not in body and "<ol" not in body:
                errors.append(f"{where}: fusion_text nên bọc nội dung trong <p> inline")
            if tag == "fusion_title" and "<p" in body:
                errors.append(f"{where}: fusion_title không bọc <p>")

    for match in re.finditer(r"\[fusion_builder_container[^\]]*\](.*?)\[/fusion_builder_container\]", text, re.S):
        rows = len(re.findall(r"\[fusion_builder_row\b", match.group(1)))
        if rows != 1:
            errors.append(f"{line_col(text, match.start())}: mỗi container nên có đúng 1 fusion_builder_row, hiện có {rows}")

    return errors


def self_test() -> int:
    good = '[fusion_builder_container type="flex" hundred_percent="yes"][fusion_builder_row][fusion_builder_column type="1_1" layout="1_1" first="true" last="true" type_small="1_1"][fusion_title size="2"]Tiêu đề[/fusion_title][fusion_text]<p>Nội dung.</p>[/fusion_text][/fusion_builder_column][/fusion_builder_row][/fusion_builder_container]'
    bad = '[fusion_builder_container][fusion_builder_row][fusion_builder_column type="7_9"][fusion_title]<p>X</p>[/fusion_text][/fusion_builder_column][/fusion_builder_row][/fusion_builder_container]'
    if validate(good):
        print("self-test failed: good shortcode rejected", file=sys.stderr)
        return 1
    if not validate(bad):
        print("self-test failed: bad shortcode accepted", file=sys.stderr)
        return 1
    print("avada shortcode validator self-check passed")
    return 0


def main(argv: list[str]) -> int:
    if argv == ["--self-test"]:
        return self_test()
    if len(argv) != 1:
        print("Usage: validate-avada-shortcode.py <shortcode-file>", file=sys.stderr)
        return 2
    text = Path(argv[0]).read_text(encoding="utf-8")
    errors = validate(text)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print("Avada shortcode OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
