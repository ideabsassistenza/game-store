// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {BrowserCapture, Archives, DownloadFormats, Downloads, FileSystem, Http, Linking, Notifications, Packages, Platform, Power} from '@ps5-react/core';
import {t} from '../i18n/core.js';
import {createSourceResolver} from './download-sources.js';
import {createDownloadQueue} from './download-queue.js';
import {createMockDownloadQueue} from './mock-download-queue.js';
import {createShadowMountProbe} from './shadowmount.js';
import {getGame} from './catalog.js';
import {consoleRoots} from './roots.js';

let instance;
const mocked = () => Platform.OS !== 'ps5' && FileSystem.exists(`${FileSystem.dataDir}/overdrive/mock-downloads`);
// On the console the queue lives on /data beside the downloads, where a reinstall leaves it; the old
// overdrive/ folder there held an engine data root's files, so it gets a folder of its own.
const stateDir = Platform.OS === 'ps5' ? '/data/ps5-react/PPSA99058/queue' : undefined;
export const downloadQueue = () => instance ??= mocked() ? createMockDownloadQueue() : createDownloadQueue({fs: FileSystem,
  archives: Archives, downloads: Downloads, http: Http, formats: DownloadFormats, dataDir: FileSystem.dataDir, stateDir, platform: Platform.OS,
  notifications: Notifications, power: Power, linking: Linking, sources: createSourceResolver({http: Http}), packages: Packages, browserCapture: BrowserCapture,
  releasesOf: id => getGame(id)?.releases || []});

// Only the PS5 runs ShadowMountPlus, so elsewhere there is nothing to warn about.
export const shadowMountUp = Platform.OS === 'ps5'
  ? createShadowMountProbe({http: Http, now: Date.now}) : async () => true;

/** Free bytes on a storage root, or null when it cannot be read (a disconnected drive). */
export function freeBytes(root) {
  try { return FileSystem.diskUsage(root).free; } catch { return null; }
}

/** A storage root as people name it: the console's paths ('/mnt/usb0') mean nothing on screen. */
export function driveName(root) {
  if (root === '/data') return t('drives.internal');
  const mount = /^\/mnt\/(usb|ext)(\d+)$/.exec(root);
  if (!mount) return t('drives.thisDevice');
  return t(mount[1] === 'usb' ? 'drives.usb' : 'drives.extended', {number: String(Number(mount[2]) + 1)});
}

export function storageRoots() {
  if (Platform.OS !== 'ps5') return [FileSystem.dataDir];
  return consoleRoots(() => FileSystem.mounts());
}
