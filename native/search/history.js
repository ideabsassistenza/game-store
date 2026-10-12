// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {savedList} from '../state/saved.js';

const LIMIT = 8;
const searches = savedList('searches.json', 'recent searches');

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Puts a search first in "Recent searches" (at most 8). */
export function rememberSearch(query) {
  const term = query.trim();
  const terms = searches.get();
  if (term.length < 2 || same(terms[0] ?? '', term)) return;
  searches.set([term, ...terms.filter(other => !same(other, term))].slice(0, LIMIT));
}

export const forgetSearch = term => searches.set(searches.get().filter(other => other !== term));

/** The recent searches, newest first. */
export const useSearchHistory = searches.useList;
