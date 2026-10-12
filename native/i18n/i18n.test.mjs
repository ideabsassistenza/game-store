// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {configure, formatDate, formatNumber, setLocale, subscribe, t} from './core.js';
import {SPAN_MAX, TEXT_MAX, fitBytes} from './fit.js';
import {formatDate as dateIn, formatList, formatNumber as numberIn, formatPercent} from './format.js';
import {compile, format} from './icu.js';
import {LOCALES, matchLocale} from './locales.js';
import {pluralCategory} from './plural.js';

const render = (message, params, locale = 'en') => format(compile(message), params, locale);

test('cardinal plural categories follow CLDR', () => {
  const categories = (locale, numbers) => numbers.map(n => pluralCategory(locale, n));
  assert.deepEqual(categories('en', [0, 1, 2, 1.5]), ['other', 'one', 'other', 'other']);
  assert.deepEqual(categories('ru', [1, 2, 5, 11, 12, 21, 22, 25, 111, 1.5]),
    ['one', 'few', 'many', 'many', 'many', 'one', 'few', 'many', 'many', 'other']);
  assert.deepEqual(categories('ar', [0, 1, 2, 3, 10, 11, 99, 100, 102, 111]),
    ['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other', 'other', 'many']);
  assert.deepEqual(categories('fr', [0, 1, 1.5, 2, 1000000]), ['one', 'one', 'one', 'other', 'many']);
  assert.deepEqual(categories('pt-BR', [0, 1, 2]), ['one', 'one', 'other']);
  assert.deepEqual(categories('es', [0, 1, 2, 2000000]), ['other', 'one', 'other', 'many']);
  assert.deepEqual(categories('hi', [0, 1, 2]), ['one', 'one', 'other']);
  assert.deepEqual(categories('ja', [1, 2]), ['other', 'other']);
});

test('ICU messages: placeholders, plural with exact cases and #, select and quoting', () => {
  const games = '{count, plural, =0 {No games} one {# game} other {# games}}';
  assert.equal(render(games, {count: 0}), 'No games');
  assert.equal(render(games, {count: 1}), '1 game');
  assert.equal(render(games, {count: 2132}), '2,132 games');
  assert.equal(render(games, {count: 2132}, 'de'), '2.132 games');
  const ru = '{count, plural, one {# игра} few {# игры} many {# игр} other {# игры}}';
  assert.deepEqual([1, 3, 5, 21].map(count => render(ru, {count}, 'ru')), ['1 игра', '3 игры', '5 игр', '21 игра']);
  const ar = '{count, plural, zero {لا ألعاب} one {لعبة} two {لعبتان} few {# ألعاب} many {# لعبة} other {# لعبة}}';
  assert.deepEqual([0, 2, 3, 11].map(count => render(ar, {count}, 'ar')), ['لا ألعاب', 'لعبتان', '3 ألعاب', '11 لعبة']);
  assert.equal(render('{n, plural, offset:1 =0 {nobody} one {you and # other} other {you and # others}}', {n: 3}),
    'you and 2 others');
  assert.equal(render('{parts, select, all {All parts} other {Archive}} verified', {parts: 'all'}), 'All parts verified');
  assert.equal(render('{parts, select, all {All parts} other {Archive}} verified', {parts: 'x'}), 'Archive verified');
  assert.equal(render("Saved progress can't be resumed"), "Saved progress can't be resumed");
  assert.equal(render("Type '{name}' or it''s {name}", {name: 'x'}), "Type {name} or it's x");
  assert.equal(render('{done} of {total}', {done: '1 GB'}), '1 GB of {total}');
  assert.equal(render('{share, number, percent}', {share: 0.45}, 'de'), '45 %');
  assert.throws(() => compile('{count, plural, one {# game}}'), /Missing other case/);
  assert.throws(() => compile('{count'), SyntaxError);
});

test('numbers, percentages, dates and lists by locale, with Western digits', () => {
  assert.equal(numberIn('en', 1234567.891, {maximumFractionDigits: 2}), '1,234,567.89');
  assert.equal(numberIn('de', 1234567.5, {maximumFractionDigits: 1}), '1.234.567,5');
  assert.equal(numberIn('fr', 1234567), '1 234 567');
  assert.equal(numberIn('ru', 1234.5, {maximumFractionDigits: 1}), '1 234,5');
  assert.equal(numberIn('hi', 1234567), '12,34,567');
  assert.equal(numberIn('bn', 123), '123');
  assert.equal(numberIn('es', 1234), '1234');
  assert.equal(numberIn('es', 12345), '12.345');
  assert.equal(numberIn('pt-BR', 3.0, {minimumFractionDigits: 1}), '3,0');
  assert.equal(numberIn('en', 3725.29, {maximumFractionDigits: 1, useGrouping: false}), '3725.3');
  assert.equal(numberIn('ar', -1234), '-1,234');
  assert.equal(formatPercent('en', 45), '45%');
  assert.equal(formatPercent('fr', 45), '45 %');
  assert.equal(dateIn('en', '2021-10-14'), 'Oct 14, 2021');
  assert.equal(dateIn('de', '2021-03-05'), '5. März 2021');
  assert.equal(dateIn('pt-BR', '2021-10-14'), '14 de out. de 2021');
  assert.equal(dateIn('ja', '2021-10-14'), '2021年10月14日');
  assert.equal(dateIn('ru', '2021-05-01'), '1 мая 2021 г.');
  assert.equal(formatList('en', ['A', 'B', 'C']), 'A, B, and C');
  assert.equal(formatList('en', ['A', 'B']), 'A and B');
  assert.equal(formatList('de', ['A', 'B', 'C']), 'A, B und C');
  assert.equal(formatList('ja', ['A', 'B', 'C']), 'A、B、C');
});

