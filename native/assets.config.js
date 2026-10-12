// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {readdirSync, readFileSync} from 'node:fs';
import {LOCALES} from './i18n/locales.js';

// Catalog and translated text only exist at runtime, so the bundle glyph check cannot see them.
// 'european' bakes Latin Extended, Cyrillic and Greek; the locale files and locale data add the few
// characters beyond it (the French narrow no-break space). Arabic, Devanagari, Bengali and CJK
// come from the runtime fonts app.json lists in textFonts.
const locales = new URL('./i18n/locales/', import.meta.url);
const localeText = readdirSync(locales).filter(name => name.endsWith('.json'))
  .map(name => Object.values(JSON.parse(readFileSync(new URL(name, locales), 'utf8'))).join('')).join('')
  + LOCALES.map(({name, months = [], date, list, group, percent}) => [name, ...months, date, ...list, group, percent].join('')).join('');
const european = [...new Set(localeText)].filter(char => /[\u0080-\u052f\u2000-\u206f]/.test(char)).join('');

// The mono face draws translated status lines too (the update dialog's): without these
// sets their accents, Cyrillic and the · separator would draw as '?'.
export default {
  fonts: {
    'Inter-Regular': {glyphs: 'european', extraGlyphs: european},
    'JetBrainsMono-Regular': {glyphs: 'european', extraGlyphs: european},
  },
  // Opaque art: 16 bits a pixel halve what it costs to bake and to repaint.
  images: {
    'cdn-card': {format: 'rgb565'},
  },
};
