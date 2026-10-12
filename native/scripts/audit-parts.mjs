// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Reads the file name and size of multipart sets' volumes from their hosts' pages, to find the sets the feed
// cut short (missingVolumes in state/release-sets.js); prepare.mjs leaves those out. Each host is asked for
// one page at a time, with a pause between: first every set's last volume, then the first volume of a set
// still undecided, unless another host showed the size of a file of that name for the same game. A page read
// once stays in the catalog's audits/part-audit/results.json, so another run asks only for what failed or is new.
//   node native/scripts/audit-parts.mjs [--pause <ms>] [--limit <sets per host>]
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {missingVolumes, releaseSets} from '../state/release-sets.js';
import {vikingMetadata} from '../state/viking-capture.js';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';
import {providerKey} from './sources.mjs';

const POWERS = {B: 0, KB: 1, MB: 2, GB: 3, TB: 4};
// Most hosts print binary sizes as GB (9.90 GB for a 9.9 GiB volume); 1fichier prints decimal ones (10.63 GB).
const bytesOf = (match, base = 1024) => match ? Math.round(Number(match[1]) * base ** POWERS[match[2].toUpperCase().replace('I', '')]) : undefined;
const SIZE = '([\\d.]+)\\s*([KMGT]?i?B)';

/** A volume's file name and size as its host's page shows them, by provider key. */
export const PAGES = {
  vikingfile: html => {
    try {
      const {filename, displaySize} = vikingMetadata(html);
      return {name: filename, bytes: displaySize && bytesOf([, displaySize.value, displaySize.unit])};
    } catch { return {}; }
  },
  '1fichier': html => ({name: /class="tier-name">([^<]*)/.exec(html)?.[1], bytes: bytesOf(new RegExp(`class="tier-feat">${SIZE}<`).exec(html), 1000)}),
  mediafire: html => ({name: /class="filename">([^<]*)/.exec(html)?.[1], bytes: bytesOf(new RegExp(`Download \\(${SIZE}\\)`).exec(html))}),
};
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const linkOf = part => part.sources[0].url || part.sources[0].browserUrl;
const hostOf = url => providerKey(new URL(url).hostname);
const VOLUME = /part\d+\.(?:rar|7z|zip)$/i;
const volumeNumbered = (name, number) => name?.replace(/part(\d+)(\.(?:rar|7z|zip))$/i, (all, digits, extension) =>
  `part${String(number(Number(digits))).padStart(digits.length, '0')}${extension}`);
const firstVolume = name => volumeNumbered(name, () => 1);
const nextVolume = name => volumeNumbered(name, n => n+1);

/**
 * The sizes every page read shows for each file of a game, by name: mirrors of one upload share their file
 * names. A name seen without a size maps to none.
 */
export function sizesByName(jobs, pages) {
  const sizes = new Map();
  for (const {game, set} of jobs) for (const part of set.parts) {
    const page = pages.get(linkOf(part));
    if (!page?.name) continue;
    const key = `${game.id}\n${page.name}`;
    sizes.set(key, [...sizes.get(key) ?? [], ...page.bytes ? [page.bytes] : []]);
  }
  return sizes;
}

// Sizes are all on one scale (1fichier's decimal GB are read as such); files of one name that differ by more
// than a rounding are not one file, and give no size.
const agreed = sizes => sizes?.length && sizes.every(size => Math.abs(size-sizes[0]) <= sizes[0]/100) ? sizes[0] : undefined;

/**
 * The audit's record of one set: 'incomplete' with missingVolumes' reason; 'unproven' for a full last volume
 * alone, when neither the game's size nor its next volume on another host shows it is not the last; 'gone'
 * when a volume's host answered 404 twice; 'ok' when its last volume's page was read; else 'unread'.
 * `pages`: what was read per link, `{status, confirmed, name, bytes}`; `sizes`: sizesByName's.
 */
