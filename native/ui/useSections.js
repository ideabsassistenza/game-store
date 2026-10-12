// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useRef, useState} from 'react';
import {NO_FILTERS, activeCount} from '../state/catalog.js';
import {useNavActions, useNavState} from '../state/nav.jsx';
import {useQueryActive, useStoreActions, useStoreState} from '../state/store.jsx';

const KEYS = {search: 'nav:search', discover: 'nav:discover', catalog: 'nav:browse', top: 'nav:top',
  new: 'nav:new', favorites: 'nav:favorites', downloads: 'nav:downloads', files: 'nav:files'};
// L1/R1 order, as laid out in the bar. Browse is a genre menu rather than a tab ("All games" is
// Discover's view), so the shoulders skip it; a genre view sits between Discover and Top rated.
const TABS = ['search', 'discover', 'top', 'new', 'favorites', 'downloads', 'files'];

/** Shows the library with `filters` and `sort` and no query, back home, focusing `target`. */
export function useShowLibrary() {
  const store = useStoreActions();
  const nav = useNavActions();
  const [show] = useState(() => (filters, sort, target = 'catalog:sort') => {
    store.setFilters(filters);
    store.setQuery('');
    store.setSort(sort);
    nav.home(target);
  });
  return show;
}

function sectionOf({filters, sort}, query) {
  if (filters.wishlist) return 'favorites';
  if (sort === 'rating') return 'top';
  if (sort === 'newest') return 'new';
  if (activeCount(filters) > 0 || query) return 'catalog';
  return 'discover';
}

/**
 * The header's sections: the current one (null on a game page), a handler per section that resets
 * the library view like the source's links did, and `step(forward)` for L1/R1. On a game or search
 * page the step is from the library section underneath it, and lands back home.
 */
export function useSections() {
  // Narrow subscriptions: typing in Search changes the query on every key, not whether one is set.
  const store = {...useStoreState(), ...useStoreActions()};
  const queryActive = useQueryActive();
  const nav = useNavActions();
  const {top} = useNavState();
  const show = useShowLibrary();
  const underneath = top.name === 'downloads' || top.name === 'files' ? top.name : sectionOf(store, queryActive);
  const section = top.name === 'search' ? 'search' : top.name === 'game' ? null : underneath;

  const topName = useRef(top.name);
  topName.current = top.name;
  // Created once, so the memoized items skip the re-render every navigation causes in the header.
  const [on] = useState(() => ({
    show,
    search: () => topName.current !== 'search' && nav.push({name: 'search'}, 'nav:search'),
    discover: () => show(NO_FILTERS, 'relevance', 'spotlight:cta'),
    top: () => show(NO_FILTERS, 'rating'),
    new: () => show(NO_FILTERS, 'newest'),
    favorites: () => show({...NO_FILTERS, wishlist: true}, 'relevance'),
    downloads: () => topName.current !== 'downloads' && nav.push({name: 'downloads'}, 'nav:downloads'),
    files: () => topName.current !== 'files' && nav.push({name: 'files'}, 'nav:files'),
  }));

  // The header follows the page: a step that lands down the page (the catalog) leaves it hidden,
  // since shown it covered the catalog's title.
  const step = forward => {
    const current = top.name === 'search' ? 'search' : underneath;
    const at = current === 'catalog' ? 1.5 : TABS.indexOf(current);
    const next = TABS[forward ? Math.floor(at) + 1 : Math.ceil(at) - 1];
    if (!next) return;
    if (next === 'downloads' || next === 'files') {
      store.setQuery('');
      nav.home();
    }
    on[next]();
  };

  return {
    section,
    filters: store.filters,
    on,
    step,
    // The page's top elements go up to `nav:current`, the current section's item, like a PS5 tab
    // row; the scope's own memory would be stale after L1/R1 or a closed menu.
    keyOf: name => (name === section ? 'nav:current' : KEYS[name]),
  };
}
