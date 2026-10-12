// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {formatTimeLeft} from './format.js';

test('time left rounds into the next unit instead of reading "60 s"', () => {
  assert.equal(formatTimeLeft(0.2), '1 s left');
  assert.equal(formatTimeLeft(59.4), '59 s left');
  assert.equal(formatTimeLeft(59.7), '1 min left');
  assert.equal(formatTimeLeft(3599), '1 h 0 min left');
  assert.equal(formatTimeLeft(5400), '1 h 30 min left');
});
