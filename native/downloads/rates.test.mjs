// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createActivity, createThroughput} from './rates.js';

const MB = 1024 ** 2;
const job = (state, bytesPerSecond, extra = {}) => ({id: 'a', state, bytesPerSecond, connections: 64, total: 100 * MB, written: 10 * MB, ...extra});

test('a download stays active through ticks that wrote nothing', () => {
  const measure = createActivity();
  measure([job('downloading', 40 * MB)], 0);
  const stalled = measure([job('downloading', 0)], 250);
  assert.equal(stalled.active, 1);
  assert.equal(stalled.connections, 64);
  assert.equal(stalled.speed, 20 * MB);
});

test('peak and low leave out warm-up and fully stalled seconds, and reset once nothing downloads', () => {
  const measure = createActivity();
  let at = 0;
  for (const speed of [90, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 30, 30, 30, 30, 0, 0, 0, 0])
    measure([job('downloading', speed * MB)], at += 250);
  const seen = measure([job('downloading', 0)], at += 250);
  assert.equal(seen.peak, 30 * MB);
  assert.equal(seen.low, 7.5 * MB);
  assert.deepEqual(measure([job('paused', 0)], at += 250), {active: 0, speed: 0, connections: 0, left: 0, peak: 0, low: 0, mean: 0});
});

test('throughput samples average each second instead of keeping its last 250 ms tick', () => {
  const measure = createThroughput();
  assert.equal(measure({received: 0, written: 0}, 0), null);
  assert.equal(measure({received: 10 * MB, written: 8 * MB}, 1000), null, 'the first count is a baseline');
  assert.equal(measure({received: 15 * MB, written: 12 * MB}, 1500), null);
  assert.deepEqual(measure({received: 30 * MB, written: 28 * MB, bytesPerSecond: 0}, 2000), {network: 20 * MB, disk: 20 * MB});
});

test('a count going back, as a cut range drops its bytes, starts a new baseline', () => {
  const measure = createThroughput();
  measure({received: 10 * MB, written: 10 * MB}, 0);
  measure({received: 20 * MB, written: 20 * MB}, 1000);
  assert.equal(measure({received: 25 * MB, written: 18 * MB}, 2000), null);
  assert.deepEqual(measure({received: 35 * MB, written: 28 * MB}, 3000), {network: 10 * MB, disk: 10 * MB});
});

test('a set connecting its next volume still counts as downloading', () => {
  const measure = createActivity();
  measure([job('downloading', 40 * MB)], 0);
  assert.equal(measure([job('connecting', 0)], 250).active, 1);
});

// A set's received count is its volume's while its written count is every volume's.
test('a set starting a volume is a new baseline, not a spike', () => {
  const measure = createThroughput();
  const GB = 1024 ** 3;
  assert.equal(measure({received: 0, written: 8 * GB}, 0), null);
  assert.equal(measure({received: 2 * GB, written: 10 * GB}, 1000), null);
  assert.deepEqual(measure({received: 2 * GB + 10 * MB, written: 10 * GB + 10 * MB}, 2000), {network: 10 * MB, disk: 10 * MB});
});
