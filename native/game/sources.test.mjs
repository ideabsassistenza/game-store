// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import '../i18n/testing.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {describeSource, equivalent, fallbacks, preferredRelease, sourceSections} from './sources.js';

const direct = {provider: 'Spectrum', format: 'ffpfsc', label: '', version: '1.0', sizeBytes: 116104364032,
  url: 'https://example.com/game.ffpfsc'};
const part = url => ({sources: [{url, requiresBrowser: true, source: 'pegasus-0', record: 'pegasus-0-7'}]});
const mediafire = {provider: 'MediaFire', format: 'archive-set', label: 'EUR 9.xx Base - Mediafire · 3 parts', version: '',
  requiresBrowser: true, parts: [1, 2, 3].map(n => part(`https://www.mediafire.com/file/${n}`))};
const akira = {...mediafire, provider: 'AkiraBox', label: 'EUR 9.xx Base - Akirabox · 3 parts',
  parts: [1, 2, 3].map(n => part(`https://akirabox.com/f/${n}`))};
const fichier = {provider: '1fichier.com', format: 'archive-set', label: 'EUR 9.xx Base - 1fichier · 2 parts',
  requiresBrowser: true, parts: [1, 2].map(n => part(`https://1fichier.com/?${n}`))};
const gofile = {provider: 'gofile.io', format: 'binary', label: 'EUR 9.xx Base - Gofile', requiresBrowser: true,
  source: 'pegasus-0', url: 'https://gofile.io/d/abc'};
const broken = {...fichier, unavailableReason: 'This source has missing volumes. Choose another complete set.'};

test('a direct image names its version, kind and size', () => {
  assert.deepEqual(describeSource(direct), {name: 'Spectrum', detail: 'v1.0 · Game image', size: '116.1 GB',
    group: 'direct', reason: null});
});

test('a host the app can read downloads in the app despite the catalog browser flag', () => {
  assert.deepEqual(describeSource(mediafire), {name: 'MediaFire', detail: 'EUR 9.xx Base · Archive · 3 parts · Capped near 3 MB/s',
    size: null, group: 'page', reason: null});
});

test('a host that hides its file link behind a CAPTCHA needs a browser', () => {
  assert.equal(describeSource({...gofile, provider: 'VikingFile', url: 'https://vikingfile.com/f/x'}).group, 'browser');
  assert.equal(describeSource({...gofile, provider: 'Buzzheavier', url: 'https://buzzheavier.com/x'}).group, 'browser');
});

test('a host with a domain still matches its label suffix, and an unknown host needs a browser', () => {
  assert.equal(describeSource(fichier).detail, 'EUR 9.xx Base · Archive · 2 parts');
  assert.equal(describeSource(fichier).group, 'browser');
  assert.equal(describeSource(broken).group, 'unavailable');
});

test('sections run links, host pages, then browser sources with fewer parts first', () => {
  assert.deepEqual(sourceSections([fichier, mediafire, gofile, direct]).map(section => [section.group, section.items.map(item => item.index)]),
    [['direct', [3]], ['page', [1]], ['browser', [2, 0]]]);
});

test('only copies of the same build are equivalent', () => {
  const same = {...direct, provider: 'Archive.org', version: '01.000.000', sizeBytes: 116104364032 + 1000};
  assert.equal(equivalent(direct, same), true);
  assert.equal(equivalent(direct, {...same, version: '1.06'}), false);
  assert.equal(equivalent(direct, {...same, format: 'exfat'}), false);
  assert.equal(equivalent(direct, {...same, sizeBytes: 90e9}), false);
  assert.equal(equivalent({...direct, sizeBytes: undefined}, {...same, sizeBytes: undefined}), false);
  const piece = n => ({...direct, provider: 'AkiraBox', label: `EUR 4.03 Base - Akirabox part ${n}`, sizeBytes: 4e9});
  assert.equal(equivalent(piece(1), {...piece(1), provider: 'rootz.so', label: 'EUR 4.03 Base - Rootz part 1'}), true);
  assert.equal(equivalent(piece(1), {...piece(2), provider: 'rootz.so', label: 'EUR 4.03 Base - Rootz part 2'}), false);
  assert.equal(equivalent(piece(1), {...piece(1), label: 'USA 4.03 Base - Akirabox part 1'}), false);
  const viking = {...akira, provider: 'VikingFile', label: 'EUR 9.xx Base - Vikingfile · 3 parts'};
  assert.equal(equivalent(akira, viking), true);
  assert.equal(equivalent(akira, {...viking, parts: viking.parts.slice(0, 2)}), false);
  assert.equal(equivalent(akira, {...viking, label: 'EUR DLC - Vikingfile · 2 parts'}), false);
  assert.equal(equivalent(akira, {...viking, label: 'USA 9.xx Base - Vikingfile · 2 parts'}), false);
  assert.equal(equivalent(akira, direct), false);
});

test('a label that only names the host is dropped', () => {
  assert.equal(describeSource({...direct, provider: 'VikingFile', label: 'Viki', version: '01.070'}).detail, 'v01.070 · Game image');
  assert.equal(describeSource({...direct, provider: 'AkiraBox', label: 'AkiraBox', version: '01.070'}).detail, 'v01.070 · Game image');
});

