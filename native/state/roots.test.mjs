// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {consoleRoots} from './roots.js';

test('lists the internal drive, then USB and extended drives once each', () => {
  const mounts = () => [{path: '/'}, {path: '/mnt/usb0'}, {path: '/mnt/ext1'}, {path: '/mnt/usb0'}, {path: '/mnt/sandbox/x'}];
  assert.deepEqual(consoleRoots(mounts), ['/data', '/mnt/usb0', '/mnt/ext1']);
});

test('a console that refuses the mount list (no console access) still has the internal drive', () => {
  const mounts = () => { throw new Error('fs.mounts: Operation not permitted'); };
  assert.deepEqual(consoleRoots(mounts), ['/data']);
});
