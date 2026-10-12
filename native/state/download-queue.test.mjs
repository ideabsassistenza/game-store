// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createDownloadQueue} from './download-queue.js';
import {stillNeeded} from './space.js';
import {createSourceResolver} from './download-sources.js';
import {explainError} from '../downloads/errors.js';

function fixture() {
  const files = new Map();
  const tasks = [];
  const calls = [];
  const inside = (path, directory) => path === directory || path.startsWith(`${directory}/`);
  const fs = {exists: path => [...files.keys()].some(key => inside(key, path)), readFile: path => files.get(path),
    writeFile: (path, data) => files.set(path, data), rename(from, to) {
      for (const key of [...files.keys()].filter(key => inside(key, from))) { files.set(to+key.slice(from.length), files.get(key)); files.delete(key); }
    },
    readDir(path) {
      const children = new Map();
      for (const key of files.keys()) if (key.startsWith(`${path}/`)) {
        const [name, ...rest] = key.slice(path.length+1).split('/');
        children.set(name, {name, isDirectory: rest.length > 0});
      }
      return [...children.values()];
    },
    mkdir() {}, remove: path => files.delete(path),
    removeTree: path => { for (const key of [...files.keys()]) if (inside(key, path)) files.delete(key); },
    // FileSystem.removeAsync: a file or a whole tree, a step later; a missing path resolves.
    removeAsync: async path => { await Promise.resolve(); for (const key of [...files.keys()]) if (inside(key, path)) files.delete(key); },
    stat: path => ['/data', '/mnt/usb0'].includes(path) ? {isDirectory: true, device: '1', inode: '2'} : files.has(path) ? {isFile: true} : null,
    diskUsage: () => ({free: 1e9})};
  const downloads = {enqueue(options) {
    let resolve, reject;
    const done = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    const task = {options, done, resolve, reject, listener: null,
      subscribe(listener) { task.listener = listener; return () => { task.listener = null; }; },
      cancel() { reject(new Error('cancelled')); }};
    tasks.push(task); return task;
  }};
  const formats = {artifact: (release, root) => ({destination: `${root}/${release.filename}`, directory: root,
    nextAction: release.format === 'pkg' ? 'installer-required' : release.format === 'binary' ? 'downloaded' : 'shadowmount'}),
  detected: (release, root, kind) => ({destination: `${root}/routed/${release.filename.replace(/\.binary$/, '')}.${kind}`,
    directory: `${root}/routed`, nextAction: {pkg: 'installer-required', rar: 'extraction-required', exfat: 'shadowmount'}[kind]}),
  manifest: value => value};
  // What Archives.inspect reports for a path; unknown paths have no recognizable header yet.
  const inspections = new Map();
  const extractions = [];
  const archives = {inspect: ([path]) => inspections.get(path) || {kind: '', refusal: ''},
    extract(options) {
      let resolve;
      const done = new Promise(ok => { resolve = ok; });
      extractions.push({options, resolve});
      return {done, subscribe: () => () => {}, cancel() {}};
    }};
  const http = {async request(url, options) {
    calls.push({url, options});
    return {ok: true, json: async () => ({capabilities: ['rescan'], expectedBytes: 100})};
  }};
  const notices = [];
  const notifications = {show: (message, sub) => { notices.push(`${message}: ${sub}`); return true; }};
  const awake = [];
  const power = {keepAwake: enabled => awake.push(enabled)};
  const waits = [];
  const dependencies = {fs, downloads, formats, http, dataDir: '/download0', platform: 'ps5', notifications, power, archives,
    wait: async ms => { waits.push(ms); }};
  return {files, tasks, calls, notices, awake, waits, fs, inspections, extractions, dependencies, queue: createDownloadQueue(dependencies)};
}
const game = {id: 'PPSA12345', titleId: 'PPSA12345', title: 'Test game'};
const release = {id: 'image', filename: 'game.ffpfsc', format: 'ffpfsc', url: 'https://example.com/file', sizeBytes: 100};
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('browser verification persists, does not block the next job and accepts a final public URL', async () => {
  const f = fixture();
  const opened = [];
  f.dependencies.linking = {openURL: url => { opened.push(url); return true; }};
  f.dependencies.http.request = async url => ({ok: true, status: 200, url, headers: {}});
  const queue = createDownloadQueue(f.dependencies);
  const id = queue.enqueue(game, {...release, requiresBrowser: true}, '/data');
  await settle();
  assert.equal(queue.snapshot()[0].state, 'awaiting-browser');
  assert.equal(queue.awake, false);
  assert.equal(f.tasks.length, 0);
  const restored = createDownloadQueue(f.dependencies);
  assert.equal(restored.snapshot()[0].state, 'awaiting-browser');
  queue.openBrowser(id);
  assert.deepEqual(opened, [release.url]);
  assert.throws(() => queue.continueWithURL(id, 'javascript:alert(1)'), /Invalid HTTP/);
  queue.enqueue(game, {...release, id: 'next', filename: 'next.ffpfsc'}, '/data');
  assert.equal(f.tasks.length, 1);
  queue.continueWithURL(id, 'https://files.example.com/final');
  assert.equal(f.tasks.length, 1);
  f.tasks[0].resolve({}); await settle(); await settle();
  assert.equal(f.tasks.length, 2);
  assert.equal(f.tasks[1].options.url, 'https://files.example.com/final');
  assert.equal(f.tasks[1].options.rejectHtml, true);
});

test('queue persists progress, continues across screens and serializes releases', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  const unsubscribe = f.queue.subscribe(() => {});
  unsubscribe();
  f.tasks[0].listener({state: 'downloading', written: 50, total: 100});
  f.queue.enqueue(game, {...release, id: 'pkg', format: 'pkg', filename: 'game.pkg'}, '/data');
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot()[1].state, 'queued');
  f.tasks[0].resolve({written: 100});
  await settle();
  assert.equal(f.tasks.length, 2);
  assert.equal(f.queue.snapshot()[0].state, 'downloaded');
  f.tasks[1].resolve({written: 100});
  await settle();
  assert.equal(f.queue.snapshot()[1].state, 'installer-required');
  await f.queue.register(id);
  assert.deepEqual(f.calls.map(call => call.url.split('/api/v1/')[1]), ['games/info', 'images', 'version', 'scan']);
  assert.equal(f.queue.snapshot()[0].state, 'downloaded');
  assert.match(f.queue.snapshot()[0].message, /Close Overdrive/);
  const loaded = createDownloadQueue(f.dependencies);
  assert.equal(loaded.snapshot()[1].state, 'installer-required');
});

test('pause waits for native cancellation before resume; a job interrupted mid-transfer resumes on the next launch', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id);
  assert.equal(f.queue.snapshot()[0].state, 'pausing');
  f.queue.resume(id);
  assert.equal(f.tasks.length, 1);
  await settle();
  assert.equal(f.queue.snapshot()[0].state, 'paused');
  f.queue.resume(id);
  assert.equal(f.tasks.length, 2);
  assert.equal(f.tasks[1].options.storageRoot, '/data');
  const loaded = createDownloadQueue(f.dependencies);
  assert.equal(loaded.snapshot()[0].state, 'resolving');
  f.tasks[1].reject(new Error('HTTP 404'));
  await settle();
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  assert.match(f.queue.snapshot()[0].error, /404/);
});

test('missing space, missing disks and invalid persisted data never start native downloads', async () => {
  const f = fixture();
  f.fs.diskUsage = () => ({free: 0});
  assert.throws(() => f.queue.enqueue(game, release, '/data'), /Not enough space on \/data: needs 0 MB, 0 MB free$/);
  assert.equal(f.queue.snapshot().length, 0);
  f.queue.enqueue(game, {...release, sizeBytes: undefined}, '/data');
  assert.equal(f.tasks.length, 0);
  assert.match(f.queue.snapshot()[0].error, /space/);
  const disconnected = fixture();
  disconnected.fs.stat = () => null;
  disconnected.queue.enqueue(game, release, '/mnt/usb0');
  assert.equal(disconnected.tasks.length, 0);
  assert.match(disconnected.queue.snapshot()[0].error, /disconnected/);
  f.files.set('/download0/overdrive/downloads.json', '{"version":999,"jobs":[]}');
  assert.deepEqual(createDownloadQueue(f.dependencies).snapshot(), []);
});

test('a release does not enqueue when unfinished downloads on its drive already claim the space', () => {
  const f = fixture();
  const big = {...release, sizeBytes: 6e8};
  f.queue.enqueue(game, big, '/data');
  let refusal;
  assert.throws(() => f.queue.enqueue(game, {...big, id: 'second', filename: 'second.bin'}, '/data'), error => { refusal = error.message; return true; });
  assert.deepEqual(explainError(refusal), {title: 'Not enough space on /data: needs 600 MB, 400 MB free after queued downloads',
    action: 'Free space, or choose another drive under Save to. Test game (600 MB)'});
  f.queue.enqueue(game, {...big, id: 'elsewhere', filename: 'elsewhere.bin'}, '/mnt/usb0');
  assert.equal(f.queue.snapshot().length, 2);
});

const GB = 1e9;
const re4 = {id: 're4', filename: 're4.ffpfsc', format: 'ffpfsc', url: 'https://example.com/re4', sizeBytes: 125 * GB};

// A queue saved with Resident Evil 4 stopped on /data, as the app finds it on its next launch.
function stoppedRE4(f, fields) {
  f.files.set('/download0/overdrive/downloads.json', JSON.stringify({version: 1, jobs: [{id: 'RE4/re4', gameId: 'RE4',
    title: 'Resident Evil 4', release: re4, root: '/data', artifact: {destination: '/data/re4.ffpfsc', directory: '/data', nextAction: 'shadowmount'},
    written: 0, total: 125 * GB, error: '', ...fields}]}));
  f.fs.diskUsage = () => ({free: 127.2 * GB});
  return createDownloadQueue(f.dependencies);
}
const noMansSky = {...release, id: 'nms', filename: 'nms.ffpfsc', sizeBytes: 6 * GB};
const deadSpace = {...release, id: 'ds', filename: 'ds.ffpfsc', sizeBytes: 52 * GB};

for (const state of ['failed', 'paused']) {
  test(`a ${state} download whose files were deleted outside the app holds no space`, () => {
    const f = fixture();
    const queue = stoppedRE4(f, {state, written: 40 * GB, rootIdentity: '1:2', error: 'Interrupted. Resume to continue.'});
    queue.enqueue({...game, id: 'NMS', title: "No Man's Sky"}, noMansSky, '/data');
    queue.enqueue({...game, id: 'DS', title: 'Dead Space'}, deadSpace, '/data');
    assert.equal(queue.snapshot().length, 3);
    assert.equal(queue.snapshot()[0].error, 'Its partial files were deleted. Restart to download it again, or remove it.');
    assert.equal(explainError(queue.snapshot()[0].error).title, 'Its downloaded files were deleted');
    assert.match(f.files.get('/download0/overdrive/downloads.json'), /partial files were deleted/);
  });
}

test('a failed or browser-bound download holds no space; the retry checks it again', () => {
  for (const state of ['failed', 'awaiting-browser']) {
    const f = fixture();
    f.files.set('/data/re4.ffpfsc.part', 'kept');
    const queue = stoppedRE4(f, {state, written: 40 * GB, error: 'HTTP 0'});
    queue.enqueue(game, deadSpace, '/data');
    assert.equal(queue.snapshot()[0].error, 'HTTP 0');
  }
});

test('a paused download holds what it still needs: the rest of its partial, or all of it before it starts', () => {
  const started = fixture();
  started.files.set('/data/re4.ffpfsc.part', 'kept');
  const queue = stoppedRE4(started, {state: 'paused', written: 40 * GB});
  assert.throws(() => queue.enqueue(game, deadSpace, '/data'), /needs 52 GB, 42\.2 GB free after queued downloads: Resident Evil 4 \(85 GB\)$/);
  const fresh = stoppedRE4(fixture(), {state: 'paused'});
  assert.throws(() => fresh.enqueue(game, deadSpace, '/data'), /needs 52 GB, 2\.2 GB free after queued downloads: Resident Evil 4 \(125 GB\)$/);
  assert.equal(fresh.snapshot()[0].error, '');
});

test('an interrupted published file is submitted for native verification even on a full disk', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  const destination = f.queue.snapshot()[0].artifact.destination;
  f.files.set(destination, 'final data');
  f.files.set(destination+'.complete', 'native receipt');
  f.fs.diskUsage = () => ({free: 0});
  const loaded = createDownloadQueue(f.dependencies);
  loaded.resume(id);
  assert.equal(f.tasks.length, 2);
  assert.equal(f.tasks[1].options.recoverCompleted, true);
  f.tasks[1].resolve({written: 100});
  await settle();
  assert.equal(loaded.snapshot()[0].state, 'downloaded');
  assert.equal(f.files.get(destination), 'final data');
});

test('restart discards owned sidecars only after cancellation and preserves existing finals', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  const destination = f.queue.snapshot()[0].artifact.destination;
  for (const suffix of ['.part', '.resume', '.resume.tmp', '.complete', '.complete.tmp']) f.files.set(destination+suffix, suffix);
  f.files.set('/data/unrelated.part', 'keep');
  f.queue.pause(id);
  f.queue.restart(id);
  assert.equal(f.files.has(destination+'.part'), true);
  assert.equal(f.tasks.length, 1);
  await settle();
  await f.queue.restart(id);
  assert.equal(f.tasks.length, 2);
  assert.equal(f.queue.snapshot()[0].written, 0);
  assert.equal(f.files.has(destination+'.part'), false);
  assert.equal(f.files.has(destination+'.complete'), false);
  assert.equal(f.files.get('/data/unrelated.part'), 'keep');
  f.tasks[1].reject(new Error('HTTP 404'));
  await settle();
  f.files.set(destination, 'existing final');
  await assert.rejects(f.queue.restart(id), /final file exists/);
  f.queue.remove(id);
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.files.get(destination), 'existing final');
});

