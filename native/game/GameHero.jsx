// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {View, Text, Image, motion} from '@ps5-react/core';
import {COVER, HERO, LOGO} from './art.js';
import {Button} from '../ui/Button.jsx';
import {Cover} from '../ui/Cover.jsx';
import {GameLogo} from '../ui/GameLogo.jsx';
import {WishHeart} from '../ui/WishHeart.jsx';
import {EASE_OUT} from '../ui/ease.js';
import {SPAN_MAX, fitBytes, latin, useLocale, useT} from '../i18n/index.js';
import {genreLabel, listedId} from '../state/catalog.js';
import {useStoreActions, useWishlist} from '../state/store.jsx';
import {BackLink} from './BackLink.jsx';
import {DownloadButton} from './DownloadButton.jsx';
import {canDownload} from './releases.js';


// The cover lands first; the text follows in short steps. The actions row stays put: a transform,
// even at rest, would make each download tick and focus change repaint the whole row.
const column = {hidden: {}, show: {transition: {staggerChildren: 0.06, delayChildren: 0.22}}};
const rise = {hidden: {opacity: 0, y: 12}, show: {opacity: 1, y: 0, transition: {duration: 0.55, ease: EASE_OUT}}};

// Background failures can use a screenshot of the same game without changing the layout.
function Backdrop({game}) {
  const [failed, setFailed] = useState([]);
  const uri = [game.art.hero, ...game.shots.map(shot => shot.url)]
    .find(url => url && !failed.includes(url));
  // The cover's tint stands in for the art until it arrives.
  return uri ? <Image key={uri} source={{uri}} className="absolute left-0 -top-16 bg-surface-2"
    style={game.art.tint ? {...HERO, backgroundColor: game.art.tint} : HERO} resizeMode="cover"
    onError={() => setFailed(previous => [...previous, uri])} /> : null;
}

function Meta({game}) {
  const t = useT();
  const {rtl} = useLocale();
  return (
    <>
      <motion.View variants={rise} className="mt-2">
        <Text className="w-[640px] font-sans text-[15px] text-muted truncate">
          {latin(rtl, fitBytes(game.developer, SPAN_MAX - 3))}
          {game.developer && game.genres.length > 0 ? <Text className="text-subtle">{'  ·  '}</Text> : null}
          {fitBytes(game.genres.map(genreLabel).join(', '), SPAN_MAX)}
        </Text>
      </motion.View>
      <motion.View variants={rise} className="mt-4 flex-row items-center gap-6">
        {game.metacritic ? (
          <View className="flex-row items-center gap-2">
            <View className="rounded-sm bg-fg px-1.5">
              <Text className="font-sans text-sm font-bold text-canvas">{String(game.metacritic)}</Text>
            </View>
            <Text className="font-sans text-sm text-muted">{t('game.metacritic')}</Text>
          </View>
        ) : null}
        {game.year ? <Text className="font-sans text-sm text-muted">{t('game.released', {year: String(game.year)})}</Text> : null}
      </motion.View>
    </>
  );
}

// Like the console's game pages: art across the top band, cover, logo and actions beside it.
// The art appears at once and only the text blocks rise in. Fading or sliding the art repaints it
// and both gradients every frame (~16 ms of raster at 1080p on an M4, 33 ms frames), measured too slow.
export function GameHero({game, download, onBack, onDownloaded, onRequestDialog}) {
  const t = useT();
  const {rtl} = useLocale();
  const {toggleWish} = useStoreActions();
  const wished = useWishlist().includes(listedId(game.id));
  const nextDown = game.shots.length > 0 ? 'game:shots' : undefined;

  return (
    <View scrollAnchor className="relative overflow-hidden border-b border-line">
      {/* Until the art arrives its own box is a static skeleton; a pulse this large would repaint the band. */}
      <Backdrop key={game.id} game={game} />
      <View className={rtl ? 'absolute inset-0 bg-gradient-to-l from-canvas via-canvas/85 via-45% to-canvas/25'
        : 'absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 via-45% to-canvas/25'} />
      <View className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent via-40% to-canvas/40" />

      <View className="px-8 pt-6 pb-12">
        <BackLink onPress={onBack} />
        <View className="mt-10 flex-row items-end gap-10">
          <View className="w-48 h-64 overflow-hidden rounded-lg bg-surface">
            <Cover game={game} style={COVER} />
          </View>
          <motion.View variants={column} initial="hidden" animate="show" className="flex-1">
            <motion.View variants={rise} className="mb-4">
              <GameLogo game={game} width={LOGO.width} height={LOGO.height} />
            </motion.View>
            <Meta game={game} />
            <View className="mt-7 flex-row items-start gap-2.5">
              <DownloadButton onRequestDialog={onRequestDialog} key={game.id} game={game} start={download} onDownloaded={onDownloaded} nextDown={nextDown} />
              <Button variant="outline" size="lg" label={t(wished ? 'game.favorite' : 'game.addToFavorites')}
                onPress={() => toggleWish(game.id)} nextFocusDown={nextDown} autoFocus={!canDownload(game)} focusKey={`favorite:${game.id}`}>
                <WishHeart active={wished} />
              </Button>
            </View>
          </motion.View>
        </View>
      </View>
    </View>
  );
}
