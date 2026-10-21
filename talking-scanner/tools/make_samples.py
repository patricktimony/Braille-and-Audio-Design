"""Create simulated scanner images in samples/ (for --simulate and the tests).

Pages are rendered at 200 dots per inch on US Letter paper, with light
noise so they look more like real scans.  Usage:

    python tools/make_samples.py [output folder]
"""

import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PAGES = {
    "page1.png": [
        "Chapter One",
        "",
        "The library opens at nine o'clock every morning.",
        "Patrons may borrow up to twenty books at a time,",
        "and audio books may be renewed twice online or",
        "in person at the front desk.",
    ],
    "page2.png": [
        "Chapter Two",
        "",
        "Large print and braille editions are kept on the",
        "second floor, next to the quiet reading room.",
        "Ask a librarian to order any title you need.",
    ],
    "page3_upside_down.png": [
        "Chapter Three",
        "",
        "This page was placed upside down on the glass.",
        "The program turns it the right way up before",
        "reading it aloud.",
    ],
    "page4_blank.png": [],
}

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "C:/Windows/Fonts/times.ttf",
    "/System/Library/Fonts/Times.ttc",
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def render(lines, rotate=0, seed=0):
    rng = random.Random(seed)
    img = Image.new("L", (1700, 2200), 250)
    draw = ImageDraw.Draw(img)
    body, heading = font(44), font(64)
    y = 220
    for i, line in enumerate(lines):
        f = heading if i == 0 else body
        draw.text((180, y), line, fill=20, font=f)
        y += 110 if i == 0 else 70
    px = img.load()
    for _ in range(4000):  # specks of dust
        px[rng.randrange(img.width), rng.randrange(img.height)] = rng.randrange(80, 200)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    return img.rotate(rotate) if rotate else img


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for i, (name, lines) in enumerate(PAGES.items()):
        rotate = 180 if "upside_down" in name else 0
        render(lines, rotate, seed=i).save(os.path.join(out_dir, name), dpi=(200, 200), optimize=True)
        print("wrote", os.path.join(out_dir, name))


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "samples"))
