// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// What QuickJS's missing Intl would know about each locale, from CLDR. Digits stay Western (0-9)
// everywhere, Arabic and Bengali included, so numbers read the same across the app and the catalog.
//   group/decimal  separators; `indian` groups 12,34,567; `minGroup` 2 leaves 4-digit numbers whole
//   percent        where the number goes: "45 %" in German
//   date           the yMMMd pattern: d day, M month number, MMM short month, y year
//   list           and-list separators: between items, before the last, and between a pair
const NBSP = ' ', NNBSP = ' ';

export const SOURCE_LOCALE = 'en';

export const LOCALES = [
  {code: 'en', name: 'English', group: ',', decimal: '.', percent: '{n}%', date: '{MMM} {d}, {y}',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    list: [', ', ', and ', ' and ']},
  {code: 'zh-Hans', name: '简体中文', group: ',', decimal: '.', percent: '{n}%', date: '{y}年{M}月{d}日',
    list: ['、', '和', '和']},
  {code: 'hi', name: 'हिन्दी', group: ',', decimal: '.', indian: true, percent: '{n}%', date: '{d} {MMM} {y}',
    months: ['जन॰', 'फ़र॰', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल॰', 'अग॰', 'सित॰', 'अक्तू॰', 'नव॰', 'दिस॰'],
    list: [', ', ' और ', ' और ']},
  {code: 'es', name: 'Español', group: '.', decimal: ',', minGroup: 2, percent: `{n}${NBSP}%`, date: '{d} {MMM} {y}',
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    list: [', ', ' y ', ' y ']},
  {code: 'ar', name: 'العربية', rtl: true, group: ',', decimal: '.', percent: '{n}%', date: '{d} {MMM} {y}',
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    list: [' و', ' و', ' و']},
  {code: 'fr', name: 'Français', group: NNBSP, decimal: ',', percent: `{n}${NNBSP}%`, date: '{d} {MMM} {y}',
    months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    list: [', ', ' et ', ' et ']},
  {code: 'bn', name: 'বাংলা', group: ',', decimal: '.', indian: true, percent: '{n}%', date: '{d} {MMM}, {y}',
    months: ['জানু', 'ফেব', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুল', 'আগ', 'সেপ', 'অক্টো', 'নভে', 'ডিসে'],
    list: [', ', ' এবং ', ' এবং ']},
  {code: 'pt-BR', name: 'Português (Brasil)', group: '.', decimal: ',', percent: '{n}%', date: '{d} de {MMM} de {y}',
    months: ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'],
    list: [', ', ' e ', ' e ']},
  {code: 'ru', name: 'Русский', group: NBSP, decimal: ',', percent: `{n}${NBSP}%`, date: '{d} {MMM} {y} г.',
    months: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    list: [', ', ' и ', ' и ']},
  {code: 'id', name: 'Bahasa Indonesia', group: '.', decimal: ',', percent: '{n}%', date: '{d} {MMM} {y}',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    list: [', ', ', dan ', ' dan ']},
  {code: 'ur', name: 'اردو', rtl: true, group: ',', decimal: '.', indian: true, percent: '{n}%', date: '{d} {MMM} {y}',
    months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    list: ['، ', '، اور ', ' اور ']},
  {code: 'de', name: 'Deutsch', group: '.', decimal: ',', percent: `{n}${NBSP}%`, date: '{d}. {MMM} {y}',
    months: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
    list: [', ', ' und ', ' und ']},
  {code: 'ja', name: '日本語', group: ',', decimal: '.', percent: '{n}%', date: '{y}年{M}月{d}日',
    list: ['、', '、', '、']},
];

const byCode = new Map(LOCALES.map(locale => [locale.code, locale]));

/** The locale data for `code`, English for an unknown one. */
export const localeData = code => byCode.get(code) ?? byCode.get(SOURCE_LOCALE);

export const isRTL = code => Boolean(byCode.get(code)?.rtl);

/**
 * The supported locale closest to a BCP 47 tag ("pt-PT" → "pt-BR", "zh-CN" → "zh-Hans",
 * "es-419" → "es"), or null when the language is not translated.
 */
export function matchLocale(tag) {
  if (!tag) return null;
  const [language, ...rest] = tag.replace(/_/g, '-').split('-');
  const exact = LOCALES.find(locale => locale.code.toLowerCase() === tag.toLowerCase().replace(/_/g, '-'));
  if (exact) return exact.code;
  if (language.toLowerCase() === 'zh') return rest.some(part => /^(hant|tw|hk|mo)$/i.test(part)) ? null : 'zh-Hans';
  return LOCALES.find(locale => locale.code.split('-')[0] === language.toLowerCase())?.code ?? null;
}
