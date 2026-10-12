#!/usr/bin/env python3
# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
"""Fetch public store metadata with exact identity matching and a resumable cache.

Input: {games: [...], steam: [...]} (no download links required).
PSN index: [name, metadata] records from Ephellon/game-store-catalog/psn/!.json.
No fuzzy matches, authenticated endpoints, or game downloads.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import html
import json
import os
from pathlib import Path
import re
import time
import unicodedata
import urllib.error
import urllib.request


def title_key(title):
    value = unicodedata.normalize('NFKD', title)
    value = ''.join(c for c in value if not unicodedata.combining(c)).lower()
    value = re.sub(r'\bps[45]\s*(?:&|and|/|\+)\s*ps[45]\b', '', value)
    value = re.sub(r'\bps[45]\b', '', value)
    value = re.sub(r'\b(?:digital deluxe|deluxe|ultimate|definitive|complete|standard|premium|gold)\s+edition\b', '', value)
    return re.sub(r'[^a-z0-9]', '', value.replace('&', 'and'))


def text(value):
    value = re.sub(r'<br\s*/?>|</(?:p|li|h\d)>', '\n', value or '', flags=re.I)
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def clean_about(value):
    # Purchase/upgrade boilerplate is not a useful game summary.
    return '\n\n'.join(part.strip() for part in re.split(r'\n\s*\n', value or '')
                         if part.strip() and not re.match(r'(?:This product entitles you|If you already own|Owners of a PS4)', part.strip(), re.I))


def image_url(url):
    if not re.match(r'^https://', url or '') or not re.search(r'\.(?:png|jpe?g)(?:[?#]|$)', url, re.I):
        return None
    if url.startswith('https://image.api.playstation.com/'):
        return url.split('?')[0] + '?w=1920&thumb=false'
    return url


def parse_store(page, product_id):
    scripts = re.findall(r'<script([^>]*)>(.*?)</script>', page, re.S)
    next_data = next((json.loads(body) for attrs, body in scripts if 'id="__NEXT_DATA__"' in attrs), None)
    if not next_data:
        raise ValueError('Store page has no structured product metadata')
    cache = {}
    for fragment in next_data['props']['pageProps'].get('batarangs', {}).values():
        for attrs, body in re.findall(r'<script([^>]*)>(.*?)</script>', fragment.get('text', ''), re.S):
            if 'application/json' not in attrs:
                continue
            try:
                records = json.loads(body).get('cache', {})
            except ValueError:
                continue
            for key, value in records.items():
                if isinstance(value, dict):
                    cache.setdefault(key, {}).update(value)
    product = cache.get('Product:' + product_id, {})
    if product.get('id') != product_id or product.get('topCategory') not in ('GAME', None):
        raise ValueError('Product identity mismatch')
    if product.get('storeDisplayClassification') not in ('FULL_GAME', 'GAME_BUNDLE', 'PREMIUM_EDITION'):
        raise ValueError('Product is not a full game or game bundle')
    concept = cache.get((product.get('concept') or {}).get('__ref'), {})
    descriptions = {d['type']: text(d.get('value')) for d in (product.get('descriptions') or [])}
    media = (product.get('media') or []) + (concept.get('media') or [])
    def images(role):
        return list(dict.fromkeys(image_url(m.get('url')) for m in media if m.get('role') == role and m.get('type') == 'IMAGE' and image_url(m.get('url'))))
    hero = images('BACKGROUND') or images('BACKGROUND_LAYER_ART') or images('SCREENSHOT')
    result = {
        'shortDescription': descriptions.get('SHORT', ''),
        'about': clean_about(descriptions.get('LONG', '')),
        'publisher': product.get('publisherName', ''),
        'releaseDate': (product.get('releaseDate') or '')[:10],
        'genres': list(dict.fromkeys(g['value'] for g in (product.get('localizedGenres') or concept.get('localizedGenres') or []) if g.get('value') and g['value'] != 'Unique')),
        'images': {'hero': hero[0] if hero else None},
        'screenshots': images('SCREENSHOT')[:6],
    }
    if not result['shortDescription'] and not result['about']:
        raise ValueError('Product has no description')
    return result


def fetch_page(url):
    for attempt in range(2):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Overdrive-Metadata/1.0', 'Accept-Language': 'en-US'})
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status != 200:
                    raise ValueError(f'HTTP {response.status}')
                return parse_store(response.read(4 * 1024 * 1024).decode(), url.rsplit('/', 1)[-1])
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt:
                raise
            time.sleep(5)
        except (TimeoutError, urllib.error.URLError):
            if attempt:
                raise
            time.sleep(1)


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--psn', required=True)
    parser.add_argument('--homebrew', help='Optional homebrew.page metadata snapshot')
    parser.add_argument('--cache', default='native/.art/metadata-pages.json')
    parser.add_argument('--output', default=str(Path(os.environ.get('OVERDRIVE_CATALOG_DIR', '../overdrive-catalog')) / 'overrides/metadata-overrides.json'))
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--offline', action='store_true', help='Build from cache without network requests')
    parser.add_argument('--alternates', action='store_true', help='Try alternate product pages for missing metadata')
    args = parser.parse_args()
    data = json.loads(Path(args.input).read_text())
    by_id, by_title = {}, {}
    for name, record in json.loads(Path(args.psn).read_text()):
        if record.get('type') != 'game' or not record.get('href', '').startswith('https://store.playstation.com/en-us/product/'):
            continue
        product = re.search(r'(?:PPSA|CUSA)\d{5}', record.get('uuid', ''))
        if product:
            by_id.setdefault(product[0], []).append(record)
        by_title.setdefault(title_key(name), []).append(record)
    choices = {}
    for game in data['games']:
        records = by_id.get(game['titleId']) or by_title.get(title_key(game['title']), [])
        match = 'product-id' if game['titleId'] in by_id else 'normalized-title'
        choices[game['id']] = list(dict.fromkeys((r['href'], match) for r in records))[:4]
    cache_path = Path(args.cache)
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    urls = set()
    if not args.offline:
        for candidates in choices.values():
            if candidates and not any(url in cache for url, _ in candidates):
                urls.update(url for url, _ in (candidates if args.alternates else candidates[:1]))
    urls = sorted(urls)
    failures = {}
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        tasks = {pool.submit(fetch_page, url): url for url in urls}
        for count, future in enumerate(as_completed(tasks), 1):
            url = tasks[future]
            try:
                cache[url] = future.result()
            except Exception as error:
                failures[url] = f'{type(error).__name__}: {error}'
            if count % 25 == 0 or count == len(tasks):
                write_json(cache_path, cache)
                print(f'Pages {count}/{len(tasks)}; cached {len(cache)}; failed {len(failures)}', flush=True)
    # Steam enriches missing descriptive fields, never console release dates or platform features.
    steam = {title_key(g['title']): g for g in data.get('steam', [])}
    steam_cache = cache_path.with_name('metadata-steam.json')
    if steam_cache.exists():
        steam.update({key: game for key, game in json.loads(steam_cache.read_text()).items() if game})
    homebrew = {g['titleid']: g for g in json.loads(Path(args.homebrew).read_text()).get('apps', []) if g.get('kind') == 'game'} if args.homebrew else {}
    games = {}
    unresolved = []
    for game in data['games']:
        url, match = next(((url, method) for url, method in choices.get(game['id'], []) if url in cache), (None, None))
        result = dict(cache.get(url, {}))
        sources = [{'url': url, 'match': match}] if result else []
        extra = steam.get(title_key(game['title']))
        if extra:
            for field in ['shortDescription', 'about', 'developer', 'publisher', 'genres']:
                if not result.get(field) and extra.get(field):
                    result[field] = extra[field]
            result['images'] = dict(result.get('images', {}))
            if not result['images'].get('hero'):
                result['images']['hero'] = image_url(extra.get('images', {}).get('hero'))
            if not result.get('screenshots'):
                result['screenshots'] = [u for u in map(image_url, extra.get('screenshots', [])) if u][:6]
            sources.append({'url': f"https://store.steampowered.com/app/{extra['id']}/", 'match': 'normalized-title'})
        app = homebrew.get(game['titleId'])
        if app:
            result.update({'shortDescription': app.get('description', ''), 'about': app.get('description', ''), 'developer': app.get('author', '')})
            sources.append({'url': app['page'], 'match': 'product-id'})
        if result:
            result['about'] = clean_about(result.get('about', ''))
            result['sources'] = sources
            games[game['id']] = result
        else:
            unresolved.append({'id': game['id'], 'title': game['title']})
    write_json(args.output, {'schemaVersion': 1, 'games': games, 'unresolved': unresolved})
    if not args.offline:
        write_json(cache_path.with_name('metadata-failures.json'), failures)
    print(f'Enriched {len(games)}/{len(data["games"])} entries; {len(unresolved)} without supplemental metadata.', flush=True)


if __name__ == '__main__':
    main()
