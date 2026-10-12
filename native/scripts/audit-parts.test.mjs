// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {releaseSets} from '../state/release-sets.js';
import {PAGES, setRecord, sizesByName} from './audit-parts.mjs';

const GB = 1024 ** 3;
const name = '[fixture-password]-PPSA03671.part09.rar';

test('each host page gives the volume name and, where shown, its size', () => {
  assert.deepEqual(PAGES.vikingfile(`<div id="filename">${name}</div><div id="size">9.90 GB</div>`), {name, bytes: Math.round(9.9 * GB)});
  assert.deepEqual(PAGES.akirabox(`<meta property="og:title" content="${name}"/><meta name="description" content="RAR file · 9.90 GB — download it free on AkiraBox."/>`),
    {name, bytes: Math.round(9.9 * GB)});
  assert.deepEqual(PAGES.rootz(`<title>${name}</title>`), {name});
  assert.deepEqual(PAGES['1fichier'](`<span class="tier-name">${name}</span>\n<span class="tier-feat">10.63 GB</span>`), {name, bytes: 10.63e9});
  assert.deepEqual(PAGES.mediafire(`<div class="filename">${name}</div><a>Download (9.9GB)</a>`), {name, bytes: Math.round(9.9 * GB)});
  assert.deepEqual(PAGES.vikingfile('<title>File not found</title>'), {});
});

const job = (count, declaredBytes, host = 'vikingfile.com/f') => {
  const releases = Array.from({length: count}, (_, index) => ({id: `pegasus-0-67-${host.length}${index}`, provider: host,
    label: `USA 13.xx Base - ${host} part ${index+1}`, url: `https://${host}/w${index+1}`}));
  return {game: {id: 'PPSA03671', title: 'Marvel’s Wolverine'}, set: releaseSets(releases)[0], declaredBytes};
};
const volume = number => `[fixture-password]-PPSA03671.part${number}.rar`;
const pages = (count, last, host = 'vikingfile.com/f') => new Map([[`https://${host}/w1`, {status: 200, name: volume(1), bytes: 9.9 * GB}],
  [`https://${host}/w${count}`, {status: 200, name: volume(count), bytes: last}]]);

test('a set record carries the verdict and what each volume page showed', () => {
  const short = setRecord(job(4, 48 * GB), pages(4, 9.9 * GB));
  assert.equal(short.verdict, 'incomplete');
  assert.equal(short.reason, 'last');
  assert.deepEqual(short.parts.map(part => part.url), [1, 2, 3, 4].map(n => `https://vikingfile.com/f/w${n}`));
  assert.equal(setRecord(job(4), pages(4, 9.9 * GB)).verdict, 'unproven');
  const once = pages(5, 7.4 * GB).set('https://vikingfile.com/f/w5', {status: 404});
  assert.equal(setRecord(job(5, 48 * GB), once).verdict, 'unread');
  assert.equal(setRecord(job(5, 48 * GB), once.set('https://vikingfile.com/f/w5', {status: 404, confirmed: true})).verdict, 'gone');
  assert.equal(setRecord(job(5, 48 * GB), pages(5, 7.4 * GB)).verdict, 'ok');
  assert.equal(setRecord(job(5, 48 * GB), new Map()).verdict, 'unread');
});

test('a host that shows no size takes it from a file of the same name on another host', () => {
  const viking = job(4, 48 * GB);
  const rootz = job(4, 48 * GB, 'www.rootz.so/d');
  const read = new Map([...pages(4, 9.9 * GB), ['https://www.rootz.so/d/w4', {status: 200, name: volume(4)}]]);
  const record = setRecord(rootz, read, sizesByName([viking, rootz], read));
  assert.equal(record.verdict, 'incomplete');
  assert.equal(record.parts[0].bytes, undefined);
});

test('a full last volume is proof without the game size once another host shows the next volume', () => {
  const five = job(5, undefined, 'akirabox.com');
  const read = new Map([...pages(4, 9.9 * GB), ['https://akirabox.com/w5', {status: 200, name: volume(5), bytes: 3 * GB}]]);
  assert.equal(setRecord(job(4), read, sizesByName([job(4), five], read)).verdict, 'incomplete');
});

test('files of one name whose sizes disagree give no size to borrow', () => {
  // TEKKEN 8: a part10 of 7.13 GB on one host and of 9.90 GB on another.
  const viking = job(4, 48 * GB);
  const other = job(4, 48 * GB, 'akirabox.com');
  const rootz = job(4, 48 * GB, 'www.rootz.so/d');
  const read = new Map([...pages(4, 9.9 * GB), ['https://akirabox.com/w4', {status: 200, name: volume(4), bytes: 7.13 * GB}],
    ['https://www.rootz.so/d/w4', {status: 200, name: volume(4)}]]);
  assert.equal(setRecord(rootz, read, sizesByName([viking, other, rootz], read)).verdict, 'ok');
});
