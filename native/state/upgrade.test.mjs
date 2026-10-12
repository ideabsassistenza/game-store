// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {VERSION} from '../version.js';
import {clearAction} from '../downloads/labels.js';
import {BUSY, COMPLETE, createDownloadQueue} from './download-queue.js';
import {upgradeFixtures} from './fixtures/upgrade/fixtures.mjs';
import {SAVED_FILES, isRecord, readJSON} from './read-json.js';
import {createUpdater} from './updater.js';

// What each shipped version left on a console (native/state/fixtures/upgrade), loaded by this build's
// readers the way an update finds it: nothing may throw, and every job and saved entry stays.
const DATA = '/download0';
const QUEUE = '/data/ps5-react/PPSA99058/queue';
const IMAGE = '/data/homebrew/Overdrive-PPSA99058.exfat';
const ROOTS = {'/data': {device: '1', inode: '2'}, '/mnt/usb0': {device: '9', inode: '41'}};
const STATES = [...BUSY, ...COMPLETE, 'paused', 'failed', 'awaiting-browser'];
const quiet = () => {};

// `online`: the jobs' drives answer, so what was running resumes.
function memoryFs(files, online) {
  const tree = new Map(Object.entries(files));
  return {
    tree,
    exists: path => tree.has(path) || [...tree.keys()].some(key => key.startsWith(`${path}/`)),
    stat: path => tree.has(path) ? {isFile: true, size: tree.get(path).length, modified: 0} : ROOTS[path] ? {isDirectory: true, ...ROOTS[path]} : null,
    readFile: path => { if (!tree.has(path)) throw new Error(`ENOENT ${path}`); return tree.get(path); },
    writeFile: (path, text) => { tree.set(path, text); },
    rename(from, to) { tree.set(to, tree.get(from)); tree.delete(from); },
    mkdir() {}, remove: path => { tree.delete(path); }, removeTree: path => { tree.delete(path); }, readDir: () => [],
    removals: [],
    async removeAsync(path) { this.removals.push(path); for (const key of [...tree.keys()]) if (key === path || key.startsWith(`${path}/`)) tree.delete(key); },
    diskUsage: () => { if (!online) throw new Error('ENODEV'); return {total: 2e12, free: 1e12}; },
  };
}

const onConsole = files => Object.fromEntries(Object.entries(files).map(([path, text]) =>
  [path.replace(/^data-dir/, DATA).replace(/^queue-dir/, QUEUE), text]));

// The transfers never start: a job that resumes stays where the queue put it.
const pending = () => new Promise(() => {});
const queueOver = (fs, http = {request: pending}) => createDownloadQueue({fs, formats: {}, http, sources: {resolve: pending},
  downloads: {enqueue: () => ({subscribe: () => () => {}, done: pending(), cancel() {}})},
  dataDir: DATA, stateDir: QUEUE, platform: 'ps5', notifications: {show: () => true}, power: {keepAwake() {}}, archives: {}});

function quietly(run) {
  const log = console.log;
  console.log = quiet;
  try { return run(); } finally { console.log = log; }
}

// The jobs the queue should come back with: the newest queue file a version wrote.
function savedJobs(files) {
  const text = files['queue-dir/downloads.json'] ?? files['data-dir/overdrive/downloads.json'];
  return text ? JSON.parse(text).jobs : [];
}

const asides = fs => [...fs.tree.keys()].filter(path => /\.unreadable-\d+$/.test(path));

