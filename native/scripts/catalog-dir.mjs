// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// The catalog (store data, download links, overrides and link audits) is kept in a private repository and
// only enters the build: OVERDRIVE_CATALOG_DIR, by default an overdrive-catalog checkout beside this one.
// native/data/sample is a small fictional catalog with the same layout, for development and tests:
//   store/games.json                 the store's games (title, text, art, Steam features)
//   downloads/download-catalog.js    download sources per title ID (import-downloads.mjs, merge-catalog.mjs)
//   overrides/*.json                 metadata and artwork overrides
//   audits/direct-link-audit/, audits/part-audit/   the link and part audits prepare.mjs applies
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export const catalogDir = resolve(process.env.OVERDRIVE_CATALOG_DIR || resolve(repo, '../overdrive-catalog'));
export const catalogPath = path => resolve(catalogDir, path);

export function requireCatalog() {
  if (existsSync(catalogDir)) return;
  console.error(`No catalog at ${catalogDir}. Clone the private overdrive-catalog repository there or set OVERDRIVE_CATALOG_DIR to its checkout; OVERDRIVE_CATALOG_DIR=native/data/sample uses the example catalog.`);
  process.exit(1);
}
