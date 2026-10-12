// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {useNavActions} from '../state/nav.jsx';
import {FACETS, facetLabel} from '../state/catalog.js';
import {useQuery, useStoreActions, useStoreState} from '../state/store.jsx';
import {Chip} from '../ui/Chip.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';

function ClearAll() {
  const t = useT();
  const focused = useIsFocused();
  return <Text focused={focused} className="font-sans text-sm text-muted focused:text-fg">{t('filters.clearAll')}</Text>;
}

/** Removable chips for the query, favorites and every filter in effect, then Clear all for two or more. */
export const ActiveFilters = memo(function ActiveFilters() {
  const t = useT();
  const {filters} = useStoreState();
  const query = useQuery();
  const {setFilters, toggleFilter, setQuery, clearFilters} = useStoreActions();
  const {focusLater} = useNavActions();
  const chips = [
    query && {label: t('filters.queryChip', {query}), remove: () => setQuery('')},
    filters.wishlist && {label: t('filters.favorites'), remove: () => setFilters({...filters, wishlist: false})},
    ...FACETS.flatMap(({key}) => filters[key].map(value => ({label: facetLabel(key, value), remove: () => toggleFilter(key, value)}))),
  ].filter(Boolean);
  if (!chips.length) return null;

  // The removed chip unmounts: focus goes to its neighbour, or to the Filters button after the last one.
  const remove = (index, action) => {
    const neighbour = chips[index + 1] ?? chips[index - 1];
    action();
    focusLater(neighbour ? `chip:${neighbour.label}` : 'catalog:filters');
  };

  return (
    <>
      {chips.map((chip, index) => (
        <Chip key={chip.label} focusKey={`chip:${chip.label}`} label={chip.label}
          onPress={() => remove(index, chip.remove)} />
      ))}
      {chips.length > 1 && (
        <View onPress={() => {
          clearFilters();
          focusLater('catalog:filters');
        }} className="h-10 justify-center rounded-full px-4 focused:bg-surface-3">
          <FocusRing round="full" />
          <ClearAll />
        </View>
      )}
    </>
  );
});
