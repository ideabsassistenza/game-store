// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useRef, useState} from 'react';
import {View, Text, FocusScope} from '@ps5-react/core';
import {focusEnd, useLocale, useT} from '../i18n/index.js';
import {NO_FILTERS, activeCount, genreLabel, genres, getGame} from '../state/catalog.js';
import {useIsImmersive, useNavActions, useNavState} from '../state/nav.jsx';
import {useWishlist} from '../state/store.jsx';
import {VERSION} from '../version.js';
import {ButtonGlyph} from './ButtonHints.jsx';
import {DownloadToast} from './DownloadToast.jsx';
import {DownloadsBadge} from './DownloadsBadge.jsx';
import {FocusRing} from './FocusRing.jsx';
import {LanguageSheet} from './LanguageSheet.jsx';
import {Logo} from './Logo.jsx';
import {Menu, MenuDivider, MenuItem} from './Menu.jsx';
import {NavItem} from './NavItem.jsx';
import {NavPill, useNavLayouts} from './NavPill.jsx';
import {useSections} from './useSections.js';

// One element for the app's lifetime, so the memoized Downloads item keeps equal props.
const BADGE = <DownloadsBadge />;

/**
 * The fixed top bar, above the screens it wraps and in the page's own black: Search and Discover /
 * Browse on the left, the logo centred, quick sorts, favorites, downloads and the language on the right. Every
 * section resets the library view, like the source's links did. L1/R1 step through the sections
 * from any screen; a full-screen viewer (useImmersive) hides it.
 */
export function Header({children}) {
  const t = useT();
  const {rtl} = useLocale();
  const {section, filters, on, step, keyOf} = useSections();
  const wishlist = useWishlist();
  // A favorite whose game left the catalog stays saved but is not shown or counted.
  const favorites = wishlist.filter(id => getGame(id)).length;
  const nav = useNavActions();
  const {top} = useNavState();
  const [browsing, setBrowsing] = useState(false);
  const [choosingLanguage, setChoosingLanguage] = useState(false);
  const immersive = useIsImmersive();
  const [layouts, track] = useNavLayouts();
  const onlyGenre = filters.genre.length === 1 && activeCount(filters) === 1 && filters.genre[0];
  // Down returns to where the page or screen was left, not to whatever sits under the item.
  const down = top.name === 'browse' ? 'page' : 'screen';

  const toastAction = useRef(null);

  const onAction = action => {
    if (action === 'r2' && toastAction.current) {
      toastAction.current();
      return true;
    }
    if (action !== 'l1' && action !== 'r1') return false;
    setBrowsing(false);
    // The language picker is the bar's last stop: R1 past Files opens it, as the globe does.
    if (action === 'r1' && section === 'files') setChoosingLanguage(true);
    else step(action === 'r1');
    return true;
  };
  // Circle the screens leave unhandled (focus in the header, say) goes back; at home it returns to
  // the top of the page.
  const onBack = () => {
    if (!nav.pop()) nav.focusLater('spotlight:cta');
    return true;
  };

  return (
    <FocusScope onAction={onAction} onBack={onBack}>
      {children}
      <DownloadToast actionRef={toastAction} />
      {choosingLanguage ? <LanguageSheet onClose={() => setChoosingLanguage(false)} /> : null}
      <View className={immersive ? 'absolute inset-x-0 top-0 z-40 hidden' : 'absolute inset-x-0 top-0 z-40'}>
        <FocusScope focusKey="header" inert={immersive}>
          <View onLayout={track('header')}
            className="h-16 flex-row items-center justify-between bg-canvas px-8">
            <NavPill section={section} layouts={layouts} />
            <View className="flex-1 flex-row items-center justify-between gap-4">
              <View className={rtl ? '-mr-4' : '-ml-4'}>
                <NavItem focusKey={keyOf('search')} icon="search" label={t('nav.search')} current={section === 'search'}
                  onPress={on.search} onLayout={track('search')} nextFocusDown={down} />
              </View>
              <View className="flex-row items-center gap-1">
                <ButtonGlyph button="l1" />
                <NavItem focusKey={keyOf('discover')} label={t('nav.discover')} current={section === 'discover'}
                  onPress={on.discover} onLayout={track('discover')} nextFocusDown={down} />
                <View className="relative">
                  <NavItem focusKey={keyOf('catalog')} label={t('nav.browse')} trailing={browsing ? 'chevronUp' : 'chevronDown'}
                    current={section === 'catalog'} onPress={() => setBrowsing(open => !open)}
                    onLayout={track('catalog')} nextFocusDown={down} />
                  <Menu open={browsing} onClose={() => setBrowsing(false)} rows={genres.length + 2}>
                    <MenuItem label={t('nav.allGames')} checked={section === 'catalog' && !filters.genre.length}
                      autoFocus={!onlyGenre} onSelect={() => on.show(NO_FILTERS, 'relevance')} />
                    <MenuDivider />
                    {genres.map(genre => (
                      <MenuItem key={genre} label={genreLabel(genre)} checked={onlyGenre === genre}
                        onSelect={() => on.show({...NO_FILTERS, genre: [genre]}, 'relevance')} />
                    ))}
                  </Menu>
                </View>
              </View>
            </View>
            <View focusKey="nav:home" onPress={on.discover} nextFocusDown={down} className="mx-6 flex-row items-center gap-2 rounded px-2">
              <FocusRing />
              <Logo />
              <Text className="font-sans text-[14px] text-subtle">{`v${VERSION}`}</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-between gap-4">
              <View className="flex-row items-center gap-1">
                <NavItem focusKey={keyOf('top')} label={t('nav.top')} current={section === 'top'}
                  onPress={on.top} onLayout={track('top')} nextFocusDown={down} />
                <NavItem focusKey={keyOf('new')} label={t('nav.new')} current={section === 'new'}
                  onPress={on.new} onLayout={track('new')} nextFocusDown={down} />
              </View>
              <View className="flex-row items-center gap-1">
                <NavItem focusKey={keyOf('favorites')} icon="heart"
                  label={favorites ? String(favorites) : null} current={section === 'favorites'}
                  onPress={on.favorites} onLayout={track('favorites')} nextFocusDown={down}
                  {...focusEnd(rtl, keyOf('downloads'))} />
                <NavItem focusKey={keyOf('downloads')} icon="download" current={section === 'downloads'}
                  onPress={on.downloads} onLayout={track('downloads')} nextFocusDown={down}>
                  {BADGE}
                </NavItem>
                <NavItem focusKey={keyOf('files')} icon="folder" current={section === 'files'}
                  onPress={on.files} onLayout={track('files')} nextFocusDown={down} />
                {/* The bar ends here: Right (Left in Arabic) would otherwise fall through to the page below. */}
                <NavItem focusKey="nav:language" icon="globe" onPress={() => setChoosingLanguage(true)}
                  nextFocusDown={down} {...focusEnd(rtl, 'nav:language')} />
                <ButtonGlyph button="r1" />
              </View>
            </View>
          </View>
        </FocusScope>
      </View>
    </FocusScope>
  );
}
