# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
"""Measures each cover's placeholder colour for the catalog: reads a JSON list of URLs on stdin, prints
{url: "#rrggbb"} for each image it could read. Failures are reported on stderr and omitted, so the next
run tries them again.

The colour is the image's mean, what a blur of the art converges to (next/image's `placeholder`): the app
fills a cover, hero or screenshot box with it until the art arrives, instead of a grey skeleton.
"""
import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

from PIL import Image, PngImagePlugin

PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024 * 1024


def measure(url):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as response:
        image = Image.open(io.BytesIO(response.read()))
        image.draft("RGB", (64, 64))
        image = image.convert("RGBA")
    # Alpha-weighted, so a transparent margin does not pull the colour toward black.
    r, g, b, a = image.resize((1, 1), Image.Resampling.BOX, reducing_gap=None).getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}" if a else None


def attempt(url):
    try:
        return url, measure(url)
    except Exception as error:  # noqa: BLE001 - one unreadable cover must not stop the catalog
        print(f"tint {url}: {error}", file=sys.stderr)
        return url, None


def main():
    with ThreadPoolExecutor(16) as pool:
        results = dict(pool.map(attempt, json.load(sys.stdin)))
    print(json.dumps({url: value for url, value in results.items() if value}))


if __name__ == "__main__":
    main()
