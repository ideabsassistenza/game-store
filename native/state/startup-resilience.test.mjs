// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createDownloadQueue} from './download-queue.js';
import {SAVED_FILES, isRecord, readJSON} from './read-json.js';
import {createUpdater} from './updater.js';

// Every file the app reads from its data folders at launch, fed what a save cut short, an older
// build or a hand edit can leave: none of it may stop the app from opening.
const DAMAGED = {empty: '', truncated: '{"version":1,"jobs":[{"id":', null: 'null', number: '7', text: '"text"',
  garbage: '\u0000\u0007not json', list: '[1,{"a":2}]', record: '{"a":1}'};

function memoryFs(files = {}) {
  const tree = new Map(Object.entries(files));
  return {
    tree,
    exists: path => [...tree.keys()].some(key => key === path || key.startsWith(`${path}/`)),
    stat: path => tree.has(path) ? {isFile: true, size: String(tree.get(path)).length, modified: 0} : ['/data', '/mnt/usb0'].includes(path) ? {isDirectory: true, device: '1', inode: '2'} : null,
    readFile: path => { if (!tree.has(path)) throw new Error(`ENOENT ${path}`); return tree.get(path); },
    writeFile: (path, text) => { tree.set(path, text); },
    rename(from, to) { tree.set(to, tree.get(from)); tree.delete(from); },
    mkdir() {}, remove: path => { tree.delete(path); }, removeTree: path => { tree.delete(path); }, removeAsync: async path => { tree.delete(path); }, readDir: () => [],
    diskUsage: () => ({total: 2e12, free: 1e12}),
  };
}
const asides = fs => [...fs.tree.keys()].filter(path => /\.unreadable-\d+$/.test(path));
const quiet = () => {};

for (const [name, valid] of Object.entries(SAVED_FILES)) {
  const fallback = () => valid === isRecord ? {} : [];
  for (const [kind, text] of Object.entries(DAMAGED)) {
    if ((kind === 'record' && valid === isRecord)) continue;
    test(`${name}: ${kind} contents load as empty and are kept aside`, () => {
      const path = `/download0/overdrive/${name}`;
      const fs = memoryFs({[path]: text});
      assert.deepEqual(readJSON(fs, path, fallback(), valid, quiet), fallback());
      assert.equal(fs.tree.get(asides(fs)[0]), text);
      assert.ok(!fs.tree.has(path));
    });
  }
  test(`${name}: a file the console refuses to read loads as empty and stays`, () => {
    const path = `/download0/overdrive/${name}`;
    const fs = memoryFs({[path]: '[]'});
    fs.readFile = () => { throw new Error('EPERM'); };
    assert.deepEqual(readJSON(fs, path, fallback(), valid, quiet), fallback());
    assert.ok(fs.tree.has(path) && !asides(fs).length);
  });
  test(`${name}: a file that cannot be moved aside still loads as empty`, () => {
    const path = `/download0/overdrive/${name}`;
    const fs = memoryFs({[path]: ''});
    fs.rename = () => { throw new Error('EROFS'); };
    assert.deepEqual(readJSON(fs, path, fallback(), valid, quiet), fallback());
  });
}

const queueDependencies = fs => ({fs, downloads: {enqueue() { throw new Error('no downloads in this test'); }},
  formats: {artifact: () => ({destination: '/data/x', directory: '/data', nextAction: 'shadowmount'})}, http: {request: async () => ({ok: false})},
  dataDir: '/download0', stateDir: '/data/queue', platform: 'ps5', notifications: {show: () => true}, power: {keepAwake() {}}, archives: {}});

for (const where of ['/data/queue/downloads.json', '/data/queue/downloads.json.tmp', '/download0/overdrive/downloads.json']) {
  for (const [kind, text] of Object.entries(DAMAGED)) {
    test(`download queue: ${kind} ${where} opens an empty queue and is kept aside`, () => {
      const fs = memoryFs({[where]: text});
      const log = console.log;
      console.log = quiet;
      try {
        assert.deepEqual(createDownloadQueue(queueDependencies(fs)).snapshot(), []);
      } finally { console.log = log; }
      assert.equal(fs.tree.get(asides(fs)[0]), text);
    });
  }
}

for (const [kind, text] of Object.entries(DAMAGED)) {
  test(`update marker: ${kind} contents are dropped and the update check goes on`, async () => {
    const marker = '/download0/overdrive/pending-image.json';
    const fs = memoryFs({[marker]: text, '/data/homebrew/Overdrive-PPSA99058.exfat': 'image'});
    const http = {request: async () => ({ok: true, json: async () => ({tag_name: 'v0.0.1', assets: []})})};
    const updater = createUpdater({http, downloads: {}, archives: {}, fs, version: '0.0.108', feed: 'https://example.com/feed',
      asset: 'Overdrive-PPSA99058.exfat.zip', image: '/data/homebrew/Overdrive-PPSA99058.exfat', workDir: '/data/overdrive-update', marker, log: quiet});
    assert.equal(await updater.check(), null);
    assert.ok(!fs.tree.has(marker));
  });
}
