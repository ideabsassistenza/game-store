// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {deletionTargets, isPackage, scanDrive, totals} from './scan.js';

const file = (name, size) => ({name, size, isDirectory: false, modified: 1});
const dir = name => ({name, size: 0, isDirectory: true, modified: 1});
const tree = {
  '/data/downloads/packages': [file('CUSA24899-game.pkg', 7e9), file('CUSA24899-game.pkg.complete', 168), file('x.pkg.part', 5)],
  '/data/homebrew': [file('PPSA02100-stray.exfat', 9e9), file('.ps5-react-extraction', 3)],
  '/data/downloads/extracted': [dir('set')],
  '/data/downloads/extracted/set': [file('a.bin', 2), dir('deep')],
  '/data/downloads/extracted/set/deep': [file('b.bin', 3)],
};
const fs = {readDir: path => { if (!tree[path]) throw new Error('missing'); return tree[path]; }};

test('a drive lists its downloads by kind, largest first, without bookkeeping files', () => {
  const files = scanDrive(fs, '/data');
  assert.deepEqual(files.map(item => [item.kind, item.name, item.size]),
    [['images', 'PPSA02100-stray.exfat', 9e9], ['packages', 'CUSA24899-game.pkg', 7e9], ['extracted', 'set', 5]]);
  assert.equal(files[1].titleId, 'CUSA24899');
  assert.equal(files[1].platform, 'ps4');
  assert.equal(files[0].platform, 'ps5');
});

test('totals count each kind and the whole', () => {
  const sums = totals(scanDrive(fs, '/data'));
  assert.deepEqual(sums.all, {count: 3, size: 16e9 + 5});
  assert.deepEqual(sums.packages, {count: 1, size: 7e9});
  assert.deepEqual(sums.other, {count: 0, size: 0});
});

test('deleting a file takes its receipt and partial state with it', () => {
  assert.deepEqual(deletionTargets({path: '/data/a.pkg', isDirectory: false}),
    ['/data/a.pkg', '/data/a.pkg.complete', '/data/a.pkg.resume', '/data/a.pkg.part']);
  assert.deepEqual(deletionTargets({path: '/data/set', isDirectory: true}), ['/data/set']);
  assert.ok(isPackage('x.FPKG') && isPackage('y.pkg') && !isPackage('z.exfat'));
});
