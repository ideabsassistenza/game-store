// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {createContext, useContext, useMemo, useRef, useState} from 'react';
import {NO_FILTERS, listedId, toggleValue} from './catalog.js';
import {loadList, saveList} from './saved.js';

const StateContext = createContext(null);
const WishlistContext = createContext([]);
const QueryContext = createContext('');
const QueryActiveContext = createContext(false);
const ActionsContext = createContext(null);

// Actions live in their own context and never change, so components that only act on the store
// (TopCharts, buttons) do not re-render when the wishlist or filters change. The wishlist and the
// query have their own contexts too: a favorite toggle or a search key re-renders only their readers.
export function StoreProvider({children}) {
  // Saved under the card's id, so a favorite made on an entry that later lost its card (a region
  // merged into another's card) still shows on that card.
  const [wishlist, setWishlist] = useState(() => [...new Set(loadList('wishlist.json', 'wishlist').map(listedId))]);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState('relevance');
  const [query, setQuery] = useState('');

  const [actions] = useState(() => ({
    setFilters, setSort, setQuery,
    toggleWish: id => setWishlist(list => {
      const next = toggleValue(list, listedId(id));
      saveList('wishlist.json', 'wishlist', next);
      return next;
    }),
    toggleFilter: (key, value) => setFilters(current => ({...current, [key]: toggleValue(current[key], value)})),
    clearFilters: () => {
      setFilters(NO_FILTERS);
      setQuery('');
    },
  }));
  const state = useMemo(() => ({filters, sort}), [filters, sort]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <WishlistContext.Provider value={wishlist}>
          <QueryActiveContext.Provider value={query !== ''}>
            <QueryContext.Provider value={query}>{children}</QueryContext.Provider>
          </QueryActiveContext.Provider>
        </WishlistContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

/**
 * While `frozen`, its subtree keeps seeing the store as it was when it froze, so a hidden screen
 * (Browse under Search) does not re-render on every key; it catches up when unfrozen.
 */
export function StoreFreeze({frozen, children}) {
  const live = {state: useContext(StateContext), wishlist: useContext(WishlistContext), query: useContext(QueryContext)};
  const kept = useRef(live);
  if (!frozen) kept.current = live;
  return (
    <StateContext.Provider value={kept.current.state}>
      <WishlistContext.Provider value={kept.current.wishlist}>
        <QueryContext.Provider value={kept.current.query}>{children}</QueryContext.Provider>
      </WishlistContext.Provider>
    </StateContext.Provider>
  );
}

/**
 * @returns {{toggleWish: (id: string) => void, setFilters: Function, setSort: Function, setQuery: Function,
 *   toggleFilter: (key: string, value: string) => void, clearFilters: () => void}}
 *   stable for the app's lifetime
 */
export const useStoreActions = () => useContext(ActionsContext);

/**
 * Filters and sort.
 * @returns {{filters: {[facet: string]: string[], wishlist: boolean}, sort: string}}
 */
export const useStoreState = () => useContext(StateContext);

/** Favorite game ids. @returns {string[]} */
export const useWishlist = () => useContext(WishlistContext);

/** The search query; changes on every search key. @returns {string} */
export const useQuery = () => useContext(QueryContext);

/** Whether a search query is set; changes only when it becomes empty or non-empty. @returns {boolean} */
export const useQueryActive = () => useContext(QueryActiveContext);

/**
 * Everything together; re-renders the caller on any store change, every search key included.
 * @returns {ReturnType<typeof useStoreState> & {wishlist: string[], query: string}
 *   & ReturnType<typeof useStoreActions>}
 */
export function useStore() {
  const state = useContext(StateContext);
  const wishlist = useContext(WishlistContext);
  const query = useContext(QueryContext);
  const actions = useContext(ActionsContext);
  return useMemo(() => ({...state, wishlist, query, ...actions}), [state, wishlist, query, actions]);
}
