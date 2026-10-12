// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, motion, tw, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {genreLabel} from '../state/catalog.js';
import {Cover} from '../ui/Cover.jsx';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {Shine} from '../ui/Shine.jsx';
import {Icon} from '../ui/Icon.jsx';
import {EASE_OUT} from '../ui/ease.js';
import {colors} from '../ui/colors.js';

const spread = {type: 'tween', duration: 0.3, ease: EASE_OUT};
const cover = tw`w-[84px] h-28 rounded-lg`;
const side = tw`w-[75.6px] h-[100.8px] rounded-lg`;
const front = tw`absolute left-[58px] top-4 z-10`;
// Side covers sit 110% of a cover width off centre at 90% size and open to 125% on focus. They are
// drawn at 90% rather than scaled, so they never go through the transform buffer; only x animates.
// Covers are positioned in the card's 16 px padding, whose top is reserved for them.
const OPEN = [-12.6, 12.6];

function Fan({covers}) {
  const focused = useIsFocused();
  return covers.slice(1).map((game, index) => (
    <motion.View key={game.id} className={index === 0 ? 'absolute left-[11.8px] top-[21.6px]' : 'absolute left-[112.6px] top-[21.6px]'}
      initial={false} animate={{x: focused ? OPEN[index] : 0}} transition={spread}>
      <Cover game={game} style={side} label={false} />
    </motion.View>
  ));
}

/** A genre tile with three fanned covers; Cross toggles the genre filter. Memoized per genre. */
export const GenreCard = memo(function GenreCard({genre, count, covers, active, onToggle}) {
  const t = useT();
  return (
    <motion.View focusKey={`genre:${genre}`} onPress={() => onToggle(genre)} selected={active}
      whileFocus={{y: -6}} transition={spread}
      className="w-[200px] rounded-xl bg-surface px-4 pb-4 pt-[144px] selected:bg-surface-2 focused:bg-surface-2">
      <Fan covers={covers} />
      {covers[0] && <Cover game={covers[0]} style={[cover, front]} label={false} />}
      {active && (
        <View className="absolute right-3 top-3 z-20 size-6 items-center justify-center rounded-full bg-fg">
          <Icon name="check" size={14} strokeWidth={3} color={colors.canvas} />
        </View>
      )}
      <Text className="font-sans text-base text-fg">{genreLabel(genre)}</Text>
      <Text className="font-sans text-sm text-subtle">{t('catalog.gameCount', {count})}</Text>
      <Shine width={200} round="xl" />
      <FocusFrame round="xl" />
    </motion.View>
  );
});
