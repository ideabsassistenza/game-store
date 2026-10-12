// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {Controller, Image} from '@ps5-react/core';

// The controller light bar follows the focused game tile or the open game page. One owner at a time:
// the latest caller wins, and a clear from an owner that was already replaced is ignored, so focus
// moving from tile to tile, or a tile blurring after its page opened, never turns the light off.
const NEUTRAL = '#ffffff';
const colors = new Map();
let owner = null;
let resetting = null;
// Focus can leave a tile a frame before it reaches the next one; resetting at once flashed the
// default blue between two games.
const RESET_DELAY_MS = 250;
// The colour waits for focus to rest: a held key passing a card a frame queued its cover's colour.
const LIGHT_DELAY_MS = 150;
let lighting = null;

const colorOf = uri => {
  if (!colors.has(uri)) colors.set(uri, Image.getColor(uri).catch(() => null));
  return colors.get(uri);
};

/** Lights the bar in `game`'s cover colour on behalf of `key`; neutral art (white, grey, black) lights it white. */
export function lightGame(key, game) {
  owner = key;
  clearTimeout(resetting);
  clearTimeout(lighting);
  if (!game.art.cover) { Controller.setLightBar(NEUTRAL); return; }
  lighting = setTimeout(() => void colorOf(game.art.cover).then(color => {
    if (owner !== key) return;
    // The default light is the first player's blue, which reads as a colour the art does not have.
    Controller.setLightBar(color ?? NEUTRAL);
  }), LIGHT_DELAY_MS);
}

/** Returns the bar to the default light, unless another tile or page took it since. */
export function unlight(key) {
  if (owner !== key) return;
  owner = null;
  clearTimeout(resetting);
  resetting = setTimeout(() => { if (owner === null) Controller.resetLightBar(); }, RESET_DELAY_MS);
}
