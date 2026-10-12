// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {FileSystem, Image} from '@ps5-react/core';
import {formatDate as dateIn, formatNumber, t} from '../i18n/core.js';
import {createPageCache} from './page-cache.js';
import {createReleaseCache} from './release-cache.js';
import {games, features, twins} from '../data/catalog.js';

export {games, features} from '../data/catalog.js';
export {formatBytes, formatSize} from './size.js';

// Sony resizes on request: its covers came 1024 px wide (about 300 KB), for boxes at most 288×384
// px. At 440 a square cover still fills the tallest box, in a quarter of the bytes.
const COVER_WIDTH = 440;
const coverSize = url => url.startsWith('https://image.api.playstation.com/') ? url.replace(/([?&]w=)\d+/, `$1${COVER_WIDTH}`) : url;

const releaseCache = createReleaseCache(path => FileSystem.readFile(`/app0/${path}`));
const pageCache = createPageCache(path => FileSystem.readFile(`/app0/${path}`));
const NO_PAGE = {about: [], shots: [], summary: ''};
// The imported stores list compound genres ("Adventure / Action / Horror") and synonyms ("RPG",
// "Role-playing"), which made one-game rail cards and filters. Each game's list is rewritten in place
// at load, so every importer of the data (search included) sees the same names. A slash without
// spaces is part of a name ("Driving/Racing").
const SYNONYMS = {
  'Role Playing Game (RPG)': 'RPG', 'Role Playing Games': 'RPG', 'Role-playing': 'RPG',
  Simulator: 'Simulation', 'Driving/Racing': 'Racing',
};
const dataFile = (dir, id) => `data/${dir}/${encodeURIComponent(id)}.json`;
// A missing or damaged file (a partial install) leaves the game without sources or text instead of
// closing the app.
const pageOf = game => { try { return pageCache(dataFile('pages', game.id)); } catch { return NO_PAGE; } };

// Shared by every entry: what only a game's page or the home rows show loads from its files on
// demand. A getter per game cost a function object each, and these fields stayed in the heap for all.
const Entry = {
  get releases() { try { return releaseCache(dataFile('releases', this.id)); } catch { return []; } },
  get about() { return pageOf(this).about; },
  get shots() { return pageOf(this).shots; },
  get shortDescription() { return pageOf(this).summary; },
  get titleId() { return this.id; },
};

// `twins`: entries of a work on a platform that already has a card (mostly other regions). They have
// no card of their own; the version sheet opens them.
const entries = [...games, ...twins];
for (const game of entries) {
  Object.setPrototypeOf(game, Entry);
  game.genres = [...new Set(game.genres.flatMap(genre => genre.split(' / ')).map(genre => SYNONYMS[genre] ?? genre))];
  game.art.cover &&= coverSize(game.art.cover);
  if (game.art.coverFallbacks) game.art.coverFallbacks = game.art.coverFallbacks.map(coverSize);
}

// A work's entries (its PS4 and PS5 editions, regions) share `work`, set by prepare.mjs from a
// normalized title; each card carries the platforms of all of them.
const editionsByWork = new Map();
for (const game of entries) if (game.work) editionsByWork.set(game.work, [...(editionsByWork.get(game.work) ?? []), game]);
const listed = new Set(games);
for (const game of entries) game.platforms = [...new Set(editionsOf(game).map(edition => edition.platform))].sort();

/** Every entry of `game`'s work, itself included: PS5 first, each platform's card before its twins. */
export function editionsOf(game) {
  return [...(editionsByWork.get(game.work) ?? [game])].sort((a, b) => b.platform.localeCompare(a.platform)
    || Number(listed.has(b)) - Number(listed.has(a)) || a.titleId.localeCompare(b.titleId));
}

export const genres = [...new Set(games.flatMap(game => game.genres))].sort();

const byId = new Map(entries.map(game => [game.id, game]));
export const getGame = id => byId.get(id);

/**
 * The id of the card that shows `id`: a twin's is its platform's card in the same work, so favorites
 * and history saved under an entry that lost its card still find one.
 */
export function listedId(id) {
  const game = byId.get(id);
  if (!game || listed.has(game)) return id;
  return editionsOf(game).find(edition => listed.has(edition) && edition.platform === game.platform)?.id ?? id;
}

/**
 * Fills the image disk cache with every cover, most popular first, in the background: after the
 * first run a cover scrolled to comes from disk, not the network.
 */
