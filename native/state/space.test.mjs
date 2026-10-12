// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {MARGIN, spaceShortfall, stillNeeded} from './space.js';

const GB = 1e9;

test('a release fits when the free space covers it and the margin', () => {
  assert.equal(spaceShortfall('/data', 10 * GB, 10 * GB + MARGIN, []), '');
  assert.equal(spaceShortfall('/data', 10 * GB, 10 * GB, []), 'Not enough space on /data: needs 10 GB, 10 GB free');
});

test('unfinished downloads on the same root hold back what they still have to write', () => {
  const pending = [{title: 'Astro Bot', total: 20 * GB, written: 5 * GB}, {title: 'Sizeless', total: null, written: 0}];
  assert.equal(spaceShortfall('/mnt/usb0', 42.1 * GB, 45 * GB, pending),
    'Not enough space on /mnt/usb0: needs 42.1 GB, 30 GB free after queued downloads: Astro Bot (15 GB)');
  assert.equal(spaceShortfall('/data', GB, 0, [{title: 'Astro Bot', total: 2 * GB, written: 0}]),
    'Not enough space on /data: needs 1 GB, 0 MB free after queued downloads: Astro Bot (2 GB)');
});

test('the message names the largest downloads holding the space, and how many more', () => {
  const pending = [5, 40, 1, 20].map(size => ({title: `Game ${size}`, total: size * GB, written: 0}));
  assert.equal(spaceShortfall('/data', 77 * GB, 125 * GB, pending),
    'Not enough space on /data: needs 77 GB, 59 GB free after queued downloads: Game 40 (40 GB), Game 20 (20 GB), Game 5 (5 GB), +1');
  assert.equal(spaceShortfall('/data', 77 * GB, 125 * GB, pending.slice(2)), '');
});

test('an archive holds back room to extract what it downloads', () => {
  const archive = {title: 'Archive', total: 10 * GB, written: 4 * GB, artifact: {nextAction: 'extraction-required'}};
  assert.equal(stillNeeded(archive), 16 * GB);
  assert.equal(stillNeeded({...archive, artifact: undefined, release: {parts: []}}), 16 * GB);
  assert.equal(stillNeeded({...archive, artifact: {nextAction: 'shadowmount'}}), 6 * GB);
  assert.equal(spaceShortfall('/data', GB, 18 * GB, [archive]), '');
  assert.match(spaceShortfall('/data', 2 * GB, 17 * GB, [archive]), /after queued downloads: Archive \(16 GB\)$/);
});

// A 77 GB release was refused on a drive with 125 GB free while another archive extracted: its
// extraction was counted as if its archive still had to be downloaded.
test('an extracting archive holds back only the rest of its output', () => {
  const extracting = {title: 'Archive', state: 'extracting', total: 40 * GB, written: 10 * GB,
    artifact: {nextAction: 'extraction-required'}};
  assert.equal(stillNeeded(extracting), 30 * GB);
  assert.equal(stillNeeded({...extracting, artifact: undefined, release: {parts: []}}), 30 * GB);
  assert.equal(spaceShortfall('/data', 77 * GB, 125 * GB, [extracting]), '');
});

test('an install holds back nothing: its package is already on the drive', () => {
  const installing = {title: 'Package', state: 'installing', total: 30 * GB, written: GB, release: {parts: []}};
  assert.equal(stillNeeded(installing), 0);
  assert.equal(spaceShortfall('/data', 77 * GB, 78 * GB, [installing]), '');
});

test('a set whose volume sizes are not known yet holds back its catalog size', () => {
  const set = {title: 'Set', total: null, written: 0, release: {parts: [], sizeBytes: 10 * GB}};
  assert.equal(stillNeeded(set), 20 * GB);
  assert.equal(stillNeeded({...set, release: {parts: []}}), 0);
});
