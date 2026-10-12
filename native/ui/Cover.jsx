// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, Image, Text, tw} from '@ps5-react/core';

// The static skeleton under a cover still loading; covers come in grids, so it never pulses. A game
// with a measured tint (the cover's mean colour) shows that instead, as next/image's placeholder.
const SKELETON = tw`bg-surface-2`;
const tinted = new Map();
const skeleton = tint => tint ? tinted.get(tint) ?? tinted.set(tint, {backgroundColor: tint}).get(tint) : SKELETON;
// A host that neither answers nor fails (archive.org stalls) left the skeleton up for good; after this
// long the next copy takes its place. The last copy keeps waiting: the loader retries connection
// failures with backoff, and a late cover beats a title tile.
const STALL_MS = 8000;

// One interval watches every waiting cover: the engine has 64 timers, and a timer per cover in a grid
// used them up, so the grid's own fill timer could not run.
const waiting = new Map();
let sweep = null;
function watchStall(onStall) {
  const token = {};
  waiting.set(token, {deadline: Date.now() + STALL_MS, onStall});
  sweep ??= setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of waiting) if (entry.deadline <= now) { waiting.delete(key); entry.onStall(); }
    if (!waiting.size) { clearInterval(sweep); sweep = null; }
  }, 1000);
  return () => waiting.delete(token);
}

const fill = style => ({width: '100%', height: '100%',
  borderRadius: Object.assign({}, ...[style].flat(Infinity).filter(Boolean)).borderRadius});

/**
 * A game's cover sized by `style` over a skeleton block while it loads, or, when the catalog has no
 * working art, a surface tile carrying the title (`label={false}` for thumbnails too small to read it).
 * Covers cut in. A fade, several at once while a held key scrolls the grid, kept the PS5 repainting
 * them every frame and lost the scroll's copy of the screen; it also remounted the image twice.
 * The image fills the box rather than taking the size itself: sized by layout, it loads a frame after
 * it mounts instead of inside the commit, and a new grid's covers loading in the commit that mounts
 * its cards made an L1/R1 switch's React frame 20 ms instead of 2 (medians on an M4).
 */
export function Cover({game, style, label = true}) {
  const [failed, setFailed] = useState([]);
  const [loaded, setLoaded] = useState(null);
  const copies = [game.art.cover, ...(game.art.coverFallbacks || [])].filter(url => url && !failed.includes(url));
  const uri = copies[0];
  const last = copies.length < 2;
  useEffect(() => {
    if (!uri || loaded === uri || last) return undefined;
    return watchStall(() => setFailed(previous => [...previous, uri]));
  }, [uri, loaded, last]);
  if (uri) {
    return (
      <View style={loaded === uri ? style : [skeleton(game.art.tint), style]}>
        <Image key={uri} source={{uri}} resizeMode="cover" style={fill(style)}
          onLoad={() => setLoaded(uri)} onError={() => setFailed(previous => [...previous, uri])} />
      </View>
    );
  }
  return (
    <View className="overflow-hidden" style={style}>
      <View className="flex-1 items-center justify-center bg-surface-2 p-2">
        {label && <Text className="w-full text-center font-sans text-sm text-muted line-clamp-3">{game.title}</Text>}
      </View>
    </View>
  );
}
