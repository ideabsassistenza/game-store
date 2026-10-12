// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useRef, useState} from 'react';
import {View, Text, ScrollView, FocusScope, AnimatePresence, useIsFocused} from '@ps5-react/core';
import {formatNumber, useT} from '../i18n/index.js';
import {FACETS, activeCount, facetCounts, facetTitle, filterGames, optionLabel} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {useStore} from '../state/store.jsx';
import {useHints} from '../ui/Legend.jsx';
import {Button} from '../ui/Button.jsx';
import {CdnAura, CdnSpark} from '../ui/CdnAura.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {PlatformBadge} from '../ui/PlatformBadge.jsx';
import {SheetPanel} from '../ui/SideSheet.jsx';
import {EASE_OUT} from '../ui/ease.js';

// The panel's w-[480px]; a translate repaints only the strip it uncovers.
const WIDTH = 480;
const slide = {type: 'tween', duration: 0.24, ease: EASE_OUT};
// Facets this short read as a row of tiles, the way a store lays out sizes; longer ones wrap as pills.
const TILE_LIMIT = 3;
// Longer pill lists show their leading options and a "+N more" pill; picked options always show.
const PILL_LIMIT = 12;

// A picked option inverts to white, the one emphasis the monochrome palette keeps for state; an option
// that would show no games stays reachable but dim.
function TileFace({facet, value, label, count, active}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      {facet === 'platform' ? <PlatformBadge platforms={[value]} />
        : <Text className={active ? 'font-sans text-[15px] font-semibold text-canvas' : 'font-sans text-[15px] font-semibold text-fg'}>{label}</Text>}
      <Text className={active ? 'font-sans text-sm text-canvas/70' : count === 0 ? 'font-sans text-sm text-subtle/60'
        : focused ? 'font-sans text-sm text-fg' : 'font-sans text-sm text-subtle'}>
        {t('catalog.gameCount', {count})}
      </Text>
    </>
  );
}

// An option that would show no games is skipped by the D-pad: toggling it could only empty the grid.
const reachable = ({count, active}) => count > 0 || active;

function Tile({focusKey, autoFocus, ...props}) {
  const {active, onPress} = props;
  return (
    <View focusKey={focusKey} autoFocus={autoFocus} focusable={reachable(props)} onPress={onPress} className={active ? 'h-[72px] flex-1 justify-center gap-1.5 rounded-lg bg-fg px-4'
      : 'h-[72px] flex-1 justify-center gap-1.5 rounded-lg border border-line px-4 focused:bg-surface-2'}>
      <TileFace {...props} />
    </View>
  );
}

function PillFace({label, count, active}) {
  const focused = useIsFocused();
  const empty = count === 0 && !active;
  return (
    <>
      <FocusRing round="full" />
      <Text className={active ? 'font-sans text-sm font-semibold text-canvas' : empty ? 'font-sans text-sm text-subtle/60'
        : focused ? 'font-sans text-sm text-fg' : 'font-sans text-sm text-fg/85'}>{label}</Text>
      <Text className={active ? 'font-sans text-[13px] text-canvas/60' : 'font-sans text-[13px] text-subtle'}>{formatNumber(count)}</Text>
    </>
  );
}

function Pill({label, count, active, onPress, focusKey, autoFocus, value}) {
  // Overdrive CDN's pill wears its aura, and its spark, unless picked (then it inverts like the rest).
  const cdn = value === 'overdrive cdn' && !active;
  return (
    <View focusKey={focusKey} autoFocus={autoFocus} focusable={reachable({count, active})} onPress={onPress} className={active ? 'h-10 flex-row items-center gap-2 rounded-full bg-fg px-4'
      : cdn ? 'relative h-10 flex-row items-center gap-2 rounded-full bg-surface px-4'
      : 'h-10 flex-row items-center gap-2 rounded-full bg-surface px-4 focused:bg-surface-3'}>
      {cdn ? <CdnAura radius={20} width={170} /> : null}
      {cdn ? <CdnSpark size={14} /> : null}
      <PillFace label={label} count={count} active={active} />
    </View>
  );
}

function More({count, onPress}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <View onPress={onPress} className="h-10 flex-row items-center rounded-full border border-line px-4 focused:bg-surface-3">
      <FocusRing round="full" />
      <Text className={focused ? 'font-sans text-sm text-fg' : 'font-sans text-sm text-muted'}>{t('filters.more', {count})}</Text>
    </View>
  );
}

function ClearFacet({onPress}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <View onPress={onPress} className="rounded px-1">
      <FocusRing />
      <Text className={focused ? 'font-sans text-sm text-fg' : 'font-sans text-sm text-muted'}>{t('filters.clearFacet')}</Text>
    </View>
  );
}

