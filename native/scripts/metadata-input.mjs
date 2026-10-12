// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Export only identity fields and cached metadata; never send download links to stores.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';
requireCatalog();
const {downloadCatalog} = await import(pathToFileURL(catalogPath('downloads/download-catalog.js')).href);
const steam = JSON.parse(readFileSync(catalogPath('store/steam-cache.json'), 'utf8'));
console.log(JSON.stringify({
  games: downloadCatalog.map(({id, titleId, title, contentKind}) => ({id, titleId, title, contentKind})),
  steam,
}));