test('removing a failed task releases a full queue and persists the removal', () => {
  const f = fixture();
  f.fs.diskUsage = () => ({free: 0});
  for (let i = 0; i < 32; i++) f.queue.enqueue(game, {...release, id: String(i), filename: `${i}.bin`, sizeBytes: undefined}, '/data');
  assert.throws(() => f.queue.enqueue(game, {...release, id: 'next', filename: 'next.bin'}, '/data'), /32 unfinished/);
  f.files.set('/data/0.bin.part', 'partial');
  f.queue.remove(`${game.id}/0`);
  assert.equal(f.files.has('/data/0.bin.part'), true);
  assert.equal(createDownloadQueue(f.dependencies).snapshot().length, 31);
  f.fs.diskUsage = () => ({free: 1e9});
  f.queue.enqueue(game, {...release, id: 'next', filename: 'next.bin'}, '/data');
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot().length, 32);
});

test('restart refuses disconnected/replaced storage and non-file sidecars', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/mnt/usb0');
  f.queue.pause(id); await settle();
  const stat = f.fs.stat;
  f.fs.stat = () => null;
  await assert.rejects(f.queue.restart(id), /Storage disconnected/);
  f.fs.stat = path => path.endsWith('.part') ? {isDirectory: true} : stat(path);
  await assert.rejects(f.queue.restart(id), /non-file/);
  f.fs.stat = path => path === '/mnt/usb0' ? {isDirectory: true, device: '99', inode: '2'} : stat(path);
  await assert.rejects(f.queue.restart(id), /Storage changed/);
  f.fs.stat = () => null;
  f.queue.remove(id);
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.tasks.length, 1);
});

test('a task on a replaced drive is removed without touching the new drive', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/mnt/usb0');
  f.queue.pause(id); await settle();
  f.files.set('/mnt/usb0/game.ffpfsc.part', 'another drive');
  const stat = f.fs.stat;
  f.fs.stat = path => path === '/mnt/usb0' ? {isDirectory: true, device: '99', inode: '2'} : stat(path);
  f.queue.remove(id);
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.files.get('/mnt/usb0/game.ffpfsc.part'), 'another drive');
});

test('/data saved from inside the ShadowMountPlus 1.7 sandbox is the same drive outside it', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  const stat = f.fs.stat;
  f.fs.stat = path => path === '/data' ? {isDirectory: true, device: '99', inode: '2'} : stat(path);
  f.queue.restart(id); await settle();
  assert.equal(f.tasks.length, 2);
  f.queue.pause(id); await settle();
  f.queue.remove(id);
  assert.equal(f.queue.snapshot().length, 0);
});

test('a partial file whose task was lost is taken over and resumed, never discarded on the way', async () => {
  const f = fixture();
  f.files.set('/data/game.ffpfsc.part', 'left by a reinstall');
  f.files.set('/data/game.ffpfsc.resume', 'checkpoint');
  const id = f.queue.enqueue(game, release, '/data'); await settle();
  assert.equal(f.files.get('/data/game.ffpfsc.part'), 'left by a reinstall');
  assert.equal(f.tasks.length, 1);
  assert.equal(f.tasks[0].options.destination, '/data/game.ffpfsc');
  // A checkpoint for another source fails the transfer: the file may be that source's, so it stays.
  f.tasks[0].reject(new Error('partial file has no matching durable checkpoint; remove .part/.resume or choose another destination'));
  await settle(); await settle();
  const [failed] = f.queue.snapshot();
  assert.equal(failed.state, 'failed');
  assert.deepEqual(explainError(failed.error), {title: 'A partial download from another source holds this name. Resume it from its original source, or delete it in Files.', action: ''});
  await assert.rejects(f.queue.restart(id), /another source holds this name/);
  f.queue.cancel(id);
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.files.get('/data/game.ffpfsc.part'), 'left by a reinstall');
  assert.equal(f.files.get('/data/game.ffpfsc.resume'), 'checkpoint');
});

test('an adopted partial is the task\'s own once its transfer keeps bytes from it', async () => {
  const f = fixture();
  f.files.set('/data/game.ffpfsc.part', 'left by a reinstall');
  const id = f.queue.enqueue(game, release, '/data'); await settle();
  f.tasks[0].listener({state: 'downloading', written: 40, total: 100});
  f.queue.pause(id); await settle();
  assert.equal(f.queue.snapshot()[0].adopted, undefined);
  f.queue.restart(id); await settle();
  assert.equal(f.files.has('/data/game.ffpfsc.part'), false);
  assert.equal(f.tasks.length, 2);
});

test('an adopted partial\'s bytes count as already downloaded in the space checks', async () => {
  const f = fixture();
  const big = {...release, sizeBytes: 6e8};
  f.files.set('/data/game.ffpfsc.part', 'left by a reinstall');
  const stat = f.fs.stat;
  f.fs.stat = path => path === '/data/game.ffpfsc.part' ? {isFile: true, size: 5e8} : stat(path);
  f.fs.diskUsage = () => ({free: 2e8});
  f.queue.enqueue(game, big, '/data'); await settle();
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot()[0].error, '');
});

test('a release split in volumes needs room for its volumes and what they extract to', () => {
  const f = fixture();
  const set = {id: 'set', filename: 'game-set', format: 'archive-set', sizeBytes: 3e8,
    parts: [1, 2].map(number => ({number, sources: [{...release, id: `part${number}`, filename: `part${number}.bin`}]}))};
  f.fs.diskUsage = () => ({free: 5e8});
  assert.throws(() => f.queue.enqueue(game, set, '/data'), /needs 600 MB/);
  f.fs.diskUsage = () => ({free: 7e8});
  f.queue.enqueue(game, set, '/data');
  assert.equal(f.queue.snapshot().length, 1);
});

test('a set reports its volume\'s network count and connections', async () => {
  const f = fixture();
  const set = {id: 'set', filename: 'game-set', format: 'archive-set',
    parts: [1, 2].map(number => ({number, sources: [{...release, id: `part${number}`, filename: `part${number}.bin`}]}))};
  f.queue.enqueue(game, set, '/data'); await settle();
  f.tasks[0].listener({state: 'downloading', written: 50, received: 60, connections: 8, total: 100});
  const [job] = f.queue.snapshot();
  assert.deepEqual([job.written, job.received, job.connections], [50, 60, 8]);
  // Volumes open as many connections as a single file, on the engine's default ranges.
  assert.deepEqual([f.tasks[0].options.connections, f.tasks[0].options.adaptive, f.tasks[0].options.rangeBytes], [64, true, undefined]);
});

test('a job saved mid-extraction reloads paused, holding what its downloaded archive still needs', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, {...release, format: 'rar', filename: 'game.rar'}, '/data');
  f.queue.pause(id); await settle();
  const path = '/download0/overdrive/downloads.json';
  const saved = JSON.parse(f.files.get(path));
  Object.assign(saved.jobs[0], {state: 'extracting', written: 30, total: 100, launches: 2, artifact: {...saved.jobs[0].artifact, nextAction: 'extraction-required'}});
  f.files.set(path, JSON.stringify(saved));
  const [job] = createDownloadQueue(f.dependencies).snapshot();
  assert.equal(job.state, 'paused');
  assert.equal(job.written, 100);
  assert.equal(stillNeeded(job), 100);
});

test('a reinstall, which wipes the app data folder, keeps the queue', async () => {
  const f = fixture();
  const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  const id = queue.enqueue(game, release, '/data');
  queue.pause(id); await settle();
  for (const path of [...f.files.keys()]) if (path.startsWith('/download0/')) f.files.delete(path);
  const reinstalled = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  assert.deepEqual(reinstalled.snapshot().map(job => job.id), [id]);
});

test('a queue saved in the app data folder moves beside the downloads', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  const moved = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  assert.deepEqual(moved.snapshot().map(job => job.id), [id]);
  assert.ok(f.files.has('/data/queue/downloads.json'));
  assert.ok(!f.files.has('/download0/overdrive/downloads.json') && f.files.has('/download0/overdrive/downloads.json.moved'));
});

test('of a queue saved in both folders, the newer one loads', async () => {
  const f = fixture();
  const job = id => ({id, gameId: game.id, title: 'x', release: {id}, root: '/data', artifact: {destination: `/data/${id}`}, state: 'paused'});
  f.files.set('/data/queue/downloads.json', JSON.stringify({version: 1, jobs: [job('older')]}));
  f.files.set('/download0/overdrive/downloads.json', JSON.stringify({version: 1, jobs: [job('newer')]}));
  const stat = f.fs.stat;
  f.fs.stat = path => ({'/data/queue/downloads.json': {isFile: true, modified: 1}, '/download0/overdrive/downloads.json': {isFile: true, modified: 2}})[path] ?? stat(path);
  const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  assert.deepEqual(queue.snapshot().map(item => item.id), ['newer']);
  assert.match(f.files.get('/data/queue/downloads.json'), /newer/);
  assert.ok(f.files.has('/download0/overdrive/downloads.json.moved'));
});

const savedJob = id => ({id, gameId: game.id, title: 'x', release: {id}, root: '/data', artifact: {destination: `/data/${id}`}, state: 'paused'});
const unreadable = f => [...f.files.keys()].filter(path => /\.unreadable-\d+$/.test(path));

// A forced close or power cut right after a save can leave the queue empty or cut short: the app
// must still open, and the file is kept for inspection.
for (const [name, text] of [['empty', ''], ['truncated', '{"version":1,"jobs":[{"id":"a"']]) {
  test(`an ${name} queue file opens an empty queue and is kept aside`, () => {
    const f = fixture();
    f.files.set('/data/queue/downloads.json', text);
    const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
    assert.deepEqual(queue.snapshot(), []);
    assert.equal(unreadable(f).length, 1);
    assert.equal(f.files.get(unreadable(f)[0]), text);
    assert.ok(!f.files.has('/data/queue/downloads.json'));
    queue.enqueue(game, release, '/data');
    assert.equal(JSON.parse(f.files.get('/data/queue/downloads.json')).jobs.length, 1);
  });
}

test('a save whose rename never ran loads from its .tmp when the queue file is empty', () => {
  const f = fixture();
  f.files.set('/data/queue/downloads.json', '');
  f.files.set('/data/queue/downloads.json.tmp', JSON.stringify({version: 1, jobs: [savedJob('kept')]}));
  const stat = f.fs.stat;
  f.fs.stat = path => ({'/data/queue/downloads.json': {isFile: true, modified: 2}, '/data/queue/downloads.json.tmp': {isFile: true, modified: 1}})[path] ?? stat(path);
  const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  assert.deepEqual(queue.snapshot().map(job => job.id), ['kept']);
  assert.match(f.files.get('/data/queue/downloads.json'), /kept/);
  assert.ok(!f.files.has('/data/queue/downloads.json.tmp'));
});

test('an entry that lost its fields is dropped, not the whole queue', () => {
  const f = fixture();
  f.files.set('/data/queue/downloads.json', JSON.stringify({version: 1, jobs: [savedJob('good'), {id: 'broken', state: 'paused'}]}));
  const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
  assert.deepEqual(queue.snapshot().map(job => job.id), ['good']);
  assert.equal(unreadable(f).length, 0);
});

test('a queue file that cannot be read is left in place', () => {
  const f = fixture();
  f.files.set('/data/queue/downloads.json', JSON.stringify({version: 1, jobs: [savedJob('later')]}));
  const read = f.fs.readFile;
  f.fs.readFile = path => { if (path === '/data/queue/downloads.json') throw new Error('EPERM'); return read(path); };
  assert.deepEqual(createDownloadQueue({...f.dependencies, stateDir: '/data/queue'}).snapshot(), []);
  assert.ok(f.files.has('/data/queue/downloads.json'));
  assert.equal(unreadable(f).length, 0);
});

// Without console access ShadowMountPlus 1.7beta4 shows /data through a nullfs that refuses stat;
// the engine's exists() is a stat, so it throws there instead of answering.
function sandboxed(f, {mkdir = false} = {}) {
  const refuse = path => { if (path.startsWith('/data/queue')) throw new Error(`fs.stat ${path}: Operation not permitted`); };
  const {exists, stat} = f.fs;
  f.fs.exists = path => { refuse(path); return exists(path); };
  f.fs.stat = path => { refuse(path); return stat(path); };
  if (mkdir) f.fs.mkdir = path => { if (path.startsWith('/data/queue')) throw new Error(`fs.mkdir ${path}: Operation not permitted`); };
}

for (const mkdir of [false, true]) {
  test(`a durable folder the sandbox refuses${mkdir ? ' to create' : ' to stat'} keeps the queue in the app data`, async () => {
    const f = fixture();
    const id = f.queue.enqueue(game, release, '/data');
    f.queue.pause(id); await settle();
    sandboxed(f, {mkdir});
    const queue = createDownloadQueue({...f.dependencies, stateDir: '/data/queue'});
    assert.deepEqual(queue.snapshot().map(job => job.id), [id]);
    assert.ok(f.files.has('/download0/overdrive/downloads.json') && !f.files.has('/download0/overdrive/downloads.json.moved'));
    assert.ok(![...f.files.keys()].some(path => path.startsWith('/data/queue')));
    queue.remove(id);
    assert.equal(JSON.parse(f.files.get('/download0/overdrive/downloads.json')).jobs.length, 0);
  });
}

