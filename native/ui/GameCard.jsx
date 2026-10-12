// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';
import {View, Text, motion, transitions, useIsFocused} from '@ps5-react/core';
import {prefetchWhenSettled} from '../game/art.js';
import {focusEnd, latin, useLocale} from '../i18n/index.js';
import {formatSize, genreLabel, onCdn} from '../state/catalog.js';
import {useStoreActions, useWishlist} from '../state/store.jsx';
import {CdnMark} from './CdnAura.jsx';
import {Cover} from './Cover.jsx';
import {CardFocus} from './CardFocus.jsx';
import {Icon} from './Icon.jsx';
import {EASE_OUT} from './ease.js';
import {colors} from './colors.js';
import {canScale, px} from './scale.js';
import {lightGame, unlight} from './lightBar.js';

const focusMotion = {type: 'tween', duration: 0.3, ease: EASE_OUT};
// Title and genre lines under the cover, in logical px.
const CAPTION = 54;
/** The detailed card's caption: genre, two title lines and the score row, in logical px. */
export const DETAILED_CAPTION = 96;
const press = {scale: 0.95};
// Focus lifts the cover 6 px and leaves the caption, as the landing page's card does. A lift rather than
// a scale: under a scale, every step of the edge light re-rendered the whole card.
const rest = {y: 0}, lift = {y: -6};

// The focused card, `{game, key}`, for shortcuts that an enclosing scope handles (Square toggles the
// favorite): a focus subscription would re-render the page on every move. A card that unmounts while
// focused (a regrid on L1/R1, a favorite removed from Favorites) gets no blur, so it clears this and
// its light itself; per card, since two rows can show the same game.
let focusedCard = null;

/**
 * A scope's `onAction` for Square: favorites the focused card's game, or `fallback` when no card has
 * focus, and returns whether it did.
 */
export function useFavoriteAction(fallback = null) {
  const {toggleWish} = useStoreActions();
  return action => {
    const game = action === 'square' && (focusedCard?.game ?? fallback);
    if (!game) return false;
    toggleWish(game.id);
    return true;
  };
}

// A favorite's heart on the cover. Only a favorite added while the card is mounted pops; cards
// mounting already favorited (rows scrolled in) show it at rest.
function WishBadge({id}) {
  const wished = useWishlist().includes(id);
  const added = useRef(0);
  const last = useRef(wished);
  if (wished && !last.current) added.current += 1;
  last.current = wished;
  if (!wished) return null;
  return (
    <View className="absolute right-2 top-2 size-7 items-center justify-center rounded-full bg-canvas/75">
      <motion.View key={added.current} initial={added.current ? {scale: 1.7} : false} animate={{scale: 1}}
        transition={transitions.pop}>
        <Icon name="heart" size={14} color={colors.fg} fill={colors.fg} />
      </motion.View>
    </View>
  );
}

// Styles per card width, shared by every card of that width instead of rebuilt for each.
const boxes = new Map();
function boxOf(width, detailed) {
  const id = detailed ? -width : width;
  if (!boxes.has(id)) {
    const height = Math.round(width * 4 / 3);
    boxes.set(id, {height, card: {width: px(width)}, tile: {height: px(height)}, text: {width: px(width)},
      cover: {width: px(width), height: px(height), borderRadius: px(8)}});
  }
  return boxes.get(id);
}

