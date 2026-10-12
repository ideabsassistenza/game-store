// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {rankEntries, regionOf, workKey} from './works.mjs';

test('spellings and edition names of one game share a work key', () => {
  const same = [
    ['Ratchet & Clank: Rift Apart', 'Ratchet and Clank Rift Apart'],
    ['Call of Duty®: Vanguard', 'Call of Duty Vanguard'],
    ['God of War Ragnarök', 'God Of War Ragnarok'],
    ["Marvel's Spider-Man: Miles Morales", 'Marvels Spider Man Miles Morales'],
    ['Tekken 8 Ultimate Edition', 'TEKKEN 8'],
    ['The Witcher 3: Wild Hunt - Complete Edition', 'The Witcher 3: Wild Hunt'],
    ['Resident Evil 7 Biohazard Gold Edition', 'RESIDENT EVIL 7 biohazard'],
    ['Ghost of Tsushima Directors Cut', 'Ghost of Tsushima'],
    ['Nioh Remastered The Complete Edition', 'Nioh'],
  ];
  for (const [a, b] of same) assert.equal(workKey(a), workKey(b), `${a} / ${b}`);
});

test('sequels, mods and other works stay apart', () => {
  assert.notEqual(workKey('Nioh 2'), workKey('Nioh'));
  assert.notEqual(workKey('ELDEN RING™ MOD PT BR'), workKey('ELDEN RING'));
  assert.notEqual(workKey('Sonic Origins Plus'), workKey('Sonic Origins'));
  assert.notEqual(workKey('FINAL FANTASY VII REMAKE'), workKey('FINAL FANTASY VII'));
  assert.equal(workKey('Edition'), 'edition');
});

test('the listed entry is the one the app downloads best, then the one with art', () => {
  const entry = (id, group, health, cover = 'c') => ({id, source: {group, health}, art: {cover, hero: null}, recommendations: 0});
  assert.deepEqual(rankEntries([entry('A', 'browser'), entry('B', 'page'), entry('C', 'page', 'ok')]).map(e => e.id), ['C', 'B', 'A']);
  assert.deepEqual(rankEntries([entry('A', 'page', undefined, null), entry('B', 'page')]).map(e => e.id), ['B', 'A']);
  assert.deepEqual(rankEntries([entry('B', 'page'), entry('A', 'page')]).map(e => e.id), ['A', 'B']);
});

test('the region is the one most labels open with', () => {
  assert.equal(regionOf([{label: 'EUR 9.xx Base - Akirabox'}, {label: 'USA 9.xx Base'}, {label: 'EUR Base'}]), 'EUR');
  assert.equal(regionOf([{label: 'Release 2 Base'}, {label: ''}]), null);
});
