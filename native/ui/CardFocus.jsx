// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, AnimatePresence, motion} from '@ps5-react/core';
import {ShineBorder} from './FocusRing.jsx';
import {PlatformBadge} from './PlatformBadge.jsx';
import {px} from './scale.js';

// The landing page's cover card under focus, ported from its web components: the edge light every
// focus draws (FocusRing.jsx), a glare and the platform tag.
// React Bits' GlareHover: a -30° band (clear to 60%, white 22% at 70% (28% on the page), clear at 100%) on a layer 260% of
// the card, crossing from background-position -100% -100% to 100% 100% in 750 ms, CSS `ease`. The page
// sends it back when focus leaves; here it just goes: crossing back while the cover settled, the band
// repainted in rectangular patches.
const SIZE = 2.6;
const band = {backgroundGradient: {type: 'linear', angle: 330, stops: [
  {color: '#ffffff00', offset: 0.6}, {color: '#ffffff38', offset: 0.7}, {color: '#ffffff00', offset: 1},
]}};
const cross = {type: 'tween', duration: 0.75, ease: [0.25, 0.1, 0.25, 1]};
// Focus that only passes through a card during a held scroll never starts the glare: sweeping three
// or four cards per second of scrolling cost the PS5 frames over 20 ms. It also waits out the cover's
// 300 ms lift: a band crossing a moving cover repainted in rectangular patches.
const SETTLE_MS = 300;
// The page fades the shine border and its hover state in and out over 300 ms.
const fade = {initial: {opacity: 0}, animate: {opacity: 1}, exit: {opacity: 0},
  transition: {type: 'tween', duration: 0.3, ease: [0, 0, 0.2, 1]}};

function Glare({width, height}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const settle = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(settle);
  }, []);
  if (!settled) return null;
  const travel = SIZE - 1;
  return (
    <View className="absolute inset-0 overflow-hidden rounded-lg">
      <motion.View className="absolute left-0 top-0" style={[{width: px(width * SIZE), height: px(height * SIZE)}, band]}
        initial={{x: travel * width, y: travel * height}} animate={{x: -travel * width, y: -travel * height}}
        transition={cross} />
    </View>
  );
}

/**
 * The cover's focus state, inside its `width` × `height` box (logical px, rounded-lg): the platform tag,
 * glare and shine border come in when `focused` turns on; the tag and border fade out when it turns off.
 * Each fade sits in its own AnimatePresence, which plays the exit of one motion element per child.
 */
export function CardFocus({focused, width, height, platforms}) {
  return (
    <>
      <AnimatePresence>
        {focused && (
          <motion.View key="tag" {...fade} className="absolute bottom-2 left-2">
            <PlatformBadge platforms={platforms} />
          </motion.View>
        )}
      </AnimatePresence>
      {focused && <Glare width={width} height={height} />}
      <AnimatePresence>{focused && <ShineBorder key="shine" radius={8} />}</AnimatePresence>
    </>
  );
}

