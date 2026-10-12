// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Which catalog entries are one game. Feeds spell a title many ways ("Ratchet & Clank: Rift Apart",
// "Ratchet and Clank Rift Apart", "Call of Duty®: Vanguard"), list edition names beside the game
// ("Tekken 8 Ultimate Edition") and repeat a game per region, so the exact title split one game into
// several cards and kept PS4 and PS5 editions apart.

const EDITION = /\s+(?:(?:deluxe|definitive|complete|standard|digital|gold|ultimate|premium|special|enhanced|launch|anniversary|game of the year|goty|cross gen|ps[45])\s+)+edition$/;

// Remasters and director's cuts that are the PS5 version of a PS4 entry in the catalog. Sequels,
// remakes and expanded re-releases ("Sonic Origins Plus") stay their own work.
const ALIASES = {
  'ghost of tsushima directors cut': 'ghost of tsushima',
  'yakuza 0 directors cut': 'yakuza 0',
  'days gone remastered': 'days gone',
  'alan wake remastered': 'alan wake',
  'the sinking city remastered': 'the sinking city',
  'nioh 2 remastered': 'nioh 2',
  'nioh remastered the complete edition': 'nioh',
  'tomb raider i iii remastered': 'tomb raider i iii',
  'tomb raider iv vi remastered': 'tomb raider iv vi',
  'mortal kombat 11 ultimate': 'mortal kombat 11',
};

/** The work a title names: case, marks (™ ® ©, accents), punctuation and edition suffixes left out. */
export function workKey(title) {
  const key = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[™®©]/g, '')
    .replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const plain = key.replace(EDITION, '').replace(/\s+ps[45]$/, '');
  return ALIASES[plain] ?? ALIASES[key] ?? plain;
}

const GROUP_RANK = {direct: 0, page: 1, browser: 2};
const HEALTH_RANK = {ok: 0, flaky: 2};

/**
 * One platform's entries of a work, best card first: the one whose default download the app reaches
 * most easily and that answered the link audit, then the one with art and store data people see on the
 * card. Entries are `{id, source: {group, health}, art: {cover, hero}, recommendations, metacritic}`.
 */
export function rankEntries(entries) {
  const score = entry => [GROUP_RANK[entry.source.group] ?? 3, HEALTH_RANK[entry.source.health] ?? 1,
    entry.art.cover ? 0 : 1, entry.art.hero ? 0 : 1, -(entry.recommendations || 0), -(entry.metacritic || 0)];
  return [...entries].sort((a, b) => {
    const [sa, sb] = [score(a), score(b)];
    return sa.reduce((order, value, i) => order || value - sb[i], 0) || a.id.localeCompare(b.id);
  });
}

// Feed labels open with the region ("USA 9.xx Base", "EUR Base (v01.01)").
const REGIONS = ['USA', 'EUR', 'JPN', 'ASIA', 'KOR'];

/** The region most of `releases` name, for telling two entries of one platform apart; null if none. */
export function regionOf(releases) {
  const counts = new Map();
  for (const {label} of releases) {
    const region = REGIONS.find(name => new RegExp(`^${name}\\b`).test(label || ''));
    if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
