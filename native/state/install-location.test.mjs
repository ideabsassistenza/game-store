// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {locateInstall} from './install-location.js';

const TITLE = 'PPSA99058';
// Paths that exist; a directory exists when a path below it does.
const fsWith = (...files) => ({
  exists: path => files.some(file => file === path || file.startsWith(`${path}/`)),
  readDir: dir => [...new Set(files.filter(file => file.startsWith(`${dir}/`)).map(file => file.slice(dir.length + 1).split('/')[0]))]
    .map(name => ({name, isDirectory: files.some(file => file.startsWith(`${dir}/${name}/`))})),
});
const answering = info => ({request: async () => ({ok: true, json: async () => info})});
const down = {request: async () => { throw new Error('connection refused'); }};
const roots = () => ['/data', '/mnt/usb0'];

test('uses the folder ShadowMount registered, wherever it is', async () => {
  const fs = fsWith('/mnt/usb0/games/Overdrive/eboot.bin');
  const http = answering({path: '/mnt/usb0/games/Overdrive', source_type: 'folder'});
  assert.deepEqual(await locateInstall({http, fs, roots, title: TITLE}),
    {installDir: '/mnt/usb0/games/Overdrive', workDir: '/mnt/usb0/overdrive-update'});
});

test('falls back to homebrew/ when ShadowMount does not answer', async () => {
  const fs = fsWith(`/data/homebrew/${TITLE}/eboot.bin`);
  assert.deepEqual(await locateInstall({http: down, fs, roots, title: TITLE}),
    {installDir: `/data/homebrew/${TITLE}`, workDir: '/data/overdrive-update'});
});

test('uses the image ShadowMount registered, with a work folder on its drive', async () => {
  const fs = fsWith(`/data/homebrew/Overdrive-${TITLE}.exfat`);
  const http = answering({path: `/data/homebrew/Overdrive-${TITLE}.exfat`, source_type: 'image'});
  assert.deepEqual(await locateInstall({http, fs, roots, title: TITLE}),
    {image: `/data/homebrew/Overdrive-${TITLE}.exfat`, workDir: '/data/overdrive-update'});
});

test('falls back to an image in homebrew/ when ShadowMount does not answer', async () => {
  const fs = fsWith(`/mnt/usb0/homebrew/Overdrive-${TITLE}.exfat`);
  assert.deepEqual(await locateInstall({http: down, fs, roots, title: TITLE}),
    {image: `/mnt/usb0/homebrew/Overdrive-${TITLE}.exfat`, workDir: '/mnt/usb0/overdrive-update'});
});

test('refuses an install type it cannot update', async () => {
  for (const [path, type] of [[`/user/app/${TITLE}/app.pkg`, 'pkg'], [`/data/homebrew/${TITLE}.ffpkg`, 'image'], ['/data/homebrew/x', undefined]]) {
    const fs = fsWith(path, `${path}/eboot.bin`, `/data/homebrew/${TITLE}/eboot.bin`);
    await assert.rejects(locateInstall({http: answering({path, source_type: type}), fs, roots, title: TITLE}), /install of type/);
  }
});

test('refuses an image ShadowMount registered that is gone', async () => {
  const http = answering({path: `/data/homebrew/Overdrive-${TITLE}.exfat`, source_type: 'image'});
  await assert.rejects(locateInstall({http, fs: fsWith(), roots, title: TITLE}), /missing/);
});

test('names both copies when homebrew/ holds two', async () => {
  const fs = fsWith(`/data/homebrew/${TITLE}/eboot.bin`, `/mnt/usb0/homebrew/${TITLE}/eboot.bin`);
  await assert.rejects(locateInstall({http: down, fs, roots, title: TITLE}), /\/data\/homebrew\/PPSA99058 and \/mnt\/usb0\/homebrew\/PPSA99058/);
});

test('names both copies when a folder and an image sit in homebrew/', async () => {
  const fs = fsWith(`/data/homebrew/${TITLE}/eboot.bin`, `/data/homebrew/Overdrive-${TITLE}.exfat`);
  await assert.rejects(locateInstall({http: down, fs, roots, title: TITLE}), /PPSA99058 and \/data\/homebrew\/Overdrive-PPSA99058.exfat/);
});

test('falls back to an image named after its version, or in any case', async () => {
  const fs = fsWith(`/data/homebrew/Overdrive-${TITLE}-v0.0.104.exfat`, '/data/homebrew/Other.exfat', `/data/homebrew/${TITLE}.ffpkg`);
  assert.deepEqual(await locateInstall({http: down, fs, roots, title: TITLE}),
    {image: `/data/homebrew/Overdrive-${TITLE}-v0.0.104.exfat`, workDir: '/data/overdrive-update'});
  const upper = fsWith(`/data/homebrew/OVERDRIVE-${TITLE}.EXFAT`);
  assert.equal((await locateInstall({http: down, fs: upper, roots, title: TITLE})).image, `/data/homebrew/OVERDRIVE-${TITLE}.EXFAT`);
});

test('names both images when homebrew/ holds two', async () => {
  const fs = fsWith(`/data/homebrew/Overdrive-${TITLE}.exfat`, `/data/homebrew/Overdrive-${TITLE}-v0.0.104.exfat`);
  await assert.rejects(locateInstall({http: down, fs, roots, title: TITLE}), /installed twice/);
});
