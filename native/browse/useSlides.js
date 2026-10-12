// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';

export const SLIDE_MS = 7000;

/**
 * Auto-advancing carousel index while `enabled`. `hold(true)` pauses it and keeps the time left, so
 * the progress bar freezes where it is; `left` is the time remaining from the last (re)start.
 */
export function useSlides(count, enabled) {
  const [active, setActive] = useState(0);
  const [left, setLeft] = useState(SLIDE_MS);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(0);
  const running = useRef(false);
  const held = useRef(false);
  const ranFor = useRef(0);
  const current = useRef(active);
  current.current = active;

  useEffect(() => {
    if (paused || !enabled) return undefined;
    startedAt.current = Date.now();
    running.current = true;
    const id = setTimeout(() => {
      setActive(index => (index + 1) % count);
      setLeft(SLIDE_MS);
    }, left);
    return () => {
      running.current = false;
      ranFor.current = Date.now() - startedAt.current;
      clearTimeout(id);
    };
  }, [active, left, paused, enabled]);

  // Hiding keeps the time left, like a hold, so the progress bar resumes where it stopped.
  useEffect(() => {
    if (!enabled && !held.current) setLeft(ms => Math.max(0, ms - ranFor.current));
  }, [enabled]);

  // Created once (they read refs), so memoized list items keep the same handlers across slides.
  const [select] = useState(() => index => {
    if (index === current.current) return;
    startedAt.current = Date.now();
    setActive(index);
    setLeft(SLIDE_MS);
  });

  // Focus moving between two list items blurs one and focuses the next in the same tick: the ref
  // keeps that from resuming, and `running` keeps a second pause from subtracting the time twice.
  const [hold] = useState(() => on => {
    if (held.current === on) return;
    held.current = on;
    if (on && running.current) {
      const elapsed = Date.now() - startedAt.current;
      setLeft(ms => Math.max(0, ms - elapsed));
    }
    setPaused(on);
  });

  return {active, left, paused: paused || !enabled, select, hold};
}