export function setRecord({game, set, declaredBytes}, pages, sizes = new Map()) {
  const parts = set.parts.map(part => ({number: part.number, url: linkOf(part), ...pages.get(linkOf(part))}));
  const [first, last] = [parts[0], parts.at(-1)];
  // The name a first volume must have, when only the last one's page was read.
  const names = parts.map(part => part.name || (part === first && firstVolume(last.name)) || part.url);
  const known = parts.map((part, index) => ({number: part.number, name: names[index], bytes: part.bytes ?? agreed(sizes.get(`${game.id}\n${names[index]}`))}));
  const reason = missingVolumes(known, declaredBytes);
  const proven = reason !== 'last' || declaredBytes || sizes.has(`${game.id}\n${nextVolume(names.at(-1))}`);
  const verdict = reason ? proven ? 'incomplete' : 'unproven' : parts.some(part => part.confirmed) ? 'gone' : last.name ? 'ok' : 'unread';
  return {gameId: game.id, title: game.title, provider: set.provider, label: set.label, ...declaredBytes && {declaredBytes},
    verdict, ...reason && {reason}, parts};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options: {pause: {type: 'string', default: '1000'}, limit: {type: 'string'}}});
  requireCatalog();
  const dir = catalogPath('audits/part-audit');
  const resultsFile = catalogPath('audits/part-audit/results.json');
  const {downloadCatalog} = await import(pathToFileURL(catalogPath('downloads/download-catalog.js')).href);
  const store = new Map(JSON.parse(readFileSync(catalogPath('store/games.json'), 'utf8')).map(game => [game.id, game.sizeGb]));
  const previous = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : [];
  const pages = new Map(previous.flatMap(set => set.parts).filter(part => part.status === 200 || part.status === 404)
    .map(({url, number, ...page}) => [url, page]));

  const jobs = downloadCatalog.flatMap(game => {
    // The game's size: the store's, else its smallest whole download's.
    const whole = game.releases.filter(release => !release.volume && release.sizeBytes).map(release => release.sizeBytes);
    const declaredBytes = store.get(game.id) ? Math.round(store.get(game.id) * 1024 ** 3) : whole.length ? Math.min(...whole) : undefined;
    return releaseSets(game.releases).filter(set => set.parts).map(set => ({game, set, declaredBytes}));
  });
  const records = () => { const sizes = sizesByName(jobs, pages); return jobs.map(job => setRecord(job, pages, sizes)); };
  const save = () => {
    mkdirSync(dir, {recursive: true});
    // A set per line, so a new run's diff shows the sets that changed.
    writeFileSync(resultsFile, `[\n${records().map(record => JSON.stringify(record)).join(',\n')}\n]\n`);
  };

  async function read(host, url) {
    const before = pages.get(url);
    const page = {status: 0, checkedAt: new Date().toISOString()};
    try {
      const response = await fetch(host === 'vikingfile' ? url.replace('://vikingfile.com/', '://vik1ngfile.site/') : url,
        {headers: {'user-agent': AGENT}, signal: AbortSignal.timeout(30_000)});
      page.status = response.status;
      if (response.ok) Object.assign(page, PAGES[host](await response.text()));
    } catch (error) { page.error = error.message; }
    if (before?.status === 404 && page.status === 404) page.confirmed = true;
    const same = before && ['status', 'name', 'bytes'].every(key => before[key] === page[key]);
    pages.set(url, same ? {...page, checkedAt: before.checkedAt} : page);
    await sleep(Number(values.pause));
    return page;
  }
  // `pick(job)`: the volume to read for a set, or none; one read before is read again only when `again`.
  async function pass(name, pick, again = false) {
    const limit = values.limit ? Number(values.limit) : Infinity;
    const byHost = Map.groupBy(jobs, job => hostOf(linkOf(job.set.parts[0])));
    await Promise.all([...byHost].filter(([host]) => PAGES[host]).map(async ([host, list]) => {
      let refused = 0;
      for (const [index, job] of list.slice(0, limit).entries()) {
        const part = pick(job);
        if (part && (again || !pages.has(linkOf(part)))) {
          const {status} = await read(host, linkOf(part));
          refused = [403, 429, 503].includes(status) ? refused+1 : 0;
          if (refused >= 5) { console.warn(`${name} ${host}: stopped after ${refused} refusals in a row (HTTP ${status})`); return; }
        }
        if ((index+1) % 100 === 0) { console.log(`${name} ${host}: ${index+1}/${Math.min(list.length, limit)}`); save(); }
      }
    }));
    save();
  }
  await pass('last volumes', job => setRecord(job, pages).reason === 'gap' ? null : job.set.parts.at(-1));
  // One 404 is not proof the file is gone; a second one, after the whole pass, is.
  await pass('404 again', job => job.set.parts.find(part => pages.get(linkOf(part))?.status === 404 && !pages.get(linkOf(part)).confirmed), true);
  await pass('first volumes', job => {
    const sizes = sizesByName(jobs, pages);
    const record = setRecord(job, pages, sizes);
    const [first, last] = [record.parts[0], record.parts.at(-1)];
    const borrowed = agreed(sizes.get(`${job.game.id}\n${first.name || firstVolume(last.name)}`));
    return record.verdict === 'ok' && record.parts.length > 1 && last.bytes && VOLUME.test(last.name) && !borrowed
      ? job.set.parts[0] : null;
  });

  const results = records();
  const count = (list, key) => Object.fromEntries([...Map.groupBy(list, key)].map(([value, items]) => [value, items.length]));
  const games = list => new Set(list.map(set => set.gameId)).size;
  const incomplete = results.filter(set => set.verdict === 'incomplete');
  console.log(`${results.length} sets of ${games(results)} games:`, count(results, set => set.verdict));
  console.log(`incomplete: ${incomplete.length} sets of ${games(incomplete)} games`, count(incomplete, set => set.reason));
  console.log('incomplete by host:', count(incomplete, set => hostOf(set.parts[0].url)));
  const gone = results.filter(set => set.verdict === 'gone');
  console.log(`gone: ${gone.length} sets of ${games(gone)} games have a volume their host answered 404 twice`);
  const unproven = results.filter(set => set.verdict === 'unproven');
  console.log(`unproven: ${unproven.length} sets of ${games(unproven)} games, a full last volume and nothing else`);
  const out = results.filter(set => ['incomplete', 'gone', 'unproven'].includes(set.verdict));
  console.log(`left out unless a game would have no other source: ${out.length} sets of ${games(out)} games`);
}
