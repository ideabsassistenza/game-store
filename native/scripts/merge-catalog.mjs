// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Merge reviewed, normalized additions without replacing existing release identities.
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {webURL} from '../state/download-sources.js';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';

const {values} = parseArgs({options: {input: {type: 'string'}, catalog: {type: 'string'}}});
if (!values.input) throw new Error('Pass --input <reviewed-additions.json>.');
if (!values.catalog) requireCatalog();
const target = pathToFileURL(values.catalog || catalogPath('downloads/download-catalog.js'));
const {downloadCatalog} = await import(target.href);
const additions = JSON.parse(readFileSync(values.input, 'utf8'));
if (additions.schemaVersion !== 1 || !Array.isArray(additions.games)) throw new Error('Invalid additions envelope.');
const games = new Map(downloadCatalog.map(game => [game.id, game]));
let added = 0;
for (const game of additions.games) {
  if (game.id !== game.titleId || !/^(?:PPSA|CUSA)\d{5}$/.test(game.titleId) ||
      game.category !== 'game' || !game.title || !['ps4', 'ps5'].includes(game.platform) ||
      !Array.isArray(game.releases) || !game.releases.length) throw new Error(`Invalid game: ${game.id}.`);
  const expectedPlatform = game.titleId.startsWith('CUSA') ? 'ps4' : 'ps5';
  if (game.platform !== expectedPlatform) throw new Error(`Platform mismatch: ${game.id}.`);
  const releaseIds = new Set();
  for (const release of game.releases) {
    webURL(release.manifestUrl || release.browserUrl || release.url);
    if (!release.id || releaseIds.has(release.id)) throw new Error(`Duplicate release ID: ${game.id}.`);
    releaseIds.add(release.id);
  }
  const previous = games.get(game.id);
  if (previous) {
    // A second pass is a no-op; a conflicting identity needs explicit review.
    if (previous.title !== game.title) throw new Error(`Title ID collision: ${game.id}.`);
    continue;
  }
  games.set(game.id, game);
  added++;
}
const result = [...games.values()];
writeFileSync(target, `// Catalog snapshot; regenerate display resources with native/scripts/prepare.mjs.\nexport const downloadCatalog = ${JSON.stringify(result)};\n`);
console.log(`Added ${added} games; ${result.length} total. Existing releases preserved.`);
