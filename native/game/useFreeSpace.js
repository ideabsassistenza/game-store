// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';
import {freeBytes} from '../state/downloads.js';

const EVERY_MS = 3000;

/**
 * Free bytes on each of `roots`, read again whenever `status` changes and, while `watching`, every
 * few seconds. A page left open does not re-render when space is freed elsewhere: games deleted in
 * the console's storage settings while the app is suspended, or another download deleting its
 * archive after extracting. Read once, a drive kept saying it was full until the app restarted.
 */
export function useFreeSpace(roots, status, watching) {
  const [free, setFree] = useState(() => roots.map(freeBytes));
  // The first render just read them.
  const mounted = useRef(false);
  useEffect(() => {
    const read = () => setFree(previous => {
      const next = roots.map(freeBytes);
      return next.every((value, i) => value === previous[i]) ? previous : next;
    });
    if (!mounted.current) mounted.current = true;
    else read();
    if (!watching) return undefined;
    const id = setInterval(read, EVERY_MS);
    return () => clearInterval(id);
  }, [status, watching]);
  return free;
}
