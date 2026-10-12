// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {subscribe} from './useQueue.js';
import {createThroughput} from './rates.js';

export const SAMPLES = 60;
const EMPTY = {network: [], disk: []};

/** One sample a second of a job's network and disk speed (bytes/s), the last minute of them. */
export function useThroughput(id) {
  const [history, setHistory] = useState(EMPTY);
  useEffect(() => {
    const measure = createThroughput();
    return subscribe(jobs => {
      const job = jobs.find(item => item.id === id);
      const sample = job && measure(job, Date.now());
      if (!sample) return;
      setHistory(previous => ({network: [...previous.network, sample.network].slice(-SAMPLES),
        disk: [...previous.disk, sample.disk].slice(-SAMPLES)}));
    });
  }, [id]);
  return history;
}
