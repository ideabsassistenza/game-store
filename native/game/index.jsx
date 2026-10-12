// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, Text, ScrollView, FocusScope, AnimatePresence} from '@ps5-react/core';
import {GameCard, useFavoriteAction} from '../ui/GameCard.jsx';
import {SectionHeader} from '../ui/SectionHeader.jsx';
import {About} from './About.jsx';
import {GameFacts} from './GameFacts.jsx';
import {BrowserCaptureDialog} from '../downloads/BrowserCaptureDialog.jsx';
import {URLDialog} from '../downloads/URLDialog.jsx';
import {OptionsSheet} from './OptionsSheet.jsx';
import {VersionSheet} from './VersionSheet.jsx';
import {SourcePicker} from './SourcePicker.jsx';
import {GameHero} from './GameHero.jsx';
import {InstallToast, TOAST_MS} from './InstallToast.jsx';
import {ShotViewer} from './ShotViewer.jsx';
import {MediaGallery} from './MediaGallery.jsx';
import {useT} from '../i18n/index.js';
import {featureLabel, relatedGames} from '../state/catalog.js';
import {downloadQueue} from '../state/downloads.js';
import {lightGame, unlight} from '../ui/lightBar.js';
import {useNavActions} from '../state/nav.jsx';
import {playNotify} from '../ui/sounds.js';

const CARD_WIDTH = 189;

function Features({features}) {
  const t = useT();
  return (
    <View>
      <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{t('game.features')}</Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {features.map(feature => (
          <View key={feature} className="rounded-md bg-surface-2 px-3 py-1.5">
            <Text className="font-sans text-sm text-fg/90">{featureLabel(feature)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// No entrance here: the row first appears while the page scrolls, and fading five cards during a
// scroll cost 21-27 ms frames on the PS5.
function Related({games, onOpenGame}) {
  const t = useT();
  return (
    <View scrollAnchor className="mt-20">
      <SectionHeader title={t('game.moreLikeThis')} />
      <View className="flex-row gap-x-4">
        {games.map(other => (
          <GameCard key={other.id} game={other} width={CARD_WIDTH} onPress={() => onOpenGame(other)} />
        ))}
      </View>
    </View>
  );
}

export function GameScreen({game, download, onBack, onOpenGame}) {
  const [dialog, setDialog] = useState(null);
  const [captureJob, setCaptureJob] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewing, setViewing] = useState(null);
  const {focusLater} = useNavActions();
  const Dialog = {source: SourcePicker, options: OptionsSheet, version: VersionSheet}[dialog?.kind] ?? URLDialog;
  const related = relatedGames(game);
  // A blank catalog paragraph would still take a line and a gap.
  const about = game.about.filter(text => text.trim());

  // The controller's light bar takes the game's colour while its page is open.
  useEffect(() => {
    const key = `page:${game.id}`;
    lightGame(key, game);
    return () => unlight(key);
  }, [game.id]);

  useEffect(() => {
    if (!toast) return undefined;
    playNotify();
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // A job for this game appearing in the queue means the hero's button just started a download.
  // The listener sets state only on that transition, so progress ticks do not re-render the page.
  useEffect(() => {
    let known;
    const queued = jobs => jobs.filter(job => job.gameId === game.id).length;
    try {
      return downloadQueue().subscribe(jobs => {
        setCaptureJob(jobs.find(job => job.gameId === game.id && job.captureState) || null);
        const count = queued(jobs);
        if (known !== undefined && count > known) setToast('started');
        known = count;
      });
    } catch { return undefined; }
  }, [game.id]);

  // Square favorites the focused related card, or else this game.
  const onAction = useFavoriteAction(game);

  const back = () => {
    onBack();
    return true;
  };

  // The scope traps, as the library's does: Left from the first screenshot or related card found the
  // header's Search, the nearest element left of the page. Up from the back link reaches the header.
  return (
    <FocusScope trap autoFocus onBack={back} onAction={onAction}>
      <View className="relative flex-1">
        <ScrollView className="flex-1">
          <GameHero onRequestDialog={setDialog} game={game} download={download} onBack={onBack} onDownloaded={() => setToast('complete')} />
          {/* No entrance: the body fills the screen below the hero, and rising it in repainted about 1 Mpx a
              frame for 1.2 s (26 ms frames on the PS5), so a scroll started meanwhile stuttered. */}
          <View className="px-8 pt-10 pb-16">
            <View className="flex-row gap-14">
              <View className="w-[872px] gap-14">
                {game.shots.length > 0 ? (
                  <MediaGallery shots={game.shots} nextDown={about.length > 0 ? 'game:about' : undefined} onOpen={setViewing} />
                ) : null}
                {about.length > 0 ? <About paragraphs={about} /> : null}
                {game.features.length > 0 ? <Features features={game.features} /> : null}
              </View>
              <GameFacts game={game} />
            </View>
            {related.length > 0 ? <Related games={related} onOpenGame={onOpenGame} /> : null}
          </View>
        </ScrollView>
        {viewing === null ? null : (
          <ShotViewer shots={game.shots} start={viewing} onClose={index => {
            setViewing(null);
            focusLater(`game:shot:${index}`);
          }} />
        )}
        {captureJob ? <BrowserCaptureDialog key={captureJob.id} job={captureJob} /> : null}
        {dialog ? <Dialog {...dialog} onClose={() => { setDialog(null); focusLater(dialog.from ?? `download:${game.id}`); }} /> : null}
        <AnimatePresence>{toast ? <InstallToast key={toast} game={game} started={toast === 'started'} /> : null}</AnimatePresence>
      </View>
    </FocusScope>
  );
}
