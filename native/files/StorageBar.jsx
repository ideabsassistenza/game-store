// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, motion} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {formatBytes} from '../state/size.js';
import {EASE_OUT} from '../ui/ease.js';
import {px} from '../ui/scale.js';
import {KINDS} from './scan.js';

// Each kind its own step of white, brightest for what people come here to manage. The one under focus
// goes to full white, so moving down the list lights its share of the drive.
const SHADE = {packages: '#d9d9de', images: '#a3a3ab', archives: '#76767f', extracted: '#5a5a62', other: '#46464d'};
const OTHER_DATA = '#2b2b30';
const lift = {type: 'tween', duration: 0.18, ease: EASE_OUT};

function Swatch({color, label, size}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2 w-2 rounded-full" style={{backgroundColor: color}} />
      <Text className="font-sans text-[13px] text-muted">{label}</Text>
      <Text className="font-sans text-[13px] text-subtle">{size}</Text>
    </View>
  );
}

/**
 * The drive as one bar: Overdrive's files by kind, then everything else on it, then free space. `focus`
 * is the kind under focus; `width` is in logical px.
 */
export function StorageBar({usage, sums, focus, width}) {
  const t = useT();
  if (!usage?.total) return null;
  const share = bytes => Math.round((bytes / usage.total) * width);
  const kinds = KINDS.filter(kind => sums[kind.key].size > 0);
  const others = Math.max(0, usage.total - usage.free - sums.all.size);
  return (
    <View className="gap-3">
      <View className="h-2 flex-row overflow-hidden rounded-full bg-surface" style={{width: px(width)}}>
        {kinds.map(kind => (
          <motion.View key={kind.key} className="h-2" initial={false} transition={lift}
            animate={{opacity: !focus || focus === kind.key ? 1 : 0.55}}
            style={{width: px(Math.max(3, share(sums[kind.key].size))), backgroundColor: focus === kind.key ? '#ffffff' : SHADE[kind.key]}} />
        ))}
        <View className="h-2" style={{width: px(share(others)), backgroundColor: OTHER_DATA}} />
      </View>
      <View className="flex-row flex-wrap gap-x-5 gap-y-1" style={{width: px(width)}}>
        {kinds.map(kind => <Swatch key={kind.key} color={focus === kind.key ? '#ffffff' : SHADE[kind.key]}
          label={t(`files.kind.${kind.key}`)} size={formatBytes(sums[kind.key].size)} />)}
        <Swatch color={OTHER_DATA} label={t('files.otherData')} size={formatBytes(others)} />
      </View>
    </View>
  );
}
