// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, tw} from '@ps5-react/core';
import {latin, useLocale, useT} from '../i18n/index.js';
import {formatCount, formatDate, games, NO_FILTERS, showcase, sortGames, sortLabel} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {useStoreActions} from '../state/store.jsx';
import {prefetchWhenSettled} from '../game/art.js';
import {Cover} from '../ui/Cover.jsx';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {SectionHeader} from '../ui/SectionHeader.jsx';
import {lightGame, unlight} from '../ui/lightBar.js';

// The source adds a fourth list (largest installs) only on screens wider than 100rem; 80rem here.
const CHARTS = ['relevance', 'newest', 'rating'].map(id => ({id, games: showcase(sortGames(games, id), 5)}));
// The supporting line shows the value the list is sorted by.
const DETAIL = {
  relevance: (t, game) => t('browse.reviews', {count: formatCount(game.recommendations)}),
  newest: (t, game) => formatDate(game.releaseDate),
};
const thumb = tw`w-11 h-[58px] rounded-md`;

function Detail({chart, game}) {
  const t = useT();
  if (chart !== 'rating') return <Text className="mt-1 font-sans text-[14px] text-muted">{DETAIL[chart](t, game)}</Text>;
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <View className="rounded-sm bg-fg px-1.5">
        <Text className="font-sans text-sm font-bold text-canvas">{String(game.metacritic ?? '—')}</Text>
      </View>
      <Text className="font-sans text-[14px] text-muted">Metacritic</Text>
    </View>
  );
}

function Row({rank, game, chart}) {
  const {rtl} = useLocale();
  return (
    <>
      <FocusFrame />
      <Text className="w-3 font-sans text-sm text-subtle">{String(rank)}</Text>
      <Cover game={game} style={thumb} label={false} />
      <View className="flex-1">
        <Text className="w-[296px] font-sans text-sm text-fg truncate">{latin(rtl, game.title)}</Text>
        <Detail chart={chart} game={game} />
      </View>
    </>
  );
}

/** Editorial top-5 columns, like the console library's "New releases / Most played" bands. */
export function TopCharts() {
  useT();
  const {openGame, focusLater} = useNavActions();
  const {setFilters, setQuery, setSort} = useStoreActions();
  const seeAll = id => {
    setFilters(NO_FILTERS);
    setQuery('');
    setSort(id);
    focusLater('catalog:sort');
  };
  // The rail above reserves caption lines its titles may not fill, and the last row's focus padding sits
  // under its text: they added 7 and 12 px of black around the charts that no other section has.
  return (
    <View scrollAnchor className="-mb-3 -mt-2 flex-row gap-8">
      {CHARTS.map(chart => (
        <View key={chart.id} className="flex-1">
          <SectionHeader title={sortLabel(chart.id)} onSeeAll={() => seeAll(chart.id)} />
          {chart.games.map((game, index) => {
            const key = `chart:${chart.id}:${game.id}`;
            return (
              <View key={game.id} focusKey={key} onPress={() => openGame(game.id, key)}
                onFocus={() => {
                  prefetchWhenSettled(game);
                  lightGame(key, game);
                }}
                onBlur={() => unlight(key)}
                className="relative -mx-2 flex-row items-center gap-3.5 rounded-lg p-2 focused:bg-surface">
                <Row rank={index + 1} game={game} chart={chart.id} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
