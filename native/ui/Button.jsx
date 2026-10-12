// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {Text, motion, tw, useIsFocused} from '@ps5-react/core';
import {FocusRing} from './FocusRing.jsx';
import {Icon} from './Icon.jsx';
import {colors} from './colors.js';

const BASE = tw`flex-row shrink-0 items-center justify-center gap-2 rounded-md`;
const SIZE = {sm: tw`h-8 px-3`, md: tw`h-10 px-4`, lg: tw`h-12 px-5`, icon: tw`size-10`};
const BOX = {
  primary: tw`bg-accent`,
  secondary: tw`bg-surface-2`,
  // Over light art a bare line vanishes: the translucent fill keeps the button readable anywhere.
  outline: tw`border border-white/20 bg-canvas/60`,
  ghost: null,
};
const FOCUSED_BOX = {primary: tw`bg-white`, secondary: tw`bg-surface-3`, outline: tw`bg-surface`, ghost: null};
const TEXT = {
  primary: tw`font-sans text-accent-fg`,
  secondary: tw`font-sans text-fg`,
  outline: tw`font-sans text-fg`,
  ghost: tw`font-sans text-muted`,
};
const TEXT_SIZE = {sm: tw`text-sm`, md: tw`text-sm`, lg: tw`text-[15px]`, icon: tw`text-sm`};

// Press feedback: down to 95% and back while Cross is held (~120 ms), like a physical key.
const press = {scale: 0.95};
const pressMotion = {type: 'tween', duration: 0.12, ease: 'easeOut'};

const ink = (variant, focused) =>
  variant === 'primary' ? colors.accentFg : variant === 'ghost' && !focused ? colors.muted : colors.fg;

function Content({variant, size, label, icon, iconFill}) {
  const focused = useIsFocused();
  const color = ink(variant, focused);
  return (
    <>
      {icon && <Icon name={icon} size={size === 'icon' ? 20 : 16} color={color} fill={iconFill ? color : 'none'} />}
      {label && <Text style={[TEXT[variant], TEXT_SIZE[size], focused && variant === 'ghost' && tw`text-fg`]}>{label}</Text>}
    </>
  );
}

/**
 * The source's Button: variants primary / secondary / outline / ghost, sizes sm / md / lg / icon.
 * `children` render before the icon and label (for example a WishHeart); other props (focusKey,
 * autoFocus, onFocus, nextFocus*) reach the focusable View.
 */
export function Button({variant = 'secondary', size = 'md', label, icon, iconFill, children, onPress, style, ...rest}) {
  return (
    <motion.View {...rest} onPress={onPress} whilePress={press} transition={pressMotion}
      style={({focused}) => [BASE, SIZE[size], BOX[variant], focused && FOCUSED_BOX[variant], style]}>
      {variant === 'primary' ? <FocusRing halo radius={6} /> : <FocusRing />}
      {children}
      <Content variant={variant} size={size} label={label} icon={icon} iconFill={iconFill} />
    </motion.View>
  );
}
