// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {formatBytes, formatDate, formatSize} from '../state/catalog.js';
import {PlatformBadge} from '../ui/PlatformBadge.jsx';
import {preferredRelease} from './releases.js';

// Studio and actions already sit in the hero; the facts column holds the rest.
export function GameFacts({game}) {
  const t = useT();
  const releases = game.releases || [];
  const bytes = releases[preferredRelease(releases)]?.sizeBytes;
  // The file the button downloads, when known; the catalog's install size can differ widely.
  const size = bytes ? [t('game.facts.downloadSize'), formatBytes(bytes)]
    : [t('game.facts.installSize'), game.sizeGb ? formatSize(game.sizeGb) : '—'];
  // The store's tag for every edition of the game, as its card shows: PS5, PS4 or both joined.
  const platform = <PlatformBadge platforms={game.platforms} />;
  const rows = [
    [t('game.facts.platform'), platform],
    [t('game.facts.publisher'), game.publisher || '—'],
    [t('game.facts.releaseDate'), formatDate(game.releaseDate)],
    size,
  ];
  return (
    <View className="w-72">
      <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{t('game.details')}</Text>
      <View className="mt-4 border-b border-line">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between gap-4 border-t border-line py-3">
            <Text className="font-sans text-sm text-subtle">{label}</Text>
            {typeof value === 'string'
              ? <Text className="w-44 font-sans text-sm text-fg text-end truncate">{value}</Text> : value}
          </View>
        ))}
      </View>
    </View>
  );
}
