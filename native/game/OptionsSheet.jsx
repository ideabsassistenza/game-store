// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {Text, View, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {SideSheet} from '../ui/SideSheet.jsx';
import {colors} from '../ui/colors.js';

function OptionFace({icon, label, detail}) {
  const focused = useIsFocused();
  const ink = focused ? colors.fg : colors.muted;
  return (
    <>
      <FocusRing />
      <Icon name={icon} size={18} color={ink} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[15px] font-semibold text-fg">{label}</Text>
        <Text style={{color: ink}} className="w-[400px] font-sans text-sm line-clamp-2">{detail}</Text>
      </View>
    </>
  );
}

const ARM_MS = 3000;

// An `armed` item takes a second press within a few seconds, showing its `armed` label and detail meanwhile.
function Option({item, autoFocus, onClose}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  const press = () => {
    if (item.armed && !armed) { setArmed(true); return; }
    if (!item.next) onClose();
    item.onSelect();
  };
  const face = armed ? {...item, ...item.armed} : item;
  return (
    <View autoFocus={autoFocus} onPress={press} onBlur={() => setArmed(false)}
      className="relative flex-row items-center gap-3 rounded-lg px-3 py-3 focused:bg-surface-2">
      <OptionFace icon={face.icon} label={face.label} detail={face.detail} />
    </View>
  );
}

/**
 * A download's other actions, each saying what it does to the files, in the sheet beside the page.
 * `items`: `[{icon, label, detail, onSelect, next, armed}]`. Picking an item closes the sheet, except a `next`
 * item, which opens the following sheet in its place.
 */
export function OptionsSheet({title, items, onClose}) {
  const t = useT();
  return (
    <SideSheet title={t('download.optionsTitle')} subtitle={title} onClose={onClose}>
      <View className="gap-1 p-1.5">
        {items.map((item, index) => <Option key={item.label} item={item} autoFocus={index === 0} onClose={onClose} />)}
      </View>
    </SideSheet>
  );
}
