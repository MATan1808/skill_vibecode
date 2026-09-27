#!/usr/bin/env python3
"""
compose_publication.py — 360 DESIGNER compositor.

Why this exists: AI image generation cannot be trusted to render Vietnamese text,
the exact logo, or real contact info correctly. So the AI tool produces only the
VISUAL BASE (background / imagery, no text). This script overlays the text,
hierarchy, brand logo, official contact bar and QR with pixel control — giving a
print-ready, on-brand result with no font errors and no fake data.

Usage:
    python3 compose_publication.py --spec spec.json
    python3 compose_publication.py --spec spec.json --defaults /path/defaults.json

Spec JSON fields (all optional except product + output_name):
    product         key in defaults.product_sizes_px_300dpi (e.g. "standee_80x180")
    background      path to AI-generated visual base PNG/JPG (no text). If missing,
                    a clean light brand background is drawn.
    headline        hero text (big)
    subheadline     supporting line
    cta             call to action (rendered in an accent pill)
    eyebrow         small label above headline (e.g. event name)
    show_logo       bool (default true) — uses logo from defaults; never generated
    show_contact    bool (default true) — uses ONLY official_contact_info
    qr              url string -> QR generated from it; null/absent -> from defaults
                    or omitted. Never random.
    output_name     base filename, e.g. "360_standee_bni"
    output_dir      override defaults.output_dir
    theme           "light" (default) | "accent_band" — both stay bright per brand
"""
import argparse, json, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ---------- helpers ----------
def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def _score_font(low, bold):
    """Higher = better. Penalise stylistic variants we don't want for clean corporate text."""
    score = 0
    avoid = ["oblique", "italic", "condensed", "compressed", "narrow",
             "light", "ultra", "thin", "extra"]
    for a in avoid:
        if a in low:
            score -= 5
    if bold:
        if "bold" in low: score += 10
        elif "black" in low or "heavy" in low: score += 7  # ok for hero headline
    else:
        if "regular" in low or "roman" in low: score += 10
        # a plain family name with no weight word is also a good "regular"
        if not any(w in low for w in ["bold", "black", "heavy"]):
            score += 4
    return score

def find_font(defaults, bold=False):
    """Return a path to a Vietnamese-capable TTF. Prefer user fonts (ranked so we
    pick clean Regular/Bold, not Oblique/Condensed/Light), fall back to DejaVu."""
    fonts_dir = defaults.get("typography", {}).get("fonts_dir", "")
    ranked = []
    if fonts_dir and os.path.isdir(fonts_dir):
        for fn in os.listdir(fonts_dir):
            low = fn.lower()
            if low.endswith((".ttf", ".otf")):
                ranked.append((_score_font(low, bold), os.path.join(fonts_dir, fn)))
    if ranked:
        ranked.sort(key=lambda t: t[0], reverse=True)
        return ranked[0][1]
    # system DejaVu (linux) supports Vietnamese; macOS Arial Unicode as last resort
    sys_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for p in sys_paths:
        if os.path.exists(p):
            return p
    return None

def font(path, size):
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

def text_size(draw, txt, fnt):
    b = draw.textbbox((0, 0), txt, font=fnt)
    return b[2] - b[0], b[3] - b[1]

def wrap_to_width(draw, txt, fnt, max_w):
    words, lines, cur = txt.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_size(draw, trial, fnt)[0] <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines

