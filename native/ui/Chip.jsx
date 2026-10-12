// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text} from '@ps5-react/core';
import {useLocale} from '../i18n/index.js';
import {FocusRing} from './FocusRing.jsx';
import {Icon} from './Icon.jsx';
import {colors} from './colors.js';

/**
 * A filter in effect, white like a picked option in the filters drawer, with a ✕; Cross calls
 * `onPress`.
 */
export function Chip({label, onPress, focusKey}) {
  const {rtl} = useLocale();
  return (
    <View focusKey={focusKey} onPress={onPress}
      className={`h-10 flex-row items-center gap-1.5 rounded-full bg-fg ${rtl ? 'pr-4 pl-3' : 'pl-4 pr-3'}`}>
      <FocusRing round="full" />
      <Text className="font-sans text-sm font-semibold text-canvas">{label}</Text>
      <Icon name="x" size={14} color={colors.canvas} />
    </View>
  );
}
