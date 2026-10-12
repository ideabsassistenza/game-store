# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.

# Draws Overdrive's mark as characters, like the landing page's hero (landing/src/components/site/
# AsciiMark.tsx), into native/assets/ascii-dial.png for the update dialog: the dial ring open at the
# limit, brighter towards it, and the needle crossing the gap. Run from the repository root:
#
#   python3 native/scripts/ascii_dial.py
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RAMP = " .:-=+*#%@"
COLS, ROWS, SUPERSAMPLE = 36, 18, 4
FONT_PX = 30
# The ring: radius 11 around the centre of the 32-unit box, 4.5 wide, from -20° sweeping 310°.
RADIUS, HALF, START, SWEEP = 11, 2.25, -20, 310
TIP, BASE, HUB = (28.4, 3.6), ((17.6, 18.1), (13.9, 14.4)), (14.87, 17.13, 2.9)


def along(x, y):
    angle = math.degrees(math.atan2(y - 16, x - 16))
    return ((angle - START) % 360) / SWEEP


def side(a, b, x, y):
    return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])


def in_needle(x, y):
    if (x - HUB[0]) ** 2 + (y - HUB[1]) ** 2 <= HUB[2] ** 2:
        return True
    d = side(TIP, BASE[0], x, y), side(BASE[0], BASE[1], x, y), side(BASE[1], TIP, x, y)
    return all(v >= 0 for v in d) or all(v <= 0 for v in d)


def cells():
    unit = 32 / COLS
    for row in range(ROWS):
        for col in range(COLS):
            ring = needle = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    x = (col + (sx + 0.5) / SUPERSAMPLE) * unit
                    y = (row + (sy + 0.5) / SUPERSAMPLE) * unit * 2
                    if in_needle(x, y):
                        needle += 1
                    elif abs(math.hypot(x - 16, y - 16) - RADIUS) <= HALF and along(x, y) <= 1:
                        ring += 1
            area = SUPERSAMPLE ** 2
            t = min(along((col + 0.5) * unit, (row + 0.5) * unit * 2), 1)
            yield col, row, ring / area, needle / area, t


def main():
    font = ImageFont.truetype(str(ROOT / "assets/JetBrainsMono-Regular.ttf"), FONT_PX)
    width = font.getlength("M")
    height = width * 2
    image = Image.new("RGBA", (round(width * COLS), round(height * ROWS)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for col, row, ring, needle, t in cells():
        if needle > 0.15:
            char, shade = RAMP[max(6, round(needle * 9))], 255
        elif ring > 0.05:
            char, shade = RAMP[max(1, round(ring * (0.35 + 0.65 * t) * 9))], round(70 + 185 * t ** 1.4)
        else:
            continue
        draw.text((col * width, row * height + (height - FONT_PX) / 2), char, font=font, fill=(shade, shade, shade, 255))
    out = ROOT / "assets/ascii-dial.png"
    image.save(out)
    print(f"{out} {image.size[0]}x{image.size[1]}")


main()