test('measured hosts say how fast they go', () => {
  assert.equal(describeSource({...direct, provider: 'MediaFire', version: ''}).detail, 'Game image · Capped near 3 MB/s');
  assert.equal(describeSource({...direct, provider: 'Archive.org', version: ''}).detail, 'Game image · Many connections at once');
});

test('mirrors of one upload are equivalent without a size; other records and labels are not', () => {
  const row = (provider, label, record = 'pegasus-2-41') => ({provider, label: `${label} - ${provider}`, format: 'binary',
    version: '', sizeBytes: null, source: 'pegasus-2', record, url: `https://${provider.toLowerCase()}.com/f/${record}`});
  const akiraRow = row('AkiraBox', 'USA 9.xx Base');
  assert.equal(equivalent(akiraRow, row('VikingFile', 'USA 9.xx Base')), true);
  assert.equal(equivalent(akiraRow, row('VikingFile', 'USA 9.xx Base', 'pegasus-0-12')), false);
  assert.equal(equivalent(akiraRow, row('VikingFile', 'USA 9.xx BackPort 4.xx')), false);
  assert.equal(equivalent(akiraRow, {...row('VikingFile', ''), label: 'Viki'}), false);
  assert.equal(equivalent(akiraRow, {...row('VikingFile', 'USA 9.xx Base'), format: 'exfat', version: '1.02'}), true);
  assert.equal(equivalent({...akiraRow, sizeBytes: 4e9}, {...row('VikingFile', 'USA 9.xx Base'), sizeBytes: 9e9}), false);
});

test('the default source is the one the app reaches most easily, then the healthiest', () => {
  const page = {...mediafire, parts: undefined, format: 'binary', label: 'EUR 9.xx Base - Mediafire', url: 'https://www.mediafire.com/file/x'};
  assert.equal(preferredRelease([{...page, provider: 'AkiraBox', url: 'https://akirabox.to/x/file'}, page]), 1);
  assert.equal(preferredRelease([fichier, gofile, page]), 2);
  // MediaFire leads every host but Overdrive CDN and Archive.org, a direct link included.
  assert.equal(preferredRelease([fichier, page, direct]), 1);
  assert.equal(preferredRelease([page, {...direct, provider: 'Archive.org', url: 'https://archive.org/download/a/b.pkg'}]), 1);
  const archive = {...direct, provider: 'Archive.org', url: 'https://archive.org/download/a/b.pkg'};
  assert.equal(preferredRelease([{...archive, health: 'flaky'}, archive, {...archive, health: 'ok'}]), 2);
  assert.equal(preferredRelease([{...page, label: 'EUR 9.xx BackPort 4.xx - Mediafire'}, mediafire]), 1);
  assert.equal(preferredRelease([broken, gofile]), 1);
  assert.equal(preferredRelease([{...page, label: 'EUR 9.xx DLCs (EMU – Pippo) - Mediafire'}, mediafire]), 1);
  assert.equal(preferredRelease([{...page, label: 'USA 12.xx Game (v1.008.000)(DLC) - Mediafire'}, mediafire]), 0);
  assert.equal(preferredRelease([]), 0);
});

test('failover lists healthy copies the app reaches by itself, never browser or CAPTCHA hosts', () => {
  const copy = (provider, url, health) => ({provider, url, health, label: `USA Base - ${provider}`, format: 'binary', record: 'r',
    requiresBrowser: true, source: 'pegasus-0'});
  const releases = [copy('AkiraBox', 'https://akirabox.to/a/file'), copy('gofile.io', 'https://gofile.io/d/b'),
    copy('MediaFire', 'https://www.mediafire.com/file/c', 'flaky'), copy('VikingFile', 'https://vikingfile.com/f/d', 'ok'),
    copy('Archive.org', 'https://archive.org/download/e/f.pkg', 'ok')];
  assert.deepEqual(fallbacks(releases, 0).map(release => release.provider), ['Archive.org', 'MediaFire']);
});

test('add-on uploads get their own section and never stand in for the game', () => {
  const dlc = {...gofile, label: 'USA 12.xx DLC (@Pkykzhack) - Mediafire', url: 'https://www.mediafire.com/file/d', provider: 'MediaFire'};
  const bundle = {...dlc, label: 'USA 12.xx Game (v1.008.000)(DLC) - Mediafire'};
  assert.deepEqual(sourceSections([dlc, mediafire, bundle]).map(section => [section.group, section.items.map(item => item.index)]),
    [['page', [1, 2]], ['dlc', [0]]]);
  assert.equal(equivalent({...dlc, sizeBytes: 4e9}, {...bundle, label: dlc.label.replace('DLC', 'Base'), sizeBytes: 4e9}), false);
});

test('Archive.org leads the links the app reaches by itself, ahead of a healthier mirror', () => {
  const archive = {...direct, provider: 'Archive.org', url: 'https://archive.org/download/a/b.pkg', health: 'flaky'};
  const mirror = {...direct, provider: 'pippo26442999.github.io', url: 'https://pippo26442999.github.io/b.exfat', health: 'ok'};
  assert.equal(preferredRelease([mirror, archive]), 1);
  assert.equal(preferredRelease([{...gofile}, archive]), 1);
});
