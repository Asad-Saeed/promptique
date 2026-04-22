#!/usr/bin/env python3
"""Generate Promptique icons — Ink & Paper theme.

Chrome extension PNGs: 16, 32, 48, 128
PWA PNGs:              192, 512
Run from the repo root:  python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAPER  = (250, 247, 242, 255)   # #FAF7F2
INK    = (26, 26, 26, 255)      # #1A1A1A (slightly darker than accent for crispness)
BORDER = (232, 227, 219, 255)   # #E8E3DB

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    "/System/Library/Fonts/NewYork.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
]

def find_font():
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    raise RuntimeError("No serif system font found.")

def make_icon(size, out_path, with_accent=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    corner = int(size * 0.22)
    stroke = max(1, size // 64)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=corner,
        fill=PAPER,
        outline=BORDER,
        width=stroke,
    )

    font = ImageFont.truetype(find_font(), int(size * 0.72))
    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, fill=INK, font=font)

    # Small ink-dot accent upper-right (skipped for tiny sizes so it doesn't smear)
    if with_accent and size >= 48:
        r = max(2, int(size * 0.05))
        cx, cy = int(size * 0.78), int(size * 0.28)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG")
    print(f"  {os.path.relpath(out_path, ROOT)}")

def main():
    print("Extension icons:")
    for s in (16, 32, 48, 128):
        make_icon(s, os.path.join(ROOT, "extension/icons", f"icon-{s}.png"))

    print("PWA icons:")
    for s in (192, 512):
        make_icon(s, os.path.join(ROOT, "pwa/icons", f"icon-{s}.png"))
    make_icon(32, os.path.join(ROOT, "pwa/icons", "favicon-32.png"), with_accent=False)

    print("Done.")

if __name__ == "__main__":
    main()
