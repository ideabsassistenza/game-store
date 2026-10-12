// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useRef} from 'react';
import {useT} from '../i18n/index.js';
import {getGame, listedId} from '../state/catalog.js';
import {useNavActions, useNavState} from '../state/nav.jsx';
import {useRecent} from '../state/recent.js';
import {GameCard} from '../ui/GameCard.jsx';
import {GameRail} from './GameRail.jsx';

/**
 * The last games opened, newest first; absent until one has been. The order holds while another
 * screen covers the page, so the row reorders once, on the way back, not under the game page.
 */
export function RecentRow() {
  return <Recent shown={useNavState().top.name === 'browse'} />;
}

// Memoized on `shown`: every navigation changes the nav state, an L1/R1 section included.
const Recent = memo(function Recent({shown}) {
  const t = useT();
  const recent = useRecent();
  const kept = useRef(recent);
  if (shown) kept.current = recent;
  const {openGame} = useNavActions();
  const games = [...new Set(kept.current.map(listedId))].map(getGame).filter(Boolean);
  if (!games.length) return null;
  return (
    <GameRail title={t('browse.recentlyViewed')}>
      {games.map((game, index) => {
        const key = `recent:${game.id}`;
        // Right from the last card stays put rather than finding the spotlight list off to the right.
        return (
          <GameCard key={game.id} game={game} width={152} detailed focusKey={key} rowEnd={index === games.length - 1}
            onPress={() => openGame(game.id, key)} />
        );
      })}
    </GameRail>
  );
});