function Facet({facet, store, autoFocus}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const {focusLater} = useNavActions();
  const counts = facetCounts(store, facet);
  const picked = store.filters[facet.key];
  const tiles = facet.options.length <= TILE_LIMIT;
  const folded = !tiles && !expanded && facet.options.length > PILL_LIMIT;
  const shown = folded ? facet.options.filter((option, index) => index < PILL_LIMIT || picked.includes(option.value))
    : facet.options;
  return (
    <View className="gap-3 border-b border-line py-5">
      <View className="h-6 flex-row items-center justify-between">
        <Text className="font-sans text-[13px] font-semibold tracking-[0.08em] text-muted">{facetTitle(facet.key).toUpperCase()}</Text>
        {picked.length > 0 && (
          <View className="flex-row items-center gap-3">
            <Text className="font-sans text-sm text-fg">{t('filters.selected', {count: picked.length})}</Text>
            <ClearFacet onPress={() => {
              store.setFilters({...store.filters, [facet.key]: []});
              focusLater(`filters:${facet.key}`);
            }} />
          </View>
        )}
      </View>
      <View className={tiles ? 'flex-row gap-3' : 'flex-row flex-wrap gap-2'}>
        {shown.map((option, index) => {
          const {value} = option;
          const props = {facet: facet.key, value, label: optionLabel(option), count: counts[value], active: picked.includes(value),
            onPress: () => store.toggleFilter(facet.key, value),
            focusKey: index === 0 ? `filters:${facet.key}` : `filters:${facet.key}:${value}`, autoFocus: index === 0 && autoFocus};
          return tiles ? <Tile key={value} {...props} /> : <Pill key={value} value={value} {...props} />;
        })}
        {folded && <More count={facet.options.length - shown.length} onPress={() => {
          // The pill unmounts; focus moves on to the first option it revealed.
          setExpanded(true);
          focusLater(`filters:${facet.key}:${facet.options[PILL_LIMIT].value}`);
        }} />}
      </View>
    </View>
  );
}

const HINTS = [{button: 'cross', label: 'hints.toggle'}, {button: 'circle', label: 'hints.close'}];

function Panel({onClose}) {
  useHints(HINTS);
  const t = useT();
  const store = useStore();
  const {filters, clearFilters} = store;
  const {focusLater} = useNavActions();
  const count = activeCount(filters);
  const total = filterGames(store).length;
  const opened = useRef(JSON.stringify(filters));
  // A changed filter remounts the grid, so the card that opened the drawer is gone: focus returns to
  // the Filters button rather than to whatever the engine finds nearest the drawer.
  const close = () => {
    if (JSON.stringify(filters) !== opened.current) focusLater('catalog:filters');
    onClose();
    return true;
  };
  return (
    // A modal: the shoulder buttons would switch the header's section under it, so every action stops here.
    <FocusScope trap onBack={close} onAction={action => (action !== 'triangle' && action !== 'options') || close()}>
      <View className="h-16 flex-row items-center gap-3 border-b border-line">
        <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{t('filters.title')}</Text>
        {count > 0 && (
          <View className="h-6 min-w-6 items-center justify-center rounded-full bg-fg px-2">
            <Text className="font-sans text-[13px] font-semibold text-canvas">{String(count)}</Text>
          </View>
        )}
        <View className="flex-1" />
        <Text className="font-sans text-sm text-muted">{t('catalog.gameCount', {count: total})}</Text>
      </View>
      <ScrollView className="-mx-4 flex-1 px-4">
        {FACETS.map((facet, index) => <Facet key={facet.key} facet={facet} store={store} autoFocus={index === 0} />)}
        {/* The actions end the list rather than sticking to the bottom: pinned, the button was the
            nearest element below every facet, so Down jumped to it and the facets past the fold were
            out of reach. Results already update live; Circle closes too. */}
        <View className="flex-row gap-3 pb-6 pt-5">
          {count > 0 && (
            <Button variant="secondary" size="lg" label={t('filters.clearAll')} onPress={() => {
              clearFilters();
              focusLater(`filters:${FACETS[0].key}`);
            }} />
          )}
          <Button variant="primary" size="lg" className="flex-1" label={t('filters.show', {count: total})} onPress={close} />
        </View>
      </ScrollView>
    </FocusScope>
  );
}

/**
 * Every catalog filter in a panel over the right edge of the page: short facets as tiles, long ones as
 * pills, each option counting the games it would show. Focus stays in it until Circle, Triangle or
 * "Show N games" closes it; the legend shows Circle. `onClosed` follows the exit slide.
 */
export const FilterDrawer = memo(function FilterDrawer({open, onClose, onClosed}) {
  return (
    <AnimatePresence onExitComplete={onClosed}>
      {open && (
        <View key="drawer" className="absolute inset-0 z-30">
          <SheetPanel className="w-[480px] px-6"
            initial={{x: WIDTH}} animate={{x: 0}} exit={{x: WIDTH, transition: {...slide, duration: 0.16}}}
            transition={slide}>
            <Panel onClose={onClose} />
          </SheetPanel>
        </View>
      )}
    </AnimatePresence>
  );
});
