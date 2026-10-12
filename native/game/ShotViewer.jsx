// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, Text, Image, FocusScope, useFocus} from '@ps5-react/core';
import {ButtonHints} from '../ui/ButtonHints.jsx';
import {useT} from '../i18n/index.js';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {useImmersive} from '../state/nav.jsx';
import {THUMB, VIEW} from './art.js';

const HINTS = [{button: 'l1r1', label: 'hints.previousNext'}, {button: 'circle', label: 'hints.close'}];
const stripKey = i => `shot-view:${i}`;

/**
 * The screenshots over the whole screen. Left/Right walk the strip and L1/R1 step from anywhere;
 * each change cuts to the next image, since fading one this size repaints the screen every frame.
 */
export function ShotViewer({shots, start, onClose}) {
  const t = useT();
  const [index, setIndex] = useState(start);
  const {focus} = useFocus();
  const step = delta => focus(stripKey((index + delta + shots.length) % shots.length));
  useImmersive(true);
  // Only the neighbours: a full-screen decode is 8 MB of the 32 MB image cache.
  useEffect(() => {
    for (const delta of [-1, 1]) Image.prefetch(shots[(index + delta + shots.length) % shots.length].url, VIEW).catch(() => {});
  }, [index]);
  const onAction = action => {
    if (action === 'l1') step(-1);
    else if (action === 'r1') step(1);
    else return false;
    return true;
  };

  return (
    <FocusScope trap autoFocus onBack={() => { onClose(index); return true; }} onAction={onAction}>
      <View className="absolute inset-0 bg-canvas">
        <Image source={{uri: shots[index].url}} style={VIEW} resizeMode="contain" />
        {/* The strip and legend sit on the image's lower edge, over a scrim, so the image keeps the
            whole screen. */}
        <View className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-canvas" />
        <View className="absolute inset-x-0 bottom-0">
          <View className="flex-row items-center justify-center gap-2">
            <Text className="mr-3 w-16 text-end font-sans text-sm text-fg">{t('game.shotPosition', {index: index + 1, total: shots.length})}</Text>
            {shots.map((shot, i) => (
              <View key={shot.url} focusKey={stripKey(i)} autoFocus={i === start} onFocus={() => setIndex(i)}
                onPress={() => onClose(i)} className="relative w-32 h-[72px]">
                <Image source={{uri: shot.thumb}} className="rounded-md bg-surface-2" style={THUMB} resizeMode="cover" />
                <FocusFrame />
              </View>
            ))}
          </View>
          <View className="mt-4">
            <ButtonHints hints={HINTS} />
          </View>
        </View>
      </View>
    </FocusScope>
  );
}
