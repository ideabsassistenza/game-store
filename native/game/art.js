// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {Image, tw} from '@ps5-react/core';
import {logoStyle} from '../ui/GameLogo.jsx';
import {px} from '../ui/scale.js';

// Art boxes of the game page. Remote images are decoded per box, so prefetching uses the same ones.
export const HERO = tw`w-[1280px] h-[600px]`;
// The radius rounds the art itself: the hero frame's overflow clips square.
export const COVER = {width: px(192), height: px(256), borderRadius: px(8)};
export const SHOT = tw`w-[872px] h-[490px]`;
export const THUMB = tw`w-32 h-[72px]`;
// The screenshot viewer fills the screen (the header and legend leave while it is open).
export const VIEW = tw`w-screen h-screen`;
export const LOGO = {width: 384, height: 120};

const ignore = () => {};

/** Loads the art a game's page shows first, so opening it draws them at once. */
export function prefetchGameArt(game) {
  const {art} = game;
  if (art.hero) Image.prefetch(art.hero, HERO).catch(ignore);
  if (art.cover) Image.prefetch(art.cover, COVER).catch(ignore);
  if (art.logo) Image.prefetch(art.logo, {...logoStyle(game, LOGO.width, LOGO.height), resizeMode: 'contain'}).catch(ignore);
  for (const shot of game.shots.slice(0, 1)) Image.prefetch(shot.url, SHOT).catch(ignore);
  for (const shot of game.shots) Image.prefetch(shot.thumb, THUMB).catch(ignore);
}

let settle = null;

/** Prefetches a focused game's page once focus has rested on it, not for every card passed by. */
export function prefetchWhenSettled(game) {
  clearTimeout(settle);
  settle = setTimeout(() => prefetchGameArt(game), 300);
}
