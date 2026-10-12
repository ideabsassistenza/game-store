// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// A few games: a page reads its own text and shots on every render, while focus resting on other
// cards reads theirs for prefetching, and the home rows read their summaries.
const KEPT = 8;

/**
 * A game's page text and screenshots (`{about, shots}`), parsed from its file on demand. The catalog
 * kept them for every game, which took about 5 MiB of the 32 MiB JavaScript heap.
 */
export function createPageCache(read) {
  const pages = new Map();
  return file => {
    if (!/^data\/pages\/[a-z0-9%_-]+\.json$/i.test(file)) throw new Error('Invalid page data path.');
    let page = pages.get(file);
    if (!page) {
      page = JSON.parse(read(file));
      if (!Array.isArray(page.about) || !Array.isArray(page.shots)) throw new Error('Invalid page data; rebuild the catalog.');
      if (pages.size === KEPT) pages.delete(pages.keys().next().value);
    }
    pages.delete(file);
    pages.set(file, page);
    return page;
  };
}
