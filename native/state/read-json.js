// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

/**
 * The JSON saved at `path`, or `fallback` when it is missing, cannot be read, does not parse or fails
 * `valid`. It never throws: a save cut short by a forced close or a power cut must not keep the app
 * from opening. A file that does not parse or holds the wrong shape is kept aside as
 * `<path>.unreadable-<time>`, so the next save does not overwrite what it held; one the console
 * refuses to read is left in place.
 */
export function readJSON(fs, path, fallback, valid = () => true, log = console.log) {
  let text;
  try {
    if (!fs.exists(path)) return fallback;
    text = fs.readFile(path);
  } catch (error) {
    log(`[saved] ${path} not read: ${error.message}`);
    return fallback;
  }
  try {
    const value = JSON.parse(text);
    if (!valid(value)) throw new Error('unexpected contents');
    return value;
  } catch (error) {
    const aside = `${path}.unreadable-${Date.now()}`;
    log(`[saved] ${path} unreadable (${error.message}); kept as ${aside}`);
    try { fs.rename(path, aside); } catch (failure) { log(`[saved] ${path} not moved aside: ${failure.message}`); }
    return fallback;
  }
}

export const isStringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The files of the app's data folder read at launch through `loadList`, with the shape each holds. */
export const SAVED_FILES = {
  'settings.json': isRecord,
  'wishlist.json': isStringList,
  'recent.json': isStringList,
  'searches.json': isStringList,
};
