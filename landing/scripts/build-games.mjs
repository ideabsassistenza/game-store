// Writes the landing's data from the native app's generated catalog: public/games.json, the library
// it lists, and src/lib/spotlight.json, the home screen's featured games. Titles, covers,
// platforms and genres only: the page shows the library, not its sources.
//   node native/scripts/prepare.mjs && node landing/scripts/build-games.mjs
import {readFileSync, writeFileSync} from 'node:fs';

const {games} = await import(new URL('../../native/data/catalog.js', import.meta.url));
// Sony resizes on request; the page draws covers at most 220 px wide.
const cover = url => url?.startsWith('https://image.api.playstation.com/') ? url.replace(/([?&]w=)\d+/, '$1440') : url;
// The names native/state/catalog.js rewrites at load (that module needs the engine, so it is mirrored).
const SYNONYMS = {
  'Role Playing Game (RPG)': 'RPG', 'Role Playing Games': 'RPG', 'Role-playing': 'RPG',
  Simulator: 'Simulation', 'Driving/Racing': 'Racing',
};
const genres = list => [...new Set(list.flatMap(genre => genre.split(' / ')).map(genre => SYNONYMS[genre] ?? genre))];
// Fan mods sit in the feeds beside the games; a showcase lists the games.
const isMod = title => /\bMOD\b/.test(title);

// One entry per work, as the app's card shows it: the PS4 and PS5 editions share it, PS5 first.
// prepare.mjs numbers works with several entries; any other entry is its own.
const workOf = game => game.work ?? game.id;
const titles = new Map();
for (const game of [...games].sort((a, b) => b.recommendations - a.recommendations)) {
  if (!game.art.cover || isMod(game.title)) continue;
  const key = workOf(game);
  const entry = titles.get(key);
  if (entry) { if (!entry.p.includes(game.platform)) entry.p.push(game.platform); continue; }
  titles.set(key, {t: game.title, p: [game.platform], c: cover(game.art.cover), g: genres(game.genres).slice(0, 2),
    y: game.year ?? null, h: game.art.hero, r: game.recommendations});
}
const library = [...titles.values()].map(({h, r, ...entry}) => ({...entry, p: entry.p.sort().reverse()}));
writeFileSync(new URL('../public/games.json', import.meta.url), JSON.stringify(library));

// The app's spotlight, as its home screen draws it, with five titles picked for their wide art (Steam's,
// which the page can load): the subject off to the right, so the logo and blurb read over the left.
// The first real paragraph is the blurb.
const FEATURED = ["Marvel's Spider-Man 2", 'God Of War Ragnarok', "DEATH STRANDING DIRECTOR'S CUT",
  'Armored Core 6 Fires of Rubicon', 'Resident Evil 4'];
// The app reads a game's paragraphs and short description from its page file, not from the catalog.
const page = game => JSON.parse(readFileSync(new URL(`../../native/data/pages/${encodeURIComponent(game.id)}.json`, import.meta.url), 'utf8'));
const summary = game => page(game).about.find(text => text.length > 80 && text !== text.toUpperCase()) ?? page(game).summary;
const spotlight = FEATURED.map(title => games.find(game => game.title === title && game.art.logo))
  .map(game => ({t: game.title, g: genres(game.genres), s: summary(game), h: game.art.hero, l: game.art.logo,
    d: Boolean(game.art.logoDark), a: game.art.logoAspect, c: cover(game.art.cover), p: titles.get(workOf(game)).p}));
writeFileSync(new URL('../src/lib/spotlight.json', import.meta.url), JSON.stringify(spotlight, null, 1));
console.log(`Wrote public/games.json (${library.length} titles) and src/lib/spotlight.json (${spotlight.length})`);
