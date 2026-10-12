// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, ScrollView, FocusScope, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {NO_FILTERS, games, genreLabel} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {GameCard} from '../ui/GameCard.jsx';
import {Icon} from '../ui/Icon.jsx';
import {HINT, useHints} from '../ui/Legend.jsx';
import {colors} from '../ui/colors.js';
import {useShowLibrary} from '../ui/useSections.js';
import {forgetSearch, useSearchHistory} from './history.js';

// Four columns beside the keyboard: 4 × 182 px plus the gaps and an 8 px inset fill the 792 px column.
// The inset keeps a focused card's lift and ring inside the scroll view, which clips them.
export const CARD_WIDTH = 182;
export const COLUMNS = 4;
const POPULAR = [...games].sort((a, b) => b.recommendations - a.recommendations).slice(0, 2 * COLUMNS);
const GENRES = Object.entries(games.flatMap(game => game.genres)
  .reduce((counts, genre) => ({...counts, [genre]: (counts[genre] ?? 0) + 1}), {}))
  .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre]) => genre);
const RECENT_HINTS = [{button: 'cross', label: 'hints.search'}, {button: 'square', label: 'hints.remove'}, HINT.clear, HINT.back];

function PillFace({label, icon, hints}) {
  const focused = useIsFocused();
  useHints(focused ? hints : null);
  return (
    <>
      <FocusRing round="full" />
      <Icon name={icon} size={18} color={focused ? colors.fg : colors.muted} />
      <Text className="font-sans text-base text-fg">{label}</Text>
    </>
  );
}

function Pill({label, icon, hints, onPress, onAction}) {
  return (
    <FocusScope onAction={onAction}>
      <View onPress={onPress}
        className="h-12 flex-row items-center gap-2 rounded-full bg-surface px-5 focused:bg-surface-2">
        <PillFace label={label} icon={icon} hints={hints} />
      </View>
    </FocusScope>
  );
}

const Title = ({children}) => <Text className="mb-4 font-sans text-xl font-semibold tracking-tight text-fg">{children}</Text>;

/** Before typing: the recent searches (Cross repeats one, Square removes it) and the most popular games. */
export function Suggestions({onSearch, onOpenGame}) {
  const t = useT();
  const recent = useSearchHistory();
  const {focusLater} = useNavActions();
  return (
    <ScrollView className="flex-1 px-2">
      {recent.length > 0 ? (
        <View className="mb-10">
          <Title>{t('search.recent')}</Title>
          <View className="flex-row flex-wrap gap-3">
            {recent.map(term => (
              <Pill key={term} label={term} icon="search" hints={RECENT_HINTS} onPress={() => onSearch(term)}
                onAction={action => {
                  if (action !== 'square') return false;
                  forgetSearch(term);
                  // Stay in the list (the next search, or the popular games) rather than the keyboard.
                  focusLater('search-results');
                  return true;
                }} />
            ))}
          </View>
        </View>
      ) : null}
      <Title>{t('search.popular')}</Title>
      <View className="flex-row flex-wrap gap-4 pb-8">
        {POPULAR.map((game, index) => (
          <GameCard key={game.id} game={game} width={CARD_WIDTH} onPress={() => onOpenGame(game)}
            rowEnd={index % COLUMNS === COLUMNS - 1} />
        ))}
      </View>
    </ScrollView>
  );
}

/** No match: say so, and offer the biggest genres, which open the library filtered by one. */
export function NoResults({query}) {
  const t = useT();
  const showLibrary = useShowLibrary();
  return (
    <View className="flex-1 items-center justify-center gap-3 pb-24">
      <Icon name="searchX" size={32} color={colors.subtle} />
      <Text className="w-[600px] font-sans text-lg font-semibold text-fg text-center truncate">{t('search.noMatch', {query})}</Text>
      <Text className="font-sans text-base text-muted">{t('search.tryGenre')}</Text>
      <View className="mt-4 w-[640px] flex-row flex-wrap justify-center gap-3">
        {GENRES.map(genre => (
          <Pill key={genre} label={genreLabel(genre)} icon="chevronRight"
            onPress={() => showLibrary({...NO_FILTERS, genre: [genre]}, 'relevance')} />
        ))}
      </View>
    </View>
  );
}
