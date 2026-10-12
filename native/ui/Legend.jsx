// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useEffect, useState} from 'react';
import {View} from '@ps5-react/core';
import {ButtonHints} from './ButtonHints.jsx';

/** The hints most screens share, for `useHints` lists; labels are message keys. */
export const HINT = {
  select: {button: 'cross', label: 'hints.select'},
  back: {button: 'circle', label: 'hints.back'},
  top: {button: 'circle', label: 'hints.top'},
  clear: {button: 'l2', label: 'hints.clear'},
  favorite: {button: 'square', label: 'hints.favorite'},
  sections: {button: 'l1r1', label: 'hints.sections'},
  close: {button: 'circle', label: 'hints.close'},
};
const HINTS = {
  browse: [HINT.select, HINT.top, HINT.sections],
  game: [HINT.select, HINT.back, HINT.favorite, HINT.sections],
  search: [HINT.select, HINT.favorite, HINT.clear, HINT.back, HINT.sections],
};

// Outside React state, so registering re-renders only the legend.
const registered = [];
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener(registered.at(-1)?.hints ?? null));

/**
 * Shows `hints` (ButtonHints' `[{button, label}]`, a module constant) in the global legend while
 * the caller is mounted and `hints` is not null, in place of the screen's own; the newest caller
 * wins. Pass null when the context ends, e.g. `useHints(focused ? GALLERY_HINTS : null)`.
 */
export function useHints(hints) {
  useEffect(() => {
    if (!hints) return undefined;
    const entry = {hints};
    registered.push(entry);
    notify();
    return () => {
      registered.splice(registered.indexOf(entry), 1);
      notify();
    };
  }, [hints]);
}

const Hints = memo(ButtonHints);

/** The controller legend along the bottom of a screen; Downloads draws its own, with row actions. */
export function Legend({screen}) {
  const [hints, setHints] = useState(() => registered.at(-1)?.hints ?? null);
  useEffect(() => {
    listeners.add(setHints);
    // A screen mounting with the legend registers before this listener exists.
    setHints(registered.at(-1)?.hints ?? null);
    return () => listeners.delete(setHints);
  }, []);
  if (!HINTS[screen]) return null;
  return (
    <View className="absolute inset-x-0 bottom-0">
      <Hints hints={hints ?? HINTS[screen]} />
    </View>
  );
}
