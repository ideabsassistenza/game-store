#!/usr/bin/env python3
# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
"""Draw the home-screen art into native/sce_sys: the 512 icon, the background and the launch splash."""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

NATIVE = Path(__file__).resolve().parent.parent
FONT = NATIVE / "assets/Inter-Regular.ttf"
# Supersampled, then reduced, so the ring and needle edges come out smooth.
SS = 4
BLACK, WHITE, MUTED = "#000000", "#ffffff", "#8a8a8a"


def mark(draw, x, y, size):
    """The header logo's dial (a 32-unit viewBox): a ring open at the limit, the needle crossing it."""
    u = size / 32
    p = lambda px, py: (x + px * u, y + py * u)
    width = 4.5 * u
    # The ring runs clockwise from -20 to 290 degrees, leaving the gap at the upper right.
    steps = 240
    for i in range(steps + 1):
        a = math.radians(-20 + 310 * i / steps)
        cx, cy = p(16 + 11 * math.cos(a), 16 + 11 * math.sin(a))
        draw.ellipse((cx - width / 2, cy - width / 2, cx + width / 2, cy + width / 2), fill=WHITE)
    hub = 2.9 * u
    hx, hy = p(15.45, 16.55)
    draw.ellipse((hx - hub, hy - hub, hx + hub, hy + hub), fill=WHITE)
    draw.polygon([p(28.4, 3.6), p(17.6, 18.1), p(13.9, 14.4)], fill=WHITE)


def word(draw, x, y, text, size, fill, weight=0):
    font = ImageFont.truetype(str(FONT), size)
    # Inter ships here only as Regular; a hairline stroke reads as the header's semibold.
    draw.text((x, y), text, font=font, fill=fill, stroke_width=weight, stroke_fill=fill)
    return font.getbbox(text, stroke_width=weight)


def render(size, paint):
    image = Image.new("RGB", (size[0] * SS, size[1] * SS), BLACK)
    paint(ImageDraw.Draw(image), SS)
    return image.resize(size, Image.LANCZOS)


def icon(draw, s):
    mark(draw, 86 * s, 86 * s, 340 * s)


def background(draw, s):
    # The home screen lays the title's info over the lower left, so the art sits right of center.
    mark(draw, 1060 * s, 300 * s, 300 * s)
    word(draw, 1060 * s, 640 * s, "overdrive", 120 * s, WHITE, 2 * s)
    word(draw, 1066 * s, 800 * s, "Your PS5 game store.", 40 * s, MUTED)


def splash(draw, s):
    # Shown by the system until the first frame; ui/Splash.jsx draws the same dial there to animate it.
    mark(draw, 860 * s, 440 * s, 200 * s)


out = NATIVE / "sce_sys"
out.mkdir(exist_ok=True)
render((512, 512), icon).save(out / "icon0.png")
render((1920, 1080), background).save(out / "pic0.png")
render((1920, 1080), splash).save(out / "pic1.png")
