// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {localeData} from './locales.js';

// Number, date and list formatting by hand: QuickJS has no Intl, and toLocaleString is toString.

function groupInteger(digits, {group, indian, minGroup = 1}) {
  if (digits.length < 4 + minGroup - 1) return digits;
  if (!indian) return digits.replace(/\B(?=(\d{3})+$)/g, group);
  // Indian grouping: the last three digits, then pairs (12,34,567).
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, group);
  return `${head}${group}${digits.slice(-3)}`;
}

/**
 * `n` with the locale's separators, rounded to at most `maximumFractionDigits` (0 by default) and
 * padded to `minimumFractionDigits`; `useGrouping: false` leaves thousands unseparated.
 */
export function formatNumber(locale, n, {minimumFractionDigits = 0, maximumFractionDigits = minimumFractionDigits,
  useGrouping = true} = {}) {
  const data = localeData(locale);
  const factor = 10 ** maximumFractionDigits;
  const rounded = Math.round(Math.abs(n) * factor) / factor;
  let [whole, fraction = ''] = rounded.toFixed(maximumFractionDigits).split('.');
  fraction = fraction.replace(/0+$/, '').padEnd(minimumFractionDigits, '0');
  const sign = n < 0 && rounded !== 0 ? '-' : '';
  return `${sign}${useGrouping ? groupInteger(whole, data) : whole}${fraction ? data.decimal + fraction : ''}`;
}

/** A whole percent for a 0..100 value: "45%", "45 %" in German. */
export const formatPercent = (locale, percent) => localeData(locale).percent.replace('{n}', formatNumber(locale, percent));

/** An ISO `yyyy-mm-dd` date in the locale's short form: "Jan 5, 2024", "5. Jan. 2024", "2024年1月5日". */
export function formatDate(locale, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const {date, months} = localeData(locale);
  return date.replace(/\{(MMM|M|d|y)\}/g, (_, token) =>
    token === 'MMM' ? months[month - 1] : String(token === 'M' ? month : token === 'd' ? day : year));
}

/** An and-list: "A, B, and C" in English, "A, B und C" in German. */
export function formatList(locale, items) {
  const [middle, end, pair] = localeData(locale).list;
  if (items.length < 2) return items.join('');
  if (items.length === 2) return `${items[0]}${pair}${items[1]}`;
  return `${items.slice(0, -1).join(middle)}${end}${items.at(-1)}`;
}
