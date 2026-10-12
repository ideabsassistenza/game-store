// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {FocusScope, ScrollView, Text, View, motion, tw} from '@ps5-react/core';
import {useLocale} from '../i18n/index.js';
import {EASE_OUT} from './ease.js';
import {HINT, useHints} from './Legend.jsx';

const enter = {type: 'tween', duration: 0.28, ease: EASE_OUT};
const PANEL = tw`absolute right-0 top-0 bottom-0 border-l border-line bg-canvas`;
const PANEL_RTL = tw`absolute left-0 top-0 bottom-0 border-r border-line bg-canvas`;
const HINTS = [HINT.select, HINT.close];

/**
 * The surface every sheet over the end edge shares (the right, the left in Arabic and Urdu): the page
 * dimmed behind and a canvas panel with a hairline on its inner side. `className` sizes and pads the
 * panel; motion props animate it, their `x` given for the right edge and mirrored here. Only the panel
 * moves: the dimming holds still, since fading it would blend the whole screen every frame.
 */
export function SheetPanel({style, children, initial, animate, exit, ...animation}) {
  const {rtl} = useLocale();
  const mirror = values => (rtl && values?.x ? {...values, x: -values.x} : values);
  return (
    <View className="absolute inset-0">
      <View className="absolute inset-0 bg-canvas/80" />
      <motion.View style={[rtl ? PANEL_RTL : PANEL, style]} initial={mirror(initial)} animate={mirror(animate)}
        exit={mirror(exit)} {...animation}>{children}</motion.View>
    </View>
  );
}

/**
 * A sheet that slides in from the end edge over a dimmed page, for choices too long or too important for
 * a dropdown. Focus and the controller's actions stay inside; Circle closes it. `children` scroll under
 * the title.
 */
export function SideSheet({title, subtitle, onClose, children}) {
  useHints(HINTS);
  // Like the filter drawer, a modal stops every action: Square favorited the page's game behind it and
  // L1/R1 switched the header's section under it.
  return (
    <FocusScope trap autoFocus onBack={() => { onClose(); return true; }} onAction={() => true}>
      <View className="absolute inset-0 z-50">
        <SheetPanel className="w-[540px] gap-5 px-6 pt-7 pb-12"
          initial={{opacity: 0, x: 48}} animate={{opacity: 1, x: 0}} transition={enter}>
          <View className="gap-1 px-3">
            <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{title}</Text>
            {subtitle ? <Text className="font-sans text-sm text-muted truncate">{subtitle}</Text> : null}
          </View>
          <ScrollView className="flex-1">{children}</ScrollView>
        </SheetPanel>
      </View>
    </FocusScope>
  );
}
