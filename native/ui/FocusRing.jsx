// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect} from 'react';
import {View, Animated, Easing, useAnimatedValue, motion, useIsFocused} from '@ps5-react/core';
import {px} from './scale.js';

// Every focus draws the game card's edge light: Magic UI's ShineBorder (1.5 px, 6 s, toned to 78% white
// on the TV), radial-gradient(transparent, transparent, white, transparent, transparent) on a background
// 300% of the box, its position looping 0% 0% → 100% 100% → 0% 0%, seen only through the border. The
// engine draws it from one animated angle; a step repaints only the ring's edge bands.
const SHINE_MS = 6000;
const shine = {type: 'radial', width: px(1.5), size: 3, stops: [
  {color: '#ffffff00', offset: 0.25}, {color: '#ffffffc7', offset: 0.5}, {color: '#ffffff00', offset: 0.75},
]};
// It fades in and out over 300 ms, as the page's does.
const fade = {initial: {opacity: 0}, animate: {opacity: 1}, exit: {opacity: 0},
  transition: {type: 'tween', duration: 0.3, ease: [0, 0, 0.2, 1]}};
const breathe = {initial: {opacity: 0.4}, animate: {opacity: 1},
  transition: {type: 'tween', duration: 2.8, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse'}};

/** The edge light inside the box around it, whose corners have `radius` logical px. */
export function ShineBorder({radius}) {
  const angle = useAnimatedValue(0);
  useEffect(() => {
    const run = Animated.loop(Animated.timing(angle, {toValue: 360, duration: SHINE_MS, easing: Easing.linear}));
    run.start();
    return () => run.stop();
  }, []);
  return (
    <motion.View {...fade} pointerEvents="none" className="absolute inset-0">
      <Animated.View className="absolute inset-0" style={{borderRadius: px(radius), borderGradient: shine, borderGradientAngle: angle}} />
    </motion.View>
  );
}

// Two 3 px rings just outside a border of `radius` (logical px), breathing between about 15% and
// 35% white.
function Glow({radius}) {
  const ring = (offset, color) => ({position: 'absolute', left: -px(offset), top: -px(offset), right: -px(offset),
    bottom: -px(offset), borderRadius: px(radius + offset), borderWidth: px(3), borderColor: color});
  return (
    <motion.View {...breathe} className="absolute inset-0">
      <View style={ring(3, '#ffffff59')} />
      <View style={ring(6, '#ffffff21')} />
    </motion.View>
  );
}

const RING_RADIUS = {full: 999, lg: 12, md: 10};

/**
 * The focus outline of the focusable View around it: the edge light 4.5 px outside the element. `halo`
 * keeps only a breathing glow against the element's edge, for elements already white, where a white
 * light outside a white fill reads as a second outline.
 */
export function FocusRing({round = 'md', halo = false, radius}) {
  const focused = useIsFocused();
  if (!focused) return null;
  if (halo) return <View className="absolute inset-0"><Glow radius={radius ?? RING_RADIUS[round]} /></View>;
  return <View className="absolute -inset-[4.5px]"><ShineBorder radius={RING_RADIUS[round]} /></View>;
}

/** The tile frame: the same edge light on the tile's own edge. */
export function FocusFrame({round = 'lg'}) {
  const focused = useIsFocused();
  if (!focused) return null;
  return <ShineBorder radius={round === '2xl' ? 16 : round === 'xl' ? 12 : 8} />;
}
