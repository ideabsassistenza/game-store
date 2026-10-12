// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useMemo} from 'react';
import {Text, View, useIsFocused} from '@ps5-react/core';
import {t, useLocale, useT} from '../i18n/index.js';
import {formatBytes, formatSize} from '../state/catalog.js';
import {FocusRing} from '../ui/FocusRing.jsx';
import {PlatformBadge} from '../ui/PlatformBadge.jsx';
import {SideSheet} from '../ui/SideSheet.jsx';
import {colors} from '../ui/colors.js';
import {preferredRelease} from './releases.js';
import {sourceSections} from './sources.js';

// The game's own sources: add-ons and incomplete sets are not a way to get it.
function summary(edition) {
  const releases = edition.releases || [];
  const bytes = releases[preferredRelease(releases)]?.sizeBytes;
  const sources = sourceSections(releases).filter(({group}) => group !== 'dlc' && group !== 'unavailable')
    .reduce((sum, {items}) => sum + items.length, 0);
  return [bytes ? formatBytes(bytes) : edition.sizeGb ? formatSize(edition.sizeGb) : null, t('versions.sources', {count: sources})];
}

// Some games have several entries on one platform (regions); their region and title ID tell them apart.
export function VersionFace({edition, here, twin, recommended}) {
  const t = useT();
  const {locale} = useLocale();
  const focused = useIsFocused();
  // Ranking an edition's sources reads them all; a focus move re-renders the row and changes none.
  const facts = useMemo(() => summary(edition), [edition, locale]);
  const detail = [...facts, here ? t('versions.thisPage') : null].filter(Boolean).join(' · ');
  const name = t('versions.name', {platform: edition.platform.toUpperCase()});
  return (
    <>
      <FocusRing />
      <PlatformBadge platforms={[edition.platform]} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[15px] font-semibold text-fg">{twin ? [name, edition.region, edition.titleId].filter(Boolean).join(' · ') : name}</Text>
        <Text style={{color: focused ? colors.fg : colors.muted}} className="font-sans text-sm">{t(recommended ? 'versions.recommended' : `versions.note.${edition.platform}`)}</Text>
        <Text className="font-sans text-sm text-subtle">{detail}</Text>
      </View>
    </>
  );
}

/**
 * Which edition of a title to download, PS5 first, before the download starts. `submit(edition)`
 * runs after the sheet closes.
 */
export function VersionSheet({title, editions, current, submit, onClose}) {
  const t = useT();
  return (
    <SideSheet title={t('versions.title')} subtitle={title} onClose={onClose}>
      <View className="gap-1 p-1.5">
        {editions.map((edition, index) => (
          <View key={edition.id} autoFocus={index === 0} onPress={() => { onClose(); submit(edition); }}
            className="relative flex-row items-center gap-4 rounded-lg px-3 py-4 focused:bg-surface-2">
            <VersionFace edition={edition} here={edition.id === current} recommended={index === 0 && edition.platform === 'ps5'}
              twin={editions.some(other => other !== edition && other.platform === edition.platform)} />
          </View>
        ))}
      </View>
    </SideSheet>
  );
}
