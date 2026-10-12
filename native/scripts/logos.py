# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
"""Measures store logos for the catalog: reads a JSON list of URLs on stdin, prints
{url: {"aspect", "dark", "blank"}} for each logo it could read. Failures are reported on stderr and omitted,
so the next run tries them again.

`aspect` is width / height; `dark` marks logos drawn mostly in dark ink, which the app tints white;
`blank` marks a store placeholder (one flat colour, opaque or fully transparent), which the app must
not show.
"""
import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen

from PIL import Image, ImageStat, PngImagePlugin

# Some store logos carry large metadata chunks; they are skipped, not decoded.
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024


def measure(url):
    with urlopen(url, timeout=30) as response:
        image = Image.open(io.BytesIO(response.read())).convert("RGBA")
    solid = [(r, g, b) for r, g, b, a in zip(*(band.tobytes() for band in image.split())) if a >= 128]
    dark = sum(0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2 * 255 for r, g, b in solid)
    # A real logo has transparent margins or ink of more than one shade; a one-colour silhouette
    # still varies in alpha. Steam serves a flat grey box for some apps (Battlefield 6).
    luma, alpha = ImageStat.Stat(image.convert("LA")).stddev
    return {"aspect": round(image.width / image.height, 3), "dark": bool(solid) and dark / len(solid) > 0.68,
            "blank": luma < 6 and alpha < 6}


def attempt(url):
    try:
        return url, measure(url)
    except Exception as error:  # noqa: BLE001 - one unreadable logo must not stop the catalog
        print(f"logo {url}: {error}", file=sys.stderr)
        return url, None


def main():
    with ThreadPoolExecutor(8) as pool:
        results = dict(pool.map(attempt, json.load(sys.stdin)))
    print(json.dumps({url: value for url, value in results.items() if value}))


if __name__ == "__main__":
    main()
