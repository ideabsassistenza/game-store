// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {View, ScrollView} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {games, genres} from '../state/catalog.js';
import {useStoreActions, useStoreState} from '../state/store.jsx';
import {SectionHeader} from '../ui/SectionHeader.jsx';
import {GenreCard} from './GenreCard.jsx';

// Each genre picks covers not shown by the genres before it, so the rail does not repeat a game.
// Genres with fewer games than a card has covers stay in the filters only.
const used = new Set();
const RAIL = genres
  .map(genre => ({genre, matches: games.filter(game => game.genres.includes(genre))
    .sort((a, b) => b.recommendations - a.recommendations)}))
  .filter(({matches}) => matches.length >= 3)
  .sort((a, b) => b.matches.length - a.matches.length)
  .map(({genre, matches}) => {
    const covers = [...matches.filter(game => !used.has(game.id)), ...matches.filter(game => used.has(game.id))]
      .slice(0, 3);
    covers.forEach(game => used.add(game.id));
    return {genre, count: matches.length, covers};
  });

/** Popular genres as a horizontal rail; choosing one only filters the grid, so focus stays put. */
export function GenreRail() {
  const t = useT();
  const {filters} = useStoreState();
  const {toggleFilter} = useStoreActions();
  const [toggleGenre] = useState(() => genre => toggleFilter('genre', genre));
  return (
    <View scrollAnchor>
      <SectionHeader title={t('browse.popularGenres')} />
      <View className="relative -mx-1.5 -my-5">
        {/* Left to right in every language: a row ScrollView scrolls only toward the right. */}
        <ScrollView className="flex-row gap-3 px-1.5 py-5" style={{direction: 'ltr'}}>
          {RAIL.map(({genre, count, covers}) => (
            <GenreCard key={genre} genre={genre} count={count} covers={covers}
              active={filters.genre.includes(genre)} onToggle={toggleGenre} />
          ))}
        </ScrollView>
        {/* The rail continues past the screen: the source masks its right edge, a canvas fade does it here. */}
        <View className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-canvas" />
      </View>
    </View>
  );
}
