// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Checks the generated catalog before it ships; prepare.mjs runs it and fails the build on an error.
//   node native/scripts/validate.mjs
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {isDlc, preferredRelease} from '../game/sources.js';
import {releaseSets} from '../state/release-sets.js';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';
import {sourceRules} from './sources.mjs';
import {workKey} from './works.mjs';

// Covers the app can draw: HTTPS, and not an archive.org storage node, which moves.
const STORAGE_NODE = /^https:\/\/[a-z0-9-]+\.(?:[a-z]+\.)?archive\.org\/\d+\/items\//;

/**
 * `{errors, warnings}` for the generated `games` (with cards) and `twins`, whose sources
 * `releasesOf(id)` returns as stored. `audit` and `sets` are the link and part audits' records; `today` an ISO date.
 */
export function validateCatalog({games, twins = [], releasesOf, audit = [], sets = [], today}) {
  const errors = [];
  const warnings = [];
  const rules = sourceRules(audit, sets);
  const ids = new Set();
  for (const game of [...games, ...twins]) {
    const name = `${game.id} ${game.title}`;
    if (ids.has(game.id)) errors.push(`${name}: duplicate id`);
    ids.add(game.id);
    if (game.releaseDate > today) errors.push(`${name}: release date ${game.releaseDate} is after the build`);
    const cover = game.art.cover;
    if (cover && (!cover.startsWith('https://') || STORAGE_NODE.test(cover))) errors.push(`${name}: cover ${cover} cannot be relied on`);
    const releases = releasesOf(game.id);
    // A set with only a full last volume against it ships when its game has no other source (prepare.mjs).
    const off = releases.filter(release => ![null, 'unproven'].includes(rules.why(release, game.id)));
    if (off.length) errors.push(`${name}: ${off.length} disabled or dead sources shipped`);
    const sets = releaseSets(releases);
    const usable = sets.filter(release => !release.unavailableReason);
    if (!usable.length) { errors.push(`${name}: no enabled source`); continue; }
    if (!usable.some(release => !isDlc(release))) warnings.push(`${name}: only add-on sources`);
    const preferred = sets[preferredRelease(sets)];
    if (preferred.unavailableReason) errors.push(`${name}: default source is unavailable`);
    if (preferred.health === 'flaky') warnings.push(`${name}: default source answered with a server error in the audit`);
  }
  const cards = new Map();
  for (const game of games) {
    const key = `${workKey(game.title)}/${game.platform}`;
    if (cards.has(key)) errors.push(`${game.id} ${game.title}: second card for the work of ${cards.get(key)}`);
    cards.set(key, game.id);
  }
  return {errors, warnings};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  requireCatalog();
  const app = new URL('../', import.meta.url);
  const {games, twins} = await import(new URL('data/catalog.js', app).href);
  const records = path => { const file = catalogPath(path); return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []; };
  const {errors, warnings} = validateCatalog({games, twins, today: new Date().toISOString().slice(0, 10),
    audit: records('audits/direct-link-audit/results.json'), sets: records('audits/part-audit/results.json'),
    releasesOf: id => JSON.parse(readFileSync(new URL(`data/releases/${encodeURIComponent(id)}.json`, app), 'utf8'))});
  for (const line of errors) console.error(`error: ${line}`);
  console.log(`Validated ${games.length + twins.length} entries: ${errors.length} errors, ${warnings.length} warnings`);
  if (errors.length) process.exit(1);
}
