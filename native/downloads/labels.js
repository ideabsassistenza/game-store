// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {t} from '../i18n/core.js';
import {COMPLETE} from '../state/download-queue.js';

const LABELED = new Set(['awaiting-browser', 'queued', 'resolving', 'connecting', 'downloading', 'verifying', 'pausing',
  'extracting', 'finishing', 'extracted', 'paused', 'failed', 'file-downloaded', 'downloaded', 'installer-required', 'installing', 'installed', 'extraction-required',
  'removing']);

/** States that wait on something with no progress to show: their label shimmers instead. */
export const WAITING = ['resolving', 'connecting', 'verifying', 'pausing', 'finishing', 'removing'];

/** The state a job reads as: an extraction writing its last files to disk is 'finishing'. */
export const shownState = job => (job.state === 'extracting' && job.phase === 'finishing' ? 'finishing' : job.state);

/** Whether a download job state has its own label. */
export const hasStateLabel = state => LABELED.has(state);

/** What a download job state reads as, wherever a download shows its state: "Paused". */
export const stateLabel = state => t(`downloadState.${state}`);

/** What a row's X does: a finished download leaves the list keeping its files; any other is cancelled, its partial discarded. */
export const clearAction = state => (COMPLETE.includes(state) ? 'remove' : 'cancel');
