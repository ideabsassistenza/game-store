// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect} from 'react';
import {AppRegistry, View, FocusScope} from '@ps5-react/core';
import {LocaleProvider, useLocale} from './i18n/index.js';
import {BrowsePage} from './browse/BrowsePage.jsx';
import {DownloadsScreen} from './downloads/DownloadsScreen.jsx';
import {FilesScreen} from './files/FilesScreen.jsx';
import {GameScreen} from './game/index.jsx';
import {SearchScreen} from './search/index.jsx';
import {getGame, warmCovers} from './state/catalog.js';
import {NavProvider, useIsImmersive, useNavActions, useNavState} from './state/nav.jsx';
import {StoreFreeze, StoreProvider} from './state/store.jsx';
import {Header} from './ui/Header.jsx';
import {Legend} from './ui/Legend.jsx';
import {Splash} from './ui/Splash.jsx';
import {UpdateDialog} from './ui/UpdateDialog.jsx';
import {useInterfaceHaptics} from './ui/haptics.js';
import {useInterfaceSounds} from './ui/sounds.js';

function Screen({screen}) {
  const {openGame, pop} = useNavActions();
  const openCard = game => openGame(game.id, `card:${game.id}`);
  if (screen.name === 'game') return <GameScreen game={getGame(screen.id)} download={screen.download} onBack={pop} onOpenGame={openCard} />;
  if (screen.name === 'downloads') return <DownloadsScreen onBack={pop} onOpenGame={openGame} />;
  if (screen.name === 'files') return <FilesScreen onBack={pop} />;
  return <SearchScreen onBack={pop} onOpenGame={openCard} />;
}

// Browse stays mounted under the other screens: remounting its ~400 nodes cost a 70 ms frame on
// every return. It is hidden while another screen is up and its scope is inert, so the D-pad
// cannot reach its stale (display: none) elements; its store view is frozen so search typing
// does not re-render it.
function BrowseLayer({shown}) {
  return (
    <View className={shown ? 'absolute inset-x-0 top-16 bottom-10' : 'absolute inset-x-0 top-16 bottom-10 hidden'}>
      <StoreFreeze frozen={!shown}>
        <FocusScope focusKey="page" autoFocus inert={!shown}>
          <BrowsePage />
        </FocusScope>
      </StoreFreeze>
    </View>
  );
}

// Warming waits for the first screen's own images to be requested; it yields to every load anyway.
const WARM_DELAY_MS = 3000;

function App() {
  useInterfaceSounds();
  useInterfaceHaptics();
  useEffect(() => {
    const id = setTimeout(warmCovers, WARM_DELAY_MS);
    return () => clearTimeout(id);
  }, []);
  const {top} = useNavState();
  const onBrowse = top.name === 'browse';
  const key = top.name === 'game' ? `game:${top.id}` : top.name;
  const immersive = useIsImmersive();
  const {rtl} = useLocale();
  // Screens swap instantly and their own blocks stagger in: a full-screen slide repaints the whole
  // screen every frame (about 19 ms of raster at 1080p on an M4, so 30 fps), while the staggered
  // blocks repaint only themselves.
  return (
    // Arabic and Urdu mirror every row and right-align every paragraph from here.
    <View className="w-screen h-screen bg-canvas" style={{direction: rtl ? 'rtl' : 'ltr'}}>
      <Header>
        {/* Every screen sits below the fixed header and above the hints: nothing overlays a page's
            ScrollView, which would cost its scroll copy. */}
        <BrowseLayer shown={onBrowse} />
        {onBrowse ? null : (
          // No background of its own: the root's canvas shows through, so a screen change does not
          // fill the whole screen twice. `screen` lets the header's Down return to where it was left.
          <View key={key} className={immersive ? 'absolute inset-0' : top.name === 'downloads' || top.name === 'files'
            ? 'absolute inset-x-0 top-16 bottom-0' : 'absolute inset-x-0 top-16 bottom-10'}>
            <FocusScope focusKey="screen">
              <Screen screen={top} />
            </FocusScope>
          </View>
        )}
        {immersive ? null : <Legend screen={top.name} />}
        <UpdateDialog />
      </Header>
      <Splash />
    </View>
  );
}

AppRegistry.registerComponent('overdrive', () => () => (
  <LocaleProvider>
    <StoreProvider>
      <NavProvider>
        <App />
      </NavProvider>
    </StoreProvider>
  </LocaleProvider>
));
