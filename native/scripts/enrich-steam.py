#!/usr/bin/env python3
# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
"""Supplement games missing a PSN match with exact Steam title matches.

Run before enrich-metadata.py; cache is read by that script automatically.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import importlib.util
import json
from pathlib import Path
import time
import threading
import urllib.error
import urllib.parse
import urllib.request

spec = importlib.util.spec_from_file_location('metadata', Path(__file__).with_name('enrich-metadata.py'))
metadata = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metadata)


request_lock = threading.Lock()
rate_limited = threading.Event()
last_request = 0


def fetch_json(url):
    global last_request
    with request_lock:
        if rate_limited.is_set():
            raise RuntimeError('Steam rate limit reached; retry later')
        time.sleep(max(0, 2 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
    try:
        return request_json(url)
    except urllib.error.HTTPError as error:
        if error.code == 429:
            rate_limited.set()
        raise


def request_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Overdrive-Metadata/1.0'}), timeout=15) as response:
        return json.load(response)


def search(title):
    query = urllib.parse.urlencode({'term': title, 'l': 'english', 'cc': 'us'})
    result = fetch_json('https://store.steampowered.com/api/storesearch/?' + query)
    matches = [g for g in result.get('items', []) if g.get('type') == 'app' and metadata.title_key(g['name']) == metadata.title_key(title)]
    if len(matches) != 1:
        return None
    app_id = str(matches[0]['id'])
    time.sleep(.5)
    details = fetch_json(f'https://store.steampowered.com/api/appdetails?appids={app_id}&l=english&cc=us').get(app_id, {})
    game = details.get('data', {})
    if not details.get('success') or game.get('type') != 'game' or metadata.title_key(game.get('name', '')) != metadata.title_key(title):
        return None
    return {'id': app_id, 'title': game['name'], 'shortDescription': metadata.text(game.get('short_description')),
            'about': metadata.text(game.get('about_the_game'))[:8000],
            'developer': ', '.join(game.get('developers', [])), 'publisher': ', '.join(game.get('publishers', [])),
            'genres': [g['description'] for g in game.get('genres', [])],
            'images': {'hero': game.get('background_raw') or game.get('background') or game.get('header_image')},
            'screenshots': [s['path_full'] for s in game.get('screenshots', [])][:6]}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True)
    p.add_argument('--psn', required=True)
    p.add_argument('--missing', help='Retry entries unresolved by the metadata collector, including unavailable PSN pages')
    p.add_argument('--cache', default='native/.art/metadata-steam.json')
    args = p.parse_args()
    data = json.loads(Path(args.input).read_text())
    psn = json.loads(Path(args.psn).read_text())
    names = {metadata.title_key(n) for n, m in psn if m.get('type') == 'game'}
    ids = {m.get('uuid', '') for _, m in psn if m.get('type') == 'game'}
    path = Path(args.cache)
    cache = json.loads(path.read_text()) if path.exists() else {}
    existing = {metadata.title_key(g['title']) for g in data.get('steam', [])}
    missing = {g['id'] for g in json.loads(Path(args.missing).read_text()).get('unresolved', [])} if args.missing else None
    titles = {metadata.title_key(g['title']): g['title'] for g in data['games']
              if metadata.title_key(g['title']) not in existing | cache.keys()
              and (g['id'] in missing if missing is not None else
                   metadata.title_key(g['title']) not in names and not any(g['titleId'] in product for product in ids))
              and g.get('contentKind') != 'homebrew'}
    failures = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(search, title): key for key, title in titles.items()}
        for count, future in enumerate(as_completed(futures), 1):
            key = futures[future]
            try:
                cache[key] = future.result()
            except Exception as error:
                failures[key] = str(error)
            if count % 10 == 0 or count == len(futures):
                metadata.write_json(path, cache)
                print(f'Steam {count}/{len(futures)}; matches {sum(bool(v) for v in cache.values())}; errors {len(failures)}', flush=True)
    metadata.write_json(path.with_name('metadata-steam-failures.json'), failures)


if __name__ == '__main__':
    main()
