// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {Svg, Path, motion} from '@ps5-react/core';
import {colors} from './colors.js';
import {px} from './scale.js';

// Matches sce_sys/pic1.png (scripts/sce_art.py), the system splash shown until the first frame:
// a 200 px dial centered on the 1080p screen, so the hand-off does not move.
const SIZE = 200 / 1.5;
const UNIT = SIZE / 32;
// The needle turns about its hub, which sits off the dial's center.
const HUB = {x: 15.45, y: 16.55};
const needleBox = {position: 'absolute', left: px((HUB.x - 16) * UNIT), top: px((HUB.y - 16) * UNIT)};
const STEPS = [
  // Swings back like a revved engine settling...
  {rotate: -120, transition: {type: 'tween', duration: 0.4, ease: 'easeInOut', delay: 0.15}},
  // ...then kicks through the limit and settles in the gap.
  {rotate: 0, transition: {type: 'spring', stiffness: 260, damping: 11}},
];

/** The launch intro over the app: the splash's dial revs its needle, then the screen fades in. */
export function Splash() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return null;
  const leaving = step === STEPS.length;
  return (
    <motion.View className="absolute inset-0 items-center justify-center bg-canvas" initial={false}
      animate={{opacity: leaving ? 0 : 1}} transition={{duration: 0.35, ease: 'easeIn', delay: 0.1}}
      onAnimationComplete={() => leaving && setDone(true)}>
      <motion.View style={{width: px(SIZE), height: px(SIZE)}} initial={false}
        animate={{scale: leaving ? 0.9 : 1}} transition={{duration: 0.45, ease: 'easeIn'}}>
        <Svg width={px(SIZE)} height={px(SIZE)} viewBox="0 0 32 32">
          <Path d="M26.34 12.24A11 11 0 1 1 19.76 5.66" fill="none" stroke={colors.fg} strokeWidth={4.5} />
        </Svg>
        <motion.View style={needleBox} initial={{rotate: 0}} animate={STEPS[Math.min(step, STEPS.length - 1)]}
          onAnimationComplete={() => setStep(s => Math.min(s + 1, STEPS.length))}>
          <Svg width={px(SIZE)} height={px(SIZE)} viewBox={`${HUB.x - 16} ${HUB.y - 16} 32 32`}>
            <Path d="M28.4 3.6 17.6 18.1a2.9 2.9 0 1 1-3.7-3.7Z" fill={colors.fg} />
          </Svg>
        </motion.View>
      </motion.View>
    </motion.View>
  );
}
