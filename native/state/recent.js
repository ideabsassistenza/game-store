// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {savedList} from './saved.js';

const LIMIT = 12;
const recent = savedList('recent.json', 'recently viewed');

/** Puts a game first in "Recently viewed" (at most 12). */
export function recordVisit(id) {
  const ids = recent.get();
  if (ids[0] !== id) recent.set([id, ...ids.filter(other => other !== id)].slice(0, LIMIT));
}

/** The recently viewed game ids, newest first. */
export const useRecent = recent.useList;
