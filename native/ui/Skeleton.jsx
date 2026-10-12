// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, motion, tw} from '@ps5-react/core';
import {px} from './scale.js';

const BLOCK = tw`bg-surface-2 rounded-md`;
const BAR = tw`h-3.5 bg-surface-2 rounded`;
// The pulse fades only the block's own pixels. Keep it to a few large blocks (a logo, a hero):
// a grid of pulsing covers would repaint every card every frame.
const pulse = {initial: {opacity: 1}, animate: {opacity: 0.5},
  transition: {type: 'tween', duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse'}};

/** A rounded placeholder block sized by `style` (render px, like any style), static unless `pulse`. */
export function Skeleton({style, pulse: pulsing = false}) {
  if (!pulsing) return <View style={[BLOCK, style]} />;
  return <motion.View {...pulse} style={[BLOCK, style]} />;
}

/** Placeholder text: `lines` bars `width` logical px wide, the last one shorter. */
export function SkeletonLines({lines = 2, width, pulse: pulsing = false}) {
  const Bar = pulsing ? motion.View : View;
  return (
    <View className="gap-2.5">
      {Array.from({length: lines}, (_, i) => (
        <Bar key={i} {...(pulsing ? pulse : {})}
          style={[BAR, {width: px(i === lines - 1 && lines > 1 ? width * 0.6 : width)}]} />
      ))}
    </View>
  );
}
