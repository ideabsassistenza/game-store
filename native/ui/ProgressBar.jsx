// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, motion} from '@ps5-react/core';
import {useLocale} from '../i18n/index.js';
import {px} from './scale.js';

/** Each progress tick glides over the tick interval instead of jumping. */
export const glide = {type: 'tween', duration: 0.05, ease: 'linear'};

/**
 * A download's thin progress track, `width` logical px wide. The fill is a full-width bar translated
 * left, so a tick moves pixels instead of relaying out the row; `active` fills it with the accent.
 */
export function ProgressBar({fraction, width, active}) {
  const {rtl} = useLocale();
  return (
    <View className="h-1 overflow-hidden rounded-full bg-surface-2" style={{width: px(width)}}>
      <motion.View className={active ? 'absolute inset-0 bg-accent' : 'absolute inset-0 bg-subtle'}
        initial={false} animate={{x: (rtl ? 1 : -1) * (1 - fraction) * width}} transition={glide} />
    </View>
  );
}