test('a sandboxed first launch without any saved queue opens an empty one', () => {
  const f = fixture();
  sandboxed(f);
  assert.deepEqual(createDownloadQueue({...f.dependencies, stateDir: '/data/queue'}).snapshot(), []);
});

test('legacy tasks cannot discard without a root identity', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  const path = '/download0/overdrive/downloads.json';
  const saved = JSON.parse(f.files.get(path));
  delete saved.jobs[0].rootIdentity;
  f.files.set(path, JSON.stringify(saved));
  const loaded = createDownloadQueue(f.dependencies);
  await assert.rejects(loaded.restart(id), /no storage identity/);
  loaded.remove(id);
  assert.equal(loaded.snapshot().length, 0);
});

test('cancel pauses an active task, discards its partial and forgets it; completed tasks leave keeping files', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  const destination = f.queue.snapshot()[0].artifact.destination;
  f.files.set(destination+'.part', 'partial');
  f.queue.cancel(id);
  assert.equal(f.queue.snapshot()[0].state, 'pausing');
  await settle(); await settle();
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.files.has(destination+'.part'), false);
  const queued = f.queue.enqueue(game, {...release, id: 'second', filename: 'second.bin'}, '/data');
  f.queue.enqueue(game, {...release, id: 'third', filename: 'third.bin'}, '/data');
  f.queue.cancel(`${game.id}/third`);
  assert.deepEqual(f.queue.snapshot().map(job => job.id), [queued]);
  f.tasks[1].resolve({written: 100}); await settle();
  f.files.set('/data/second.bin', 'final data');
  f.queue.cancel(queued);
  assert.equal(f.queue.snapshot().length, 1);
  f.queue.remove(queued);
  assert.equal(createDownloadQueue(f.dependencies).snapshot().length, 0);
  assert.equal(f.files.get('/data/second.bin'), 'final data');
});

test('finished and failed downloads post a system notification; pausing does not', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.queue.resume(id);
  f.tasks[1].reject(new Error('HTTP 404')); await settle();
  f.queue.resume(id);
  f.tasks[2].resolve({written: 100}); await settle();
  assert.deepEqual(f.notices, ['Download failed: Test game', 'Download complete: Test game']);
});

test('the console stays awake exactly while a download is queued or running', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  assert.equal(f.queue.awake, true);
  f.queue.pause(id); await settle();
  assert.equal(f.queue.awake, false);
  f.queue.resume(id);
  f.tasks[1].resolve({written: 100}); await settle();
  assert.deepEqual(f.awake, [true, false, true, false]);
});

test('deleting a finished game uninstalls it, then removes its file and receipt', async () => {
  const f = fixture();
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/homebrew/${item.filename}`, directory: `${root}/homebrew`, nextAction: 'shadowmount'});
  const queue = createDownloadQueue(f.dependencies);
  const id = queue.enqueue(game, release, '/data');
  f.tasks[0].resolve({written: 100});
  await settle();
  f.files.set('/data/homebrew/game.ffpfsc', 'image'); f.files.set('/data/homebrew/game.ffpfsc.complete', 'receipt');
  f.files.set('/data/homebrew/other.ffpfsc', 'keep');
  shadowMount(f, {games: [listed()]});
  await queue.deleteFromDisk(id);
  assert.deepEqual(f.calls.map(call => [call.url, call.options.body]),
    [['http://127.0.0.1:10101/api/v1/images', '{}'], ['http://127.0.0.1:10101/api/v1/games/info', '{"title_id":"PPSA12345"}'],
      ['http://127.0.0.1:10101/api/v1/games/uninstall', '{"title_id":"PPSA12345"}'], ['http://127.0.0.1:10101/api/v1/storage', '{}']]);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc') && !f.files.has('/data/homebrew/game.ffpfsc.complete'));
  assert.equal(f.files.get('/data/homebrew/other.ffpfsc'), 'keep');
  assert.equal(queue.snapshot().length, 0);
});

// ShadowMount's API by route: `games/info` answers with the first of `games` holding the title, else
// 404; `images` lists `images`; `uninstall` is the reply to an uninstall.
function shadowMount(f, {games = [], images = [], uninstall = {ok: true, status: 200, json: async () => ({status: 0})}} = {}) {
  f.dependencies.http.request = async (url, options) => {
    f.calls.push({url, options});
    const route = url.split('/api/v1/')[1];
    if (route === 'games') throw new Error('The full game list is never asked for.');
    if (route === 'games/info') {
      const game = games.find(item => item.title_id === JSON.parse(options.body).title_id);
      return game ? {ok: true, status: 200, json: async () => ({status: 0, ...game})}
        : {ok: false, status: 404, json: async () => ({status: 2, error: 'Game not found'})};
    }
    if (route === 'games/uninstall') return uninstall;
    // An image naming its title is released by that title's unmount.
    if (route === 'games/unmount') for (const image of images) if (image.title === JSON.parse(options.body).title_id) image.mounted = false;
    if (route === 'images') return {ok: true, status: 200, json: async () => ({status: 0, count: images.length, images})};
    return {ok: true, status: 200, json: async () => ({status: 0, capabilities: ['rescan']})};
  };
}

async function finishedImage(f, entry = game) {
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/homebrew/${item.filename}`, directory: `${root}/homebrew`, nextAction: 'shadowmount'});
  const queue = createDownloadQueue(f.dependencies);
  const id = queue.enqueue(entry, release, '/data');
  f.tasks[0].resolve({written: 100});
  await settle();
  f.files.set('/data/homebrew/game.ffpfsc', 'image');
  return {queue, id};
}

const listed = (fields = {}) => ({path: '/data/homebrew/game.ffpfsc', title_id: 'PPSA12345', source_type: 'image', managed: true, installed: true, ...fields});
const routes = f => f.calls.map(call => call.url.split('/api/v1/')[1]);

test('an image ShadowMount installed while the app was closed shows as installed once asked, never at launch', async () => {
  const f = fixture();
  await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  const loaded = createDownloadQueue(f.dependencies);
  await settle();
  assert.deepEqual(routes(f), []);
  assert.equal(loaded.snapshot()[0].state, 'downloaded');
  assert.equal(await loaded.syncInstalls(), true);
  const [job] = loaded.snapshot();
  assert.equal(job.state, 'installed');
  assert.equal(job.installedTitleId, 'PPSA12345');
  assert.match(job.message, /home screen/);
  assert.deepEqual(routes(f), ['games/info']);
  assert.equal(f.calls[0].options.body, '{"title_id":"PPSA12345"}');
});

test('a game page checks only its own download', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  assert.equal(await queue.syncInstalls('another'), false);
  assert.deepEqual(routes(f), []);
  assert.equal(await queue.syncInstalls(id), true);
  assert.deepEqual(routes(f), ['games/info']);
});

test('an image ShadowMount has not installed, or only another source\'s PKG of it, stays ready to install', async () => {
  const f = fixture();
  const {queue} = await finishedImage(f);
  shadowMount(f, {games: [listed({installed: false})]});
  assert.equal(await queue.syncInstalls(), false);
  shadowMount(f, {games: [{path: '/user/app/PPSA12345/app.pkg', title_id: 'PPSA12345', source_type: 'pkg', managed: false, installed: true}]});
  assert.equal(await queue.syncInstalls(), false);
  assert.equal(queue.snapshot()[0].state, 'downloaded');
});

test('a game ShadowMount manages from another folder counts as installed by its title', async () => {
  const f = fixture();
  const {queue} = await finishedImage(f);
  f.files.delete('/data/homebrew/game.ffpfsc');
  shadowMount(f, {games: [listed({path: '/data/games/PPSA12345'})]});
  assert.equal(await queue.syncInstalls(), true);
  assert.equal(queue.snapshot()[0].state, 'installed');
});

// Another install of the same title is not the download: deleting the download must leave it alone.
test('another install of the same title leaves a fresh download ready to install and is not uninstalled with it', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed({path: '/data/games/PPSA12345'})]});
  assert.equal(await queue.syncInstalls(), false);
  assert.equal(queue.snapshot()[0].state, 'downloaded');
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['games/info', 'images', 'images', 'games/info', 'images', 'storage']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('install checks asked at once share one request to ShadowMount', async () => {
  const f = fixture();
  const {queue} = await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  const [first, second] = await Promise.all([queue.syncInstalls(), queue.syncInstalls()]);
  assert.deepEqual([first, second, routes(f)], [true, true, ['games/info']]);
});

test('without ShadowMount\'s game list, files are deleted only once its uninstall says it has no such game', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  const reply = status => ({ok: status < 400, status, json: async () => ({error: 'x'})});
  let uninstall = reply(500);
  f.dependencies.http.request = async url => url.endsWith('/games/info') ? reply(500)
    : url.endsWith('/images') ? {ok: true, status: 200, json: async () => ({images: []})} : uninstall;
  await assert.rejects(queue.deleteFromDisk(id), /files were kept: ShadowMount HTTP 500/);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  uninstall = reply(404);
  await queue.deleteFromDisk(id);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
  assert.equal(queue.snapshot().length, 0);
});

test('checking installs without ShadowMount\'s API leaves the job as it was', async () => {
  const f = fixture();
  const {queue} = await finishedImage(f);
  f.dependencies.http.request = async () => { throw new Error('Couldn\'t connect to server'); };
  assert.equal(await queue.syncInstalls(), false);
  assert.equal(queue.snapshot()[0].state, 'downloaded');
});

test('Install on an image ShadowMount already installed marks it installed instead of scanning again', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  await queue.register(id);
  assert.equal(queue.snapshot()[0].state, 'installed');
  assert.deepEqual(routes(f), ['games/info']);
});

test('an installed game leaves the list without touching its files', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  await queue.syncInstalls();
  queue.remove(id);
  assert.equal(queue.snapshot().length, 0);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  assert.deepEqual(routes(f), ['games/info']);
});

test('deleting uninstalls the title ShadowMount registered the image under', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()]});
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'games/info', 'games/uninstall', 'storage']);
  assert.equal(f.calls[2].options.body, '{"title_id":"PPSA12345"}');
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
  assert.equal(queue.snapshot().length, 0);
});

test('an installed game whose uninstall ShadowMount refuses keeps its files and its task', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()], uninstall: {ok: false, status: 409, json: async () => ({status: 16, error: 'Device busy'})}});
  await assert.rejects(queue.deleteFromDisk(id), /ShadowMount did not uninstall it, so its files were kept: ShadowMount HTTP 409: Device busy/);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  assert.equal(queue.snapshot().length, 1);
});

test('deleting an image ShadowMount never registered asks for no uninstall', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f);
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'games/info', 'images', 'storage']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('taking a finished download off the list deletes nothing and asks ShadowMount nothing', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  f.files.set('/data/homebrew/game.ffpfsc.complete', 'receipt');
  shadowMount(f, {games: [listed({installed: false})]});
  const before = new Map(f.files);
  queue.remove(id);
  assert.equal(queue.snapshot().length, 0);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith('/data/')), [...before.keys()].filter(path => path.startsWith('/data/')));
  assert.deepEqual(routes(f), []);
});

test('an image ShadowMount still has mounted after the uninstall is kept, with its task', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed({mounted: true})], images: [{path: '/data/homebrew/game.ffpfsc', mounted: true}]});
  await assert.rejects(queue.deleteFromDisk(id), /ShadowMount still has \/data\/homebrew\/game\.ffpfsc mounted, so its files were kept/);
  assert.deepEqual(routes(f), ['images', 'games/info', 'games/uninstall', 'games/unmount', ...Array(5).fill('images')]);
  assert.deepEqual(f.waits, [1000, 1000, 1000, 1000]);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  assert.equal(queue.snapshot().length, 1);
});

test('an image whose mount ShadowMount releases a moment after the uninstall is deleted', async () => {
  const f = fixture();
  const image = {path: '/data/homebrew/game.ffpfsc', mounted: true};
  f.dependencies.wait = async () => { image.mounted = false; };
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {games: [listed()], images: [image]});
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'games/info', 'games/uninstall', 'games/unmount', 'images', 'images', 'storage']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('a mounted image is kept even when ShadowMount names it through another mount of the drive and has no game for it', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f, {images: [{path: '/mnt/usb0/homebrew/other.ffpfsc', mounted: true}, {path: '/user/data/homebrew/game.ffpfsc', mounted: true}]});
  await assert.rejects(queue.deleteFromDisk(id), /still has \/user\/data\/homebrew\/game\.ffpfsc mounted/);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  shadowMount(f, {images: [{path: '/mnt/usb0/homebrew/other.ffpfsc', mounted: true}, {path: '/data/homebrew/game.ffpfsc', mounted: false}]});
  await queue.deleteFromDisk(id);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

// The catalog lists ASTRO BOT as PPSA21564; the dump is another region's, PPSA21567, which is the title
// ShadowMount registers it under. Its param.json is at the mount's root, or in a folder below it.
const astroBot = {id: 'PPSA21564', titleId: 'PPSA21564', title: 'ASTRO BOT'};
function otherRegion(f, {nested = false, installed = true} = {}) {
  const image = {path: '/data/homebrew/game.ffpfsc', mount_point: '/mnt/shadowmnt/astro', mounted: true, title: 'PPSA21567'};
  f.files.set(`/mnt/shadowmnt/astro${nested ? '/PPSA21567-app0' : ''}/sce_sys/param.json`, '{"titleId":"PPSA21567"}');
  shadowMount(f, {games: [listed({title_id: 'PPSA21567', installed})], images: [image]});
  return image;
}
const titleOf = call => JSON.parse(call.options.body).title_id;

