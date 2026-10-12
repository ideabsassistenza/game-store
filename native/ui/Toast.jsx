// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, motion} from '@ps5-react/core';
import {ButtonGlyph} from './ButtonHints.jsx';
import {Cover} from './Cover.jsx';
import {Icon} from './Icon.jsx';
import {EASE_OUT} from './ease.js';
import {colors} from './colors.js';
import {useLocale} from '../i18n/index.js';
import {px} from './scale.js';

// Every notice in one place and size, under the header's right end like the console's own: the
// corner above the legend held the download notice and the header's own icons the install one.
const WIDTH = 400;
const THUMB = {width: px(56), height: px(75), borderRadius: px(6)};
const enter = {duration: 0.45, ease: EASE_OUT};
const leave = {opacity: 0, x: 24, transition: {duration: 0.25, ease: 'easeIn'}};
const leaveRtl = {...leave, x: -24};

/**
 * A corner notice: the game's cover, a status line with its icon, the title, and either the button
 * that acts on it or a detail line. A failure carries a brighter border. The hairline at the bottom
 * runs out over `duration` ms, the time it stays. `inPage` places it from a screen's own top, below
 * the header, rather than the whole screen's. It is wider than the scale limit, so it slides in;
 * render it under AnimatePresence to slide it out. Right to left it takes the left corner, under the
 * header's downloads.
 */
export function Toast({game, icon, status, title, action, detail, failed = false, duration, inPage = false}) {
  const {rtl} = useLocale();
  const side = rtl ? 'left-8' : 'right-8';
  return (
    <motion.View className={`absolute ${side} ${inPage ? 'top-3' : 'top-[76px]'} z-50 w-[400px]`}
      initial={{opacity: 0, x: rtl ? -40 : 40}} animate={{opacity: 1, x: 0}} transition={enter} exit={rtl ? leaveRtl : leave}>
      <View className={`flex-row items-center gap-4 overflow-hidden rounded-xl border bg-surface p-3 ${rtl ? 'pl-5' : 'pr-5'} ${
        failed ? 'border-fg/60' : 'border-line'}`}>
        {game ? <Cover game={game} label={false} style={THUMB} /> : null}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            <Icon name={icon} size={16} color={failed ? colors.fg : colors.muted} />
            <Text className={failed ? 'font-sans text-sm font-semibold text-fg truncate' : 'font-sans text-sm text-muted truncate'}>{status}</Text>
          </View>
          <Text className="font-sans text-[17px] font-semibold leading-6 text-fg line-clamp-2">{title}</Text>
          {action ? (
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <ButtonGlyph button={action.button} />
              <Text className="font-sans text-sm text-fg/85">{action.label}</Text>
            </View>
          ) : detail ? <Text className="font-sans text-sm text-muted">{detail}</Text> : null}
        </View>
        {duration ? (
          <motion.View className="absolute left-0 right-0 bottom-0 h-0.5 bg-fg/50"
            initial={{x: 0}} animate={{x: rtl ? WIDTH : -WIDTH}} transition={{duration: duration / 1000, ease: 'linear'}} />
        ) : null}
      </View>
    </motion.View>
  );
}
