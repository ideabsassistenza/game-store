// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useEffect, useRef, useState} from 'react';
import {View, Text, Image, AnimatePresence, motion, tw} from '@ps5-react/core';
import {LATIN_IN_RTL, focusEnd, useLocale, useT} from '../i18n/index.js';
import {fromArchive, games, genreLabel, sortGames, summaryOf} from '../state/catalog.js';
import {useNavActions, useNavState} from '../state/nav.jsx';
import {useStoreActions, useWishlist} from '../state/store.jsx';
import {Button} from '../ui/Button.jsx';
import {GameLogo, logoStyle} from '../ui/GameLogo.jsx';
import {WishHeart} from '../ui/WishHeart.jsx';
import {EASE_OUT} from '../ui/ease.js';
import {FIRST_POPULAR} from './PopularRail.jsx';
import {SpotlightList} from './SpotlightList.jsx';
import {useSlides} from './useSlides.js';


// The engine has no Date objects: "new" is among the catalog's latest releases instead of a date window.
const NEWEST = 150;

const shuffle = list => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

// Drawn once per launch from games with a logo that Archive.org serves: three of the 20 most
// recommended and two of the 10 most recommended among the latest releases, so the slides mix the
// famous with the new.
function selectFeatured() {
  const eligible = games.filter(game => game.art.logo && fromArchive(game));
  const pool = eligible.length >= 5 ? eligible : games.filter(game => game.art.logo);
  const byFame = [...pool].sort((a, b) => b.recommendations - a.recommendations);
  const latest = new Set(sortGames(games, 'newest').slice(0, NEWEST));
  const recent = shuffle(byFame.filter(game => latest.has(game)).slice(0, 10)).slice(0, 2);
  const famous = shuffle(byFame.filter(game => !recent.includes(game)).slice(0, 20)).slice(0, 5 - recent.length);
  return shuffle([...famous, ...recent]);
}

const featured = selectFeatured();

const ART = tw`w-[940px] h-[440px]`;
const LOGO = [320, 112, 48 * 256];

// After the visible art has had a head start, every slide's art and logo load, so a slide change
// never waits on the network.
function prefetchSlides() {
  for (const game of featured) {
    if (game.art.hero) Image.prefetch(game.art.hero, ART).catch(() => {});
    if (game.art.logo) Image.prefetch(game.art.logo, {...logoStyle(game, ...LOGO), resizeMode: 'contain'}).catch(() => {});
  }
}

// The art cuts. A crossfade at 1080p (new art fading in over the old for 0.75 s) still repaints the
// 940 × 440 band every frame: 16–22 ms of raster, 51–52 fps windows. The cut follows the rest of the
// slide change by a frame: together they took one 24 ms frame on the PS5 (4 ms of JS, 19 ms of
// raster), apart each fits in one.
function Art({game}) {
  const [shown, setShown] = useState(game);
  useEffect(() => {
    if (shown === game) return undefined;
    const id = setTimeout(() => setShown(game), 20);
    return () => clearTimeout(id);
  }, [game, shown]);
  if (!shown.art.hero) return null;
  // The frame's overflow clips square; an Image clips to its own radius, so the art carries the frame's.
  return <Image source={{uri: shown.art.hero}} resizeMode="cover" className="absolute inset-0 rounded-xl"
    style={shown.art.tint ? {...ART, backgroundColor: shown.art.tint} : ART} />;
}

