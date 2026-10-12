// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {formatBytes} from './size.js';

// The queue refuses a download that would leave less than this free.
export const MARGIN = 16 * 1024 ** 2;

/** Whether a job's download is an archive that is then extracted next to it, needing its size twice. */
export const extracts = job => Boolean(job.release?.parts) || job.artifact?.nextAction === 'extraction-required';

/**
 * Bytes a queued or running job still needs on its drive, extraction included. While a job extracts or
 * installs, its figures count that step, not the download: an extraction's archive is already on the
 * drive, so only the rest of its output is still needed, and an install's package is already written and
 * the console's installer checks its own room.
 */
export function stillNeeded(job) {
  if (job.state === 'installing') return 0;
  const factor = extracts(job) && job.state !== 'extracting' ? 2 : 1;
  // A set learns its total as each volume starts; until then the catalog's size stands in.
  return Math.max(0, (job.total ?? job.release?.sizeBytes ?? 0) * factor - job.written);
}

// The largest few, so the message stays short enough to read on the page.
const SHOWN = 3;

/**
 * Why `need` bytes do not fit on `root`, or '' when they do. The `pending` downloads saving to the
 * same root have not written all their bytes yet, so what they still need is not free; the message
 * names them, since removing one is how the space comes back.
 */
export function spaceShortfall(root, need, free, pending) {
  const holders = pending.map(job => ({title: job.title, bytes: stillNeeded(job)})).filter(job => job.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  const reserved = holders.reduce((sum, job) => sum + job.bytes, 0);
  const left = Math.max(0, free - reserved);
  if (left >= need + MARGIN) return '';
  const message = `Not enough space on ${root}: needs ${formatBytes(need)}, ${formatBytes(left)} free`;
  if (!reserved) return message;
  const named = holders.slice(0, SHOWN).map(job => `${job.title} (${formatBytes(job.bytes)})`);
  if (holders.length > SHOWN) named.push(`+${holders.length - SHOWN}`);
  return `${message} after queued downloads: ${named.join(', ')}`;
}