export function warmCovers() {
  Image.warm(sortGames(games, 'relevance').filter(game => game.art.cover).map(game => game.art.cover));
}

export const SORTS = [
  // Most popular puts the games Archive.org serves first: the app downloads them fastest.
  {id: 'relevance', compare: (a, b) => fromArchive(b) - fromArchive(a) || b.recommendations - a.recommendations},
  {id: 'newest', compare: (a, b) => b.releaseDate.localeCompare(a.releaseDate)},
  {id: 'rating', compare: (a, b) => (b.metacritic ?? 0) - (a.metacritic ?? 0)},
  {id: 'size', compare: (a, b) => (b.sizeGb ?? 0) - (a.sizeGb ?? 0)},
  {id: 'title', compare: (a, b) => a.title.localeCompare(b.title)},
];

export const sortLabel = id => t(`sort.${id}`);

export const sortGames = (list, id) => [...list].sort(SORTS.find(sort => sort.id === id).compare);

// The home page leads with games Archive.org serves: the host the app downloads from fastest and
// with no page to pass. Others fill in only where too few qualify.
export const fromArchive = game => Boolean(game.providers?.includes('archive.org'));
/** The first `count` of `list`, in its order, Archive.org's games first. */
export function showcase(list, count) {
  const first = list.filter(fromArchive);
  return first.length >= count ? first.slice(0, count) : [...first, ...list.filter(game => !fromArchive(game))].slice(0, count);
}

// Hosts named as their sites write them; any other key reads as itself.
const HOST_NAMES = {
  'overdrive cdn': 'Overdrive CDN', akirabox: 'AkiraBox', vikingfile: 'VikingFile', 'archive.org': 'Archive.org', '1fichier': '1fichier', rootz: 'Rootz',
  'pippo26442999.github': 'Pippo mirror', datanodes: 'DataNodes', mediafire: 'MediaFire', filekeeper: 'FileKeeper',
  datavaults: 'DataVaults', spectrum: 'Spectrum', buzzheavier: 'Buzzheavier', gofile: 'Gofile', rapidgator: 'Rapidgator',
  filecrypt: 'Filecrypt', fileditchfiles: 'FileDitch', ranoz: 'Ranoz', transfer: 'Transfer.it',
};
// Hosts with fewer games make rows nobody picks.
const MIN_HOST_GAMES = 20;
const hostCounts = new Map();
for (const game of games) for (const host of game.providers ?? []) hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
// A catalog value as a message key: "Music/Rhythm" → "musicRhythm".
function slug(value) {
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.map((word, i) => (i ? word[0].toUpperCase() + word.slice(1) : word)).join('');
}

// Overdrive CDN leads the hosts however few games it serves.
export const CDN_HOST = 'overdrive cdn';
const hosts = [...hostCounts].filter(([host, count]) => count >= MIN_HOST_GAMES || host === CDN_HOST)
  .sort((a, b) => (b[0] === CDN_HOST) - (a[0] === CDN_HOST) || b[1] - a[1])
  .map(([host]) => ({value: host, name: HOST_NAMES[host] ?? host}));
/** Whether a game has an Overdrive CDN source, which its cover marks. */
export const onCdn = game => Boolean(game.providers?.includes(CDN_HOST));

// Labels are message keys, or `name` for catalog values shown as themselves.
const SIZES = [
  {value: 'small', label: 'filters.size.small', test: gb => gb < 10},
  {value: 'medium', label: 'filters.size.medium', test: gb => gb >= 10 && gb <= 50},
  {value: 'large', label: 'filters.size.large', test: gb => gb > 50},
];
const named = (values, namespace) => values.map(value => ({value, label: `${namespace}.${slug(value)}`, name: value}));
// Most games first, as store facets list them: the genres people pick lead the drawer.
const byGames = (values, has) => {
  const counts = new Map(values.map(value => [value, games.filter(game => has(game, value)).length]));
  return [...values].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
};
const RELEASES = [
  {value: 'recent', label: 'filters.release.recent', test: year => year >= 2024},
  {value: 'current', label: 'filters.release.current', test: year => year >= 2020 && year <= 2023},
  {value: 'older', label: 'filters.release.older', test: year => year < 2020},
];

/**
 * The drawer's filters, in its order. `any`: a game matches one of the picked options (a game is on
 * one platform); otherwise it matches all of them (a co-op RPG).
 */
