// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, Text, Image, VirtualList, FocusScope, useIsFocused} from '@ps5-react/core';
import {SPAN_MAX, fitBytes, useLocale, useT} from '../i18n/index.js';
import {activeCount, filterGames, sortGames} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {useStore} from '../state/store.jsx';
import {ButtonGlyph} from '../ui/ButtonHints.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {GameCard, DETAILED_CAPTION} from '../ui/GameCard.jsx';
import {px} from '../ui/scale.js';
import {ActiveFilters} from './ActiveFilters.jsx';
import {EmptyState} from './EmptyState.jsx';
import {SortSelect} from './SortSelect.jsx';

const STAGGER = 0.03;
// Cards load in batches of eight rows as focus nears the end; only the rows around the viewport stay
// mounted, so the whole library scrolls without paging. Six 182 px cards and five 24 px gaps fill the
// page's 1216 px.
const COLUMNS = 6;
const BATCH = COLUMNS * 8;
const CARD_WIDTH = 182;
// The 243 px cover plus the caption.
const CARD_HEIGHT = 243 + DETAILED_CAPTION;
// A new grid (an L1/R1 section, a sort, a filter) fills its first three rows three cards a frame:
// mounting eighteen in one commit took 25–40 ms of React on an M4, three times that on the PS5.
const FIRST = COLUMNS * 3;
const STEP = 3;

// Focus resting on a row fetches the covers two to four rows below it, past the rows the list mounts
// ahead, so the next steps down find them decoded. A held Down prefetches nothing: every row it passed
// queued eighteen covers, and the network served them while the covers on screen waited.
const AHEAD = [2, 5];
const SETTLE_MS = 200;
const fetched = new Set();
let settle = null;
const coverBox = {width: px(CARD_WIDTH), height: px(Math.round(CARD_WIDTH * 4 / 3)), resizeMode: 'cover'};
function prefetchBelow(games, index) {
  clearTimeout(settle);
  settle = setTimeout(() => prefetchRows(games, index), SETTLE_MS);
}
function prefetchRows(games, index) {
  const row = Math.floor(index / COLUMNS);
  for (const game of games.slice((row + AHEAD[0]) * COLUMNS, (row + AHEAD[1]) * COLUMNS)) {
    if (!game.art.cover || fetched.has(game.id)) continue;
    fetched.add(game.id);
    Image.prefetch(game.art.cover, coverBox).catch(() => fetched.delete(game.id));
  }
}

const sameGrid = (a, b) => a.signature === b.signature && a.enter === b.enter
  && a.games.length === b.games.length && a.games.every((game, i) => game === b.games[i]);

// Memoized on the games it shows: a wishlist toggle elsewhere re-renders the catalog, not its cards.
// Only the cards of its first rows play the entrance; rows mounted while scrolling appear at rest.
const Grid = memo(function Grid({games, enter}) {
  const {openGame} = useNavActions();
  const [limit, setLimit] = useState(BATCH);
  const [filled, setFilled] = useState(STEP);
  const entering = useRef(enter);
  useEffect(() => {
    if (filled >= FIRST) {
      entering.current = false;
      return undefined;
    }
    const id = setTimeout(() => setFilled(count => count + STEP), 0);
    return () => clearTimeout(id);
  }, [filled]);
  // Stable, so loading the next batch re-renders only the rows it adds. Right from the last column
  // stays put: the nearest element to the right was a genre card scrolled off the rail far above.
  const all = useRef(games);
  all.current = games;
  const renderItem = useCallback(({item: game, index}) => (
    <GameCard game={game} width={CARD_WIDTH} detailed rowEnd={index % COLUMNS === COLUMNS - 1}
      enterDelay={entering.current ? index * STAGGER : undefined}
      onFocus={() => prefetchBelow(all.current, index)} onPress={() => openGame(game.id, `card:${game.id}`)} />
  ), [openGame]);
  return (
    <VirtualList className="mt-6" data={games.slice(0, filled < FIRST ? filled : limit)} numColumns={COLUMNS}
      itemHeight={CARD_HEIGHT}
      rowGap={40} columnGap={24} initialNumRows={3} keyExtractor={game => game.id}
      onEndReached={() => setLimit(count => count + BATCH)} renderItem={renderItem} />
  );
}, sameGrid);

function FiltersLabel({count}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <Text focused={focused} className="font-sans text-sm text-fg/85 focused:text-fg">{t('filters.title')}</Text>
      {count > 0 && (
        <View className="h-5 min-w-5 items-center justify-center rounded-full bg-fg px-1.5">
          <Text className="font-sans text-xs font-semibold text-canvas">{String(count)}</Text>
        </View>
      )}
      <ButtonGlyph button="triangle" size={18} />
    </>
  );
}

/**
 * The library grid across the page. Filters live in a drawer: the Filters button or Triangle
 * anywhere in the catalog opens it. Entering the catalog from above lands on the nearest control,
 * never on the card focused last time, which may be far down the list.
 */
export function Catalog({onOpenFilters}) {
  const t = useT();
  const {rtl} = useLocale();
  const store = useStore();
  const {filters, query} = store;
  // Filtering and sorting copy the library; only the inputs they read change the result.
  const results = useMemo(() => sortGames(filterGames(store), store.sort),
    [filters, query, store.wishlist, store.sort]);
  // After the first render, a new filter, query or sort remounts the grid and its cards play the
  // source's entrance, staggered; the first render shows the grid at rest.
  const settled = useRef(false);
  useEffect(() => { settled.current = true; }, []);
  const signature = JSON.stringify([filters, query, store.sort]);
  const title = query ? t('catalog.resultsFor', {query}) : filters.wishlist ? t('catalog.favorites') : t('catalog.library');
  const filtersCount = activeCount(filters) - Number(filters.wishlist);
  const onAction = action => {
    if (action !== 'triangle' && action !== 'options') return false;
    onOpenFilters();
    return true;
  };

  return (
    <FocusScope restoreFocus={false} onAction={onAction}>
      <View scrollAnchor>
        <Text className="font-sans text-xl font-semibold tracking-tight text-fg">
          {fitBytes(title, SPAN_MAX)}
          <Text className="font-normal text-subtle">{fitBytes(`  ${t('catalog.gameCount', {count: results.length})}`, SPAN_MAX)}</Text>
        </Text>
        {/* The controls start at the left edge, above the first column: Up from the grid reaches them
            without pulling focus to the right, and Up again continues straight up the page. */}
        <View className="z-10 mt-4 flex-row flex-wrap items-center gap-2">
          <View focusKey="catalog:filters" onPress={onOpenFilters}
            className={`h-10 flex-row items-center gap-2 rounded-full bg-surface ${rtl ? 'pr-4 pl-3' : 'pl-4 pr-3'} focused:bg-surface-3`}>
            <FiltersLabel count={filtersCount} />
          </View>
          <SortSelect />
          <ActiveFilters />
        </View>
        {results.length > 0 ? (
          <Grid key={signature} games={results} signature={signature} enter={settled.current} />
        ) : (
          <EmptyState query={query} onlyWishlist={filters.wishlist && activeCount(filters) === 1}
            onClear={store.clearFilters} />
        )}
      </View>
    </FocusScope>
  );
}
