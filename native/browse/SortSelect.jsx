// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useState} from 'react';
import {View, Text, motion, transitions, useIsFocused} from '@ps5-react/core';
import {SPAN_MAX, fitBytes, useLocale, useT} from '../i18n/index.js';
import {SORTS, sortLabel} from '../state/catalog.js';
import {useStoreActions, useStoreState} from '../state/store.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {Menu, MenuItem} from '../ui/Menu.jsx';
import {colors} from '../ui/colors.js';

function Trigger({sort, open}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <FocusRing round="full" />
      <Text focused={focused} className="font-sans text-sm text-muted focused:text-fg/85">
        {fitBytes(t('sort.label'), SPAN_MAX)}
        <Text className="text-fg">{fitBytes(`  ${sortLabel(sort)}`, SPAN_MAX)}</Text>
      </Text>
      <motion.View initial={false} animate={{rotate: open ? 180 : 0}}
        transition={{type: 'tween', duration: 0.2, ease: 'easeOut'}}>
        <Icon name="chevronDown" color={focused ? colors.fg : colors.muted} />
      </motion.View>
    </>
  );
}

/** "Sort  Most popular ▾" with its dropdown of the five orders. */
export const SortSelect = memo(function SortSelect() {
  const {rtl} = useLocale();
  const {sort} = useStoreState();
  const {setSort} = useStoreActions();
  const [open, setOpen] = useState(false);
  return (
    <View className="relative z-10">
      <View focusKey="catalog:sort" selected={open} onPress={() => setOpen(value => !value)}
        className={`h-10 flex-row items-center gap-2 rounded-full bg-surface ${rtl ? 'pr-4 pl-3' : 'pl-4 pr-3'} selected:bg-surface-3 focused:bg-surface-3`}>
        <Trigger sort={sort} open={open} />
      </View>
      <Menu open={open} onClose={() => setOpen(false)} align="left" rows={SORTS.length}>
        {SORTS.map(option => (
          <MenuItem key={option.id} label={sortLabel(option.id)} checked={sort === option.id}
            onSelect={() => setSort(option.id)} />
        ))}
      </Menu>
    </View>
  );
});
