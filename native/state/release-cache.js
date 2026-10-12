// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

import {releaseSets} from './release-sets.js';

// A few games: the version sheet reads every edition of a game (God of War Ragnarok has five) while
// the page reads its own on every render, and with one kept each read parsed a file again.
const KEPT = 6;

/** The recently read games' variants stay parsed; the complete catalog stays on disk. */
export function createReleaseCache(read) {
  const games = new Map();
  return file => {
    if (!/^data\/releases\/[a-z0-9%_-]+\.json$/i.test(file)) throw new Error('Invalid release data path.');
    let releases = games.get(file);
    if (!releases) {
      const parsed = JSON.parse(read(file));
      if (!Array.isArray(parsed)) throw new Error('Invalid release data; rebuild the catalog.');
      releases = releaseSets(parsed);
      if (games.size === KEPT) games.delete(games.keys().next().value);
    }
    games.delete(file);
    games.set(file, releases);
    return releases;
  };
}
