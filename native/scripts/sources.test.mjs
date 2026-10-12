// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {providerKey, sourceRules} from './sources.mjs';

const audit = [
  {url: 'https://archive.org/download/a/private.pkg', verdict: 'blocked', httpStatus: 401},
  {url: 'https://fileditchfiles.st/x/game.exfat', verdict: 'not_direct', httpStatus: 200},
  {url: 'https://vikingfile.com/d/gone/game.exfat', verdict: 'invalid', httpStatus: 404},
  {url: 'https://archive.org/download/a/busy.pkg', verdict: 'uncertain', httpStatus: 500},
  {url: 'https://archive.org/download/a/fine.pkg', verdict: 'reachable', httpStatus: 200},
];

test('a disabled host is left out by its name or by the domain of its links', () => {
  const {why} = sourceRules(audit);
  assert.equal(why({provider: 'Spectrum', manifestUrl: 'https://example.com/m.json'}), 'host');
  assert.equal(why({provider: 'Mirror', url: 'https://api.spectrumlibrary.online/dl?url=x'}), 'host');
});

test('Rootz and AkiraBox are off however a feed spells or wraps them, and other hosts stay', () => {
  const {why} = sourceRules(audit);
  for (const release of [
    {provider: 'www.rootz.so', url: 'https://www.rootz.so/d/a'},
    {provider: 'rootz.so', url: 'https://rootz.so/d/a'},
    {provider: 'Rootz', browserUrl: 'https://example.com/a'},
    {provider: 'AkiraBox', url: 'https://akirabox.com/abc/file'},
    {provider: 'akirabox.to', url: 'https://akirabox.to/abc/file'},
    {provider: 'example.com', url: 'https://cdn.akirabox.to/abc/file'},
    {provider: 'links.example.com', url: 'https://links.example.com/c/AbCd1234#AkiraBox'},
  ]) assert.equal(why(release), 'host', JSON.stringify(release));
  for (const release of [
    {provider: 'VikingFile', url: 'https://vikingfile.com/f/abc'},
    {provider: 'MediaFire', url: 'https://www.mediafire.com/file/abc'},
    {provider: 'links.example.com', url: 'https://links.example.com/c/AbCd1234#VikingFile'},
    {provider: 'example.com', url: 'https://notakirabox.com/abc/file'},
    {provider: 'example.com', url: 'https://rootz.so.example.com/d/a'},
  ]) assert.equal(why(release), null, JSON.stringify(release));
});

test('only links the audit found gone are dead; a server error is not proof', () => {
  const {why} = sourceRules(audit);
  for (const url of audit.slice(0, 3).map(record => record.url)) assert.equal(why({provider: 'x', url}), 'dead');
  assert.equal(why({provider: 'Archive.org', url: audit[3].url}), null);
  assert.equal(why({provider: 'Archive.org', url: audit[4].url}), null);
  assert.equal(why({provider: 'x', browserUrl: audit[0].url}), 'dead');
});

test('provider keys ignore www and the top-level domain', () => {
  assert.equal(providerKey('www.rootz.so'), 'rootz');
  assert.equal(providerKey('akirabox.to'), 'akirabox');
});

test('a kept link carries the audit health that ranks it', () => {
  const {health} = sourceRules(audit);
  assert.equal(health({url: audit[3].url}), 'flaky');
  assert.equal(health({url: audit[4].url}), 'ok');
  assert.equal(health({url: 'https://example.com/never-checked.pkg'}), undefined);
});

test('every volume of a set the part audit found cut short is left out, and the game keeps its other sets', () => {
  const part = number => ({provider: '1fichier.com', url: `https://1fichier.com/?w${number}`, label: `USA 13.xx Base - 1fichier part ${number}`});
  const {why} = sourceRules(audit, [
    {gameId: 'PPSA03671', verdict: 'incomplete', reason: 'count', parts: [1, 2].map(number => ({number, url: part(number).url}))},
    {gameId: 'PPSA03671', verdict: 'ok', parts: [{number: 1, url: 'https://www.mediafire.com/file/a'}]},
  ]);
  assert.deepEqual([1, 2].map(number => why(part(number), 'PPSA03671')), ['incomplete', 'incomplete']);
  assert.equal(why({provider: 'MediaFire', url: 'https://www.mediafire.com/file/a'}, 'PPSA03671'), null);
});

test('a set with a volume its host answered 404 twice is dead, every volume of it', () => {
  const {why} = sourceRules(audit, [{gameId: 'PPSA10662', verdict: 'gone', parts: [1, 2].map(number => ({number, url: `https://vikingfile.com/f/g${number}`}))}]);
  assert.deepEqual([1, 2].map(number => why({provider: 'VikingFile', url: `https://vikingfile.com/f/g${number}`}, 'PPSA10662')), ['dead', 'dead']);
});

test('a link in sets of two games takes each set its own verdict', () => {
  const set = (gameId, verdict, ids) => ({gameId, verdict, parts: ids.map((id, index) => ({number: index+1, url: `https://${id}`}))});
  const {why} = sourceRules(audit, [
    // Forza Horizon 5's 1fichier set holds a volume of Khazan's, whose own set is whole.
    set('PPSA22327', 'incomplete', ['1fichier.com/?f1', '1fichier.com/?k3', '1fichier.com/?f3']),
    set('PPSA20447', 'ok', ['1fichier.com/?k1', '1fichier.com/?k2', '1fichier.com/?k3']),
    // The Last of Us Part I's set is whole; two other games' sets with the same volume lost another one.
    set('PPSA10662', 'gone', ['vikingfile.com/f/a1', 'vikingfile.com/f/50mhr9mMmZ', 'vikingfile.com/f/a3']),
    set('PPSA03396', 'ok', ['vikingfile.com/f/t1', 'vikingfile.com/f/50mhr9mMmZ', 'vikingfile.com/f/t3']),
    set('PPSA05684', 'gone', ['vikingfile.com/f/b1', 'vikingfile.com/f/b2', 'vikingfile.com/f/50mhr9mMmZ']),
  ]);
  const release = id => ({provider: 'x', url: `https://${id}`});
  assert.equal(why(release('1fichier.com/?k3'), 'PPSA22327'), 'incomplete');
  assert.equal(why(release('1fichier.com/?k3'), 'PPSA20447'), null);
  assert.equal(why(release('vikingfile.com/f/50mhr9mMmZ'), 'PPSA03396'), null);
  assert.equal(why(release('vikingfile.com/f/50mhr9mMmZ'), 'PPSA10662'), 'dead');
});

test('a set with only a full last volume against it is unproven, not incomplete', () => {
  const {why} = sourceRules(audit, [{gameId: 'PPSA28416', verdict: 'unproven', reason: 'last', parts: [{number: 1, url: 'https://vikingfile.com/f/s1'}]}]);
  assert.equal(why({provider: 'VikingFile', url: 'https://vikingfile.com/f/s1'}, 'PPSA28416'), 'unproven');
});
