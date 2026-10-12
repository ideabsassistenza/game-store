// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {t} from '../i18n/core.js';

// Native and queue errors are written for logs (curl, file and hash failures) and stay in English, so
// the queue can match them; a row says what happened and what to do next, in the app's language.
// Order matters: the first match wins. Each case names its title and action messages.
export const STALE_PARTIAL = /partial file|checkpoint/i;

// A native task's error leads with its call and file: 'Downloads.enqueue /data/homebrew/PPSA03845 Dead
// Space.ffpfsc: range probe failed (HTTP 0, Couldn't resolve host name)'. Only what follows is the cause;
// matched whole, the game's name was read as one, and Dead Space's lost connection as a full drive.
const TASK = /^\w+\.\w+ \/.*?: /;

/** A job's error without the native call and file that lead it. */
export const cause = message => message.replace(TASK, '');

// rar-extract names the volume of a set that was cut short; the queue deletes it so Retry downloads it again.
export const INCOMPLETE_PART = /Volume (\d+) of \d+ looks incomplete/;

const SHORTFALL = /^Not enough space on (\S+): needs (.+?), (.+?) free(?:( after queued downloads)(?:: (.+))?)?$/;

const CASES = [
  // Before STALE_PARTIAL: a full disk fails "write partial file".
  [/no space left|ENOSPC/i, 'noSpace', 'freeThenResume'],
  [/partial files were deleted/i, 'partialDeleted', 'restart'],
  [STALE_PARTIAL, 'staleProgress', 'restart'],
  [/file changed since this partial/i, 'fileChanged', 'restart'],
  [/needs more memory to extract/i, 'archiveTooLarge', 'otherSource'],
  // The engine's heap had no room for the extraction; a fresh launch frees it.
  [/not enough memory to extract/i, 'noMemory', 'reopenApp'],
  [/archive password/i, 'archivePassword', 'otherSource'],
  // A set's last volume ends where the archive goes on, or its first is not where it starts: the source lists
  // too few volumes, and downloading them again fails the same way. A lone archive the worker cannot open
  // fails with the same words; that one is downloaded again.
  [/^(?:Incomplete RAR archive or missing volume|Missing first RAR volume)\.$/, 'missingParts', 'otherSource', 'set'],
  [/missing volume|damaged RAR|cannot read the RAR/i, 'damaged', 'restartFromZero'],
  [/browser verification/i, 'needsBrowser', 'openSource'],
  [/interrupted/i, 'interrupted', 'resume'],
  [/space/i, 'noSpace', 'freeThenRetry'],
  [/storage (disconnected|changed|identity)|reconnect|original storage root/i, 'driveDisconnected', 'reconnect'],
  [/HTTP (404|410|403|401)\b/, 'linkGone', 'otherSource'],
  [/HTTP (429|5\d\d)\b/, 'serverBusy', 'retryLater'],
  [/resolve|connect|timeout|timed out|unreachable|receiving data|SSL|network/i, 'noConnection', 'checkConnection'],
  [/SHA|hash|verification|mismatch|changed the resource|truncated/i, 'damaged', 'restartFromZero'],
];

// Written for the person and already saying what to do: ShadowMount's own errors, and a partial
// file the job took over that belongs to another source.
const PLAIN = /ShadowMount|from another source holds this name/;

/** `{title, action}` for a job's error message, keeping an unknown cause as it is; `set` for a job of volumes. */
export function explainError(error, set = false) {
  const message = cause(error);
  if (PLAIN.test(message)) return {title: message, action: ''};
  const part = INCOMPLETE_PART.exec(message);
  if (part) return {title: t('errors.partIncomplete', {part: part[1]}), action: t('errors.action.retryPart')};
  const shortfall = SHORTFALL.exec(message);
  if (shortfall) {
    const [, root, need, free, queued, holders] = shortfall;
    // The downloads holding the space are titles and sizes, the same in every language. They go on
    // the action's line, which has room for them; the title's is clamped.
    const action = t('errors.action.freeOrOtherDrive');
    return {title: t('errors.noSpaceOn', {root, need, free, queued: queued ? 'yes' : 'no'}),
      action: holders ? `${action} ${holders}` : action};
  }
  const known = CASES.find(([pattern, , , only]) => (!only || set) && pattern.test(message));
  if (!known) return {title: message, action: t('errors.action.retryOrOtherSource')};
  return {title: t(`errors.${known[1]}`), action: t(`errors.action.${known[2]}`)};
}