export const FACETS = [
  {key: 'platform', any: true, options: [{value: 'ps5', name: 'PS5'}, {value: 'ps4', name: 'PS4'}],
    has: (game, value) => game.platform === value},
  // A source the app downloads by itself, with no CAPTCHA page to pass in a browser.
  {key: 'access', options: [{value: 'direct', label: 'filters.access.direct'}], has: game => Boolean(game.direct)},
  {key: 'genre', options: named(byGames(genres, (game, genre) => game.genres.includes(genre)), 'genre'),
    has: (game, value) => game.genres.includes(value)},
  {key: 'feature', options: named(features, 'feature'), has: (game, value) => game.features.includes(value)},
  {key: 'release', any: true, options: RELEASES,
    has: (game, value) => game.year != null && RELEASES.find(release => release.value === value).test(game.year)},
  {key: 'size', any: true, options: SIZES,
    has: (game, value) => game.sizeGb != null && SIZES.find(size => size.value === value).test(game.sizeGb)},
  {key: 'provider', any: true, options: hosts, has: (game, value) => game.providers?.includes(value)},
];

/** A facet's title in the drawer: "Genre". */
export const facetTitle = key => t(`filters.facet.${key}`);

/** What a filter option reads as: its message, or its own name (hosts, platforms, an untranslated genre). */
export function optionLabel(option) {
  if (!option.label) return option.name;
  const text = t(option.label);
  return text === option.label ? option.name : text;
}

export const facetLabel = (key, value) => {
  const option = FACETS.find(facet => facet.key === key).options.find(candidate => candidate.value === value);
  return option ? optionLabel(option) : value;
};

/** A catalog genre in the active language ("Action"); genres without a message show as named. */
export const genreLabel = genre => optionLabel({label: `genre.${slug(genre)}`, name: genre});

/** A catalog feature in the active language ("Online multiplayer"). */
export const featureLabel = feature => optionLabel({label: `feature.${slug(feature)}`, name: feature});

export const NO_FILTERS = {...Object.fromEntries(FACETS.map(facet => [facet.key, []])), wishlist: false};

export const activeCount = filters => FACETS.reduce((sum, facet) => sum + filters[facet.key].length, Number(filters.wishlist));

export const toggleValue = (list, value) =>
  list.includes(value) ? list.filter(item => item !== value) : [...list, value];

const passes = (game, facet, picked) =>
  !picked.length || (facet.any ? picked.some(value => facet.has(game, value)) : picked.every(value => facet.has(game, value)));

function matching({filters, query, wishlist}, skip) {
  const q = query.trim().toLowerCase();
  return games.filter(game =>
    (!q || `${game.title} ${game.developer} ${game.publisher}`.toLowerCase().includes(q))
    && FACETS.every(facet => facet === skip || passes(game, facet, filters[facet.key]))
    && (!filters.wishlist || wishlist.includes(game.id)));
}

export const filterGames = state => matching(state);

/**
 * Games each option of `facet` would show, `{value: count}`: picking an `any` option adds its games to
 * the others picked there, picking another option narrows. Rows that would show nothing say so.
 */
export function facetCounts(state, facet) {
  const pool = matching(state, facet.any ? facet : undefined);
  return Object.fromEntries(facet.options.map(({value}) => [value, pool.filter(game => facet.has(game, value)).length]));
}

// The first real paragraph (skipping all-caps headings) summarises better than the short description.
export const summaryOf = game =>
  game.about.find(text => text.length > 80 && text !== text.toUpperCase()) ?? game.shortDescription;

export function relatedGames(game, limit = 6) {
  const shared = other => other.genres.filter(genre => game.genres.includes(genre)).length;
  return games
    .filter(other => other.id !== game.id && shared(other) > 0)
    .sort((a, b) => shared(b) - shared(a) || b.recommendations - a.recommendations)
    .slice(0, limit);
}

/** A release date in the active locale's short form ("Oct 14, 2021"), or a dash without one. */
export const formatDate = iso => (iso ? dateIn(iso) : '—');

/** A compact count: "22.2K", "1.3M". */
export function formatCount(n) {
  const short = value => formatNumber(value, {maximumFractionDigits: 1});
  if (n >= 1e6) return t('units.millions', {n: short(n / 1e6)});
  if (n >= 1e3) return t('units.thousands', {n: short(n / 1e3)});
  return formatNumber(n);
}
