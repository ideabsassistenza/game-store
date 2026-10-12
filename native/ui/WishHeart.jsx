// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, motion, transitions} from '@ps5-react/core';
import {Icon} from './Icon.jsx';
import {colors} from './colors.js';

// Adding pops the heart and releases a ring; removing only empties it. Both stay within 16 px boxes.
export function WishHeart({active, color = colors.fg}) {
  return (
    <View className="relative size-4 items-center justify-center">
      {active && (
        <motion.View key="burst" className="absolute inset-0 rounded-full border border-fg"
          initial={{scale: 0.4, opacity: 0.7}} animate={{scale: 2.4, opacity: 0}}
          transition={{type: 'tween', duration: 0.55, ease: 'easeOut'}} />
      )}
      <motion.View key={String(active)} initial={active ? {scale: 1.45} : false} animate={{scale: 1}}
        transition={transitions.pop}>
        <Icon name="heart" color={color} fill={active ? color : 'none'} />
      </motion.View>
    </View>
  );
}
