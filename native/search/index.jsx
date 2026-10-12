// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';
import {View, Text, ScrollView, VirtualList, FocusScope, motion} from '@ps5-react/core';
import {SPAN_MAX, fitBytes, useLocale, useT} from '../i18n/index.js';
import {useNavActions} from '../state/nav.jsx';
import {useQuery, useStoreActions} from '../state/store.jsx';
import {GameCard, useFavoriteAction} from '../ui/GameCard.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';
import {Keyboard} from './Keyboard.jsx';
import {rememberSearch} from './history.js';
import {searchGames} from './match.js';
import {CARD_WIDTH, COLUMNS, NoResults, Suggestions} from './Suggestions.jsx';

// The cover is 4:3 tall, plus the 54 px caption.
const CARD_HEIGHT = Math.round(CARD_WIDTH * 4 / 3) + 54;
// The field follows every key; the grid, which remounts on a new query (about 20 ms of React on an
// M4), waits for a pause in typing. A query that jumps (a recent search, Clear) shows at once.
const SETTLE_MS = 150;
const blink = {duration: 0.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse'};

// The query is typed on a Latin keyboard, so it stays left to right; the row mirrors around it.
function QueryField({query}) {
  const t = useT();
  const {rtl} = useLocale();
  return (
    <View className="w-[376px] h-14 flex-row items-center rounded-full border border-white/20 bg-white/5 px-5">
      <Icon name="search" size={20} color={colors.subtle} />
      {query ? <Text style={{writingDirection: 'ltr'}} className={rtl ? 'mr-3 font-sans text-lg leading-6 text-fg' : 'ml-3 font-sans text-lg leading-6 text-fg'}>{query}</Text> : null}
      <motion.View className={`${query ? (rtl ? 'mr-0.5' : 'ml-0.5') : (rtl ? 'mr-3' : 'ml-3')} w-px h-5 bg-fg`} initial={{opacity: 1}} animate={{opacity: 0}} transition={blink} />
      {query ? null : <Text className={rtl ? 'mr-1 font-sans text-lg leading-6 text-subtle' : 'ml-1 font-sans text-lg leading-6 text-subtle'}>{t('search.placeholder')}</Text>}
    </View>
  );
}

function useSettled(query) {
  const [settled, setSettled] = useState(query);
  const typed = Math.abs(query.length - settled.length) === 1;
  useEffect(() => {
    const id = setTimeout(() => setSettled(query), typed ? SETTLE_MS : 0);
    return () => clearTimeout(id);
  }, [query]);
  return typed ? settled : query;
}

function Results({query, onOpenGame}) {
  const t = useT();
  const results = searchGames(query);
  if (!results.length) return <NoResults query={query.trim()} />;
  return (
    <>
      <Text className="mb-1 px-2 font-sans text-xl font-semibold tracking-tight text-fg">
        {fitBytes(t('search.resultsFor', {query: query.trim()}), SPAN_MAX)}
        <Text className="font-normal text-subtle">{fitBytes(`  ${t('catalog.gameCount', {count: results.length})}`, SPAN_MAX)}</Text>
      </Text>
      <ScrollView key={query} className="flex-1">
        <VirtualList className="px-2 pt-3 pb-8" data={results} numColumns={COLUMNS}
          itemHeight={CARD_HEIGHT} rowGap={16} columnGap={16} keyExtractor={game => game.id}
          renderItem={({item: game, index}) => (
            // Right stops at the row's end instead of falling through to the header.
            <GameCard game={game} width={CARD_WIDTH} onPress={() => onOpenGame(game)}
              rowEnd={index % COLUMNS === COLUMNS - 1 || index === results.length - 1} />
          )} />
      </ScrollView>
    </>
  );
}

/**
 * Search: an on-screen keyboard beside instant results, or, before typing, recent searches and
 * popular games. In the keyboard Square deletes and Triangle types a space; L2 clears, R2 searches (to
 * the results), Square on a result toggles its favorite; Circle goes back.
 */
export function SearchScreen({onBack, onOpenGame}) {
  const query = useQuery();
  const settled = useSettled(query);
  const {setQuery} = useStoreActions();
  const favorite = useFavoriteAction();
  const {focusLater} = useNavActions();
  const current = useRef(query);
  current.current = query;
  // Created once, so the memoized keyboard keeps equal props. A search counts as made once it is
  // submitted or one of its results opened.
  const [on] = useState(() => ({
    submit: () => {
      rememberSearch(current.current);
      focusLater('search-results');
    },
    search: term => {
      setQuery(term);
      focusLater('search-results');
    },
    openGame: game => {
      rememberSearch(current.current);
      onOpenGame(game);
    },
  }));
  // The query filters the library too; leaving Search must not leave home filtered by it.
  const back = () => {
    setQuery('');
    onBack();
    return true;
  };
  const onAction = action => {
    if (action === 'l2') setQuery('');
    else if (action === 'r2') on.submit();
    else return favorite(action);
    return true;
  };

  return (
    <FocusScope autoFocus onBack={back} onAction={onAction}>
      <View className="flex-1 flex-row gap-12 bg-canvas px-8 pt-8">
        <View className="gap-6">
          <QueryField query={query} />
          <Keyboard onChange={setQuery} onSubmit={on.submit} />
        </View>
        <View className="flex-1">
          <FocusScope focusKey="search-results">
            {settled.trim() ? <Results query={settled} onOpenGame={on.openGame} />
              : <Suggestions onSearch={on.search} onOpenGame={on.openGame} />}
          </FocusScope>
        </View>
      </View>
    </FocusScope>
  );
}
