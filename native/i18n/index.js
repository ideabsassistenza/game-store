// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {createContext, createElement, useContext, useEffect, useState} from 'react';
import {DeviceInfo, FileSystem, Fonts} from '@ps5-react/core';
import {loadList, saveList} from '../state/saved.js';
import {configure, getLocale, setLocale, subscribe, t} from './core.js';
import {SOURCE_LOCALE, isRTL, matchLocale} from './locales.js';
import english from './locales/en.json';

export {LOCALES} from './locales.js';
export {SPAN_MAX, fitBytes} from './fit.js';
export {formatDate, formatList, formatNumber, formatPercent, getLocale, isRightToLeft, t} from './core.js';

// Locale files ship as app resources (app.json), read when a locale becomes active; only English and
// the active one are ever in the heap. English is in the bundle as well: on a console where the app's
// folder could not be read, the text fell back to nothing and showed its message keys.
configure(code => JSON.parse(FileSystem.readFile(`${FileSystem.appDir}/i18n/locales/${code}.json`)), english);

const SETTINGS = 'settings.json';

const systemLanguage = () => {
  try {
    return DeviceInfo.get().language;
  } catch {
    return null;
  }
};

/** The PS5's system language when the app translates it, else English. */
export const systemLocale = () => matchLocale(systemLanguage()) ?? SOURCE_LOCALE;

// `language` in settings.json is the person's pick; without one the app follows the system.
let choice = loadList(SETTINGS, 'settings').language ?? null;

// The runtime fonts pick Japanese or Chinese Han forms, and shape, for this language. Following the
// system, its own tag is kept even when the app falls back to English, so a Japanese PS5 still
// draws Japanese titles with Japanese forms.
function applyLocale() {
  setLocale(choice ?? systemLocale());
  Fonts.setLanguage(choice ?? systemLanguage() ?? getLocale());
}
applyLocale();

/** The picked locale code, or null while the app follows the system language. */
export const languageChoice = () => choice;

/** Picks `code` as the app's language, or the system's with null, and saves the pick. */
export function chooseLanguage(code) {
  choice = code;
  const {language, ...settings} = loadList(SETTINGS, 'settings');
  saveList(SETTINGS, 'settings', code ? {...settings, language: code} : settings);
  applyLocale();
}

const LocaleContext = createContext(getLocale());

/** Re-renders the app's text on a locale change: every useT/useLocale reader under it. */
export function LocaleProvider({children}) {
  const [locale, setActive] = useState(getLocale);
  useEffect(() => subscribe(setActive), []);
  return createElement(LocaleContext.Provider, {value: locale}, children);
}

/** `t(key, params)`, re-rendering the caller when the locale changes. */
export function useT() {
  useContext(LocaleContext);
  return t;
}

/** The active locale: `{locale, rtl}`; `rtl` mirrors rows and text for Arabic and Urdu. */
export function useLocale() {
  const locale = useContext(LocaleContext);
  return {locale, rtl: isRTL(locale)};
}

// Catalog text is English. Right to left it keeps its own direction, so a full stop stays at its
// end, and aligns with the mirrored layout.
export const LATIN_IN_RTL = {writingDirection: 'ltr', textAlign: 'right'};

/**
 * A catalog name inside right-to-left text: a left-to-right mark after it keeps a trailing full stop
 * or ™ at its end ("CAPCOM Co., Ltd."), where the paragraph direction would move it to the front.
 */
export const latin = (rtl, text) => (rtl && text ? `${text}\u200e` : text);

// Focus overrides toward the end and the start of a row: Right and Left, swapped right to left.
export const focusEnd = (rtl, key) => ({[rtl ? 'nextFocusLeft' : 'nextFocusRight']: key});
export const focusStart = (rtl, key) => ({[rtl ? 'nextFocusRight' : 'nextFocusLeft']: key});
