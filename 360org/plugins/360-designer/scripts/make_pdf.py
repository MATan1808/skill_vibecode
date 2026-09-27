#!/usr/bin/env python3
"""
make_pdf.py — Convert a composed PNG into a print-ready PDF at the correct
physical size. Embeds the image at 300 DPI so the printer gets true dimensions.

Usage:
    python3 make_pdf.py --png /path/design.png --out /path/design.pdf
    python3 make_pdf.py --png /path/design.png            # writes alongside PNG
"""
import argparse, os
from PIL import Image

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", required=True)
    ap.add_argument("--out")
    ap.add_argument("--dpi", type=int, default=300)
    args = ap.parse_args()

    out = args.out or os.path.splitext(args.png)[0] + ".pdf"
    img = Image.open(args.png).convert("RGB")
    img.save(out, "PDF", resolution=float(args.dpi))
    print(out)

if __name__ == "__main__":
    main()
