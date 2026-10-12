// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createReleaseCache} from './release-cache.js';

test('release cache keeps the last few games parsed and cannot read arbitrary filesystem paths', () => {
  const reads = [];
  const cache = createReleaseCache(path => { reads.push(path); return JSON.stringify([{id: path}]); });
  const file = n => `data/releases/PPSA1234${n}.json`;
  const first = cache(file(0));
  for (let n = 1; n < 6; n++) cache(file(n));
  assert.equal(cache(file(0)), first);
  assert.equal(reads.length, 6);
  cache(file(6));
  cache(file(1));
  assert.equal(reads.length, 8, 'the least recently read game was dropped');
  assert.equal(cache(file(0)), first);
  assert.throws(() => cache('data/releases/../../secret.json'), /Invalid release data path/);
});