test('the system language maps to the closest translated locale', () => {
  assert.equal(matchLocale('pt-BR'), 'pt-BR');
  assert.equal(matchLocale('pt-PT'), 'pt-BR');
  assert.equal(matchLocale('pt_BR'), 'pt-BR');
  assert.equal(matchLocale('en-GB'), 'en');
  assert.equal(matchLocale('es-419'), 'es');
  assert.equal(matchLocale('zh-Hans'), 'zh-Hans');
  assert.equal(matchLocale('zh-CN'), 'zh-Hans');
  assert.equal(matchLocale('zh-Hant'), null);
  assert.equal(matchLocale('ko'), null);
  assert.equal(matchLocale(null), null);
});

test('the active locale falls back to English per message and re-renders subscribers', () => {
  const files = {
    en: {'game.download': 'Download', 'catalog.count': '{count, plural, one {# game} other {# games}}', 'only.en': 'Only English'},
    'pt-BR': {'game.download': 'Baixar', 'catalog.count': '{count, plural, one {# jogo} other {# jogos}}', 'only.en': '{broken'},
  };
  const loaded = [];
  configure(code => { loaded.push(code); return files[code]; });
  const changes = [];
  const unsubscribe = subscribe(code => changes.push(code));
  try {
    assert.equal(t('game.download'), 'Download');
    setLocale('pt-BR');
    assert.equal(t('game.download'), 'Baixar');
    assert.equal(t('catalog.count', {count: 1500}), '1.500 jogos');
    assert.equal(t('only.en'), 'Only English');
    assert.equal(t('missing.key'), 'missing.key');
    assert.equal(formatNumber(1.5, {maximumFractionDigits: 1}), '1,5');
    assert.equal(formatDate('2024-01-05'), '5 de jan. de 2024');
    assert.deepEqual(loaded, ['en', 'pt-BR']);
    assert.deepEqual(changes, ['pt-BR']);
  } finally {
    setLocale('en');
    unsubscribe();
  }
});

test('with the app folder unreadable, every locale shows the bundled English, logging each file once', context => {
  const english = JSON.parse(readFileSync(new URL('./locales/en.json', import.meta.url), 'utf8'));
  const reads = [];
  const log = context.mock.method(console, 'log', () => {});
  configure(code => { reads.push(code); throw new Error(`fs.readFile /app0/i18n/locales/${code}.json: No such file or directory`); }, english);
  try {
    assert.equal(t('browse.addToFavorites'), 'Add to favorites');
    setLocale('de');
    assert.equal(t('browse.addToFavorites'), 'Add to favorites');
    assert.equal(t('browse.favorited'), 'Favorite');
    assert.deepEqual(reads, ['de']);
    assert.equal(log.mock.callCount(), 1);
  } finally {
    setLocale('en');
  }
});

test('locale files: English is complete ICU, the others hold only English keys', () => {
  const dir = new URL('./locales/', import.meta.url);
  const read = name => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  const en = read('en.json');
  for (const [key, message] of Object.entries(en)) assert.doesNotThrow(() => compile(message), key);
  assert.deepEqual(readdirSync(dir).sort(), LOCALES.map(locale => `${locale.code}.json`).sort());
  for (const {code} of LOCALES.filter(locale => locale.code !== 'en')) {
    for (const [key, message] of Object.entries(read(`${code}.json`))) {
      assert.ok(key in en, `${code}: ${key} is not an English key`);
      assert.doesNotThrow(() => compile(message), `${code}: ${key}`);
    }
  }
});

// The longest a message can render, in UTF-8 bytes: the longest plural or select case, an argument
// as long as a game size or a short title.
const ARGUMENT_BYTES = 16;
const longest = parts => parts.reduce((sum, part) => sum + (typeof part === 'string' ? Buffer.byteLength(part)
  : part.cases ? Math.max(...Object.values(part.cases).map(longest)) : ARGUMENT_BYTES), 0);

test('every message fits a Text node with room for its arguments', () => {
  const dir = new URL('./locales/', import.meta.url);
  for (const {code} of LOCALES) {
    const messages = JSON.parse(readFileSync(new URL(`${code}.json`, dir), 'utf8'));
    for (const [key, message] of Object.entries(messages)) {
      assert.ok(longest(compile(message)) <= TEXT_MAX - 15, `${code}: ${key} is too long for a Text node`);
    }
  }
});

test('fitBytes cuts at a character and ends with an ellipsis within the byte limit', () => {
  const bytes = text => Buffer.byteLength(text);
  assert.equal(fitBytes('Download'), 'Download');
  const hanzi = '游戏'.repeat(100);
  assert.equal(bytes(fitBytes(hanzi)), TEXT_MAX);
  assert.ok(fitBytes(hanzi).endsWith('戏…'));
  const hindi = fitBytes('डाउनलोड पूरा हुआ '.repeat(10), SPAN_MAX);
  assert.ok(bytes(hindi) <= SPAN_MAX && hindi.endsWith('…') && !hindi.includes('\ufffd'));
  assert.equal(fitBytes('a'.repeat(255)), 'a'.repeat(255));
  assert.equal(fitBytes(`${'a'.repeat(254)}é`), `${'a'.repeat(252)}…`);
  assert.equal(fitBytes('😀'.repeat(70), 9), '😀…');
});
