// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {downloadQueue} from '../state/downloads.js';
import {createActivity} from './rates.js';

/** Listens to the queue; a queue that failed to load leaves the listener idle (useJobs says why). */
export function subscribe(listener) {
  try { return downloadQueue().subscribe(listener); } catch { return undefined; }
}

/** What a row shows besides its progress; the list only re-renders when one of these changes. */
export const shapeOf = job => `${job.id}|${job.state}|${job.phase || ''}|${job.error}|${job.message || ''}|${job.total}`;

/** How much of a job (or `useProgress` value) is written, from 0 to 1; 0 while its size is unknown. */
export const fractionOf = progress => (progress?.total ? Math.min(1, progress.written / progress.total) : 0);

// Subscribers compare before they set state, never inside the updater: React keeps each update it
// eagerly bails out of on the hook until the component next renders, so an updater that returns the
// last state on every progress tick (four a second) piled up updates, and the job lists they held,
// until the JS heap ran out during a long download.

/** The queue's jobs, refreshed on state changes but not on progress ticks. */
export function useJobs() {
  const [state, setState] = useState({jobs: [], shape: '', error: ''});
  useEffect(() => {
    let last = '';
    try {
      return downloadQueue().subscribe(jobs => {
        const shape = jobs.map(shapeOf).join('\n');
        if (shape === last) return;
        last = shape;
        setState({jobs, shape, error: ''});
      });
    } catch (failure) {
      setState({jobs: [], shape: '', error: failure.message});
      return undefined;
    }
  }, []);
  return state;
}

/** One job's byte counts, so a tick re-renders only that row's progress. */
export function useProgress(id) {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    let last = null;
    return subscribe(jobs => {
      const job = jobs.find(item => item.id === id);
      if (!job || (last && last.written === job.written && last.total === job.total
        && last.bytesPerSecond === (job.bytesPerSecond || 0))) return;
      last = {written: job.written, total: job.total, bytesPerSecond: job.bytesPerSecond || 0};
      setProgress(last);
    });
  }, [id]);
  return progress;
}

/**
 * Combined speed, bytes left and connections of the downloads in flight, with the highest, lowest and
 * mean speed since downloading last started; re-renders only when they change.
 */
export function useActivity() {
  const [activity, setActivity] = useState({speed: 0, left: 0, active: 0, connections: 0, peak: 0, low: 0, mean: 0});
  useEffect(() => {
    const measure = createActivity();
    let shown = null;
    return subscribe(jobs => {
      const next = measure(jobs, Date.now());
      if (shown && Object.keys(next).every(key => shown[key] === next[key])) return;
      shown = next;
      setActivity(next);
    });
  }, []);
  return activity;
}
