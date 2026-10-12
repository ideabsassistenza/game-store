// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect} from 'react';
import {View, Animated, Easing, Svg, Path, useAnimatedValue, motion} from '@ps5-react/core';
import {px} from './scale.js';

// Overdrive CDN is the one thing in the app that carries color: Overdrive's own servers, so wherever
// it is named the element glows, focused or not. Its border is the focus light (ui/FocusRing.jsx's
// ShineBorder, drawn on the edge as FocusFrame draws it on a tile: a radial light dancing round it on
// the same 6 s loop) in pastel iridescence instead of white, over a faint lavender hairline; its ground
// takes a faint tint and a light band crosses it.
const SHINE_MS = 6000;
// The focus light's shape (transparent, light, transparent around the middle of the background), its
// light spread across lavender, white and blush.
const DANCE = [
  {color: '#c4b5fd00', offset: 0.22}, {color: '#c4b5fdcc', offset: 0.38}, {color: '#ffffffe6', offset: 0.5},
  {color: '#fbcfe8cc', offset: 0.62}, {color: '#a5f3fc00', offset: 0.78},
];
const ground = {backgroundGradient: {type: 'linear', angle: 115, stops: [
  {color: '#c4b5fd17', offset: 0}, {color: '#a5f3fc0d', offset: 0.55}, {color: '#fbcfe812', offset: 1},
]}};
const band = {backgroundGradient: {type: 'linear', angle: 115, stops: [
  {color: '#ffffff00', offset: 0.32}, {color: '#ffffff14', offset: 0.5}, {color: '#ffffff00', offset: 0.68},
]}};
// Loops on the motion driver, so the aura takes none of the app's 64 timers.
const crossing = {type: 'tween', duration: 2.2, ease: [0.4, 0, 0.3, 1], repeat: Infinity, repeatDelay: 4.2};

/**
 * The aura inside a positioned element whose corners have `radius` logical px; `width` (logical px) sizes
 * the light band. It draws behind nothing and takes no input.
 */
export function CdnAura({radius = 8, width}) {
  const angle = useAnimatedValue(0);
  useEffect(() => {
    const run = Animated.loop(Animated.timing(angle, {toValue: 360, duration: SHINE_MS, easing: Easing.linear}));
    run.start();
    return () => run.stop();
  }, []);
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <View className="absolute inset-0" style={[{borderRadius: px(radius)}, ground]} />
      <View className="absolute inset-0 overflow-hidden" style={{borderRadius: px(radius)}}>
        <motion.View className="absolute inset-y-0 left-0" style={[{width: px(width)}, band]}
          initial={{x: -0.8 * width}} animate={{x: 0.8 * width}} transition={crossing} />
      </View>
      <View className="absolute inset-0" style={{borderRadius: px(radius), borderWidth: px(1), borderColor: '#c4b5fd29'}} />
      <Animated.View className="absolute inset-0" style={{borderRadius: px(radius), borderGradientAngle: angle,
        borderGradient: {type: 'radial', width: px(1.5), size: 3, stops: DANCE}}} />
    </View>
  );
}

// A cover Overdrive CDN serves is framed like a foil card: the aura's colors as a still hairline on the
// cover's edge, so a grid animates nothing for it (the focus light still dances over the focused one).
// No label over the art: the frame alone marks it.
const FOIL = {type: 'conic', width: px(1.5), angle: 210, stops: [
  {color: '#c4b5fd', offset: 0}, {color: '#a5f3fc', offset: 0.3}, {color: '#ffffff', offset: 0.5},
  {color: '#fbcfe8', offset: 0.75}, {color: '#c4b5fd', offset: 1},
]};

/** The foil frame of a cover whose corners have `radius` logical px. */
export function CdnMark({radius = 8}) {
  return <View pointerEvents="none" className="absolute inset-0" style={{borderRadius: px(radius), borderGradient: FOIL}} />;
}

/** Overdrive CDN's mark beside its name: a four-point spark, with a smaller one trailing it. */
export function CdnSpark({size = 14}) {
  return (
    <Svg width={px(size)} height={px(size)} viewBox="0 0 24 24">
      <Path d="M10 1C10 7 13 10 19 10C13 10 10 13 10 19C10 13 7 10 1 10C7 10 10 7 10 1Z" fill="#a5f3fc" />
      <Path d="M19 14C19 17 20 18 23 18C20 18 19 19 19 22C19 19 18 18 15 18C18 18 19 17 19 14Z" fill="#f9a8d4" />
    </Svg>
  );
}
