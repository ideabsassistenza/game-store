// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, Text, Image, FocusScope, motion} from '@ps5-react/core';
import {FocusFrame} from '../ui/FocusRing.jsx';
import {useT} from '../i18n/index.js';
import {HINT, useHints} from '../ui/Legend.jsx';
import {SHOT, THUMB} from './art.js';

const HINTS = [{button: 'cross', label: 'hints.view'}, HINT.back, HINT.favorite, HINT.sections];

// The store crossfaded here. Fading the scaled shot re-blends ~1.1 Mpx a frame (17 ms of raster at
// 1080p on an M4, 33 ms frames, fps windows 50–55), so the shot cuts; only the thumbnails animate.
function MainShot({shots, index}) {
  const t = useT();
  return (
    <View className="relative overflow-hidden rounded-xl bg-surface-2" style={SHOT}>
      <Image source={{uri: shots[index].url}} className="rounded-xl" style={SHOT} resizeMode="cover" />
      <View className="absolute right-4 bottom-4 rounded-full bg-canvas/70 px-2.5 py-1">
        <Text className="font-sans text-sm text-fg">{t('game.shotPosition', {index: index + 1, total: shots.length})}</Text>
      </View>
    </View>
  );
}

// On a TV the focused thumbnail already is the main image: the D-pad browses with no extra buttons.
// The strip is a scope so entering it lands on the shot on display, not the nearest thumbnail.
export function MediaGallery({shots, nextDown, onOpen}) {
  const [index, setIndex] = useState(0);
  const [inside, setInside] = useState(false);
  useHints(inside ? HINTS : null);
  // Every shot loads with the page, so browsing the strip never waits on the network.
  useEffect(() => {
    for (const shot of shots.slice(1)) Image.prefetch(shot.url, SHOT).catch(() => {});
  }, [shots]);

  return (
    <View scrollAnchor className="w-[872px]">
      <MainShot shots={shots} index={index} />
      <FocusScope focusKey="game:shots">
        <View className="mt-3 flex-row gap-2">
          {shots.map((shot, i) => (
            <View key={shot.url} focusKey={`game:shot:${i}`} onPress={() => onOpen(i)} onFocus={() => { setIndex(i); setInside(true); }}
              onBlur={() => setInside(false)} nextFocusDown={nextDown}
              className="relative w-32 h-[72px]">
              <motion.View className="w-32 h-[72px] overflow-hidden rounded-md"
                initial={false} animate={{opacity: i === index ? 1 : 0.45}} transition={{duration: 0.2}}>
                <Image source={{uri: shot.thumb}} className="rounded-md bg-surface-2" style={THUMB} resizeMode="cover" />
              </motion.View>
              <FocusFrame />
            </View>
          ))}
        </View>
      </FocusScope>
    </View>
  );
}
