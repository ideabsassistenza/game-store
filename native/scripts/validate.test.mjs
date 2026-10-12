// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {validateCatalog} from './validate.mjs';

const game = (id, title, extra = {}) => ({id, title, platform: 'ps5', releaseDate: '2024-03-22',
  art: {cover: 'https://image.api.playstation.com/c.png'}, ...extra});
const file = url => ({id: url, provider: 'Archive.org', label: '', format: 'pkg', url});
const check = (games, releases, extra = {}) => validateCatalog({games, releasesOf: id => releases[id] ?? [file(`https://archive.org/download/${id}/g.pkg`)],
  today: '2026-10-08', ...extra});

test('a clean catalog passes', () => {
  assert.deepEqual(check([game('PPSA1', 'One'), game('PPSA2', 'Two')], {}).errors, []);
});

test('future dates, storage-node covers, missing sources and dead defaults fail the build', () => {
  const {errors} = check([
    game('PPSA1', 'Future', {releaseDate: '2026-10-09'}),
    game('PPSA2', 'Node cover', {art: {cover: 'https://dn710101.ca.archive.org/0/items/x/y.png'}}),
    game('PPSA3', 'Nothing'),
    game('PPSA4', 'Dead'),
  ], {PPSA3: [], PPSA4: [file('https://archive.org/download/gone/g.pkg')]},
  {audit: [{url: 'https://archive.org/download/gone/g.pkg', verdict: 'blocked'}]});
  assert.deepEqual(errors.map(line => line.split(':')[0]), ['PPSA1 Future', 'PPSA2 Node cover', 'PPSA3 Nothing', 'PPSA4 Dead']);
});

test('two cards for one work on one platform fail; a twin does not', () => {
  const {errors} = check([game('PPSA1', 'Tekken 8'), game('PPSA2', 'TEKKEN 8 Ultimate Edition')], {});
  assert.match(errors[0], /second card/);
  assert.deepEqual(validateCatalog({games: [game('PPSA1', 'Tekken 8')], twins: [game('PPSA2', 'TEKKEN 8')],
    releasesOf: id => [file(`https://archive.org/download/${id}/g.pkg`)], today: '2026-10-08'}).errors, []);
});
