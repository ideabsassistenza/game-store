// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {alertsBetween} from './alerts.js';

const job = (id, state, error = '') => ({id, gameId: id, title: `Game ${id}`, state, error, release: {}});

test('only transitions into completed or failed raise alerts', () => {
  const before = [job('a', 'downloading'), job('b', 'downloading'), job('c', 'paused'), job('d', 'downloaded')];
  const after = [job('a', 'downloaded'), job('b', 'failed', 'HTTP 404'), job('c', 'paused'), job('d', 'downloaded'), job('e', 'failed', 'x')];
  assert.deepEqual(alertsBetween(before, after).map(alert => [alert.kind, alert.gameId, alert.message]),
    [['complete', 'a', 'Download complete'], ['failed', 'b', 'Download link no longer works']]);
  assert.deepEqual(alertsBetween(after, after), []);
});
