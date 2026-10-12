// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useFocus} from '@ps5-react/core';
import {useNavState} from '../state/nav.jsx';
import {HINT, useHints} from '../ui/Legend.jsx';

const CATALOG = [HINT.select, {button: 'triangle', label: 'hints.filters'}, HINT.favorite, HINT.top, HINT.sections];
const CARDS = [HINT.select, HINT.favorite, HINT.top, HINT.sections];

function hintsFor(key) {
  if (/^(card|catalog|chip):/.test(key)) return CATALOG;
  if (/^(popular|recent|continue):/.test(key) && !key.endsWith(':all')) return CARDS;
  return null;
}

/**
 * Adds Triangle and Square to the legend while focus is where they work: the catalog, or a card in
 * the rows. Its own leaf: it re-renders on every focus move and renders nothing. The page stays
 * mounted under other screens, whose cards share the `card:` keys, so it answers only while shown.
 */
export function PageHints() {
  const {focusedKey} = useFocus();
  const shown = useNavState().top.name === 'browse';
  useHints(shown ? hintsFor(focusedKey ?? '') : null);
  return null;
}
