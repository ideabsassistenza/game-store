// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {Icon} from '../ui/Icon.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {colors} from '../ui/colors.js';
import {getGame} from '../state/catalog.js';
import {useNavState} from '../state/nav.jsx';

/** The screen Circle returns to: a list's name, or the title of the game this one was opened from. */
function useOrigin() {
  const t = useT();
  const {stack} = useNavState();
  const previous = stack[stack.length - 2];
  return previous.name === 'game' ? getGame(previous.id).title : t(`game.back.${previous.name}`);
}

function Label() {
  const focused = useIsFocused();
  const origin = useOrigin();
  return (
    <>
      <Icon name="chevronLeft" size={16} color={focused ? colors.fg : colors.muted} />
      <Text focused={focused} className="max-w-[480px] font-sans text-sm text-muted focused:text-fg truncate">{origin}</Text>
    </>
  );
}

export function BackLink({onPress}) {
  return (
    <View onPress={onPress} nextFocusUp="nav:search" className="relative self-start flex-row items-center gap-1 rounded">
      <Label />
      <FocusRing />
    </View>
  );
}
