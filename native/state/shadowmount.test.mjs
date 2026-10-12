// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createShadowMountProbe} from './shadowmount.js';

function fixture(reply) {
  const calls = [];
  let time = 0;
  const http = {async request(url) { calls.push(url); return reply(); }};
  return {calls, advance: ms => { time += ms; }, probe: createShadowMountProbe({http, now: () => time})};
}

test('a recent answer is reused instead of probing again', async () => {
  const f = fixture(() => ({ok: true}));
  assert.equal(await f.probe(), true);
  f.advance(29_000);
  assert.equal(await f.probe(), true);
  assert.deepEqual(f.calls, ['http://127.0.0.1:10101/api/v1/version']);
  f.advance(1_000);
  await f.probe();
  assert.equal(f.calls.length, 2);
});

test('a refused connection reads as unreachable and is asked again on the next call', async () => {
  const f = fixture(() => { throw new Error('Couldn\'t connect to server'); });
  assert.equal(await f.probe(), false);
  assert.equal(await f.probe(), false);
  assert.equal(f.calls.length, 2);
});

test('any HTTP answer means ShadowMount is running, even an error status', async () => {
  assert.equal(await fixture(() => ({ok: false, status: 404})).probe(), true);
  assert.equal(await fixture(() => ({ok: false, status: 409})).probe(), true);
});
