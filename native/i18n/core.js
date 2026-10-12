// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {formatDate as dateIn, formatList as listIn, formatNumber as numberIn, formatPercent as percentIn} from './format.js';
import {fitBytes} from './fit.js';
import {compile, format} from './icu.js';
import {SOURCE_LOCALE, isRTL, localeData} from './locales.js';

// The message catalog without the platform: index.js gives it a loader that reads the locale files
// from the app's resources, tests one that reads them from disk. Only English (the fallback) and the
// active locale are ever parsed; each message compiles on first use and stays cached until the
// locale changes.
let load = () => ({});
let bundled = null;
let english = null;
let active = null;
let locale = SOURCE_LOCALE;
let compiled = new Map();
const listeners = new Set();

/**
 * `read(code)` returns the parsed messages of one locale file. `source`, the English messages, makes
 * English not depend on reading a file: a locale that cannot be read then falls back to it.
 */
export function configure(read, source = null) {
  load = read;
  bundled = source;
  english = null;
  active = null;
  compiled = new Map();
}

function messages(code) {
  try {
    return load(code);
  } catch (error) {
    console.log(`i18n: ${code} not loaded: ${error.message}`);
    return {};
  }
}

const source = () => (english ??= bundled ?? messages(SOURCE_LOCALE));

function entry(key) {
  if (compiled.has(key)) return compiled.get(key);
  active ??= locale === SOURCE_LOCALE ? source() : messages(locale);
  let found = null;
  for (const [code, catalog] of [[locale, active], [SOURCE_LOCALE, source()]]) {
    const text = catalog[key];
    if (typeof text !== 'string') continue;
    try {
      found = {code, parts: compile(text)};
      break;
    } catch (error) {
      console.log(`i18n: ${code} ${key}: ${error.message}`);
    }
  }
  compiled.set(key, found);
  return found;
}

/**
 * The message `key` in the active locale, else English, formatted with `params`, fitted to a Text
 * node; the key itself when no locale has it.
 */
export function t(key, params) {
  const found = entry(key);
  return found ? fitBytes(format(found.parts, params, found.code)) : key;
}

export const getLocale = () => locale;

/** Switches the active locale and tells every subscriber. */
export function setLocale(code) {
  if (code === locale) return;
  locale = code;
  active = null;
  compiled = new Map();
  for (const listener of listeners) listener(code);
}

/** Calls `listener(code)` on every locale change; returns the unsubscribe. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const isRightToLeft = () => isRTL(locale);
export const formatNumber = (n, options) => numberIn(locale, n, options);
export const formatPercent = percent => percentIn(locale, percent);
export const formatDate = iso => dateIn(locale, iso);
export const formatList = items => listIn(locale, items);
export const localeInfo = () => localeData(locale);
