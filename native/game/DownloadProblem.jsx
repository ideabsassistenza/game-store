// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';

/** What went wrong and the one thing to do about it, under the button that does it. */
export function ProblemNote({title, action}) {
  return (
    <View className="w-[272px] flex-row gap-2.5">
      <Icon name="alert" size={16} color={colors.fg} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-sm font-semibold text-fg line-clamp-2">{title}</Text>
        {action ? <Text className="font-sans text-sm text-muted line-clamp-3">{action}</Text> : null}
      </View>
    </View>
  );
}

function TriggerFace() {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <Text className={focused ? 'font-sans text-sm text-fg' : 'font-sans text-sm text-muted'}>{t('download.moreOptions')}</Text>
      <Icon name="chevronRight" size={14} color={focused ? colors.fg : colors.muted} />
    </>
  );
}

/**
 * The recovery actions that are not the button's: a quiet row that opens them in a sheet, so a failed
 * download shows one action and keeps the rest one press away.
 */
export function MoreOptions({focusKey, nextFocusDown, onPress}) {
  // The row's padding hangs into the gutter, so its text lines up with the note above.
  return (
    <View focusKey={focusKey} nextFocusDown={nextFocusDown} onPress={onPress}
      className="relative -mx-3 h-9 w-[296px] flex-row items-center justify-between rounded-md px-3 focused:bg-surface-2">
      <TriggerFace />
    </View>
  );
}
