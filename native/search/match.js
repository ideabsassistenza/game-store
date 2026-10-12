// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {games} from '../data/catalog.js';

// QuickJS ships String.prototype.normalize, so "pokemon" finds "Pokémon" as on the web store.
const fold = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const haystacks = games.map(game => fold(`${game.title} ${game.developer} ${game.publisher}`));

export function searchGames(query) {
  const needle = fold(query.trim());
  return needle ? games.filter((_, i) => haystacks[i].includes(needle)) : games;
}
