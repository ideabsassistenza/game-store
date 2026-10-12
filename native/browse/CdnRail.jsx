// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, Image, motion, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {CDN_HOST, NO_FILTERS, games, onCdn, sortGames} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {useStoreActions} from '../state/store.jsx';
import {colors} from '../ui/colors.js';
import {EASE_OUT} from '../ui/ease.js';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {GameCard, DETAILED_CAPTION} from '../ui/GameCard.jsx';
import {Icon} from '../ui/Icon.jsx';
import {px} from '../ui/scale.js';
import {GameRail} from './GameRail.jsx';
import art from '../assets/cdn-card.png';

// The rail's cards are Popular now's. The collection card spans two of them and the gap between, with a
// cover's height, so its art, caption and lift line up with the games beside it.
const WIDTH = 152;
const TILE = {width: px(WIDTH * 2 + 24), height: px(Math.round(WIDTH * 4 / 3)), borderRadius: px(8)};
const CAPTION = {width: px(WIDTH * 2 + 24), height: px(DETAILED_CAPTION)};
const SERVED = sortGames(games.filter(onCdn), 'relevance');
const lift = {type: 'tween', duration: 0.3, ease: EASE_OUT};

// The art carries the collection's name; the caption follows a game card's: a detail line, the title and
// a last line, here the way in.
function CollectionCard() {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <motion.View className="relative" style={TILE} initial={false} animate={{y: focused ? -6 : 0}} transition={lift}>
        <Image source={art} resizeMode="cover" style={TILE} />
        <FocusFrame round="lg" />
      </motion.View>
      <View className="pt-2.5" style={CAPTION}>
        <Text className="font-sans text-[13px] leading-4 text-subtle">{t('catalog.gameCount', {count: SERVED.length})}</Text>
        <Text focused={focused} className="mt-1 font-sans text-[15px] font-semibold leading-5 text-fg/90 focused:text-fg">Overdrive CDN</Text>
        <View className="mt-1.5 flex-row items-center gap-1">
          <Text focused={focused} className="font-sans text-[13px] text-muted focused:text-fg">{t('common.seeAll')}</Text>
          <Icon name="chevronRight" size={14} color={focused ? colors.fg : colors.muted} />
        </View>
      </View>
    </>
  );
}

/**
 * Overdrive CDN as a store collection: its card, then the games it serves. The card, the rail's title and
 * See all all open the catalog filtered to those games. Until it serves one, the home leaves it out.
 */
export const CdnRail = memo(function CdnRail() {
  const {openGame, focusLater} = useNavActions();
  const {setFilters, setQuery} = useStoreActions();
  if (!SERVED.length) return null;
  const browse = () => {
    setFilters({...NO_FILTERS, provider: [CDN_HOST]});
    setQuery('');
    focusLater('catalog:filters');
  };
  return (
    <GameRail title="Overdrive CDN" onSeeAll={browse} seeAllKey="cdn:all">
      <View focusKey="cdn:card" onPress={browse}>
        <CollectionCard />
      </View>
      {SERVED.map((game, index) => {
        const key = `cdn:${game.id}`;
        return (
          <GameCard key={game.id} game={game} width={WIDTH} detailed focusKey={key} rowEnd={index === SERVED.length - 1}
            onPress={() => openGame(game.id, key)} />
        );
      })}
    </GameRail>
  );
});
