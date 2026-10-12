// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useMemo} from 'react';
import {View, Text, motion, tw, useIsFocused} from '@ps5-react/core';
import {Cover} from '../ui/Cover.jsx';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {Shine} from '../ui/Shine.jsx';
import {focusEnd, focusStart, latin, useLocale} from '../i18n/index.js';
import {SLIDE_MS} from './useSlides.js';
import {lightGame, unlight} from '../ui/lightBar.js';

// The progress track spans the item minus inset-x-2.5 on both sides.
const TRACK = 240;
const cover = tw`h-full aspect-[3/4] rounded-md`;

// Translating a full-width fill is cheaper than scaling it; a pause snaps it to where it is.
// Right to left, the fill comes in from the right.
function Progress({left, paused}) {
  const {rtl} = useLocale();
  const sign = rtl ? -1 : 1;
  const x = -TRACK * left / SLIDE_MS * sign;
  return (
    <View className="absolute inset-x-2.5 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
      <motion.View className="absolute inset-y-0 left-0 w-[240px] bg-fg"
        initial={{x: -TRACK * sign}} animate={{x: paused ? x : 0}}
        transition={paused ? {type: 'tween', duration: 0} : {type: 'tween', duration: left / 1000, ease: 'linear'}} />
    </View>
  );
}

function Title({title, active}) {
  const focused = useIsFocused();
  const {rtl} = useLocale();
  return (
    <Text selected={active || focused} className="w-[176px] font-sans text-sm text-muted line-clamp-2 selected:text-fg">
      {latin(rtl, title)}
    </Text>
  );
}

// Memoized with stable handlers: a slide change re-renders only the items whose `active` flips,
// and only the active one receives the progress values that tick with it.
const Item = memo(function Item({game, index, active, progress, select, hold}) {
  const {rtl} = useLocale();
  return (
    <View focusKey={`spotlight:${index}`} selected={active} nextFocusUp={index === 0 ? 'nav:current' : undefined}
      {...focusStart(rtl, 'spotlight:wish')} {...focusEnd(rtl, `spotlight:${index}`)}
      onFocus={() => {
        select(index);
        hold(true);
        lightGame(`spotlight:${index}`, game);
      }}
      onBlur={() => {
        hold(false);
        unlight(`spotlight:${index}`);
      }}
      onPress={() => select(index)}
      className="relative flex-1 flex-row items-center gap-3.5 rounded-xl p-2.5 selected:bg-surface">
      <Shine width={260} round="xl" />
      <FocusFrame round="xl" />
      <Cover game={game} style={cover} label={false} />
      <Title title={game.title} active={active} />
      {progress && <Progress left={progress.left} paused={progress.paused} />}
    </View>
  );
});

/**
 * The five featured games beside the spotlight; focusing one shows it and pauses the timer.
 * Left returns to the actions (the charts' links below are spatially closer); Right stays put,
 * and Up from the first one goes to the header's current section, like Up from the actions.
 */
export function SpotlightList({games, slides}) {
  const {active, left, paused, select, hold} = slides;
  const progress = useMemo(() => ({left, paused}), [left, paused]);
  return (
    <View className="w-[260px] gap-1">
      {games.map((game, index) => (
        <Item key={game.id} game={game} index={index} active={index === active}
          progress={index === active ? progress : null} select={select} hold={hold} />
      ))}
    </View>
  );
}
