// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, useIsFocused} from '@ps5-react/core';
import {FocusRing} from './FocusRing.jsx';
import {Icon} from './Icon.jsx';
import {colors} from './colors.js';

function Content({label, icon, iconFill, trailing, current}) {
  const focused = useIsFocused();
  const color = current || focused ? colors.fg : '#f2f2f3a6';
  return (
    <>
      <FocusRing round="full" />
      {icon && <Icon name={icon} size={18} color={color} fill={iconFill ? color : 'none'} />}
      {label && <Text style={{color}} className="font-sans text-[15px]">{label}</Text>}
      {trailing && <Icon name={trailing} size={14} color={color} />}
    </>
  );
}

/**
 * Header link, dimmed unless it is the current section or focused; the header's NavPill marks the
 * current one, placed from `onLayout`. Children follow the label; other props (focusKey, onPress,
 * nextFocus*) go to the focusable View. Memoized: the header re-renders on every navigation.
 */
export const NavItem = memo(function NavItem({label, icon, iconFill, trailing, current = false, children, ...rest}) {
  return (
    <View {...rest} className="relative h-10 flex-row items-center gap-1.5 rounded-full px-4">
      <Content label={label} icon={icon} iconFill={iconFill} trailing={trailing} current={current} />
      {children}
    </View>
  );
});
