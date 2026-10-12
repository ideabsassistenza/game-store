// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('./import-downloads.mjs', import.meta.url));
const direct = {titleId: 'PPSA12345', title: 'Example', genre: 'Adventure', format: 'FFPFSC',
  filename: 'example.ffpfsc', provider: 'Archive.org', sourceId: 'archive', url: 'https://example.com/game', sizeBytes: 100};

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'orbit-catalog-'));
  const input = join(directory, 'catalog.json');
  const output = join(directory, 'download-catalog.js');
  const importCatalog = value => {
    writeFileSync(input, JSON.stringify(value));
    execFileSync(process.execPath, [script, '--orbit', input, '--output', output]);
    return JSON.parse(readFileSync(output, 'utf8').split('export const downloadCatalog = ')[1].trim().replace(/;$/, ''));
  };
  try { run({input, output, importCatalog}); } finally { rmSync(directory, {recursive: true, force: true}); }
}

test('Orbit envelopes and legacy arrays preserve existing release identities', () => fixture(({importCatalog}) => {
  const legacy = importCatalog([direct]);
  const modern = importCatalog({schemaVersion: 1, revision: 13, releases: [direct]});
  assert.deepEqual(modern, legacy);
  assert.equal(modern[0].releases[0].id, 'orbit-0-0');
  assert.equal(modern[0].releases[0].requiresBrowser, false);
  assert.deepEqual(modern[0].genres, ['Adventure']);
}));

test('Viking browser pages cannot be mistaken for native binary sources', () => fixture(({importCatalog}) => {
  const pages = [{...direct, sourceId: 'vikingfile', provider: 'Vikingfile', url: 'https://vikingfile.com/f/example'},
    {...direct, sourceId: 'vikingfile', provider: 'Vikingfile', url: 'https://vikingfile.com/d/example/file', browserUrl: 'https://vik1ngfile.site/f/example'},
    {...direct, sourceId: 'vikingfile', provider: 'Vikingfile', url: 'https://vikingfile.com/d/direct/file'}];
  const releases = importCatalog({schemaVersion: 1, releases: pages})[0].releases;
  assert.equal(releases.length, 3);
  assert.equal(releases[0].requiresBrowser, true);
  assert.equal(releases[0].browserUrl, pages[0].url);
  assert.equal(releases[1].browserUrl, pages[1].browserUrl);
  assert.equal(releases[1].requiresBrowser, true);
  assert.equal(releases[2].requiresBrowser, false);
}));

test('unsupported Orbit schemas fail before writing generated data', () => fixture(({input, output}) => {
  writeFileSync(input, JSON.stringify({schemaVersion: 99, releases: [direct]}));
  const result = spawnSync(process.execPath, [script, '--orbit', input, '--output', output], {encoding: 'utf8'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid orbit catalog/);
}));

test('archive passwords preserve case and brackets without leaking between records', () => fixture(({importCatalog}) => {
  const releases = importCatalog([{...direct, format: 'rar', description: 'Password: fixture-password'},
    {...direct, format: 'rar', description: 'Password: [fixture-password]'},
    {...direct, format: 'rar'},
    {...direct, format: 'rar', description: 'Password: first\nPassword: second'},
    {...direct, description: 'Password: fixture-password'}])[0].releases;
  assert.deepEqual(releases.map(release => release.archivePassword), ['fixture-password', '[fixture-password]', undefined, undefined, undefined]);
}));

test('Pegasus imports repeated feeds, preserves artwork and gives each volume a distinct destination', () => fixture(({input, output}) => {
  const second = input + '.second';
  writeFileSync(input, JSON.stringify({packages: [{...direct, format: undefined, filename: undefined,
    url: undefined, cover: undefined, posterUrl: 'https://example.com/art.jpg', backgroundUrl: 'https://example.com/hero.jpg',
    downloadLinks: [{name: 'USA exFAT - Akirabox part1', url: 'https://akirabox.com/a'},
      {name: 'USA exFAT - Akirabox part2', url: 'https://akirabox.com/b'}]}]}));
  writeFileSync(second, JSON.stringify({packages: [{...direct, url: 'https://archive.org/download/test/app.ffpfsc'}]}));
  execFileSync(process.execPath, [script, '--pegasus', input, '--pegasus', second, '--output', output]);
  const [game] = JSON.parse(readFileSync(output, 'utf8').split('export const downloadCatalog = ')[1].trim().replace(/;$/, ''));
  assert.equal(game.releases.length, 3);
  assert.equal(game.images.cover, 'https://example.com/art.jpg');
  assert.equal(game.images.hero, 'https://example.com/hero.jpg');
  assert.equal(new Set(game.releases.map(release => release.filename)).size, 3);
  assert.equal(game.releases[0].volume, 'part1');
  assert.equal(game.releases[0].flow, 'akirabox');
  assert.equal(game.releases[2].flow, 'direct');
}));
