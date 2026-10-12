// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {formatBytes, formatSize} from './size.js';

test('sizes are decimal, as the console counts them, and switch from MB to GB after rounding', () => {
  assert.equal(formatSize(0.5), '500 MB');
  assert.equal(formatBytes(999.4e6), '999 MB');
  assert.equal(formatBytes(999.6e6), '1 GB');
  assert.equal(formatBytes(127.169e9), '127.2 GB');
  assert.equal(formatSize(4000), '4000 GB');
});
