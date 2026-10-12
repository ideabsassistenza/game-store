// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {createContext, useContext} from 'react';
import {View, Text, ScrollView, FocusScope, AnimatePresence, motion, useIsFocused} from '@ps5-react/core';
import {useLocale} from '../i18n/index.js';
import {Icon} from './Icon.jsx';
import {EASE_OUT} from './ease.js';
import {colors} from './colors.js';
import {canScale} from './scale.js';

const CloseContext = createContext(null);
// The ScrollView's max-h-[512px]: 14 rows, so a long list stops above the controller hints.
const MAX_HEIGHT = 512;

/**
 * Dropdown list under its trigger; place it inside the trigger's `relative` wrapper. While open,
 * focus is trapped in the options and Circle closes it; focus then returns to the trigger. Long
 * lists scroll. `rows` (option count) decides whether the source's 98% pop fits the engine's
 * transform limit.
 */
export function Menu({open, onClose, align = 'left', rows, children}) {
  // `align` names the side in left-to-right order; a right-to-left layout mirrors it.
  const {rtl} = useLocale();
  const left = (align === 'left') !== rtl;
  // Rows are 36 px plus the 8 px padding; the menu is w-60 (240 px).
  const pop = canScale(240, Math.min(rows * 36 + 8, MAX_HEIGHT)) ? 0.98 : 1;
  const close = () => {
    onClose();
    return true;
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.View key="menu"
          className={left
            ? 'absolute left-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-line bg-surface p-1 origin-top-left'
            : 'absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-line bg-surface p-1 origin-top-right'}
          initial={{opacity: 0, y: -6, scale: pop}} animate={{opacity: 1, y: 0, scale: 1}}
          exit={{opacity: 0, y: -4, transition: {type: 'tween', duration: 0.1, ease: 'easeIn'}}}
          transition={{type: 'tween', duration: 0.18, ease: EASE_OUT}}>
          <FocusScope trap onBack={close}>
            <ScrollView className="max-h-[512px]">
              <CloseContext.Provider value={onClose}>{children}</CloseContext.Provider>
            </ScrollView>
          </FocusScope>
        </motion.View>
      )}
    </AnimatePresence>
  );
}

function ItemContent({label, checked}) {
  const focused = useIsFocused();
  return (
    <>
      <Text focused={focused} selected={checked}
        className="flex-1 font-sans text-sm text-muted truncate selected:text-fg focused:text-fg">{label}</Text>
      {checked && <Icon name="check" color={colors.fg} />}
    </>
  );
}

/** A menu option; the checked one (or `autoFocus`) takes focus when the menu opens. */
export function MenuItem({label, checked = false, autoFocus = false, onSelect}) {
  const close = useContext(CloseContext);
  return (
    <View autoFocus={checked || autoFocus} onPress={() => {
      onSelect();
      close();
    }} className="flex-row items-center justify-between gap-6 rounded-md px-3 py-2 focused:bg-surface-3">
      <ItemContent label={label} checked={checked} />
    </View>
  );
}

export const MenuDivider = () => <View className="my-1 h-px bg-line" />;
