// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef} from 'react';
import {downloadQueue} from '../state/downloads.js';
import {alertsBetween} from './alerts.js';

/**
 * Calls `onAlert` when a download completes or fails, from any screen. The system notification
 * does not reach the user on every firmware, so the app's own toast is the reliable notice.
 */
export function useDownloadAlerts(onAlert) {
  const current = useRef(onAlert);
  current.current = onAlert;
  useEffect(() => {
    let previous = null;
    // Mounted on launch, like the badge: a queue that cannot load must not take the app down.
    try {
      return downloadQueue().subscribe(jobs => {
        if (previous) for (const alert of alertsBetween(previous, jobs)) current.current(alert);
        previous = jobs;
      });
    } catch { return undefined; }
  }, []);
}