// The detailed card's caption, like the Epic store's: main genre, the title on up to two lines and
// the Metacritic score with the download size. Its height is fixed, so a row's cards line up and a
// grid's itemHeight is exact.
function Details({game, focused, box}) {
  const {rtl} = useLocale();
  return (
    <View className="h-[96px] pt-2.5" style={box.text}>
      <Text className="font-sans text-[13px] leading-4 text-subtle truncate">{game.genres[0] ? genreLabel(game.genres[0]) : game.platform.toUpperCase()}</Text>
      <Text focused={focused}
        className="mt-1 h-10 pr-1 font-sans text-[15px] font-semibold leading-5 text-fg/90 line-clamp-2 focused:text-fg">
        {latin(rtl, game.title)}
      </Text>
      <View className="mt-1.5 h-5 flex-row items-center gap-2">
        {game.metacritic != null && (
          <View className="rounded-sm bg-fg px-1.5">
            <Text className="font-sans text-[13px] font-bold leading-4 text-canvas">{String(game.metacritic)}</Text>
          </View>
        )}
        {game.sizeGb != null && <Text className="font-sans text-[13px] text-muted">{formatSize(game.sizeGb)}</Text>}
      </View>
    </View>
  );
}

// One focus subscription for the whole card: the glare and the edge light mount only on the focused
// card, and the title brightens. Each component with hooks a card carries unfocused costs heap for
// every card mounted while scrolling.
function Body({game, width, caption, detailed}) {
  const {rtl} = useLocale();
  const focused = useIsFocused();
  const box = boxOf(width, detailed);
  return (
    <>
      <motion.View className="rounded-lg bg-surface" style={box.tile} initial={false} animate={focused ? lift : rest}
        transition={focusMotion}>
        <Cover game={game} style={box.cover} />
        <WishBadge id={game.id} />
        {onCdn(game) ? <CdnMark /> : null}
        <CardFocus focused={focused} width={width} height={box.height} platforms={game.platforms} />
      </motion.View>
      {caption ?? (detailed ? <Details game={game} focused={focused} box={box} /> : (
        <>
          <Text focused={focused} style={box.text}
            className="mt-3 font-sans text-[15px] text-fg/85 truncate focused:text-fg">{latin(rtl, game.title)}</Text>
          <Text style={box.text} className="mt-0.5 font-sans text-[14px] text-subtle truncate">
            {game.genres.slice(0, 2).map(genreLabel).join(' · ')}
          </Text>
        </>
      ))}
    </>
  );
}

/**
 * Library card: the cover carries it, title and two genres identify the game. Width in logical px.
 * `enterDelay` (seconds) plays the grid entrance after that delay: a fade only. The source also grows
 * cards from 94%; fading and scaling twelve cards together measured 51–55 fps, either alone 59.5.
 * `caption` replaces the title and genres under the cover. `rowEnd` keeps Right (Left right to
 * left) on the card, for the last one of a row. `detailed` is the browse page's card, with the genre
 * (or the platform), a two-line title and the score and size. `onFocus` runs after the card's own
 * focus handling.
 */
export function GameCard({game, onPress, width = 150, focusKey = `card:${game.id}`, rowEnd, enterDelay, caption,
  detailed, onFocus, ...rest}) {
  const {rtl} = useLocale();
  const box = boxOf(width, detailed);
  const scales = canScale(width, box.height + (detailed ? DETAILED_CAPTION : CAPTION));
  const [entering, setEntering] = useState(enterDelay != null);
  const card = useRef({}).current;
  card.game = game;
  card.key = focusKey;
  useEffect(() => () => {
    if (focusedCard !== card) return;
    focusedCard = null;
    unlight(card.key);
  }, []);
  const entrance = entering && {
    initial: {opacity: 0}, animate: {opacity: 1},
    transition: {...focusMotion, duration: 0.4, delay: enterDelay}, onAnimationComplete: () => setEntering(false),
  };
  return (
    <motion.View {...focusEnd(rtl, rowEnd ? focusKey : undefined)} {...rest} focusKey={focusKey} onPress={onPress}
      onFocus={() => {
        focusedCard = card;
        prefetchWhenSettled(game);
        lightGame(focusKey, game);
        onFocus?.();
      }}
      onBlur={() => {
        if (focusedCard === card) focusedCard = null;
        unlight(focusKey);
      }}
      whilePress={scales ? press : undefined}
      transition={focusMotion} {...entrance} style={box.card}>
      <Body game={game} width={width} caption={caption} detailed={detailed} />
    </motion.View>
  );
}
