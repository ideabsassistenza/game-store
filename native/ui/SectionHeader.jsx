// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {FocusRing} from './FocusRing.jsx';
import {Icon} from './Icon.jsx';
import {colors} from './colors.js';

function SeeAll() {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <Text focused={focused} className="font-sans text-sm text-muted focused:text-fg">{t('common.seeAll')}</Text>
      <Icon name="chevronRight" color={focused ? colors.fg : colors.muted} />
    </>
  );
}

/** Section title, with a "See all" link when `onSeeAll` is given; `focusKey` and `nextFocusUp` go to the link. */
export function SectionHeader({title, onSeeAll, focusKey, nextFocusUp}) {
  return (
    <View className="mb-4 flex-row items-end justify-between">
      <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{title}</Text>
      {onSeeAll && (
        <View onPress={onSeeAll} focusKey={focusKey} nextFocusUp={nextFocusUp} className="flex-row items-center gap-0.5 rounded">
          <SeeAll />
        </View>
      )}
    </View>
  );
}
