// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, ScrollView, useIsFocused} from '@ps5-react/core';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';

function TitleLink({title}) {
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{title}</Text>
      <Icon name="chevronRight" size={16} color={focused ? colors.fg : colors.muted} />
    </>
  );
}

// Left and Right scroll the rail; the arrows only say so, like the store's.
const Arrow = ({name}) => (
  <View className="size-8 items-center justify-center rounded-full bg-surface">
    <Icon name={name} size={16} color={colors.muted} fixed />
  </View>
);

// A row ScrollView scrolls only toward the right, so a right-to-left rail keeps the left-to-right
// order, and its arrows with it.
const LTR = {direction: 'ltr'};

/**
 * A titled horizontal row of cards; the page aligns its title at the top when focus enters it. With
 * `onSeeAll` the title is a link ("Popular now ›"). The rail's vertical padding, taken back by the
 * negative margin, leaves room for a focused card's lift and frame.
 */
export function GameRail({title, onSeeAll, seeAllKey, children}) {
  return (
    <View scrollAnchor>
      <View className="mb-4 flex-row items-center justify-between">
        {onSeeAll ? (
          <View onPress={onSeeAll} focusKey={seeAllKey} className="flex-row items-center gap-1 rounded-md">
            <TitleLink title={title} />
          </View>
        ) : (
          <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{title}</Text>
        )}
        <View className="flex-row gap-2" style={LTR}>
          <Arrow name="chevronLeft" />
          <Arrow name="chevronRight" />
        </View>
      </View>
      <View className="-mx-2 -my-4">
        <ScrollView className="flex-row gap-6 px-2 py-4" style={LTR}>{children}</ScrollView>
      </View>
    </View>
  );
}
