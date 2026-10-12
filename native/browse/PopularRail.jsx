// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {useT} from '../i18n/index.js';
import {NO_FILTERS, games, showcase, sortGames} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {useStoreActions} from '../state/store.jsx';
import {GameCard} from '../ui/GameCard.jsx';
import {GameRail} from './GameRail.jsx';

// Seven cards fill the page's 1216 px with six 24 px gaps.
const WIDTH = 152;
const POPULAR = showcase(sortGames(games, 'relevance'), 15);
/** The rail's first card, where Down from the spotlight's actions lands rather than on its title link. */
export const FIRST_POPULAR = `popular:${POPULAR[0].id}`;

/** The most recommended games, in detailed cards right under the spotlight; the title opens them all. */
export const PopularRail = memo(function PopularRail() {
  const t = useT();
  const {openGame, focusLater} = useNavActions();
  const {setFilters, setQuery, setSort} = useStoreActions();
  const seeAll = () => {
    setFilters(NO_FILTERS);
    setQuery('');
    setSort('relevance');
    focusLater('catalog:sort');
  };
  return (
    <GameRail title={t('browse.popularNow')} onSeeAll={seeAll} seeAllKey="popular:all">
      {POPULAR.map((game, index) => {
        const key = `popular:${game.id}`;
        return (
          <GameCard key={game.id} game={game} width={WIDTH} detailed focusKey={key} rowEnd={index === POPULAR.length - 1}
            onPress={() => openGame(game.id, key)} />
        );
      })}
    </GameRail>
  );
});