test('a release of another region shows as installed once ShadowMount registers its image, under the image\'s title', async () => {
  const f = fixture();
  const {queue} = await finishedImage(f, astroBot);
  otherRegion(f);
  assert.equal(await queue.syncInstalls(), true);
  const [job] = queue.snapshot();
  assert.equal(job.state, 'installed');
  assert.deepEqual([job.installedTitleId, job.consoleTitleId], ['PPSA21567', 'PPSA21567']);
  assert.deepEqual(f.calls.map(call => [call.url.split('/api/v1/')[1], call.options.body]),
    [['games/info', '{"title_id":"PPSA21564"}'], ['images', '{}'], ['games/info', '{"title_id":"PPSA21567"}']]);
  f.calls.length = 0;
  await queue.syncInstalls();
  assert.deepEqual(routes(f), []);
  const reloaded = createDownloadQueue(f.dependencies);
  assert.equal(reloaded.snapshot()[0].consoleTitleId, 'PPSA21567');
});

test('deleting a release of another region uninstalls the image\'s title before unmounting it', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f, astroBot);
  otherRegion(f);
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'games/info', 'images', 'games/info', 'games/uninstall', 'games/unmount', 'images', 'storage']);
  assert.deepEqual(f.calls.filter(call => /uninstall|unmount/.test(call.url)).map(titleOf), ['PPSA21567', 'PPSA21567']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
  assert.equal(queue.snapshot().length, 0);
});

test('an image whose param.json sits in a folder below the mount is found by that title', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f, astroBot);
  otherRegion(f, {nested: true});
  await queue.deleteFromDisk(id);
  assert.deepEqual(f.calls.filter(call => /uninstall|unmount/.test(call.url)).map(titleOf), ['PPSA21567', 'PPSA21567']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('a mounted image naming no title is kept, and the message says to delete it from ShadowMount', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f, astroBot);
  shadowMount(f, {images: [{path: '/data/homebrew/game.ffpfsc', mount_point: '/mnt/shadowmnt/astro', mounted: true}]});
  await assert.rejects(queue.deleteFromDisk(id), /still has \/data\/homebrew\/game\.ffpfsc mounted, so its files were kept\. .*delete the game from ShadowMount's web page/);
  assert.ok(!routes(f).includes('games/unmount'));
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
  assert.equal(queue.snapshot().length, 1);
});

test('without ShadowMount running nothing is mounted, so the files are deleted', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  f.dependencies.http.request = async url => { f.calls.push({url}); throw new Error('Couldn\'t connect to server'); };
  await queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'storage']);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
  assert.equal(queue.snapshot().length, 0);
});

test('a second Delete while the first waits for ShadowMount to release the mount asks nothing more and ends with it', async () => {
  const f = fixture();
  let release;
  f.dependencies.wait = () => new Promise(resolve => { release = resolve; });
  const {queue, id} = await finishedImage(f);
  const image = {path: '/data/homebrew/game.ffpfsc', mounted: true};
  shadowMount(f, {games: [listed()], images: [image]});
  const first = queue.deleteFromDisk(id);
  while (!release) await settle();
  const second = queue.deleteFromDisk(id);
  await settle();
  assert.equal(routes(f).filter(route => route === 'games/uninstall').length, 1);
  image.mounted = false; release();
  await Promise.all([first, second]);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('an image is kept when ShadowMount cannot say whether it is mounted', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f);
  const answer = f.dependencies.http.request;
  f.dependencies.http.request = async (url, options) => url.endsWith('/images')
    ? {ok: false, status: 500, json: async () => ({error: 'busy'})} : answer(url, options);
  await assert.rejects(queue.deleteFromDisk(id), /could not say whether the image is mounted, so its files were kept: ShadowMount HTTP 500: busy/);
  assert.equal(f.files.get('/data/homebrew/game.ffpfsc'), 'image');
});

test('pausing source resolution cancels HTTP before any native file task starts', async () => {
  const f = fixture();
  let signal;
  f.dependencies.sources = {resolve: (_, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new Error('cancelled')));
  })};
  const queue = createDownloadQueue(f.dependencies);
  const id = queue.enqueue(game, {...release, requiresBrowser: true}, '/data');
  queue.pause(id); await settle();
  assert.equal(signal.aborted, true);
  assert.equal(queue.snapshot()[0].state, 'paused');
  assert.equal(f.tasks.length, 0);
  assert.deepEqual(f.notices, []);
});

test('native HTML rejection goes back to browser verification without reporting completion', async () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data');
  f.tasks[0].reject(new Error('provider returned a web page; browser verification required'));
  await settle();
  assert.equal(f.queue.snapshot()[0].state, 'awaiting-browser');
  assert.deepEqual(f.notices, []);
  assert.equal(f.queue.awake, false);
});

test('split-piece downloads enable HTML rejection too', async () => {
  const f = fixture();
  f.queue.enqueue(game, {...release, manifestUrl: 'https://example.com/manifest.json'}, '/data');
  await settle();
  assert.equal(f.tasks[0].options.rejectHtml, true);
});

test('one multipart job downloads its ordered parts, then extracts, and only then completes', async()=>{
 const f=fixture();let extractOptions,finishExtract;
 f.dependencies.archives={inspect:()=>({kind:'',refusal:''}),extract(options){extractOptions=options;return {done:new Promise(resolve=>finishExtract=resolve),subscribe(){return()=>{};},cancel(){}};}};
 const queue=createDownloadQueue(f.dependencies);
 const set={id:'set',filename:'game-set',format:'archive-set',parts:[1,2].map(number=>({number,sources:[{...release,id:`part${number}`,filename:`part${number}.bin`,format:'binary'}]}))};
 queue.enqueue(game,set,'/data');await settle();
 assert.equal(f.tasks.length,1);assert.match(f.tasks[0].options.destination,/part-1.bin$/);
 f.tasks[0].listener({state:'downloading',written:100,total:100});f.tasks[0].resolve({written:100});await settle();
 assert.equal(f.tasks.length,2);assert.match(f.tasks[1].options.destination,/part-2.bin$/);
 assert.notEqual(queue.snapshot()[0].state,'extracted');
 f.tasks[1].listener({state:'downloading',written:100,total:100});f.tasks[1].resolve({written:100});await settle();
 assert.equal(queue.snapshot()[0].state,'extracting');assert.equal(extractOptions.sources.length,2);
 finishExtract({});await settle();
 assert.equal(queue.snapshot()[0].state,'extracted');assert.equal(queue.snapshot()[0].written,200);
 assert.equal(queue.awake,false);
});

test('an extraction shows a full bar while the engine finishes writing, and as before on engines without the phase', async () => {
  for (const phased of [true, false]) {
    const f = fixture();
    let listener, finish;
    f.dependencies.archives = {inspect: () => ({kind: '', refusal: ''}),
      extract: () => ({done: new Promise(resolve => { finish = resolve; }), subscribe(next) { listener = next; return () => {}; }, cancel() {}})};
    f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/downloads/archives/${item.filename}`,
      directory: `${root}/downloads/archives`, nextAction: 'extraction-required'});
    const queue = createDownloadQueue(f.dependencies);
    queue.enqueue(game, {...release, id: 'zip', format: 'zip', filename: 'game.zip'}, '/data');
    f.files.set('/data/downloads/archives/game.zip', 'zip');
    f.fs.stat = (stat => path => path === '/data/downloads/archives/game.zip' ? {isFile: true, size: 100} : stat(path))(f.fs.stat);
    f.tasks[0].resolve({written: 100}); await settle(); await settle();
    listener({state: 'extracting', phase: phased ? 'extracting' : undefined, written: 100});
    assert.equal(queue.snapshot()[0].written, 99);
    listener({state: 'extracting', ...(phased && {phase: 'finishing'}), written: 100});
    const [job] = queue.snapshot();
    assert.equal(job.phase, phased ? 'finishing' : undefined);
    assert.equal(job.written, phased ? 100 : 99);
    finish({}); await settle();
    assert.equal(queue.snapshot()[0].state, 'extracted');
    assert.equal(queue.snapshot()[0].phase, undefined);
  }
});

test('an incomplete part set cannot create a native transfer',async()=>{
 const f=fixture();assert.throws(()=>f.queue.enqueue(game,{id:'bad',filename:'bad-set',format:'archive-set',parts:[],unavailableReason:'Missing volumes'},'/data'),/Missing volumes/);
 assert.equal(f.tasks.length,0);
});

test('a source that wants a browser before any byte fails over to the next alternative', async () => {
  const f = fixture();
  f.dependencies.sources = {resolve: async source => {
    if (source.provider === 'Host') throw Object.assign(new Error('Browser verification required.'), {url: source.url});
    return {url: source.url};
  }};
  const queue = createDownloadQueue(f.dependencies);
  const hosted = {...release, id: 'hosted', provider: 'Host', filename: 'hosted.ffpfsc', url: 'https://host.example/page', requiresBrowser: true};
  const mirror = {...release, id: 'mirror', provider: 'Mirror', filename: 'mirror.ffpfsc'};
  queue.enqueue(game, hosted, '/data', [mirror]);
  await settle(); await settle();
  const [job] = queue.snapshot();
  assert.equal(job.release.id, 'mirror');
  assert.equal(job.requestedId, 'hosted');
  assert.equal(job.artifact.destination, '/data/mirror.ffpfsc');
  assert.match(job.message, /Host didn't work, so Overdrive switched to Mirror/);
  assert.equal(f.tasks.length, 1);
  assert.equal(f.tasks[0].options.url, release.url);
  assert.deepEqual(f.notices, []);
});

test('a source that fails after writing keeps its partial instead of switching', async () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data', [{...release, id: 'mirror', provider: 'Mirror', filename: 'mirror.ffpfsc'}]);
  f.tasks[0].listener({state: 'downloading', written: 40, total: 100});
  f.tasks[0].reject(new Error('HTTP 503'));
  await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  assert.equal(f.queue.snapshot()[0].release.id, 'image');
});

test('a game named like a cause still fails over when its first source cannot connect', async () => {
  const f = fixture();
  const dead = {...release, id: 'archive', provider: 'Archive.org', filename: 'PPSA03845 Dead Space.ffpfsc'};
  f.queue.enqueue(game, dead, '/data', [{...release, id: 'mirror', provider: 'Mirror', filename: 'mirror.ffpfsc'}]);
  f.tasks[0].reject(new Error("Downloads.enqueue /data/PPSA03845 Dead Space.ffpfsc: range probe failed (HTTP 0, Couldn't resolve host name)"));
  await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].release.id, 'mirror');
  assert.equal(f.tasks.length, 2);
});

test('without alternatives a browser source still waits for the person', async () => {
  const f = fixture();
  f.dependencies.http.request = async url => ({ok: true, status: 200, url, headers: {}});
  const queue = createDownloadQueue(f.dependencies);
  queue.enqueue(game, {...release, requiresBrowser: true}, '/data');
  await settle();
  assert.equal(queue.snapshot()[0].state, 'awaiting-browser');
});

const binary = {...release, id: 'binary', format: 'binary', filename: 'game.binary'};
const tick = (task, progress, times = 20) => { for (let i = 0; i < times; i++) task.listener(progress); };

test('a binary release that turns out to be an archive is extracted like a typed one', async () => {
  const f = fixture();
  f.queue.enqueue(game, binary, '/data');
  f.files.set('/data/game.binary', 'rar bytes');
  f.inspections.set('/data/game.binary', {kind: 'rar', refusal: ''});
  f.tasks[0].resolve({written: 100}); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'extracting');
  assert.deepEqual(f.extractions[0].options.sources, ['/data/game.binary']);
  f.extractions[0].resolve({artifacts: ['game.ffpfsc']}); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'downloaded');
  assert.equal(f.queue.snapshot()[0].artifact.nextAction, 'shadowmount');
});

test('a binary release that is a package or an image moves to where that kind belongs', async () => {
  for (const [kind, state] of [['pkg', 'installer-required'], ['exfat', 'downloaded']]) {
    const f = fixture();
    f.queue.enqueue(game, binary, '/data');
    f.files.set('/data/game.binary', 'bytes'); f.files.set('/data/game.binary.complete', 'receipt');
    f.inspections.set('/data/game.binary', {kind, refusal: ''});
    f.tasks[0].resolve({written: 100}); await settle();
    const [job] = f.queue.snapshot();
    assert.equal(job.state, state);
    assert.equal(job.artifact.destination, `/data/routed/game.${kind}`);
    assert.equal(f.files.get(`/data/routed/game.${kind}`), 'bytes');
    assert.equal(f.files.get(`/data/routed/game.${kind}.complete`), 'receipt');
    assert.ok(!f.files.has('/data/game.binary') && !f.files.has('/data/game.binary.complete'));
  }
});

test('a binary download whose bytes are unrecognized stays a plain file', async () => {
  const f = fixture();
  f.queue.enqueue(game, binary, '/data');
  f.tasks[0].resolve({written: 100}); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'file-downloaded');
  assert.equal(f.extractions.length, 0);
});

test('a move to the detected destination cut short by the app closing finishes on resume', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, binary, '/data');
  f.files.set('/data/game.binary', 'bytes'); f.files.set('/data/game.binary.complete', 'receipt');
  f.inspections.set('/data/game.binary', {kind: 'pkg', refusal: ''});
  // Persist the routing intent, then "crash" after moving only the file.
  const path = '/download0/overdrive/downloads.json';
  const saved = JSON.parse(f.files.get(path));
  saved.jobs[0] = {...saved.jobs[0], state: 'verifying', downloadDestination: '/data/game.binary', rootIdentity: '1:2',
    routing: {destination: '/data/routed/game.pkg', directory: '/data/routed', nextAction: 'installer-required'}};
  f.files.set(path, JSON.stringify(saved));
  f.fs.rename('/data/game.binary', '/data/routed/game.pkg');
  const loaded = createDownloadQueue({...f.dependencies, downloads: {enqueue: options => {
    assert.equal(options.destination, '/data/routed/game.pkg');
    return f.dependencies.downloads.enqueue(options);
  }}});
  loaded.resume(id);
  assert.equal(f.files.get('/data/routed/game.pkg.complete'), 'receipt');
  f.tasks.at(-1).resolve({written: 100}); await settle();
  assert.equal(loaded.snapshot()[0].state, 'installer-required');
});

test('an archive whose first bytes need too much memory stops before the rest downloads', async () => {
  const f = fixture();
  const archive = {...release, id: 'rar', format: 'rar', filename: 'game.rar'};
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/${item.filename}`, directory: root, nextAction: 'extraction-required'});
  const queue = createDownloadQueue(f.dependencies);
  queue.enqueue(game, archive, '/data');
  tick(f.tasks[0], {state: 'downloading', written: 10, total: 100});
  assert.equal(queue.snapshot()[0].state, 'downloading');
  f.files.set('/data/game.rar.part', 'rar header');
  f.inspections.set('/data/game.rar.part', {kind: 'rar', refusal: 'This archive needs more memory to extract than the console app can use.'});
  tick(f.tasks[0], {state: 'downloading', written: 20, total: 100});
  await settle();
  assert.equal(queue.snapshot()[0].state, 'failed');
  assert.match(queue.snapshot()[0].error, /needs more memory/);
});

