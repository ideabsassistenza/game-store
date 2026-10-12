// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {t} from '../i18n/core.js';
import {COMPLETE} from '../state/download-queue.js';
import {explainError} from './errors.js';

/** The jobs that completed or failed between two queue snapshots, as in-app alerts. */
export function alertsBetween(previous, jobs) {
  const before = new Map(previous.map(job => [job.id, job.state]));
  const alerts = [];
  for (const job of jobs) {
    const was = before.get(job.id);
    if (was === undefined || was === job.state) continue;
    if (COMPLETE.includes(job.state) && !COMPLETE.includes(was)) {
      alerts.push({kind: 'complete', title: job.title, gameId: job.gameId, message: t('downloads.notice.complete')});
    } else if (job.state === 'failed') {
      alerts.push({kind: 'failed', title: job.title, gameId: job.gameId, message: explainError(job.error, Boolean(job.release.parts)).title});
    }
  }
  return alerts;
}