// The slide's text rises in once its logo can be drawn, never around an empty logo box; a logo
// still loading after 800 ms stops holding it back.
function Blurb({game}) {
  useT();
  const {rtl} = useLocale();
  const [ready, setReady] = useState(null);
  const current = useRef(game.id);
  current.current = game.id;
  useEffect(() => {
    const id = setTimeout(() => setReady(game.id), 800);
    return () => clearTimeout(id);
  }, [game.id]);
  const id = game.id;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.View key={game.id} className="gap-5"
        initial={{opacity: 0, y: 12}} animate={ready === game.id ? {opacity: 1, y: 0} : {opacity: 0, y: 12}}
        exit={{opacity: 0, y: -6, transition: {type: 'tween', duration: 0.15, ease: 'easeIn'}}}
        transition={{type: 'tween', duration: 0.45, ease: EASE_OUT}}>
        <GameLogo game={game} width={LOGO[0]} height={LOGO[1]} area={LOGO[2]}
          onReady={() => current.current === id && setReady(id)} />
        <Text className="-mb-2 font-sans text-sm text-muted">{game.genres.map(genreLabel).join(' · ')}</Text>
        <Text style={rtl ? LATIN_IN_RTL : undefined} className="w-[368px] font-sans text-[15px] leading-relaxed text-fg/85 line-clamp-3">
          {summaryOf(game)}
        </Text>
      </motion.View>
    </AnimatePresence>
  );
}

// Its own component, so a wishlist change re-renders this button and not the whole spotlight.
function WishButton({id, toList}) {
  const t = useT();
  const {rtl} = useLocale();
  const wishlist = useWishlist();
  const {toggleWish} = useStoreActions();
  const wished = wishlist.includes(id);
  return (
    <Button variant="outline" size="lg" label={wished ? t('browse.favorited') : t('browse.addToFavorites')}
      focusKey="spotlight:wish" nextFocusUp="nav:current" nextFocusDown={FIRST_POPULAR} {...focusEnd(rtl, toList)} onPress={() => toggleWish(id)}>
      <WishHeart active={wished} />
    </Button>
  );
}

/** Featured carousel: art with shade layers, logo and blurb, actions, and the five-game list. */
export function Spotlight() {
  // The page stays mounted under other screens; the carousel stops while it is hidden. Only that
  // flag reaches the spotlight: every navigation (an L1/R1 section included) changes the nav state.
  return <Carousel shown={useNavState().top.name === 'browse'} />;
}

const Carousel = memo(function Carousel({shown}) {
  const t = useT();
  const {rtl} = useLocale();
  const slides = useSlides(featured.length, shown);
  const {openGame} = useNavActions();
  const game = featured[slides.active];
  useEffect(() => {
    const id = setTimeout(prefetchSlides, 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <View className="flex-row gap-4">
      {/* 1216 px of content minus the 260 px list and the gap, at the source's 16:7.5 aspect. */}
      <View className="relative w-[940px] h-[440px] overflow-hidden rounded-xl bg-surface-2">
        <Art game={game} />
        {/* Strong enough for light art: the text stays readable over any hero. */}
        <View className={rtl ? 'absolute inset-0 bg-gradient-to-l from-canvas via-canvas/75 via-35% to-transparent to-75%'
          : 'absolute inset-0 bg-gradient-to-r from-canvas via-canvas/75 via-35% to-transparent to-75%'} />
        <View className="absolute inset-0 bg-gradient-to-t from-canvas/70 to-transparent to-50%" />
        <View className={rtl ? 'absolute inset-y-0 right-0 w-[448px] justify-end p-10' : 'absolute inset-y-0 left-0 w-[448px] justify-end p-10'}>
          <Blurb game={game} />
          {/* Outside the animated block, so controller focus survives a slide change. Up would find
              the list first (same scope) and Right the charts' "See all", so both are explicit. */}
          <View className="mt-5 flex-row gap-2">
            <Button variant="primary" size="lg" label={t('browse.viewGame')} focusKey="spotlight:cta" nextFocusUp="nav:current"
              nextFocusDown={FIRST_POPULAR}
              onPress={() => openGame(game.id, 'spotlight:cta')} />
            <WishButton id={game.id} toList={`spotlight:${slides.active}`} />
          </View>
        </View>
      </View>
      <SpotlightList games={featured} slides={slides} />
    </View>
  );
});
