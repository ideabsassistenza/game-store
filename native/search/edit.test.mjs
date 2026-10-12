// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {edit} from './edit.js';
test('URL editing preserves case, punctuation and allows URLs beyond the search limit', () => {
  const url = 'https://files.example/CaseSensitive?key=A&B=1';
  assert.equal(edit(url, '#', 8192), url + '#');
  assert.equal(edit(url, 'delete', 8192), url.slice(0, -1));
  assert.equal(edit(url, 'clear', 8192), '');
  assert.equal(edit('x'.repeat(40), 'y'), 'x'.repeat(40));
});
