// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {COMPLETE} from '../state/download-queue.js';
import {WAITING, clearAction, hasStateLabel, shownState, stateLabel} from './labels.js';

test('an extraction writing its last files reads as finishing, with a shimmer instead of a percentage', () => {
  assert.equal(shownState({state: 'extracting', phase: 'finishing'}), 'finishing');
  assert.equal(stateLabel('finishing'), 'Finishing up…');
  assert.ok(hasStateLabel('finishing') && WAITING.includes('finishing'));
});

test('an engine without the phase, or any other state, reads as before', () => {
  assert.equal(shownState({state: 'extracting'}), 'extracting');
  assert.equal(shownState({state: 'extracting', phase: 'extracting'}), 'extracting');
  assert.equal(shownState({state: 'paused', phase: 'finishing'}), 'paused');
  assert.ok(!WAITING.includes('extracting'));
});

test('X on a finished download only takes it off the list; on any other it cancels', () => {
  for (const state of COMPLETE) assert.equal(clearAction(state), 'remove', state);
  for (const state of ['queued', 'downloading', 'extracting', 'paused', 'failed', 'awaiting-browser']) assert.equal(clearAction(state), 'cancel', state);
});
