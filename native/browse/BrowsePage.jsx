// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useState} from 'react';
import {View, Text, ScrollView, FocusScope} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {StoreFreeze} from '../state/store.jsx';
import {useFolderInstall} from '../state/update.js';
import {useFavoriteAction} from '../ui/GameCard.jsx';
import {Icon} from '../ui/Icon.jsx';
import {Logo} from '../ui/Logo.jsx';
import {colors} from '../ui/colors.js';
import {Catalog} from './Catalog.jsx';
import {CdnRail} from './CdnRail.jsx';
import {ContinueRow} from './ContinueRow.jsx';
import {FilterDrawer} from './FilterDrawer.jsx';
import {GenreRail} from './GenreRail.jsx';
import {PageHints} from './PageHints.jsx';
import {PopularRail} from './PopularRail.jsx';
import {RecentRow} from './RecentRow.jsx';
import {Spotlight} from './Spotlight.jsx';
import {TopCharts} from './TopCharts.jsx';

function Footer() {
  const t = useT();
  return (
    <View className="-mx-8 mt-20 flex-row items-center justify-between border-t border-line px-8 py-8">
      <Logo color={colors.muted} />
      <Text className="font-sans text-sm text-subtle">{t('browse.footer')}</Text>
    </View>
  );
}

const MIGRATE_GUIDE = 'github.com/overdriveps5/overdrive-releases/blob/main/MIGRATE.md';

// Folder installs are being retired for the single-file image, which the user installs by hand. Not
// focusable: it only informs, and stays until the app runs from the image.
function FolderInstallNotice() {
  const t = useT();
  if (!useFolderInstall()) return null;
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3">
      <Icon name="alert" size={18} color={colors.muted} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-sm text-muted">{t('browse.folderInstall')}</Text>
        <Text className="font-mono text-sm text-fg">{MIGRATE_GUIDE}</Text>
      </View>
    </View>
  );
}

// Memoized apart from the drawer state, so opening the drawer does not re-render the page. The
// scope traps: Left at the page's edge found the header's Search, the nearest element left of the
// page. The header is reached only by Up from the spotlight, through its explicit nextFocusUp.
// The spotlight's anchor includes the top padding, so it scrolls back to 0.
const Sections = memo(function Sections({onOpenFilters}) {
  // Square on any card favorites its game, without opening it.
  const onAction = useFavoriteAction();
  return (
    <FocusScope trap onAction={onAction}>
      <ScrollView className="flex-1 gap-10 px-8">
        <View scrollAnchor className="gap-4 pt-6">
          <FolderInstallNotice />
          <Spotlight />
        </View>
        <PopularRail />
        <CdnRail />
        <ContinueRow />
        <RecentRow />
        <TopCharts />
        <GenreRail />
        <Catalog onOpenFilters={onOpenFilters} />
        <Footer />
      </ScrollView>
    </FocusScope>
  );
});

/**
 * The library home: spotlight, charts, genres and the grid, scrolled by focus, with the filter
 * drawer over it. Memoized: it takes no props, and its sections subscribe to exactly the state
 * they show. The page behind the drawer is frozen until the drawer has slid out: each toggle would
 * otherwise remount the dimmed grid (a 50 ms frame on an M4), and catching up once costs one.
 */
export const BrowsePage = memo(function BrowsePage() {
  const [open, setOpen] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [drawer] = useState(() => ({
    open: () => {
      setOpen(true);
      setFrozen(true);
    },
    close: () => setOpen(false),
    closed: () => setFrozen(false),
  }));
  return (
    <>
      <StoreFreeze frozen={frozen}>
        <Sections onOpenFilters={drawer.open} />
      </StoreFreeze>
      <FilterDrawer open={open} onClose={drawer.close} onClosed={drawer.closed} />
      <PageHints />
    </>
  );
});