def fit_font(draw, txt, font_path, max_w, max_h, start, min_size=18):
    """Shrink font until wrapped text fits the box. Returns (font, lines, line_h)."""
    size = start
    while size >= min_size:
        fnt = font(font_path, size)
        lines = wrap_to_width(draw, txt, fnt, max_w)
        lh = int(size * 1.18)
        if lh * len(lines) <= max_h:
            return fnt, lines, lh
        size -= max(2, size // 20)
    fnt = font(font_path, min_size)
    return fnt, wrap_to_width(draw, txt, fnt, max_w), int(min_size * 1.18)

def draw_lines(draw, lines, x, y, fnt, lh, fill, align="left", box_w=None):
    for ln in lines:
        if align == "center" and box_w:
            w = text_size(draw, ln, fnt)[0]
            draw.text((x + (box_w - w) // 2, y), ln, font=fnt, fill=fill)
        else:
            draw.text((x, y), ln, font=fnt, fill=fill)
        y += lh
    return y

def make_qr(data, px):
    try:
        import qrcode
        qr = qrcode.QRCode(border=1, box_size=10,
                           error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(data); qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        return img.resize((px, px), Image.NEAREST)
    except Exception as e:
        sys.stderr.write(f"[WARN] QR skipped ({e}). Run: pip install qrcode --break-system-packages\n")
        return None

# ---------- main compose ----------
def compose(spec, defaults):
    sizes = defaults["product_sizes_px_300dpi"]
    product = spec.get("product", "social_post")
    if product not in sizes:
        sys.exit(f"[ERROR] Unknown product '{product}'. Options: {', '.join(sizes)}")
    W, H = sizes[product]["w"], sizes[product]["h"]

    # cap render size for huge print formats; PDF restores physical size
    scale = 1.0
    cap = 6000
    if max(W, H) > cap:
        scale = cap / max(W, H)
        W, H = int(W * scale), int(H * scale)

    colors = defaults["brand_colors"]
    primary = hex2rgb(colors["primary"])
    accent = hex2rgb(colors["accent"])
    bg_light = hex2rgb(colors["background_light"])
    text_dark = hex2rgb(colors["text_dark"])
    text_muted = hex2rgb(colors["text_muted"])

    canvas = Image.new("RGB", (W, H), bg_light)

    # background visual base
    bgp = spec.get("background")
    if bgp and os.path.exists(bgp):
        try:
            bg = Image.open(bgp).convert("RGB")
            # cover-fit
            r = max(W / bg.width, H / bg.height)
            bg = bg.resize((int(bg.width * r), int(bg.height * r)))
            canvas.paste(bg, ((W - bg.width) // 2, (H - bg.height) // 2))
            # bright scrim for readability (keep it light, per brand)
            scrim = Image.new("RGB", (W, H), bg_light)
            canvas = Image.blend(canvas, scrim, 0.18)
        except Exception as e:
            sys.stderr.write(f"[WARN] background load failed: {e}\n")
    else:
        # clean light brand background: soft top accent strip
        d = ImageDraw.Draw(canvas)
        d.rectangle([0, 0, W, int(H * 0.012)], fill=primary)

    draw = ImageDraw.Draw(canvas)
    f_reg = find_font(defaults, bold=False)
    f_bold = find_font(defaults, bold=True)

    M = int(W * 0.07)               # margin
    content_w = W - 2 * M
    y = int(H * 0.06)
    portrait = H >= W

    # logo (top) — only from file, never generated
    if spec.get("show_logo", True):
        lp = defaults["logo"]["path_to_logo_png"]
        if os.path.exists(lp):
            try:
                logo = Image.open(lp).convert("RGBA")
                target_h = int(H * (0.05 if portrait else 0.08))
                lw = int(logo.width * target_h / logo.height)
                logo = logo.resize((lw, target_h))
                canvas.paste(logo, (M, y), logo)
                y += target_h + int(H * 0.03)
            except Exception as e:
                sys.stderr.write(f"[WARN] logo load failed: {e}\n")
        else:
            sys.stderr.write("[WARN] No logo file found — leaving logo area empty (rule: never generate a logo).\n")
            y += int(H * 0.02)

    # eyebrow
    if spec.get("eyebrow"):
        ef = font(f_bold, int(H * 0.018) if portrait else int(H * 0.03))
        draw.text((M, y), spec["eyebrow"].upper(), font=ef, fill=primary)
        y += int(text_size(draw, "X", ef)[1] * 2.2)

    # headline (hero)
    if spec.get("headline"):
        start = int(H * 0.06) if portrait else int(H * 0.11)
        max_h = int(H * 0.26)
        hf, hlines, hlh = fit_font(draw, spec["headline"].upper(), f_bold,
                                   content_w, max_h, start)
        y = draw_lines(draw, hlines, M, y, hf, hlh, text_dark)
        y += int(H * 0.018)

    # subheadline
    if spec.get("subheadline"):
        start = int(H * 0.026) if portrait else int(H * 0.045)
        sf, slines, slh = fit_font(draw, spec["subheadline"], f_reg,
                                   content_w, int(H * 0.14), start)
        y = draw_lines(draw, slines, M, y, sf, slh, text_muted)
        y += int(H * 0.03)

    # CTA pill (accent)
    if spec.get("cta"):
        cf = font(f_bold, int(H * 0.022) if portrait else int(H * 0.038))
        ctw, cth = text_size(draw, spec["cta"], cf)
        padx, pady = int(cth * 0.9), int(cth * 0.55)
        pill = [M, y, M + ctw + 2 * padx, y + cth + 2 * pady]
        draw.rounded_rectangle(pill, radius=(cth + 2 * pady) // 2, fill=accent)
        draw.text((M + padx, y + pady), spec["cta"], font=cf, fill=(255, 255, 255))
        y = pill[3] + int(H * 0.03)

    # contact bar (bottom) — ONLY official info
    if spec.get("show_contact", True):
        ci = defaults["official_contact_info"]
        bar_h = int(H * (0.13 if portrait else 0.18))
        bar_top = H - bar_h
        draw.rectangle([0, bar_top, W, H], fill=primary)
        cf = font(f_reg, max(14, int(bar_h * (0.16 if portrait else 0.12))))
        lines = [
            f"Hotline: {ci['hotline']}    Email: {ci['email']}",
            "  |  ".join(ci["websites"]),
            ci["address"],
        ]
        ty = bar_top + int(bar_h * 0.18)
        lh = int(bar_h * (0.26 if portrait else 0.2))
        cx = M
        # QR on the right inside the bar
        qr_data = spec.get("qr")
        if qr_data is None and defaults.get("qr", {}).get("default_url"):
            qr_data = defaults["qr"]["default_url"]
        if qr_data:
            qpx = int(bar_h * 0.7)
            qimg = make_qr(qr_data, qpx)
            if qimg:
                qx = W - M - qpx
                qpad = 8
                draw.rectangle([qx - qpad, bar_top + (bar_h - qpx)//2 - qpad,
                                qx + qpx + qpad, bar_top + (bar_h - qpx)//2 + qpx + qpad],
                               fill=(255, 255, 255))
                canvas.paste(qimg, (qx, bar_top + (bar_h - qpx)//2))
        for ln in lines:
            draw.text((cx, ty), ln, font=cf, fill=(255, 255, 255))
            ty += lh

    return canvas, scale

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--defaults", default=os.path.join(here, "..", "resources", "defaults.json"))
    args = ap.parse_args()

    spec = load_json(args.spec)
    defaults = load_json(args.defaults)

    out_dir = spec.get("output_dir") or defaults["output_dir"]
    os.makedirs(out_dir, exist_ok=True)
    name = spec.get("output_name", "360_design")
    out_png = os.path.join(out_dir, f"{name}.png")

    img, scale = compose(spec, defaults)
    img.save(out_png, "PNG", dpi=(300, 300))
    print(json.dumps({"png": out_png, "size": img.size, "render_scale": scale}, ensure_ascii=False))

if __name__ == "__main__":
    main()