test('a growing download of a kind the headers never name is read three times at most', async () => {
  const f = fixture();
  let reads = 0;
  f.dependencies.archives = {inspect: () => { reads += 1; return {kind: '', refusal: ''}; }};
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/${item.filename}`, directory: root, nextAction: 'extraction-required'});
  const queue = createDownloadQueue(f.dependencies);
  queue.enqueue(game, {...release, id: 'rar', format: 'rar', filename: 'game.rar'}, '/data');
  f.files.set('/data/game.rar.part', 'unknown bytes');
  tick(f.tasks[0], {state: 'downloading', written: 10, total: 100}, 200);
  assert.equal(reads, 3);
});

test('a set whose first volume needs too much memory stops before the next volume', async () => {
  const f = fixture();
  const set = {id: 'set', filename: 'game-set', format: 'archive-set', parts: [1, 2].map(number => ({number,
    sources: [{...release, id: `part${number}`, filename: `part${number}.bin`, format: 'binary'}]}))};
  f.queue.enqueue(game, set, '/data'); await settle();
  f.inspections.set('/data/downloads/sets/game-set/part-1.bin', {kind: 'rar', refusal: 'This archive needs more memory to extract than the console app can use.'});
  f.tasks[0].resolve({written: 100}); await settle();
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  assert.match(f.queue.snapshot()[0].error, /needs more memory/);
});

const denied = 'provider denied the file; link expired or browser verification required (HTTP 403)';

test('an expired signed link resolves its page again and continues the partial', async () => {
  const f = fixture();
  let signature = 0;
  f.dependencies.sources = {resolve: async (_, {directURL}) => ({url: directURL || `https://download.example/file?sig=${++signature}`, rejectHtml: true})};
  const queue = createDownloadQueue(f.dependencies);
  const hosted = {...release, id: 'hosted', provider: 'MediaFire', url: 'https://www.mediafire.com/file/abc/game.ffpfsc/file'};
  const id = queue.enqueue(game, hosted, '/data');
  await settle();
  const destination = f.tasks[0].options.destination;
  f.tasks[0].listener({state: 'downloading', written: 40, total: 100});
  f.tasks[0].reject(new Error(denied)); await settle(); await settle();
  assert.equal(f.tasks.length, 2);
  assert.equal(f.tasks[1].options.url, 'https://download.example/file?sig=2');
  assert.equal(f.tasks[1].options.destination, destination);
  assert.notEqual(queue.snapshot()[0].state, 'awaiting-browser');
  f.tasks[1].reject(new Error(denied)); await settle(); await settle();
  f.tasks[2].reject(new Error(denied)); await settle(); await settle();
  assert.equal(f.tasks.length, 3);
  assert.equal(queue.snapshot()[0].state, 'awaiting-browser');
  // Entering a final URL keeps the partial: native resume decides whether it is the same file.
  f.files.set(`${destination}.part`, 'partial');
  queue.continueWithURL(id, 'https://download.example/file?sig=manual'); await settle(); await settle();
  assert.equal(f.files.get(`${destination}.part`), 'partial');
  assert.equal(f.tasks[3].options.url, 'https://download.example/file?sig=manual');
  f.tasks[3].reject(new Error('partial file has no matching durable checkpoint; remove .part/.resume or choose another destination'));
  await settle();
  assert.equal(queue.snapshot()[0].state, 'failed');
});

test('an expired direct link waits for the person instead of resolving again', async () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data');
  f.tasks[0].listener({state: 'downloading', written: 40, total: 100});
  f.tasks[0].reject(new Error(denied)); await settle();
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot()[0].state, 'awaiting-browser');
});

const set = {id: 'set', filename: 'game-set', format: 'archive-set', parts: [1, 2, 3].map(number => ({number,
  sources: [{...release, id: `part${number}`, filename: `part${number}.bin`, format: 'binary', url: `https://example.com/part${number}`}]}))};
const part = number => `/data/downloads/sets/game-set/part-${number}.bin`;
async function finishPart(f, task, number, size = 100) {
  f.files.set(part(number), 'volume'); f.files.set(`${part(number)}.complete`, 'receipt');
  task.listener({state: 'downloading', written: size, total: size});
  task.resolve({written: size}); await settle(); await settle();
}

test('multipart extraction gets its exact recorded password after queue persistence', async () => {
  const f = fixture();
  const protectedSet = {...set, parts: set.parts.map(item => ({...item,
    sources: item.sources.map(source => ({...source, archivePassword: '[fixture-password]'}))}))};
  f.queue.enqueue(game, protectedSet, '/data'); await settle();
  const saved = JSON.parse(f.files.get('/download0/overdrive/downloads.json'));
  assert.equal(saved.jobs[0].release.parts[0].sources[0].archivePassword, '[fixture-password]');
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number-1], number);
  assert.equal(f.extractions[0].options.password, '[fixture-password]');
  f.extractions[0].resolve(Promise.reject(new Error('Incorrect passphrase.'))); await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  for (const number of [1, 2, 3]) assert.ok(f.files.has(part(number)));
});

test('an old downloaded archive hydrates only the password of its matching catalog URL', async () => {
  for (const match of [true, false]) {
    const f = fixture();
    const archive = {...release, format: 'binary', filename: 'game.binary'};
    f.dependencies.releasesOf = id => {
      assert.equal(id, game.id);
      return [{...archive, url: match ? archive.url : 'https://example.com/other-build', archivePassword: 'fixture-password'}];
    };
    const queue = createDownloadQueue(f.dependencies);
    queue.enqueue(game, archive, '/data');
    f.files.set('/data/game.binary', 'rar');
    f.inspections.set('/data/game.binary', {kind: 'rar', refusal: ''});
    f.tasks[0].resolve({written: 100}); await settle(); await settle();
    assert.equal(f.extractions[0].options.password, match ? 'fixture-password' : undefined);
  }
});

test('game folders inside archive wrappers publish to homebrew for ShadowMount', async () => {
  for (const wrappers of [[], ['dump'], ['[fixture-password]-[PPSA03647][v01.000.000]', '3D MiniGolf v01.000.000 - [PPSA03647]']]) {
    const f = fixture();
    const archive = {...release, format: 'binary', filename: 'game.binary', archivePassword: 'fixture-password'};
    f.queue.enqueue(game, archive, '/data');
    f.files.set('/data/game.binary', 'rar');
    f.inspections.set('/data/game.binary', {kind: 'rar', refusal: ''});
    f.tasks[0].resolve({written: 100}); await settle(); await settle();
    const output = f.extractions[0].options.destination;
    const folder = [output, ...wrappers].join('/');
    f.files.set(`${folder}/eboot.bin`, 'executable');
    f.files.set(`${folder}/sce_sys/param.json`, 'metadata');
    f.extractions[0].resolve({artifacts: [], written: 20}); await settle(); await settle();
    const destination = '/data/homebrew/game.binary-app';
    const job = f.queue.snapshot()[0];
    assert.equal(job.state, 'downloaded');
    assert.equal(job.output, destination);
    assert.equal(job.artifact.nextAction, 'shadowmount');
    assert.equal(f.files.get(`${destination}/eboot.bin`), 'executable');
    assert.equal(f.files.get(`${destination}/sce_sys/param.json`), 'metadata');
    assert.ok(!f.files.has('/data/game.binary'));
    assert.ok(!f.fs.exists(output));
  }
});

test('multiple extracted folders are preserved instead of choosing a game', async () => {
  const f = fixture();
  f.queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number-1], number);
  const output = f.extractions[0].options.destination;
  for (const folder of ['one', 'two']) {
    f.files.set(`${output}/${folder}/eboot.bin`, 'executable');
    f.files.set(`${output}/${folder}/sce_sys/param.json`, 'metadata');
  }
  f.extractions[0].resolve({artifacts: [], written: 20}); await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'extracted');
  assert.ok(f.fs.exists(`${output}/one/eboot.bin`));
  assert.ok(f.fs.exists(`${output}/two/eboot.bin`));
});

test('a verified extraction deletes its volumes, and deleting from disk removes the whole job tree', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number-1], number);
  f.files.set('/data/downloads/extracted/game-set/game.ffpfsc', 'image');
  f.extractions[0].resolve({artifacts: ['game.ffpfsc']}); await settle();
  const [job] = f.queue.snapshot();
  assert.equal(job.state, 'downloaded');
  assert.equal(job.artifact.destination, '/data/homebrew/game-set-extracted/game.ffpfsc');
  assert.ok(![...f.files.keys()].some(path => path.startsWith('/data/downloads/sets/')), [...f.files.keys()]);
  f.files.set('/data/homebrew/game-set-extracted/.ps5-react-extraction', 'receipt');
  f.files.set('/data/homebrew/kept.ffpfsc', 'keep'); f.files.set('/data/downloads/extracted/other/file', 'keep');
  await f.queue.deleteFromDisk(id);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith('/data/')).sort(),
    ['/data/downloads/extracted/other/file', '/data/homebrew/kept.ffpfsc']);
  assert.equal(f.queue.snapshot().length, 0);
});

test('deleting from disk removes every path the job wrote, never the dump ShadowMount lists under its title', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number-1], number);
  f.files.set('/data/downloads/extracted/game-set/game.ffpfsc', 'image');
  f.extractions[0].resolve({artifacts: ['game.ffpfsc']}); await settle();
  // A first extraction left behind and receipts; the job's image went by FTP, and another dump of the
  // same title is what ShadowMount lists now.
  f.files.delete('/data/homebrew/game-set-extracted/game.ffpfsc');
  for (const path of ['/data/downloads/extracted/game-set/half', '/data/homebrew/game-set-extracted/.ps5-react-extraction',
    '/data/homebrew/game-set-extracted.complete']) f.files.set(path, 'x');
  f.files.set('/data/homebrew/other-dump/game.ffpfsc', 'keep'); f.files.set('/data/homebrew/other-dump/game.ffpfsc.complete', 'keep');
  f.files.set('/data/homebrew/kept.ffpfsc', 'keep'); f.files.set('/data/downloads/extracted/other/file', 'keep');
  shadowMount(f, {games: [listed({path: '/data/homebrew/other-dump/game.ffpfsc'})]});
  await f.queue.deleteFromDisk(id);
  assert.deepEqual(routes(f), ['images', 'games/info', 'images', 'games/uninstall', 'storage']);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith('/data/')).sort(), ['/data/downloads/extracted/other/file',
    '/data/homebrew/kept.ffpfsc', '/data/homebrew/other-dump/game.ffpfsc', '/data/homebrew/other-dump/game.ffpfsc.complete']);
  assert.equal(f.queue.snapshot().length, 0);
});

test('a failed extraction keeps its volumes for a retry', async () => {
  const f = fixture();
  f.queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number-1], number);
  f.extractions[0].resolve(Promise.reject(new Error('Incomplete archive data.'))); await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  for (const number of [1, 2, 3]) assert.ok(f.files.has(part(number)));
});

test('a set reserves room for its remaining volumes and their extraction before each volume', async () => {
  const f = fixture();
  f.queue.enqueue(game, set, '/data'); await settle();
  // One known 100-byte volume: two more to download, three to extract.
  f.fs.diskUsage = () => ({free: 500 + 16 * 1024 ** 2 - 1});
  await finishPart(f, f.tasks[0], 1);
  assert.equal(f.tasks.length, 1);
  assert.equal(f.queue.snapshot()[0].state, 'failed');
  assert.match(f.queue.snapshot()[0].error, /Not enough space for the remaining volumes and their extraction/);
  f.fs.diskUsage = () => ({free: 500 + 16 * 1024 ** 2});
  f.queue.resume(f.queue.snapshot()[0].id); await settle();
  assert.equal(f.tasks.length, 2);
});