for (const {version, files} of upgradeFixtures()) {
  test(`${version}: the saved lists load as they were`, () => {
    const fs = memoryFs(onConsole(files), false);
    for (const [name, valid] of Object.entries(SAVED_FILES)) {
      const path = `${DATA}/overdrive/${name}`;
      const fallback = valid === isRecord ? {} : [];
      assert.deepEqual(readJSON(fs, path, fallback, valid, quiet), files[`data-dir/overdrive/${name}`] ? JSON.parse(files[`data-dir/overdrive/${name}`]) : fallback, name);
    }
    assert.deepEqual(asides(fs), asides(memoryFs(onConsole(files))));
  });

  test(`${version}: every job comes back, stopped where it was`, () => {
    const fs = memoryFs(onConsole(files), false);
    const jobs = quietly(() => queueOver(fs).snapshot());
    const saved = savedJobs(files);
    assert.ok(saved.length > 0);
    assert.deepEqual(jobs.map(job => job.id), saved.map(job => job.id));
    for (const [index, before] of saved.entries()) {
      const after = jobs[index];
      const expected = before.state === 'installing' ? 'installer-required' : BUSY.includes(before.state) ? 'paused' : before.state;
      assert.equal(after.state, expected, `${after.id} was ${before.state}`);
      for (const key of ['release', 'artifact', 'root', 'parts', 'adopted', 'output', 'publishTo', 'downloadDestination', 'installedTitleId', 'fallbacks',
        'packages', 'install', 'routing'])
        assert.deepEqual(after[key], before[key], `${after.id}: ${key}`);
      assert.equal(after.written, before.state === 'extracting' ? before.total : before.written, `${after.id}: written`);
      assert.equal(after.captureState, undefined);
    }
    // The queue now lives in its own folder; a copy in the data folder is renamed, never read again.
    assert.deepEqual(JSON.parse(fs.tree.get(`${QUEUE}/downloads.json`)).jobs.map(job => job.id), saved.map(job => job.id));
    assert.ok(!fs.tree.has(`${DATA}/overdrive/downloads.json`));
    assert.deepEqual(asides(fs), asides(memoryFs(onConsole(files))));
  });

  test(`${version}: with the drives connected, what was running resumes`, () => {
    const fs = memoryFs(onConsole(files), true);
    const jobs = quietly(() => queueOver(fs).snapshot());
    const saved = savedJobs(files);
    assert.deepEqual(jobs.map(job => job.id), saved.map(job => job.id));
    for (const job of jobs) assert.ok(STATES.includes(job.state), `${job.id}: ${job.state}`);
    assert.ok(jobs.filter(job => BUSY.includes(job.state) && job.state !== 'queued').length <= 1);
    // A job running at each of the last two launches stays paused: it may be what closed the app.
    for (const before of saved.filter(job => job.launches >= 2))
      assert.equal(jobs.find(job => job.id === before.id).state, 'paused');
  });

  test(`${version}: an update marker left behind is cleared and the update check goes on`, async () => {
    const marker = `${DATA}/overdrive/pending-image.json`;
    const fs = memoryFs({...onConsole(files), [IMAGE]: 'image'}, false);
    const http = {request: async () => ({ok: true, json: async () => ({tag_name: `v${VERSION}`, assets: []})})};
    const updater = createUpdater({http, downloads: {}, archives: {}, fs, version: VERSION, feed: 'https://example.com/feed',
      asset: 'Overdrive-PPSA99058.exfat.zip', image: IMAGE, workDir: '/data/overdrive-update', marker});
    const log = console.log;
    console.log = quiet;
    try { assert.equal(await updater.check(), null); } finally { console.log = log; }
    assert.ok(!fs.tree.has(marker));
  });
}

// 0.1.4 moved an extracted game folder to homebrew/ for ShadowMount: its artifact, output and publishTo
// all name the folder. What deletes a finished download now reads them.
test('0.1.4: X on an extracted game only takes it off the list, and Delete touches only its own folder', async () => {
  const {files} = upgradeFixtures().find(set => set.version === '0.1.4');
  const saved = savedJobs(files);
  const ready = saved.find(job => job.id === 'PPSA03845/archive-deadspace-2');
  const installed = saved.find(job => job.id === 'PPSA07950/archive-stellar-1');
  const disk = {[`${ready.publishTo}/eboot.bin`]: 'game', [`${ready.publishTo}/sce_sys/param.json`]: '{}',
    [`${installed.publishTo}/eboot.bin`]: 'game', [`${ready.publishTo}-old/eboot.bin`]: 'a folder beside it',
    '/data/homebrew/PPSA03845-another-dump/eboot.bin': 'another dump of the game'};
  const game = path => !path.startsWith(`${DATA}/`) && !path.startsWith(`${QUEUE}/`);
  const onDisk = fs => [...fs.tree.keys()].filter(game).sort();

  const fs = memoryFs({...onConsole(files), ...disk}, true);
  const queue = quietly(() => queueOver(fs));
  for (const job of [ready, installed]) {
    const loaded = queue.snapshot().find(item => item.id === job.id);
    assert.equal(clearAction(loaded.state), 'remove', job.id);
    queue.remove(job.id);
  }
  assert.ok(!queue.snapshot().some(job => [ready.id, installed.id].includes(job.id)));
  assert.deepEqual(onDisk(fs), Object.keys(disk).sort());
  assert.deepEqual(fs.removals, []);

  // ShadowMount not running mounts nothing, so the files go.
  const deleting = memoryFs({...onConsole(files), ...disk}, true);
  const offline = {request: async () => { throw new Error('Connection refused'); }};
  const log = console.log;
  console.log = quiet;
  try { await queueOver(deleting, offline).deleteFromDisk(ready.id); } finally { console.log = log; }
  const own = [ready.publishTo, ready.output];
  assert.ok(deleting.removals.length > 0);
  for (const path of deleting.removals) assert.ok(own.some(base => path === base || path.startsWith(`${base}/`)), path);
  assert.deepEqual(onDisk(deleting), Object.keys(disk).filter(path => !path.startsWith(`${ready.publishTo}/`)).sort());
  assert.ok(!JSON.parse(deleting.tree.get(`${QUEUE}/downloads.json`)).jobs.some(job => job.id === ready.id));
});
