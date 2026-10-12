// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text} from '@ps5-react/core';
import {CdnAura, CdnSpark} from '../ui/CdnAura.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';

/**
 * A download setting cycled with Cross; without `onPress` it is plain text, since there is nothing to
 * pick.
 */
export function Choice({focusKey, nextFocusDown, onPress, text, magic = null}) {
  // Overdrive CDN's source: a card of its own under the button, its aura in place of the outline,
  // its name on one line and what it is on the next.
  if (magic) {
    return (
      <View focusKey={focusKey} nextFocusDown={nextFocusDown} onPress={onPress ?? undefined}
        className="relative h-14 w-[272px] flex-row items-center gap-3 rounded-lg px-3.5">
        <CdnAura radius={8} width={272} />
        <FocusRing />
        <CdnSpark size={20} />
        <View className="flex-1 gap-0.5">
          <Text className="font-sans text-[15px] font-semibold text-fg truncate">{magic.name}</Text>
          <Text className="w-[184px] font-sans text-[13px] text-fg/75 truncate">{magic.detail}</Text>
        </View>
        {onPress ? <Icon name="chevronRight" size={16} color={colors.fg} /> : null}
      </View>
    );
  }
  if (!onPress) {
    return (
      <View className="py-2">
        <Text className="w-[272px] font-sans text-sm text-subtle truncate">{text}</Text>
      </View>
    );
  }
  return (
    <View focusKey={focusKey} nextFocusDown={nextFocusDown} onPress={onPress}
      className="relative flex-row items-center justify-between rounded-md border border-line px-3 py-2 focused:bg-surface-2">
      <FocusRing />
      <Text className="w-[226px] font-sans text-sm text-muted truncate">{text}</Text>
      <Icon name="chevronRight" size={14} color={colors.muted} />
    </View>
  );
}

/** A secondary action under the settings. */
export function TextAction({focusKey, nextFocusDown, onPress, text}) {
  return (
    <View focusKey={focusKey} nextFocusDown={nextFocusDown} onPress={onPress}
      className="relative rounded-md border border-line px-3 py-2 focused:bg-surface-2">
      <FocusRing />
      <Text className="font-sans text-sm text-muted">{text}</Text>
    </View>
  );
}
