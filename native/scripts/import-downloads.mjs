// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
// Import user-supplied catalogs; this does not contact providers or download games.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {parseArgs} from 'node:util';
import {sourceKind, webURL} from '../state/download-sources.js';
import {catalogPath, requireCatalog} from './catalog-dir.mjs';

const {values} = parseArgs({options: {orbit: {type: 'string'}, spectrum: {type: 'string'}, pegasus: {type: 'string', multiple: true}, 'verified-links': {type: 'string'}, output: {type: 'string'}}});
if (!values.orbit && !values.spectrum && !values.pegasus?.length) throw new Error('Pass --orbit <catalog.json> and/or --spectrum <catalogo_app.json> and/or --pegasus <catalog.json> (repeatable)');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const games = new Map();
const rejected = [];
const EXTENSIONS = {fpkg: 'pkg', folder: ''};
const verifiedLinks = values['verified-links'] ? new Set(read(values['verified-links']).links
  .filter(link => link.result === 'file_accessible' && link.status === 206 && link.resumable &&
    Number.isSafeInteger(link.actualBytes) && link.actualBytes === link.expectedBytes)
  .map(link => JSON.stringify([link.url, link.actualBytes]))) : null;

function records(data, source) {
  const entries = Array.isArray(data) ? data : source === 'orbit' ? data?.releases : data?.packages;
  if (!Array.isArray(entries) || (source === 'orbit' && data.schemaVersion != null && data.schemaVersion !== 1))
    throw new Error(`Invalid ${source} catalog; expected an array or supported catalog envelope`);
  return entries;
}

function add(record, source, index) {
  const titleId = record.titleId;
  if (!/^(?:PPSA|CUSA|LAPY|FAKE)\d{5}$/.test(titleId)) {
    if (!source.startsWith('pegasus')) throw new Error(`Invalid title ID at ${source} record ${index}`);
    rejected.push({source, index, reason: 'Invalid title ID'}); return;
  }
  const category = record.category || 'game';
  if (category !== 'game') return;
  const passwords = [...new Set([...String(record.description || '').matchAll(/^Password:\s*([^\r\n]+)/gim)].map(match => match[1].trim()))];
  const publishedPassword = record.archivePassword || (passwords.length === 1 ? passwords[0] : undefined);
  const key = category === 'game' ? titleId : `${titleId}:${category}`;
  let game = games.get(key);
  if (!game) {
    game = {id: key, titleId, title: record.title || titleId, description: record.description || '',
      category, publisher: record.publisher || '', releaseDate: record.releaseDate || '',
      images: {cover: record.cover || record.posterUrl || null, hero: record.hero || record.backgroundUrl || record.backUrl || null},
      genres: category === 'game' ? (record.genre ? [record.genre] : []) : ['Add-ons'], releases: []};
    games.set(key, game);
  }
  const links = record.manifestUrl ? [{url: record.manifestUrl}] : record.url ? [{url: record.url}] : record.downloadLinks || [];
  for (const [linkIndex, link] of links.entries()) {
    const url = typeof link === 'string' ? link : link.url;
    try { webURL(url); if (record.browserUrl) webURL(record.browserUrl); }
    catch {
      if (!source.startsWith('pegasus')) throw new Error(`Invalid URL at ${source} record ${index}, link ${linkIndex}`);
      rejected.push({source, index, linkIndex, reason: 'Invalid HTTP URL'}); continue;
    }
    const label = typeof link === 'string' ? '' : link.name || '';
    const extension = /\.(ffpfsc|ffpfs|ffpkg|exfat|pkg|zip|rar|7z|tar)(?:[?#]|$)/i.exec(url)?.[1];
    const hint = /\b(ffpfsc|ffpfs|ffpkg|exfat|pkg|zip|rar|7z)\b/i.exec(label)?.[1];
    const volume = /\bpart\s*\d+\b/i.exec(label)?.[0];
    const format = String(volume ? (['zip', 'rar', '7z'].includes(extension) ? extension : 'binary') : record.format || record.type || extension || hint || 'binary').toLowerCase();
    const manifestUrl = record.manifestUrl || (/\.json(?:[?#]|$)/i.test(url) ? url : undefined);
    const kind = sourceKind({url, manifestUrl, browserUrl: record.browserUrl, source});
    const requiresBrowser = !['direct', 'manifest'].includes(kind);
    if (verifiedLinks && (manifestUrl || requiresBrowser || !verifiedLinks.has(JSON.stringify([url, record.sizeBytes])))) continue;
    const browserUrl = requiresBrowser ? record.browserUrl || url : undefined;
    if (browserUrl && !/^https?:\/\/[^\s]+$/.test(browserUrl)) throw new Error(`Invalid browser URL at ${source} record ${index}`);
    const filename = record.filename || `${titleId}-${category}-${record.version || 'unknown'}-${source}-${index}-${linkIndex}.${EXTENSIONS[format] ?? format}`;
    const archivePassword = typeof link === 'object' && link.archivePassword ||
      (['rar', 'zip', '7z', 'tar', 'binary'].includes(format) && !/\b(?:exfat|ffpfsc|ffpfs|ffpkg)\b/i.test(label) ? publishedPassword : undefined);
    game.releases.push({id: `${source}-${index}-${linkIndex}`, format, filename, manifestUrl,
      url: manifestUrl ? undefined : url, browserUrl, requiresBrowser, sizeBytes: volume ? null : record.sizeBytes || null,
      sha256: volume ? undefined : record.sha256 || undefined, version: record.version || '', category,
      provider: record.provider || ({mediafire: 'MediaFire', buzzheavier: 'Buzzheavier', vikingfile: 'VikingFile', akirabox: 'AkiraBox', datanodes: 'DataNodes'}[kind] ?? (source === 'spectrum' ? 'Spectrum' : source === 'orbit' ? 'Orbit' : webURL(url).host)), source, flow: kind, label,
      // Archive volumes remain individual files; never concatenate them as raw-byte manifests.
      volume, ...(archivePassword ? {archivePassword} : {})});
  }
}

if (values.orbit) records(read(values.orbit), 'orbit').forEach((record, index) => add(record, 'orbit', index));
if (values.spectrum) {
  const data = read(values.spectrum);
  records(data, 'spectrum').forEach((record, index) => add(record, 'spectrum', index));
}
for (const [feed, path] of (values.pegasus || []).entries())
  records(read(path), 'pegasus').forEach((record, index) => add(record, `pegasus-${feed}`, index));
const exportedGames = [...games.values()].filter(game => !verifiedLinks || game.releases.length);
if (!values.output) requireCatalog();
const output = values.output || catalogPath('downloads/download-catalog.js');
writeFileSync(output, `// Catalog snapshot imported by scripts/import-downloads.mjs; tracked and hand-audited. Regenerate display resources with native/scripts/prepare.mjs.\nexport const downloadCatalog = ${JSON.stringify(exportedGames)};\n`);
console.log(`Imported ${exportedGames.length} titles and ${exportedGames.reduce((n, game) => n+game.releases.length, 0)} releases.`);
if (rejected.length) {
  const report = join(dirname(output), 'import-report.json');
  writeFileSync(report, `${JSON.stringify({rejected}, null, 2)}\n`);
  console.warn(`Skipped ${rejected.length} malformed Pegasus entries/links; see ${report}. No URLs or credentials are included in that report.`);
}
