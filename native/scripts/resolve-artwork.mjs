// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Resolve PNG/JPEG artwork using exact title or product-ID matches, never fuzzy search.
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';

const {values} = parseArgs({options: {psn: {type: 'string'}, homebrew: {type: 'string'}, compatibility: {type: 'string'}, output: {type: 'string'}}});
if (!values.psn) throw new Error('Pass --psn <PSN metadata JSON>.');
requireCatalog();
const {downloadCatalog} = await import(pathToFileURL(catalogPath('downloads/download-catalog.js')).href);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const supported = url => /^https:\/\//.test(url || '') && /\.(?:png|jpe?g)(?:[?#]|$)/i.test(url);
const titleKey = title => title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/\bps[45]\s*(?:&|and|\/|\+)\s*ps[45]\b/g, '').replace(/\bps[45]\b/g, '')
  .replace(/\b(?:digital deluxe|deluxe|ultimate|definitive|complete|standard|premium|gold)\s+edition\b/g, '')
  .replace(/&/g, 'and')
  .replace(/[®™]/g, '').replace(/[^a-z0-9]/g, '');
// Sony serves bounded variants; original artwork can exceed the native 5-megapixel limit.
function sizedArtwork(url) {
  if (!supported(url)) return url;
  const image = new URL(url);
  if (image.hostname === 'image.api.playstation.com') {
    image.searchParams.set('w', '1024');
    image.searchParams.set('thumb', 'false');
  }
  return image.href;
}
const byId = new Map(), byTitle = new Map();
function candidate(id, title, url) {
  if (!supported(url)) return;
  url = sizedArtwork(url);
  for (const [map, key] of [[byId, id], [byTitle, titleKey(title)]]) {
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(url)) list.push(url);
  }
}
const psn = read(values.psn);
if (!Array.isArray(psn)) throw new Error('Expected PSN [name, metadata] records.');
for (const [name, metadata] of psn) {
  if (metadata.type !== 'game') continue;
  candidate(/(?:PPSA|CUSA)\d{5}/.exec(metadata.uuid)?.[0], name, metadata.image);
}
for (const path of [catalogPath('store/steam-cache.json'), catalogPath('store/games.json')])
  for (const game of read(path)) candidate(game.titleId || game.id, game.title, game.images?.cover);
for (const game of downloadCatalog) candidate(game.titleId, game.title, game.images?.cover);
if (values.homebrew) for (const game of read(values.homebrew).apps || [])
  if (game.kind === 'game') candidate(game.titleid, game.name, game.icon_url);
if (values.compatibility) for (const game of read(values.compatibility))
  candidate(game.titleId, game.title, game.cover);

const games = {};
let replaced = 0, unresolved = 0;
for (const game of downloadCatalog) {
  const covers = [...new Set([
    ...(supported(game.images?.cover) ? [sizedArtwork(game.images.cover)] : []),
    ...(byId.get(game.titleId) || []), ...(byTitle.get(titleKey(game.title)) || []),
  ])].slice(0, 4);
  if (covers[0] !== game.images?.cover) replaced++;
  if (!covers.length) unresolved++;
  games[game.id] = {covers};
}
const output = values.output || catalogPath('overrides/artwork-overrides.json');
writeFileSync(output, JSON.stringify({schemaVersion: 1,
  sources: [
    'https://github.com/Ephellon/game-store-catalog/blob/main/psn/!.json',
    ...(values.homebrew ? ['https://homebrew.page/'] : []),
    ...(values.compatibility ? ['https://github.com/KytyPS5/kytyps5.github.io/blob/main/src/data/compat-index.json'] : []),
    'store/steam-cache.json', 'store/games.json', 'downloads/download-catalog.js',
  ], games}, null, 2) + '\n');
console.log(`Resolved ${downloadCatalog.length - unresolved}/${downloadCatalog.length} covers; ${replaced} primary changes; ${unresolved} need additional artwork.`);
