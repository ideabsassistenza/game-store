// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {Button} from '../ui/Button.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';

function copy(t, query, onlyWishlist) {
  if (query) return {title: t('catalog.empty.queryTitle', {query}), hint: t('catalog.empty.queryHint')};
  if (onlyWishlist) return {title: t('catalog.empty.wishlistTitle'), hint: t('catalog.empty.wishlistHint')};
  return {title: t('catalog.empty.filtersTitle'), hint: t('catalog.empty.filtersHint')};
}

/** Shown instead of the grid when nothing matches; the button resets every filter. */
export function EmptyState({query, onlyWishlist, onClear}) {
  const t = useT();
  const {title, hint} = copy(t, query, onlyWishlist);
  return (
    <View className="mt-6 items-center px-6 py-20">
      <Icon name={onlyWishlist ? 'heart' : 'searchX'} size={32} color={colors.subtle} />
      <Text className="mt-4 font-sans text-lg font-semibold text-fg">{title}</Text>
      <Text className="mt-1 w-[480px] text-center font-sans text-base text-muted">{hint}</Text>
      <View className="mt-6">
        <Button variant="outline" label={t('catalog.empty.browseAll')} focusKey="catalog:empty" onPress={onClear} />
      </View>
    </View>
  );
}
