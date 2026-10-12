// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {DownloadFormats} from '@ps5-react/core';
import {t} from '../i18n/core.js';
import {formatBytes} from '../state/catalog.js';
import {driveName} from '../state/downloads.js';
import {MARGIN, stillNeeded} from '../state/space.js';

export {preferredRelease} from './sources.js';

/**
 * Bytes `release` takes on `root` as the queue reserves them: twice its size when it is an archive
 * extracted next to itself. 0 when its size is unknown.
 */
export function spaceNeeded(release, root) {
  if (!release?.sizeBytes) return 0;
  let artifact;
  // A release the queue cannot route fails when it is queued, with its own message.
  try { artifact = release.parts ? undefined : DownloadFormats.artifact(release, root); } catch { artifact = undefined; }
  return stillNeeded({release, artifact, total: release.sizeBytes, written: 0});
}

/** Whether the hero's main action can start a download, so focus starts there. */
export const canDownload = game => game.hasDownloads ?? (game.releases || []).some(release => release.url || release.manifestUrl || release.browserUrl);

/** What to do when the release does not fit on the chosen drive: another drive, or how much to free. */
export function spaceAdvice(roots, free, storage, need) {
  const other = roots.findIndex((root, i) => i !== storage && free[i] >= need + MARGIN);
  if (other >= 0) return t('download.space.otherDrive', {drive: driveName(roots[other]), size: formatBytes(free[other])});
  return t('download.space.free', {size: formatBytes(need + MARGIN - free[storage]), drive: driveName(roots[storage])});
}