test('an archive reserves room to extract before it downloads and before it extracts', async () => {
  const f = fixture();
  const archive = {...release, id: 'zip', format: 'zip', filename: 'game.zip', sizeBytes: 1000};
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/downloads/archives/${item.filename}`,
    directory: `${root}/downloads/archives`, nextAction: 'extraction-required'});
  f.fs.diskUsage = () => ({free: 1500 + 16 * 1024 ** 2});
  const queue = createDownloadQueue(f.dependencies);
  assert.throws(() => queue.enqueue(game, archive, '/data'), /Not enough space on \/data: needs/);
  f.fs.diskUsage = () => ({free: 2000 + 16 * 1024 ** 2});
  queue.enqueue(game, archive, '/data');
  f.files.set('/data/downloads/archives/game.zip', 'zip');
  f.fs.stat = (stat => path => path === '/data/downloads/archives/game.zip' ? {isFile: true, size: 1000} : stat(path))(f.fs.stat);
  f.fs.diskUsage = () => ({free: 999});
  f.tasks[0].resolve({written: 1000}); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'failed');
  assert.match(queue.snapshot()[0].error, /Not enough space to extract/);
  assert.equal(f.extractions.length, 0);
  assert.ok(f.files.has('/data/downloads/archives/game.zip'));
});

test('a release fits beside an archive that is extracting, whose archive is already on the drive', async () => {
  const f = fixture();
  const archive = {...release, id: 'zip', format: 'zip', filename: 'game.zip', sizeBytes: 1000};
  f.dependencies.formats.artifact = (item, root) => ({destination: `${root}/downloads/archives/${item.filename}`,
    directory: `${root}/downloads/archives`, nextAction: item.format === 'zip' ? 'extraction-required' : 'shadowmount'});
  f.fs.diskUsage = () => ({free: 2000 + 16 * 1024 ** 2});
  const queue = createDownloadQueue(f.dependencies);
  queue.enqueue(game, archive, '/data');
  f.files.set('/data/downloads/archives/game.zip', 'zip');
  f.fs.stat = (stat => path => path === '/data/downloads/archives/game.zip' ? {isFile: true, size: 1000} : stat(path))(f.fs.stat);
  f.tasks[0].resolve({written: 1000}); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'extracting');
  // The archive took its 1000 bytes; 1000 are left for its output and 600 for the next release.
  f.fs.diskUsage = () => ({free: 1600 + 16 * 1024 ** 2});
  queue.enqueue({...game, id: 'PPSA54321'}, {...release, id: 'next', filename: 'next.ffpfsc', sizeBytes: 600}, '/data');
  assert.equal(queue.snapshot().length, 2);
  assert.throws(() => queue.enqueue({...game, id: 'PPSA99999'}, {...release, id: 'more', filename: 'more.ffpfsc', sizeBytes: 1}, '/data'),
    /after queued downloads: Test game/);
});

test('a disk that fills up mid-transfer fails with the space message and does not switch sources', async () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data', [{...release, id: 'mirror', provider: 'Mirror', filename: 'mirror.ffpfsc'}]);
  f.tasks[0].reject(new Error('Downloads.enqueue /data/game.ffpfsc: write partial file: No space left on device')); await settle();
  const [job] = f.queue.snapshot();
  assert.equal(job.state, 'failed');
  assert.equal(job.release.id, 'image');
  assert.equal(explainError(job.error).title, 'Not enough free space');
});

test('resuming a set skips its finished volumes and downloads a missing one again', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  await finishPart(f, f.tasks[1], 2);
  f.tasks[2].listener({state: 'downloading', written: 40, total: 100});
  f.queue.pause(id); await settle();
  f.queue.resume(id); await settle();
  assert.equal(f.tasks.length, 4);
  assert.equal(f.tasks[3].options.destination, part(3));
  f.queue.pause(id); await settle();
  f.files.delete(part(1));
  f.queue.resume(id); await settle();
  assert.equal(f.tasks[4].options.destination, part(1));
  assert.equal(f.queue.snapshot()[0].parts[0].completed, false);
});

// The queue file as a process killed mid-transfer left it: the last sampled save, jobs still running.
function killed(f, edit) {
  const path = '/download0/overdrive/downloads.json';
  const saved = JSON.parse(f.files.get(path));
  saved.jobs = saved.jobs.map(edit);
  f.files.set(path, JSON.stringify(saved));
}

test('a job killed mid-transfer resumes its partial when the app opens again', async () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data');
  f.tasks[0].listener({state: 'downloading', written: 40, total: 100});
  f.files.set('/data/game.ffpfsc.part', 'partial'); f.files.set('/data/game.ffpfsc.resume', 'checkpoint');
  killed(f, job => ({...job, state: 'downloading', written: 40, rootIdentity: '1:2'}));
  const loaded = createDownloadQueue(f.dependencies); await settle();
  assert.equal(f.tasks.length, 2);
  assert.deepEqual([f.tasks[1].options.destination, f.tasks[1].options.storageRoot, f.tasks[1].options.recoverCompleted],
    ['/data/game.ffpfsc', '/data', true]);
  assert.equal(f.files.get('/data/game.ffpfsc.part'), 'partial');
  assert.equal(loaded.awake, true);
  assert.equal(loaded.snapshot()[0].launches, 1);
  // Progress shows it is not crash-looping.
  tick(f.tasks[1], {state: 'downloading', written: 60, total: 100});
  assert.equal(loaded.snapshot()[0].launches, undefined);
  f.tasks[1].resolve({written: 100}); await settle();
  assert.equal(loaded.snapshot()[0].state, 'downloaded');
});

test('a job that was running at the last two launches without progress waits for the person', () => {
  const f = fixture();
  f.queue.enqueue(game, release, '/data');
  killed(f, job => ({...job, state: 'extracting', launches: 2}));
  const loaded = createDownloadQueue(f.dependencies);
  assert.equal(loaded.snapshot()[0].state, 'paused');
  assert.match(loaded.snapshot()[0].error, /Interrupted/);
  assert.equal(f.tasks.length, 1);
});

test('a job whose drive is missing or replaced at launch stays paused', () => {
  for (const stat of [() => null, path => path === '/mnt/usb0' ? {isDirectory: true, device: '7', inode: '2'} : null]) {
    const f = fixture();
    f.queue.enqueue(game, release, '/mnt/usb0');
    killed(f, job => ({...job, state: 'downloading', rootIdentity: '1:2'}));
    f.fs.stat = stat;
    const loaded = createDownloadQueue(f.dependencies);
    assert.equal(loaded.snapshot()[0].state, 'paused');
    assert.equal(f.tasks.length, 1);
    assert.equal(loaded.awake, false);
  }
});

test('at launch the running job goes first, waiting ones follow, and a pausing one stays paused', async () => {
  const f = fixture();
  for (const id of ['first', 'second', 'third']) f.queue.enqueue(game, {...release, id, filename: `${id}.ffpfsc`}, '/data');
  killed(f, job => ({...job, state: {[`${game.id}/first`]: 'queued', [`${game.id}/second`]: 'downloading', [`${game.id}/third`]: 'pausing'}[job.id]}));
  const loaded = createDownloadQueue(f.dependencies); await settle();
  assert.deepEqual(loaded.snapshot().map(job => job.state), ['queued', 'resolving', 'paused']);
  assert.equal(f.tasks.at(-1).options.destination, '/data/second.ffpfsc');
  f.tasks.at(-1).resolve({written: 100}); await settle(); await settle();
  assert.equal(f.tasks.at(-1).options.destination, '/data/first.ffpfsc');
});

function captureFixture({multipart = false, realResolver = false, page = {}, total = 100} = {}) {
  const f = fixture();
  let resolve, reject;
  const done = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  done.catch(() => {});
  const capture = {done, cancel() { capture.cancelled = true; reject(new Error('cancelled')); }};
  const opened = [], requests = [];
  const partSource = {...release, id: 'viking', filename: 'catalog.binary', format: 'binary', sizeBytes: null,
    url: 'https://vikingfile.com/f/Ab01234567', requiresBrowser: true, ...page};
  const source = multipart ? {...partSource, id: 'viking-set', filename: 'viking-set',
    parts: [{number: 1, sources: [partSource]}]} : partSource;
  const url = 'https://vikingfile.com/d/Cd01234567/Game%20DLC.pkg';
  f.dependencies.sources = {resolve: async (_, {directURL} = {}) => {
    if (!directURL) { const {BrowserRequired} = await import('./download-sources.js'); throw new BrowserRequired(source.url); }
    return {url: directURL};
  }};
  f.dependencies.browserCapture = {capture(options) { capture.options = options; return capture; }};
  f.dependencies.linking = {openURL(value) { opened.push(value); return true; }};
  f.dependencies.http.request = async (_, options) => {
    requests.push(options);
    if (options.method === 'HEAD') throw new Error('HEAD must not run after a validated capture');
    if (options.headers?.Range) return {ok: true, status: 206, url, text: async () => 'R', headers: {'content-length': '1', 'content-range': `bytes 0-0/${total}`, etag: '"file-v1"', 'content-type': 'application/octet-stream'}};
    return {ok: true, status: 200, headers: {'content-type': 'text/html'}, text: async () => '<h2 id="filename">Game DLC.pkg</h2><p id="size">100 B</p>'};
  };
  if (realResolver) f.dependencies.sources = createSourceResolver({http: f.dependencies.http});
  const queue = createDownloadQueue(f.dependencies);
  return {...f, queue, source, url, capture, resolve, reject, opened, requests};
}
const settleCapture = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
test('Vikingfile capture selects the real filename and starts the validated file ahead of waiting jobs', async () => {
  const f = captureFixture();
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  assert.equal(f.capture.options.suffix, '/Game DLC.pkg');
  assert.equal(f.capture.options.timeoutSeconds, 180);
  assert.equal(f.queue.snapshot()[0].captureState, 'capturing');
  assert.equal(f.queue.awake, true);
  assert.deepEqual(f.opened, [f.source.url]);
  f.queue.enqueue(game, {...release, id: 'after', filename: 'after.pkg'}, '/data');
  assert.equal(f.tasks.length, 0);
  f.resolve({url: f.url}); await settleCapture();
  assert.equal(f.tasks.length, 1);
  assert.equal(f.tasks[0].options.url, f.url);
  assert.equal(f.tasks[0].options.expectedBytes, 100);
  assert.equal(f.queue.snapshot()[0].captureState, undefined);
});
test('capture failure leaves manual recovery and refuses a different filename before HTTP', async () => {
  const f = captureFixture();
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  f.resolve({url: f.url.replace('DLC', 'Other')}); await settleCapture();
  assert.equal(f.tasks.length, 0);
  assert.equal(f.requests.length, 1);
  assert.equal(f.queue.snapshot()[0].captureState, 'failed');
  assert.equal(f.queue.snapshot()[0].state, 'awaiting-browser');
  f.queue.continueWithURL(id, f.url); await settleCapture();
  assert.equal(f.tasks.length, 1);
});
test('removing a browser job cancels capture and ignores late completion', async () => {
  const f = captureFixture();
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  f.queue.remove(id); f.resolve({url: f.url}); await settleCapture();
  assert.equal(f.capture.cancelled, true);
  assert.deepEqual(f.queue.snapshot(), []);
  assert.equal(f.tasks.length, 0);
});
test('capture does not reuse a short-lived URL while another download owns the queue', async () => {
  const f = captureFixture();
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.enqueue(game, {...release, id: 'other', filename: 'other.pkg'}, '/data'); await settleCapture();
  assert.throws(() => f.queue.openBrowser(id), /Wait for the current/);
  assert.equal(f.capture.options, undefined);
});
test('validated captures bypass the production HEAD resolver for single files and multipart sets', async () => {
  for (const multipart of [false, true]) {
    const f = captureFixture({multipart, realResolver: true});
    const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
    assert.equal(f.queue.snapshot()[0].state, 'awaiting-browser');
    f.queue.openBrowser(id); await settleCapture();
    f.resolve({url: f.url}); await settleCapture();
    assert.equal(f.tasks.length, 1);
    assert.equal(f.tasks[0].options.url, f.url);
    assert.equal(f.tasks[0].options.expectedBytes, 100);
    assert.equal(f.requests.filter(request => request.method === 'HEAD').length, 0);
    assert.equal(f.queue.snapshot()[0].captureState, undefined);
  }
});
test('a storage failure during multipart capture handoff reaches manual recovery instead of disappearing', async () => {
  const f = captureFixture({multipart: true});
  const id = f.queue.enqueue(game, f.source, '/mnt/usb0'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  const stat = f.fs.stat;
  f.fs.stat = path => path === '/mnt/usb0' ? {isDirectory: true, device: 'changed', inode: '2'} : stat(path);
  f.resolve({url: f.url}); await settleCapture();
  const job = f.queue.snapshot()[0];
  assert.equal(f.tasks.length, 0);
  assert.equal(job.state, 'awaiting-browser');
  assert.equal(job.captureState, 'failed');
  assert.match(job.captureError, /Storage changed/);
});
test('a queue save failure after capture cleanup still reaches recovery', async () => {
  const f = captureFixture();
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  const write = f.fs.writeFile;
  let fail = true;
  f.fs.writeFile = (path, data) => {
    if (fail && data.includes('"state":"queued"')) { fail = false; throw new Error('Queue disk write failed'); }
    write(path, data);
  };
  f.resolve({url: f.url}); await settleCapture();
  assert.equal(f.tasks.length, 0);
  const job = f.queue.snapshot()[0];
  assert.equal(job.state, 'awaiting-browser');
  assert.equal(job.captureState, 'failed');
  assert.match(job.captureError, /Queue disk write failed/);
});

const linkPage = {url: 'https://links.example.com/c/Fx01Ab23#VikingFile', browserUrl: 'https://links.example.com/c/Fx01Ab23#VikingFile',
  provider: 'links.example.com', source: 'pegasus-1', flow: 'browser', label: 'Dump - VikingFile', sizeBytes: 100};
async function captureLinkPage(page, captured, total) {
  const f = captureFixture({page: {...linkPage, ...page}, total});
  const id = f.queue.enqueue(game, f.source, '/data'); await settleCapture();
  f.queue.openBrowser(id); await settleCapture();
  if (captured) { f.resolve({url: captured}); await settleCapture(); }
  return {...f, job: f.queue.snapshot()[0]};
}
test('a link page naming VikingFile captures its /d/ link and takes the filename from it', async () => {
  const f = await captureLinkPage({});
  assert.equal(f.capture.options.suffix, '/');
  assert.equal(f.queue.snapshot()[0].captureState, 'capturing');
  assert.deepEqual(f.opened, [linkPage.browserUrl]);
  assert.equal(f.requests.length, 0, 'the link page is not fetched');
  f.resolve({url: f.url}); await settleCapture();
  assert.equal(f.tasks.length, 1);
  assert.equal(f.tasks[0].options.url, f.url);
  assert.equal(f.tasks[0].options.expectedBytes, 100);
  assert.deepEqual(f.notices, ['Link captured, return to Overdrive: Test game'], 'the person in the browser is told to come back');
});
test('a link page capture refuses another part of a multi-part page', async () => {
  const wrong = await captureLinkPage({label: 'Dump - VikingFile part 2'}, 'https://vikingfile.com/d/Cd01234567/Game.part1.rar');
  assert.equal(wrong.tasks.length, 0);
  assert.equal(wrong.job.captureState, 'failed');
  assert.match(wrong.job.captureError, /part 2/);
  const right = await captureLinkPage({label: 'Dump - VikingFile part 2'}, 'https://vikingfile.com/d/Cd01234567/Game.part02.rar');
  assert.equal(right.tasks.length, 1);
});
test('a link page capture refuses a file far from the catalog size', async () => {
  const f = await captureLinkPage({}, 'https://vikingfile.com/d/Cd01234567/Game.pkg', 3 * 2 ** 30);
  assert.equal(f.tasks.length, 0);
  assert.match(f.job.captureError, /validation/);
});
test('a link page that leads elsewhere still asks for the file link', async () => {
  const f = await captureLinkPage({url: 'https://links.example.com/c/AbCd1234#AkiraBox', browserUrl: 'https://links.example.com/c/AbCd1234#AkiraBox', label: 'Dump - AkiraBox'});
  assert.equal(f.capture.options, undefined);
  assert.equal(f.job.captureState, undefined);
  assert.deepEqual(f.opened, ['https://links.example.com/c/AbCd1234#AkiraBox']);
});

// A RAR set's archives mock that records streamed extractions, their cancels, and lets a test end each.
function streaming(f) {
  f.inspections.set(part(1), {kind: 'rar', refusal: ''});
  const runs = [];
  f.dependencies.archives = {streams: true, inspect: f.dependencies.archives.inspect,
    extract(options) {
      let resolve, reject;
      const done = new Promise((ok, fail) => { resolve = ok; reject = fail; });
      const run = {options, resolve, reject, cancelled: false, listener: null};
      runs.push(run);
      return {done, subscribe(listener) { run.listener = listener; return () => { run.listener = null; }; },
        cancel() { run.cancelled = true; reject(new Error('Extraction cancelled; downloaded parts are preserved.')); }};
    }};
  return {runs, queue: createDownloadQueue(f.dependencies)};
}

test('a RAR set extracts while its later volumes download and is done when the last one is', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  assert.equal(runs.length, 1); assert.equal(runs[0].options.stream, true);
  assert.deepEqual(runs[0].options.sources, [1, 2, 3].map(part));
  assert.equal(f.tasks.length, 2, 'the next volume downloads meanwhile');
  assert.notEqual(queue.snapshot()[0].state, 'extracting');
  runs[0].listener({written: 150});
  await finishPart(f, f.tasks[1], 2);
  await finishPart(f, f.tasks[2], 3);
  assert.equal(queue.snapshot()[0].state, 'extracting');
  assert.equal(queue.snapshot()[0].written, 150, 'the bar starts where the extraction is');
  runs[0].resolve({artifacts: []}); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'extracted');
  assert.equal(runs.length, 1, 'extracted once');
});

test('a streamed extraction that fails runs again after the last volume', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  runs[0].reject(new Error('Extracting while downloading needs the RAR worker.')); await settle();
  assert.equal(f.tasks.length, 2, 'downloading goes on');
  await finishPart(f, f.tasks[1], 2);
  await finishPart(f, f.tasks[2], 3);
  assert.equal(runs.length, 2); assert.equal(runs[1].options.stream, undefined);
  runs[1].resolve({artifacts: []}); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'extracted');
});

test('a streamed extraction that fails on the archive itself fails the job instead of extracting again', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  const id = queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  await finishPart(f, f.tasks[1], 2);
  await finishPart(f, f.tasks[2], 3);
  runs[0].reject(new Error('Archives.extract /data/x: Incomplete RAR archive or missing volume. Volume 2 of 3 looks incomplete.'));
  await settle(); await settle();
  assert.equal(runs.length, 1, 'not extracted again');
  const [job] = queue.snapshot();
  assert.equal(job.state, 'failed');
  assert.match(explainError(job.error).title, /Part 2 looks incomplete/);
  // The named volume is gone, so Retry downloads it alone and extracts again.
  assert.ok(!f.files.has(part(2)) && !f.files.has(`${part(2)}.complete`) && f.files.has(part(1)) && f.files.has(part(3)));
  assert.deepEqual(job.parts.map(item => item.completed), [true, false, true]);
  assert.equal(job.written, 200);
  queue.resume(id); await settle(); await settle();
  assert.equal(f.tasks.length, 4); assert.equal(f.tasks[3].options.destination, part(2));
});

test('a password or checksum failure while streaming fails the job without deleting a volume', async () => {
  for (const message of ['Incorrect RAR archive password.', 'RAR checksum mismatch; the archive is damaged.']) {
    const f = fixture(); const {runs, queue} = streaming(f);
    queue.enqueue(game, set, '/data'); await settle();
    for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number - 1], number);
    runs[0].reject(new Error(message)); await settle(); await settle();
    assert.equal(runs.length, 1, message);
    assert.equal(queue.snapshot()[0].state, 'failed', message);
    assert.ok([1, 2, 3].every(number => f.files.has(part(number))), message);
  }
});

test('the bar ends at what the set unpacks to once the engine knows it', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  f.fs.stat = (stat => path => path.startsWith('/data/downloads/sets/') && !path.endsWith('.complete') ? {isFile: true, size: 100} : stat(path))(f.fs.stat);
  queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2, 3]) await finishPart(f, f.tasks[number - 1], number);
  assert.equal(queue.snapshot()[0].total, 300, 'the volumes stand in at first');
  runs[0].listener({written: 400, total: 1000});
  assert.deepEqual([queue.snapshot()[0].written, queue.snapshot()[0].total], [400, 1000]);
  runs[0].listener({written: 1000, total: 1000});
  assert.equal(queue.snapshot()[0].written, 990, 'short of full until it ends');
});

test('pausing or a failed volume stops the streamed extraction before the job stops', async () => {
  for (const stop of ['pause', 'fail']) {
    const f = fixture(); const {runs, queue} = streaming(f);
    const id = queue.enqueue(game, set, '/data'); await settle();
    await finishPart(f, f.tasks[0], 1);
    if (stop === 'pause') queue.pause(id); else f.tasks[1].reject(new Error('HTTP 500'));
    await settle(); await settle();
    assert.equal(runs[0].cancelled, true, stop);
    assert.equal(queue.snapshot()[0].state, stop === 'pause' ? 'paused' : 'failed', stop);
    assert.ok(f.files.has(part(1)), 'volumes stay');
  }
});

test('the room a set needs leaves out what its streamed extraction already wrote', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  let free = 1e9; f.fs.diskUsage = () => ({free});
  queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  // Before the last volume: its 100, and 300 of extraction less the 150 written, 250; counted twice, 400.
  runs[0].listener({written: 150}); free = 300 + 16 * 1024 ** 2;
  await finishPart(f, f.tasks[1], 2);
  assert.equal(f.tasks.length, 3, queue.snapshot()[0].error);
});

test('the updater takes the archive task from a streamed extraction, and the set extracts after its download', async () => {
  const f = fixture(); const {runs, queue} = streaming(f);
  queue.enqueue(game, set, '/data'); await settle();
  await finishPart(f, f.tasks[0], 1);
  await queue.yieldArchives();
  assert.equal(runs[0].cancelled, true);
  assert.equal(f.tasks.length, 2, 'downloading goes on');
  await finishPart(f, f.tasks[1], 2);
  await finishPart(f, f.tasks[2], 3);
  assert.equal(runs.length, 2); assert.equal(runs[1].options.stream, undefined);
  runs[1].resolve({artifacts: []}); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'extracted');
});

test('the queue is synced to the disk before it is renamed into place', () => {
  const f = fixture();
  const writes = [];
  const write = f.fs.writeFile;
  f.fs.writeFile = (path, data, options) => { writes.push([path, options]); return write(path, data); };
  f.queue.enqueue(game, release, '/data');
  assert.deepEqual(writes.at(-1), ['/download0/overdrive/downloads.json.tmp', {sync: true}]);
});

test('progress saves during a download skip the sync, so they never hold up the screen', async () => {
  const f = fixture();
  const writes = [];
  const write = f.fs.writeFile;
  f.fs.writeFile = (path, data, options) => { writes.push(options); return write(path, data); };
  f.queue.enqueue(game, release, '/data');
  writes.length = 0;
  for (let tick = 1; tick <= 40; tick++) f.tasks[0].listener({state: 'downloading', written: tick, total: 100});
  assert.deepEqual(writes, [{sync: false}, {sync: false}]);
  f.tasks[0].resolve({written: 100});
  await settle();
  assert.deepEqual(writes.at(-1), {sync: true});
});

// FileSystem.removeAsync held until the test settles each call: `resolve()` deletes the path then.
function heldRemovals(f) {
  const held = [];
  f.fs.removeAsync = path => new Promise((resolve, reject) => held.push({path, reject, resolve() {
    for (const key of [...f.files.keys()]) if (key === path || key.startsWith(`${path}/`)) f.files.delete(key);
    resolve();
  }}));
  return held;
}

test('cancelling waits for its partial file to be deleted before freeing the queue or forgetting the task', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.enqueue(game, {...release, id: 'next', filename: 'next.bin'}, '/data');
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  const held = heldRemovals(f);
  await f.queue.cancel(id); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'removing');
  assert.equal(f.files.get('/data/game.ffpfsc.part'), 'GBs');
  assert.equal(f.tasks.length, 1);
  for (const removal of held) removal.resolve();
  await settle();
  assert.deepEqual(f.queue.snapshot().map(job => job.id), [`${game.id}/next`]);
  assert.equal(f.files.has('/data/game.ffpfsc.part'), false);
  assert.equal(f.tasks.length, 2);
});

test('a stopped task stays, deleting, until its cancel resolves', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  const held = heldRemovals(f);
  const cancelled = f.queue.cancel(id);
  assert.equal(f.queue.snapshot()[0].state, 'removing');
  assert.equal(f.queue.awake, false);
  assert.deepEqual(held.map(removal => removal.path).sort(), ['.complete', '.complete.tmp', '.part', '.resume', '.resume.tmp'].map(suffix => `/data/game.ffpfsc${suffix}`).sort());
  for (const removal of held) removal.resolve();
  await cancelled;
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(createDownloadQueue(f.dependencies).snapshot().length, 0);
});

test('a delete that fails puts the task back with the reason, and a later cancel deletes it', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  const held = heldRemovals(f);
  const cancelled = f.queue.cancel(id);
  held[0].reject(new Error('fs.removeAsync /data/game.ffpfsc.part: Device busy'));
  await assert.rejects(cancelled, /Its files were not deleted: fs\.removeAsync \/data\/game\.ffpfsc\.part: Device busy/);
  const [job] = f.queue.snapshot();
  assert.equal(job.state, 'paused');
  assert.equal(job.removingFrom, undefined);
  assert.match(job.error, /not deleted.*Device busy/);
  assert.equal(f.files.get('/data/game.ffpfsc.part'), 'GBs');
  f.fs.removeAsync = async path => { for (const key of [...f.files.keys()]) if (key === path) f.files.delete(key); };
  await f.queue.cancel(id);
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.files.has('/data/game.ffpfsc.part'), false);
});

test('while its files are deleted a task takes no second delete, retry or restart', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  const held = heldRemovals(f);
  const cancelled = f.queue.cancel(id);
  await f.queue.cancel(id);
  f.queue.resume(id);
  await f.queue.restart(id);
  f.queue.remove(id);
  assert.equal(held.length, 5);
  assert.equal(f.queue.snapshot()[0].state, 'removing');
  for (const removal of held) removal.resolve();
  await cancelled;
  assert.equal(f.queue.snapshot().length, 0);
  assert.equal(f.tasks.length, 1);
});

test('a second Delete while one runs deletes nothing more and ends with the first', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f);
  const held = heldRemovals(f);
  const first = queue.deleteFromDisk(id);
  assert.equal(queue.snapshot()[0].state, 'removing');
  let secondDone = false;
  const second = queue.deleteFromDisk(id).then(() => { secondDone = true; });
  for (let i = 0; i < 10 && !held.length; i++) await settle();
  await settle();
  assert.equal(secondDone, false);
  for (let i = 0; i < 10 && held.some(removal => !removal.done); i++) {
    for (const removal of held.filter(item => !item.done)) { removal.done = true; removal.resolve(); }
    await settle();
  }
  await Promise.all([first, second]);
  assert.equal(new Set(held.map(removal => removal.path)).size, held.length);
  // ShadowMount was asked what one delete asks.
  const alone = fixture();
  const lone = await finishedImage(alone);
  shadowMount(alone);
  await lone.queue.deleteFromDisk(lone.id);
  assert.deepEqual(routes(f), routes(alone));
  assert.equal(queue.snapshot().length, 0);
  assert.ok(!f.files.has('/data/homebrew/game.ffpfsc'));
});

test('a second Delete while one runs fails with it', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f);
  const held = heldRemovals(f);
  const first = queue.deleteFromDisk(id);
  const second = queue.deleteFromDisk(id);
  for (let i = 0; i < 10 && !held.length; i++) await settle();
  held[0].reject(new Error('fs.removeAsync /data/homebrew/game.ffpfsc: Device busy'));
  await assert.rejects(first, /not deleted.*Device busy/);
  await assert.rejects(second, /not deleted.*Device busy/);
  assert.equal(queue.snapshot()[0].state, 'downloaded');
});

test('a finished download whose files cannot be deleted stays, finished, with the reason', async () => {
  const f = fixture();
  const {queue, id} = await finishedImage(f);
  shadowMount(f);
  f.fs.removeAsync = async path => { throw new Error(`fs.removeAsync ${path}: Read-only file system`); };
  await assert.rejects(queue.deleteFromDisk(id), /Its files were not deleted: .*Read-only file system/);
  const [job] = queue.snapshot();
  assert.equal(job.state, 'downloaded');
  assert.match(job.error, /Read-only file system/);
  assert.ok(f.files.has('/data/homebrew/game.ffpfsc'));
});

test('a delete the app closed during comes back as it was, asking to delete again', async () => {
  const f = fixture();
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  heldRemovals(f);
  void f.queue.cancel(id);
  f.queue.enqueue(game, {...release, id: 'next', filename: 'next.bin'}, '/data');
  const [job] = createDownloadQueue(f.dependencies).snapshot();
  assert.equal(job.state, 'paused');
  assert.equal(job.removingFrom, undefined);
  assert.match(job.error, /closed while deleting/);
});

// A dump extracted with its game PKG and a backport PKG, the console refusing the paths in `refused`.
function extractedPackages(refused) {
  const f = fixture();
  const installed = [];
  f.dependencies.packages = {install({path}) {
    installed.push(path);
    const done = refused.some(name => path.includes(name)) ? Promise.reject(new Error('refused')) : Promise.resolve();
    done.catch(() => {});
    return {done, subscribe: () => () => {}};
  }};
  const output = '/data/downloads/extracted/game.binary';
  f.files.set('/download0/overdrive/downloads.json', JSON.stringify({version: 1, jobs: [{id: 'PPSA12345/dump', title: 'Test game',
    release: {id: 'dump', filename: 'game.binary', format: 'binary'}, root: '/data', state: 'installer-required', written: 0,
    artifact: {destination: `${output}/game.binary`, nextAction: 'extraction-required'}, output,
    packages: [`${output}/backport (4.xx to 11.xx)/UP0006-game-backport.pkg`, `${output}/UP0006-game.pkg`]}]}));
  return {...f, installed, queue: createDownloadQueue(f.dependencies)};
}

test('a dump installs its game PKG before the backport, and a refused backport keeps the game installed', async () => {
  const f = extractedPackages(['backport']);
  f.queue.install('PPSA12345/dump');
  await settle(); await settle();
  assert.deepEqual(f.installed.map(path => path.split('/').at(-1)), ['UP0006-game.pkg', 'UP0006-game-backport.pkg']);
  assert.equal(f.queue.snapshot()[0].state, 'installed');
});

test('a refused install from the page frees the queue for the next download', async () => {
  const f = extractedPackages(['UP0006-game.pkg']);
  f.queue.install('PPSA12345/dump');
  await settle(); await settle();
  assert.equal(f.queue.snapshot()[0].state, 'installer-required');
  assert.deepEqual(f.installed.map(path => path.split('/').at(-1)), ['UP0006-game.pkg']);
  f.queue.enqueue(game, release, '/data');
  await settle();
  assert.equal(f.tasks.length, 1);
});

// A paused task with a partial, queued again behind a running download.
async function queuedBehind(f) {
  const id = f.queue.enqueue(game, release, '/data');
  f.queue.pause(id); await settle();
  f.queue.enqueue(game, {...release, id: 'running', filename: 'running.bin'}, '/data');
  f.queue.resume(id);
  f.files.set('/data/game.ffpfsc.part', 'GBs');
  assert.equal(f.queue.snapshot()[0].state, 'queued');
  return id;
}

test('a queued task cancelled while the app closes mid-delete comes back paused, never downloading again', async () => {
  const f = fixture();
  const id = await queuedBehind(f);
  heldRemovals(f);
  void f.queue.cancel(id);
  const before = f.tasks.length;
  const loaded = createDownloadQueue(f.dependencies);
  const job = loaded.snapshot().find(item => item.id === id);
  assert.equal(job.state, 'paused');
  assert.equal(job.restore, undefined);
  assert.match(job.error, /closed while deleting/);
  await settle();
  assert.ok(f.tasks.slice(before).every(task => task.options.destination !== '/data/game.ffpfsc'));
});

test('a queued task being cancelled is not started when the download ahead of it ends', async () => {
  const f = fixture();
  const id = await queuedBehind(f);
  const held = heldRemovals(f);
  const cancelled = f.queue.cancel(id);
  // Whatever pump() runs between the delete and forgetting the task finds nothing queued.
  assert.equal(f.queue.snapshot()[0].removingFrom, 'paused');
  const running = f.tasks.at(-1);
  for (const removal of held) removal.resolve();
  running.resolve({written: 100});
  await cancelled; await settle();
  assert.deepEqual(f.queue.snapshot().map(job => job.id), [`${game.id}/running`]);
  assert.equal(f.tasks.filter(task => task.options.destination === '/data/game.ffpfsc').length, 1);
});

test('cancelling a set deletes its whole folder, complete volumes included, and no other set', async () => {
  const f = fixture();
  f.dependencies.archives = {inspect: () => ({kind: '', refusal: ''}), extract: () => ({done: new Promise(() => {}), subscribe: () => () => {}, cancel() {}})};
  const queue = createDownloadQueue(f.dependencies);
  const set = {id: 'set', filename: 'game-set', format: 'archive-set',
    parts: [1, 2, 3].map(number => ({number, sources: [{...release, id: `part${number}`, filename: `part${number}.bin`, format: 'binary'}]}))};
  const directory = '/data/downloads/sets/game-set';
  const id = queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2]) {
    f.files.set(`${directory}/part-${number}.bin`, 'volume'); f.files.set(`${directory}/part-${number}.bin.complete`, 'receipt');
    f.tasks.at(-1).resolve({written: 100}); await settle();
  }
  f.files.set(`${directory}/part-3.bin.part`, 'partial'); f.files.set(`${directory}/part-3.bin.resume`, 'checkpoint');
  f.files.set('/data/downloads/sets/other-set/part-1.bin', 'another set');
  queue.pause(id); await settle();
  assert.equal(queue.snapshot()[0].state, 'paused');
  await queue.cancel(id);
  assert.equal(queue.snapshot().length, 0);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(`${directory}/`)), []);
  assert.equal(f.files.get('/data/downloads/sets/other-set/part-1.bin'), 'another set');
});

test('cancelling a set that extracted while downloading deletes that extraction too, and nothing published or another task\'s', async () => {
  const f = fixture();
  let streamed;
  f.dependencies.archives = {streams: true, inspect: () => ({kind: 'rar', refusal: ''}), extract(options) {
    let fail;
    streamed = {options, done: new Promise((resolve, reject) => { fail = reject; })};
    return {done: streamed.done, subscribe: () => () => {}, cancel() { fail(new Error('Extraction cancelled')); }};
  }};
  const queue = createDownloadQueue(f.dependencies);
  const set = {id: 'set', filename: 'game-set', format: 'archive-set',
    parts: [1, 2, 3].map(number => ({number, sources: [{...release, id: `part${number}`, filename: `part${number}.bin`, format: 'binary'}]}))};
  const directory = '/data/downloads/sets/game-set';
  const id = queue.enqueue(game, set, '/data'); await settle();
  for (const number of [1, 2]) {
    f.files.set(`${directory}/part-${number}.bin`, 'volume');
    f.tasks.at(-1).resolve({written: 100}); await settle();
  }
  assert.equal(streamed.options.destination, '/data/downloads/extracted/game-set');
  f.files.set('/data/downloads/extracted/game-set/Game/eboot.bin', 'half extracted');
  f.files.set('/data/downloads/extracted/other-game/eboot.bin', 'another extraction');
  f.files.set('/data/homebrew/game-set-app/eboot.bin', 'published');
  queue.pause(id); await settle(); await settle();
  assert.equal(queue.snapshot()[0].state, 'paused');
  assert.equal(f.files.get('/data/downloads/extracted/game-set/Game/eboot.bin'), 'half extracted');
  await queue.cancel(id);
  assert.equal(queue.snapshot().length, 0);
  assert.deepEqual([...f.files.keys()].filter(path => path.startsWith(`${directory}/`) || path.startsWith('/data/downloads/extracted/game-set/')), []);
  assert.equal(f.files.get('/data/downloads/extracted/other-game/eboot.bin'), 'another extraction');
  assert.equal(f.files.get('/data/homebrew/game-set-app/eboot.bin'), 'published');
});

// A three-volume set saved stopped by an earlier run, with `fields`, beside `others`.
function savedSet(f, fields, others = []) {
  const set = {id: 'set', filename: 'game-set', format: 'archive-set',
    parts: [1, 2, 3].map(number => ({number, sources: [{...release, id: `part${number}`, filename: `part${number}.bin`, format: 'binary'}]}))};
  const job = {id: `${game.id}/set`, gameId: game.id, titleId: game.id, title: game.title, release: set, requestedId: 'set', fallbacks: [],
    root: '/data', artifact: {directory: '/data/downloads/sets/game-set', destination: '/data/downloads/extracted/game-set', nextAction: 'extracted'},
    state: 'failed', written: 300, total: 300, error: 'Extraction failed', rootIdentity: '1:2', partIndex: 2,
    parts: [1, 2, 3].map(number => ({number, destination: `/data/downloads/sets/game-set/part-${number}.bin`, written: 100, completed: true})), ...fields};
  f.files.set('/download0/overdrive/downloads.json', JSON.stringify({version: 1, jobs: [job, ...others]}));
  for (const number of [1, 2, 3]) f.files.set(`/data/downloads/sets/game-set/part-${number}.bin`, 'volume');
  return {id: job.id, queue: createDownloadQueue(f.dependencies)};
}

test('cancelling a set that already published its game deletes nothing published', async () => {
  for (const output of ['/data/homebrew/game-set-extracted', '/data/downloads/extracted/game-set']) {
    const f = fixture();
    const published = '/data/homebrew/game-set-extracted';
    f.files.set(`${published}/game.exfat`, 'installed game');
    f.files.set('/data/homebrew/game-set-app/eboot.bin', 'another game');
    f.files.set('/data/downloads/extracted/game-set/game.exfat', 'extracted, not moved yet');
    const {id, queue} = savedSet(f, {output, publishTo: published});
    await queue.cancel(id);
    assert.equal(queue.snapshot().length, 0, output);
    assert.equal(f.files.get(`${published}/game.exfat`), 'installed game', output);
    assert.equal(f.files.get('/data/homebrew/game-set-app/eboot.bin'), 'another game', output);
    assert.equal(f.files.get('/data/downloads/extracted/game-set/game.exfat'), 'extracted, not moved yet', output);
    assert.ok(![...f.files.keys()].some(path => path.startsWith('/data/downloads/sets/game-set/')), output);
  }
});

test('cancelling a set keeps an extraction another task owns', async () => {
  const f = fixture();
  const output = '/data/downloads/extracted/game-set';
  f.files.set(`${output}/Game/eboot.bin`, 'the other task\'s');
  const other = {id: 'PPSA99999/zip', gameId: 'PPSA99999', titleId: 'PPSA99999', title: 'Other', release: {...release, id: 'zip', filename: 'other.zip', format: 'zip'},
    requestedId: 'zip', fallbacks: [], root: '/data', artifact: {directory: '/data/downloads/archives', destination: '/data/downloads/archives/other.zip', nextAction: 'extracted'},
    state: 'extracted', written: 100, total: 100, error: '', rootIdentity: '1:2', output};
  const {id, queue} = savedSet(f, {output}, [other]);
  await queue.cancel(id);
  assert.deepEqual(queue.snapshot().map(job => job.id), [other.id]);
  assert.equal(f.files.get(`${output}/Game/eboot.bin`), 'the other task\'s');
  assert.ok(![...f.files.keys()].some(path => path.startsWith('/data/downloads/sets/game-set/')));
});
