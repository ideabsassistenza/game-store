// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichGame} from './metadata.mjs';

const game = {id: 'PPSA08772', title: 'Wo Long', platform: 'ps5', releases: [{url: 'https://example.com/game.zip'}],
  sizeGb: 52, images: {cover: 'https://example.com/cover.png', hero: 'https://example.com/hero.webp'},
  shortDescription: '', about: '', releaseDate: '2023-03-03', features: [], screenshots: [], genres: []};

test('official details repair incompatible art without changing downloads or console identity', () => {
  const enriched = enrichGame(game, {id: 'wrong', platform: 'ps4', releases: [], sizeGb: 1,
    shortDescription: 'A dark fantasy RPG.', about: 'Fight demons in the Three Kingdoms.',
    developer: 'Team NINJA', releaseDate: '2024-01-01', genres: ['RPG'],
    images: {cover: 'https://example.com/wrong.png', hero: 'https://example.com/background.jpg'},
    screenshots: ['https://example.com/shot.jpg', 'https://example.com/shot.webp']});
  assert.equal(enriched.id, game.id);
  assert.equal(enriched.platform, game.platform);
  assert.equal(enriched.releases, game.releases);
  assert.equal(enriched.sizeGb, game.sizeGb);
  assert.equal(enriched.releaseDate, game.releaseDate);
  assert.equal(enriched.images.cover, game.images.cover);
  assert.equal(enriched.images.hero, 'https://example.com/background.jpg');
  assert.equal(enriched.developer, 'Team NINJA');
  assert.deepEqual(enriched.screenshots, ['https://example.com/shot.jpg']);
});

test('missing enrichment preserves useful descriptions and supported existing images', () => {
  const original = {...game, shortDescription: 'A game.', about: 'Full description.',
    images: {...game.images, hero: 'https://example.com/good.jpg'}};
  const enriched = enrichGame(original);
  assert.equal(enriched.about, original.about);
  assert.equal(enriched.images.hero, original.images.hero);
});

test('provider notes never appear as a game description and unrenderable art is dropped', () => {
  const enriched = enrichGame({...game, shortDescription: 'Region: EUR\nPassword: ABC', about: 'Contributor: Someone'});
  assert.equal(enriched.shortDescription, '');
  assert.equal(enriched.about, '');
  assert.equal(enriched.images.hero, null);
});
