// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createPageCache} from './page-cache.js';

const page = path => JSON.stringify({about: [path], shots: []});

test('page cache keeps the eight games read last and reads nothing outside data/pages', () => {
  const reads = [];
  const cache = createPageCache(path => { reads.push(path); return page(path); });
  const first = cache('data/pages/PPSA00000.json');
  for (let i = 1; i < 8; i++) cache(`data/pages/PPSA0000${i}.json`);
  assert.equal(cache('data/pages/PPSA00000.json'), first);
  cache('data/pages/PPSA00008.json');
  assert.equal(cache('data/pages/PPSA00000.json'), first);
  assert.equal(reads.length, 9);
  cache('data/pages/PPSA00001.json');
  assert.equal(reads.length, 10);
  assert.throws(() => cache('data/pages/../../secret.json'), /Invalid page data path/);
  assert.throws(() => createPageCache(() => '{}')('data/pages/PPSA00000.json'), /Invalid page data/);
});
