// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import test from 'node:test';

// `downloadQueue()` builds the queue on first use and throws when it cannot: called while rendering or
// from an effect without a try, that error closes the app at launch. Every call needs a `try` on its
// line or the three before it, or must be an action handler listed here, which only runs once the
// person acts on a job the loaded queue already shows.
const HANDLERS = [
  'native/game/DownloadButton.jsx: submit: url => downloadQueue().continueWithURL(job.id, url)',
  "native/game/DownloadButton.jsx: ['awaiting-browser', 'failed', 'paused'].includes(job.state)) downloadQueue().remove(job.id);",
  "native/game/useDownload.js: const deleteFromDisk = () => { setError(''); void downloadQueue().deleteFromDisk(job.id)",
  'native/downloads/BrowserCaptureDialog.jsx: const close = () => downloadQueue().cancelBrowserCapture(job.id);',
  'native/downloads/BrowserCaptureDialog.jsx: submit={url => downloadQueue().continueWithURL(job.id, url)}',
  'native/downloads/BrowserCaptureDialog.jsx: downloadQueue().cancelBrowserCapture(job.id, {manual: true});',
];

const root = new URL('../..', import.meta.url).pathname;
function sources(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ['scripts', 'data', 'node_modules'].includes(entry.name) ? [] : sources(path);
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

test('every downloadQueue() call outside an action handler sits in a try', () => {
  const unguarded = [];
  for (const path of sources(join(root, 'native'))) {
    const file = relative(root, path);
    if (file === 'native/state/downloads.js') continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('downloadQueue()')) return;
      if (lines.slice(Math.max(0, index - 3), index + 1).some(near => /\btry\s*\{/.test(near))) return;
      if (HANDLERS.some(entry => { const [where, snippet] = entry.split(/: (.*)/s); return where === file && line.includes(snippet); })) return;
      unguarded.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(unguarded, []);
});
