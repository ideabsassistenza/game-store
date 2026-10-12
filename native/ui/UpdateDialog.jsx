// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {BackHandler, FocusScope, Image, Text, View, tw} from '@ps5-react/core';
import {formatPercent, useT} from '../i18n/index.js';
import {formatBytes} from '../state/size.js';
import {ImageReplaceError, installUpdate, useAvailableUpdate} from '../state/update.js';
import {VERSION} from '../version.js';
import dial from '../assets/ascii-dial.png';
import {Button} from './Button.jsx';
import {ProgressBar} from './ProgressBar.jsx';
import {ShimmerText} from './ShimmerText.jsx';
import {px} from './scale.js';

// Long enough to read that it worked before the app closes. After an image install the user reopens
// the app, which ShadowMount mounts only once the new image is over 10 s old: it closes after that.
const CLOSE_DELAY_MS = 2000;
const REOPEN_DELAY_MS = 11000;
const DIAL = 324;
const STATUS = tw`font-mono text-[15px]`;

/**
 * Offers the update found at launch. Once accepted it downloads and installs in place, then closes and
 * reopens the app on the new version, or asks the user to reopen it. An image update already in place
 * (the app was reopened too soon and runs the old image) only asks to reopen it. Later dismisses it
 * until the next launch.
 */
export function UpdateDialog() {
  const t = useT();
  const update = useAvailableUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState(null);
  // The failure's paragraphs, each its own Text: a Text node holds at most 255 bytes.
  const [error, setError] = useState(null);
  const state = progress?.state;
  const relaunch = progress?.relaunch;

  useEffect(() => {
    if (state !== 'done') return;
    const id = setTimeout(() => BackHandler.exitApp({relaunch}), relaunch ? CLOSE_DELAY_MS : REOPEN_DELAY_MS);
    return () => clearTimeout(id);
  }, [state, relaunch]);

  if (!update || dismissed) return null;
  const install = async () => {
    setError(null);
    setProgress({state: 'downloading', written: 0, total: update.size});
    try {
      const {relaunch} = await installUpdate(update, setProgress);
      setProgress({state: 'done', relaunch});
    } catch (failure) {
      setProgress(null);
      // The image could not be swapped while the app runs from it: only a copy by hand replaces it.
      setError(failure instanceof ImageReplaceError ? [t('update.replaceFailed'), t('update.replaceByHand')] : [failure.message]);
    }
  };
  const close = () => { if (!progress) setDismissed(true); return true; };

  const fraction = state === 'downloading' && progress.total ? progress.written / progress.total : state ? 1 : 0;
  const installed = update.installed;
  const paragraphs = installed ? [t('update.reopenInstalled', {version: update.version}), ...update.stuck ? [t('update.restartConsole')] : []]
    : error ?? [update.notes || t('update.detail')];
  const label = error ? t('update.failed') : state === 'done' || installed ? t('update.done') : state ? t('update.updating') : t('update.available');
  // JetBrains Mono has no narrow no-break space (French puts one before %): its no-break space instead.
  const status = state === 'downloading'
    ? `${formatPercent(Math.round(fraction * 100)).replace(/\u202f/g, '\u00a0')}  ·  ${formatBytes(progress.written)} / ${formatBytes(progress.total)}`
    : state === 'installing' ? t('update.installing') : state === 'done' ? t(relaunch ? 'update.restarting' : 'update.reopen') : null;
  return (
    // A modal: the page's actions stop here, and nothing leaves it while it installs.
    <FocusScope trap autoFocus onBack={close} onAction={() => true}>
      <View className="absolute inset-0 z-50 items-center justify-center bg-canvas/90">
        <View className="w-[940px] flex-row items-center gap-12 rounded-2xl border border-line bg-canvas px-12 py-10">
          {/* Overdrive's mark in characters, drawn by scripts/ascii_dial.py like the landing page's hero. */}
          <View className="gap-4">
            <Image source={dial} resizeMode="contain" style={{width: px(DIAL), height: px(DIAL)}} />
            {state ? <ProgressBar fraction={fraction} width={DIAL} active /> : null}
          </View>
          <View className="flex-1 gap-6">
            <View className="gap-3">
              <Text className="font-mono text-[13px] tracking-[2px] text-subtle">{label}</Text>
              <Text className="font-sans text-[44px] font-semibold tracking-tight text-fg">{`v${update.version}`}</Text>
              <Text className="font-mono text-[15px] text-muted">{`v${VERSION}  →  v${update.version}`}</Text>
            </View>
            {state ? null : (
              <View className="w-[460px] gap-2">
                {paragraphs.map(text => <Text key={text} className="font-sans text-base text-muted line-clamp-4">{text}</Text>)}
              </View>
            )}
            {/* Focusable so focus stays in the trap once the buttons go: with nothing to hold it, it falls
                to the page behind, which then takes the D-pad, Cross and Circle while it installs. */}
            {status ? <View focusable><ShimmerText textStyle={STATUS}>{status}</ShimmerText></View> : installed ? (
              <View className="flex-row gap-3">
                <Button variant="primary" size="lg" label={t('update.quit')} autoFocus onPress={() => BackHandler.exitApp({relaunch: false})} />
                <Button variant="outline" size="lg" label={t('update.later')} onPress={close} />
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Button variant="primary" size="lg" icon="download" label={t(error ? 'update.retry' : 'update.install')} autoFocus onPress={install} />
                <Button variant="outline" size="lg" label={t(error ? 'update.close' : 'update.later')} onPress={close} />
              </View>
            )}
          </View>
        </View>
      </View>
    </FocusScope>
  );
}
