// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, motion, useIsFocused} from '@ps5-react/core';
import {px} from './scale.js';

// The source's `.shine::after`: a 115° band (transparent 30%, white 6.5% at 50%, transparent 70%)
// that crosses the element from translateX(-70%) to 70% in the first 32% of a 5 s cycle.
const CYCLE_MS = 5000;
// Focus that only passes through a card during a held scroll never starts a sweep: sweeping three or
// four cards per second of scrolling cost the PS5 frames over 20 ms.
const SETTLE_MS = 300;
const sweep = {type: 'tween', duration: 1.6, ease: [0.4, 0, 0.3, 1]};
const band = {backgroundGradient: {type: 'linear', angle: 115, stops: [
  {color: '#ffffff00', offset: 0.3}, {color: '#ffffff11', offset: 0.5}, {color: '#ffffff00', offset: 0.7},
]}};

/**
 * A light sweep across the focused element around it, starting once focus has rested on it for
 * 300 ms and repeating every 5 s. Place it inside a positioned box; it clips itself. `width` is logical px.
 */
export function Shine({width, round = 'lg'}) {
  const focused = useIsFocused();
  const [pass, setPass] = useState(0);
  useEffect(() => {
    if (!focused) return undefined;
    let interval;
    const settle = setTimeout(() => {
      setPass(1);
      interval = setInterval(() => setPass(n => n + 1), CYCLE_MS);
    }, SETTLE_MS);
    return () => {
      clearTimeout(settle);
      clearInterval(interval);
      setPass(0);
    };
  }, [focused]);
  if (!focused || pass === 0) return null;
  return (
    <View className={round === 'xl' ? 'absolute inset-0 overflow-hidden rounded-xl'
      : 'absolute inset-0 overflow-hidden rounded-lg'}>
      <motion.View key={pass} className="absolute inset-y-0 left-0" style={[{width: px(width)}, band]}
        initial={{x: -0.7 * width}} animate={{x: 0.7 * width}} transition={sweep} />
    </View>
  );
}
