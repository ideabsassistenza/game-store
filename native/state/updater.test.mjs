// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as nodeFs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createUpdater, ImageReplaceError, newer} from './updater.js';

const SHA = 'ab'.repeat(32);
const RELEASE = {tag_name: 'v0.0.87', body: 'notes', assets: [
  {name: 'Overdrive-PPSA99058.zip', size: 100, digest: `sha256:${SHA}`, browser_download_url: 'https://example.com/a.zip'}]};

// A filesystem of paths to file contents ('dir' marks a directory; {size, modified} a large file),
// with `free` bytes left.
function memoryFs(files, free = 1024 ** 4) {
  const tree = new Map(Object.entries(files));
  const sizeOf = path => tree.get(path) === 'dir' ? 0 : tree.get(path).size ?? tree.get(path).length;
  const children = dir => [...tree.keys()].filter(path => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'));
  return {
    tree,
    failRename: null,
    exists: path => tree.has(path),
    readDir: dir => children(dir).map(path => ({name: path.slice(dir.length + 1), isDirectory: tree.get(path) === 'dir',
      isFile: tree.get(path) !== 'dir', size: sizeOf(path)})),
    stat: path => tree.has(path) ? {size: sizeOf(path), modified: tree.get(path).modified ?? 0} : null,
    readFile: path => tree.get(path),
    writeFile(path, text) { tree.set(path, text); this.ops.push(`write ${path}`); },
    remove(path) {
      if (children(path).length) throw new Error(`rmdir ${path}: Directory not empty`);
      tree.delete(path);
    },
    diskUsage: () => ({total: 2 * free, free}),
    mkdir(path) { for (let at = path; at && !tree.has(at); at = at.slice(0, at.lastIndexOf('/'))) tree.set(at, 'dir'); },
    rename(from, to) {
      if (this.failRename === from) throw new Error(`rename ${from} failed`);
      this.ops.push(`rename ${to}`);
      for (const path of [...tree.keys()].filter(path => path === from || path.startsWith(`${from}/`))) {
        tree.set(to + path.slice(from.length), tree.get(path));
        tree.delete(path);
      }
    },
    modes: new Map(),
    // Metadata changes in order: what touched the image after its rename.
    ops: [],
    chmod(path, mode) { this.modes.set(path, mode); this.ops.push(`chmod ${path}`); },
    removeTree(path) { for (const key of [...tree.keys()]) if (key === path || key.startsWith(`${path}/`)) tree.delete(key); },
    async removeAsync(path) { await Promise.resolve(); this.removals.push(path); for (const key of [...tree.keys()]) if (key === path || key.startsWith(`${path}/`)) tree.delete(key); },
    removals: [],
  };
}

function fixture({release = RELEASE, now, content = {}, fs =memoryFs({'/data/homebrew/PPSA99058': 'dir', '/data/homebrew/PPSA99058/eboot.bin': 'old', '/data/homebrew/PPSA99058/sce_sys': 'dir', '/data/homebrew/PPSA99058/keep': 'old'})} = {}) {
  const requests = [];
  const http = {async request(url, options) { requests.push({url, options}); return {ok: true, json: async () => release}; }};
  const downloads = {enqueue(options) { requests.push(options); fs.tree.set(options.destination, 'zip'); return {subscribe: () => () => {}, done: Promise.resolve()}; }};
  // The ZIP holds the folder itself.
  const archives = {extract({destination}) {
    fs.mkdir(`${destination}/PPSA99058/sce_sys`);
    fs.tree.set(`${destination}/PPSA99058/eboot.bin`, 'new');
    for (const [path, file] of Object.entries(content)) fs.tree.set(`${destination}/PPSA99058/${path}`, file);
    fs.tree.set(`${destination}/.ps5-react-stage`, 'receipt');
    fs.tree.set(`${destination}/.ps5-react-extraction`, 'receipt');
    return {done: Promise.resolve({artifacts: []})};
  }};
  const updater = createUpdater({http, downloads, archives, fs, version: '0.0.86', feed: 'https://api.github.com/repos/o/r/releases/latest',
    asset: 'Overdrive-PPSA99058.zip', installDir: '/data/homebrew/PPSA99058', workDir: '/data/overdrive-update', now});
  return {updater, fs, requests};
}

test('versions compare part by part, with or without a v', () => {
  assert.equal(newer('v0.0.87', '0.0.86'), true);
  assert.equal(newer('0.1.0', '0.0.99'), true);
  assert.equal(newer('0.0.10', '0.0.9'), true);
  assert.equal(newer('0.0.86', '0.0.86'), false);
  assert.equal(newer('0.0.85', '0.0.86'), false);
});

// release.sh --promote publishes a candidate (v0.0.110-rc) as v0.0.110 because of these.
test('a suffixed tag is offered to no one, and a promoted candidate not to its testers', () => {
  assert.equal(newer('v0.0.110-rc', '0.0.109'), false);
  assert.equal(newer('v0.0.110', '0.0.109'), true);
  assert.equal(newer('v0.0.110', '0.0.110'), false);
  assert.equal(newer('v0.0.109.1', '0.0.109'), true);
});

test('a newer release offers its asset with the published SHA-256', async () => {
  const {updater, requests} = fixture();
  assert.deepEqual(await updater.check(), {version: '0.0.87', notes: 'notes', url: 'https://example.com/a.zip', size: 100, sha256: SHA});
  assert.equal(requests[0].options.headers['User-Agent'], 'Overdrive');
});

test('the same version, a missing asset or a missing digest is no update', async () => {
  assert.equal(await fixture({release: {...RELEASE, tag_name: 'v0.0.86'}}).updater.check(), null);
  assert.equal(await fixture({release: {...RELEASE, assets: []}}).updater.check(), null);
  assert.equal(await fixture({release: {...RELEASE, assets: [{...RELEASE.assets[0], digest: undefined}]}}).updater.check(), null);
});

test('installing verifies the download and swaps entries inside the kept install folder', async () => {
  const {updater, fs, requests} = fixture();
  assert.deepEqual(await updater.install(await updater.check()), {relaunch: true});
  const download = requests.find(request => request.destination);
  assert.equal(download.sha256, SHA);
  assert.equal(download.expectedBytes, 100);
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/eboot.bin'), 'new');
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/keep'), 'old');
  // Opened up for the console's launcher before they moved in.
  assert.equal(fs.modes.get('/data/overdrive-update/0.0.87/PPSA99058/eboot.bin'), 0o777);
  assert.equal(fs.modes.get('/data/overdrive-update/0.0.87/PPSA99058/sce_sys'), 0o777);
  assert.equal(fs.modes.get('/data/homebrew/PPSA99058'), 0o777);
  // The extraction's receipts stay out of the install.
  assert.deepEqual([...fs.tree.keys()].filter(path => path.startsWith('/data/homebrew/PPSA99058/')).sort(),
    ['/data/homebrew/PPSA99058/eboot.bin', '/data/homebrew/PPSA99058/keep', '/data/homebrew/PPSA99058/sce_sys']);
  // The replaced version, the ZIP and the emptied staging go while the dialog says it installs.
  assert.deepEqual(leftovers(fs), []);
});

// Records each call of `fs`'s `calls` and each frame let draw (a setTimeout) while `run` runs.
async function traced(fs, calls, run) {
  const events = [];
  for (const name of calls) {
    const call = fs[name];
    fs[name] = (...args) => { events.push(name); return call.apply(fs, args); };
  }
  const {setTimeout} = globalThis;
  globalThis.setTimeout = (callback, ms) => { events.push('frame'); return setTimeout(callback, ms); };
  try { await run(); } finally { globalThis.setTimeout = setTimeout; }
  return events;
}

// The most calls of `name` between two frames.
const mostPerFrame = (events, name) => Math.max(...events.join(' ').split('frame').map(run => run.split(' ').filter(event => event === name).length));

test('leftovers found at launch are removed off the render thread in one call', async () => {
  const files = {'/data/homebrew/PPSA99058': 'dir', '/data/overdrive-update': 'dir', '/data/overdrive-update/0.0.86.zip': 'zip'};
  // Shaped like the app: two folders of 2,075 files, and a few small ones.
  for (const [dir, count] of [['data/pages', 2075], ['data/releases', 2075], ['notices', 25], ['sce_sys', 10]]) {
    files[`/data/overdrive-update/previous/${dir}`] = 'dir';
    for (let file = 0; file < count; file++) files[`/data/overdrive-update/previous/${dir}/${file}`] = 'old';
  }
  const fs = memoryFs(files);
  fs.mkdir('/data/overdrive-update/previous/data');
  const {updater} = fixture({fs});
  const events = await traced(fs, ['remove', 'removeTree', 'readDir'], () => updater.cleanup());
  assert.deepEqual(events.filter(event => event !== 'frame'), []);
  assert.deepEqual(fs.removals, ['/data/overdrive-update']);
  assert.deepEqual(leftovers(fs), []);
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058'), 'dir');
});

test('an install opens and moves files a few at a time when the console\'s clock stands still', async () => {
  // Shaped like the app: a folder of many files, and many entries at the top.
  const content = {data: 'dir'};
  for (let file = 0; file < 200; file++) content[`data/${file}`] = 'new';
  for (let file = 0; file < 20; file++) content[`top${file}`] = 'new';
  const {updater, fs} = fixture({now: () => 0, content});
  fs.removeTree = path => { throw new Error(`removeTree ${path} blocks the screen`); };
  const update = await updater.check();
  const events = await traced(fs, ['chmod', 'rename'], async () => assert.deepEqual(await updater.install(update), {relaunch: true}));
  assert.ok(mostPerFrame(events, 'chmod') <= 8, `${mostPerFrame(events, 'chmod')} chmods in one frame`);
  // Each entry moves the old one out and the new one in.
  assert.ok(mostPerFrame(events, 'rename') <= 2 * 8, `${mostPerFrame(events, 'rename')} renames in one frame`);
  assert.equal(fs.modes.get('/data/overdrive-update/0.0.87/PPSA99058/data/199'), 0o777);
  assert.equal(fs.modes.get('/data/homebrew/PPSA99058'), 0o777);
  for (const path of ['data/199', 'top19', 'eboot.bin']) assert.equal(fs.tree.get(`/data/homebrew/PPSA99058/${path}`), 'new');
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/keep'), 'old');
  assert.deepEqual(leftovers(fs), []);
});

test('an install goes on when the work folder cannot be cleared first', async () => {
  const {updater, fs} = fixture();
  const removeAsync = fs.removeAsync;
  let refusals = 0;
  fs.removeAsync = async function (path) { if (refusals++ < 2) throw new Error(`fs.removeAsync ${path}: Device busy`); return removeAsync.call(this, path); };
  void updater.cleanup();
  assert.deepEqual(await updater.install(await updater.check()), {relaunch: true});
  assert.equal(refusals, 3);
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/eboot.bin'), 'new');
  assert.deepEqual(leftovers(fs), []);
});

test('an install waits for the launch\'s cleanup to finish', async () => {
  const {updater, fs} = fixture();
  fs.removeTree = path => { throw new Error(`removeTree ${path} blocks the screen`); };
  fs.mkdir('/data/overdrive-update/previous');
  for (let file = 0; file < 200; file++) fs.tree.set(`/data/overdrive-update/previous/${file}`, 'old');
  void updater.cleanup();
  assert.deepEqual(await updater.install(await updater.check()), {relaunch: true});
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/eboot.bin'), 'new');
  assert.deepEqual(leftovers(fs), []);
});

test('a failed move puts the old entries back', async () => {
  const {updater, fs} = fixture();
  const update = await updater.check();
  fs.failRename = '/data/overdrive-update/0.0.87/PPSA99058/eboot.bin';
  await assert.rejects(updater.install(update), /rename/);
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/eboot.bin'), 'old');
  assert.equal(fs.tree.get('/data/homebrew/PPSA99058/sce_sys'), 'dir');
  assert.equal(fs.tree.get('/data/overdrive-update/0.0.87/PPSA99058/eboot.bin'), 'new');
});

const IMAGE = '/data/homebrew/Overdrive-PPSA99058.exfat';
const MARKER = '/download0/overdrive/pending-image.json';
const MIB = 1024 ** 2;
const OLD_IMAGE = {size: 779 * MIB, modified: 1_000_000};
const NEW_IMAGE = {size: 780 * MIB, modified: 2_000_000};
const IMAGE_RELEASE = {tag_name: 'v0.0.87', body: 'notes', assets: [
  {name: 'Overdrive-PPSA99058.exfat.zip', size: 19 * MIB, digest: `sha256:${SHA}`, browser_download_url: 'https://example.com/a.exfat.zip'}]};

// An image install running `version`, whose release ZIP extracts to `entries` (names to contents).
function imageFixture({entries = {'Overdrive-PPSA99058.exfat': NEW_IMAGE}, free, failDownload = false, version = '0.0.86', files = {}} = {}) {
  const fs = memoryFs({'/data/homebrew': 'dir', [IMAGE]: OLD_IMAGE, ...files}, free);
  const requests = [], enqueued = [];
  const http = {async request(url) { requests.push(url); return {ok: true, json: async () => IMAGE_RELEASE}; }};
  const downloads = {enqueue(options) {
    enqueued.push(options.destination);
    fs.tree.set(options.destination, 'zip');
    return {subscribe: () => () => {}, done: failDownload ? Promise.reject(new Error('SHA-256 mismatch')) : Promise.resolve()};
  }};
  const archives = {extract({destination}) {
    fs.mkdir(destination);
    for (const [name, content] of Object.entries(entries)) {
      if (content === 'dir') fs.mkdir(`${destination}/${name}`);
      else fs.tree.set(`${destination}/${name}`, content);
    }
    fs.tree.set(`${destination}/.ps5-react-extraction`, 'receipt');
    return {done: Promise.resolve()};
  }};
  const updater = createUpdater({http, downloads, archives, fs, version, feed: 'https://api.github.com/repos/o/r/releases/latest',
    asset: 'Overdrive-PPSA99058.exfat.zip', image: IMAGE, workDir: '/data/overdrive-update', marker: MARKER});
  return {updater, fs, requests, enqueued, update: {version: '0.0.87', size: 19 * MIB, sha256: SHA, url: 'https://example.com/a.exfat.zip'}};
}

const marker = (fields = {}) => ({[MARKER]: JSON.stringify({version: '0.0.87', image: IMAGE, ...NEW_IMAGE, ...fields})});
const OFFER = {version: '0.0.87', notes: 'notes', url: 'https://example.com/a.exfat.zip', size: 19 * MIB, sha256: SHA};

const leftovers = fs => [...fs.tree.keys()].filter(path => path.startsWith('/data/overdrive-update'));

test('an image install gets the extracted image renamed over it, leaves nothing behind and is reopened by hand', async () => {
  const {updater, fs, update} = imageFixture();
  assert.deepEqual(await updater.install(update), {relaunch: false});
  assert.equal(fs.tree.get(IMAGE), NEW_IMAGE);
  assert.deepEqual([...fs.tree.keys()].filter(path => path.startsWith('/data/homebrew/')), [IMAGE]);
  assert.deepEqual(leftovers(fs), []);
});

test('an image install opens the image and records it before the rename, and nothing touches it after', async () => {
  const {updater, fs, update} = imageFixture();
  await updater.install(update);
  // ShadowMount's 10 s wait restarts at any metadata change, and the user is told to wait from the rename.
  assert.deepEqual(fs.ops, ['chmod /data/overdrive-update/0.0.87/Overdrive-PPSA99058.exfat', `write ${MARKER}`, `rename ${IMAGE}`]);
  assert.deepEqual(JSON.parse(fs.tree.get(MARKER)), {version: '0.0.87', image: IMAGE, ...NEW_IMAGE});
});

test('an image install that cannot write its marker still updates', async () => {
  const {updater, fs, update} = imageFixture();
  fs.writeFile = () => { throw new Error('ENOSPC'); };
  assert.deepEqual(await updater.install(update), {relaunch: false});
  assert.equal(fs.tree.get(IMAGE), NEW_IMAGE);
});

test('the old version reopened over the installed image asks to be reopened instead of updating again', async () => {
  const {updater, fs, requests} = imageFixture({files: {[IMAGE]: NEW_IMAGE, ...marker()}});
  assert.deepEqual(await updater.check(), {version: '0.0.87', installed: true, stuck: false});
  assert.deepEqual(requests, []);
  assert.equal(JSON.parse(fs.tree.get(MARKER)).launches, 1);
});

test('the old version still running on a later launch asks for a console restart too', async () => {
  // Each launch is a new updater over the files the last one left.
  const first = imageFixture({files: {[IMAGE]: NEW_IMAGE, ...marker()}});
  assert.equal((await first.updater.check()).stuck, false);
  const second = imageFixture({files: Object.fromEntries(first.fs.tree)});
  assert.deepEqual(await second.updater.check(), {version: '0.0.87', installed: true, stuck: true});
  const third = imageFixture({files: Object.fromEntries(second.fs.tree)});
  assert.equal((await third.updater.check()).stuck, true);
  assert.equal(JSON.parse(third.fs.tree.get(MARKER)).launches, 3);
});

test('a marker that cannot be counted still asks to reopen', async () => {
  const {updater, fs} = imageFixture({files: {[IMAGE]: NEW_IMAGE, ...marker()}});
  fs.writeFile = () => { throw new Error('ENOSPC'); };
  assert.deepEqual(await updater.check(), {version: '0.0.87', installed: true, stuck: false});
});

test('the installed image matches its marker within exFAT time steps', async () => {
  const {updater} = imageFixture({files: {[IMAGE]: {...NEW_IMAGE, modified: NEW_IMAGE.modified + 1990}, ...marker()}});
  assert.equal((await updater.check()).installed, true);
});

test('the new version running clears the marker', async () => {
  const {updater, fs} = imageFixture({version: '0.0.87', files: {[IMAGE]: NEW_IMAGE, ...marker()}});
  assert.equal(await updater.check(), null);
  assert.equal(fs.tree.has(MARKER), false);
});

test('a marker whose image was replaced since, or never was, is cleared and the update offered', async () => {
  for (const image of [OLD_IMAGE, {...NEW_IMAGE, modified: NEW_IMAGE.modified + 5000}, {...NEW_IMAGE, size: 781 * MIB}]) {
    const {updater, fs} = imageFixture({files: {[IMAGE]: image, ...marker()}});
    assert.deepEqual(await updater.check(), OFFER);
    assert.equal(fs.tree.has(MARKER), false);
  }
  const {updater, fs} = imageFixture({files: marker({image: '/data/homebrew/gone.exfat'})});
  assert.deepEqual(await updater.check(), OFFER);
  assert.equal(fs.tree.has(MARKER), false);
});

test('a missing or unreadable marker never stops the check', async () => {
  assert.deepEqual(await imageFixture().updater.check(), OFFER);
  for (const content of ['{', 'null', '']) {
    const {updater, fs} = imageFixture({files: {[MARKER]: content}});
    assert.deepEqual(await updater.check(), OFFER);
    assert.equal(fs.tree.has(MARKER), false);
  }
  const {updater, fs} = imageFixture({files: {[MARKER]: '{'}});
  fs.remove = () => { throw new Error('EROFS'); };
  assert.deepEqual(await updater.check(), OFFER);
});

test('an image in place is an update done, whatever its chmod or the cleanup answer', async () => {
  const {updater, fs, update} = imageFixture();
  fs.chmod = () => { throw new Error('EPERM'); };
  const removeAsync = fs.removeAsync;
  fs.removeAsync = async function (path) { if (fs.tree.get(IMAGE) === NEW_IMAGE) throw new Error('EBUSY'); return removeAsync.call(this, path); };
  assert.deepEqual(await updater.install(update), {relaunch: false});
  assert.equal(fs.tree.get(IMAGE), NEW_IMAGE);
});

test('a failed cleanup does not hide why the update failed', async () => {
  const {updater, fs, update} = imageFixture({failDownload: true});
  const removeAsync = fs.removeAsync;
  fs.removeAsync = async function (path) { if (fs.tree.has('/data/overdrive-update/0.0.87.zip')) throw new Error('EBUSY'); return removeAsync.call(this, path); };
  await assert.rejects(updater.install(update), /SHA-256/);
  assert.equal(fs.tree.get(IMAGE), OLD_IMAGE);
});

test('an image install keeps its image when the update is not one exFAT image', async () => {
  for (const entries of [{}, {'PPSA99058': 'dir'}, {'Overdrive.zip': NEW_IMAGE}, {'Overdrive-PPSA99058.exfat': 'tiny'},
    {'Overdrive-PPSA99058.exfat': {size: 780 * MIB + 3}}, {'a.exfat': NEW_IMAGE, 'b.exfat': NEW_IMAGE}]) {
    const {updater, fs, update} = imageFixture({entries});
    await assert.rejects(updater.install(update), /exFAT image/);
    assert.equal(fs.tree.get(IMAGE), OLD_IMAGE);
    assert.deepEqual(leftovers(fs), []);
  }
});

test('an image install needs room for the ZIP and a whole image before downloading', async () => {
  const {updater, fs, update} = imageFixture({free: 920 * MIB});
  await assert.rejects(updater.install(update), /free next to/);
  assert.equal(fs.tree.get(IMAGE), OLD_IMAGE);
  assert.deepEqual(leftovers(fs), []);
});

test('a failed download leaves the image and no work folder', async () => {
  const {updater, fs, update} = imageFixture({failDownload: true});
  await assert.rejects(updater.install(update), /SHA-256/);
  assert.equal(fs.tree.get(IMAGE), OLD_IMAGE);
  assert.deepEqual(leftovers(fs), []);
});

test('a refused rename over the mounted image leaves it whole and asks for a copy by hand', async () => {
  for (const errno of ['Device busy', 'Operation not permitted', 'Cross-device link']) {
    const {updater, fs, update} = imageFixture();
    fs.rename = from => { throw new Error(`fs.rename ${from} -> ${IMAGE}: ${errno}`); };
    await assert.rejects(updater.install(update), error => error instanceof ImageReplaceError && error.message.includes(errno));
    assert.equal(fs.tree.get(IMAGE), OLD_IMAGE);
    assert.deepEqual(leftovers(fs), []);
    // The marker written before it no longer matches: the next launch offers the update again.
    assert.deepEqual(await updater.check(), OFFER);
    assert.equal(fs.tree.has(MARKER), false);
  }
});

test('other failures are not taken for a refused rename', async () => {
  const {updater, update} = imageFixture({failDownload: true});
  await assert.rejects(updater.install(update), error => !(error instanceof ImageReplaceError));
});

test('a failed update is downloaded once, and a check after it only offers it again', async () => {
  const {updater, enqueued, update} = imageFixture({failDownload: true});
  await assert.rejects(updater.install(update), /SHA-256/);
  assert.deepEqual(await updater.check(), OFFER);
  assert.deepEqual(enqueued, ['/data/overdrive-update/0.0.87.zip']);
});

test('installed files and root are accessible without following retained directory links', async () => {
  const root = nodeFs.mkdtempSync(join(tmpdir(), 'overdrive-update-'));
  try {
    const installDir = join(root, 'app'), outside = join(root, 'outside');
    nodeFs.mkdirSync(installDir, {mode: 0o700});
    nodeFs.mkdirSync(outside);
    const sentinel = join(outside, 'unrelated');
    nodeFs.writeFileSync(sentinel, 'keep private', {mode: 0o600});
    nodeFs.symlinkSync(outside, join(installDir, 'linked-folder'));
    const fs = {
      exists: nodeFs.existsSync, chmod: nodeFs.chmodSync, mkdir: nodeFs.mkdirSync, rename: nodeFs.renameSync,
      removeTree: path => nodeFs.rmSync(path, {recursive: true, force: true}),
      removeAsync: path => nodeFs.promises.rm(path, {recursive: true, force: true}),
      // Match the native listing, which follows links when determining entry types.
      readDir: path => nodeFs.readdirSync(path).map(name => ({name, isDirectory: nodeFs.statSync(join(path, name)).isDirectory()})),
    };
    const archives = {extract({destination}) {
      nodeFs.mkdirSync(join(destination, 'sce_module'), {recursive: true, mode: 0o700});
      nodeFs.writeFileSync(join(destination, 'eboot.bin'), 'new', {mode: 0o600});
      nodeFs.writeFileSync(join(destination, 'sce_module/libc.prx'), 'module', {mode: 0o600});
      return {done: Promise.resolve()};
    }};
    const downloads = {enqueue: () => ({subscribe: () => () => {}, done: Promise.resolve()})};
    const updater = createUpdater({fs, archives, downloads, installDir, workDir: join(root, 'work')});
    await updater.install({version: 'review', size: 0});
    for (const path of [installDir, join(installDir, 'eboot.bin'), join(installDir, 'sce_module'), join(installDir, 'sce_module/libc.prx')])
      assert.equal(nodeFs.statSync(path).mode & 0o777, 0o777, path);
    assert.equal(nodeFs.statSync(sentinel).mode & 0o777, 0o600);
  } finally {
    nodeFs.rmSync(root, {recursive: true, force: true});
  }
});
