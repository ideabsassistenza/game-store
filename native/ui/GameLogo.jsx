// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useLayoutEffect, useState} from 'react';
import {Image, Text} from '@ps5-react/core';
import {colors} from './colors.js';
import {Skeleton} from './Skeleton.jsx';
import {px} from './scale.js';

// Every logo gets about the same visual weight, wide or compact: sized by area inside the
// width × height box (logical px). Without a known aspect it is contained in the box.
function logoBox({logoAspect}, width, height, area) {
  if (!logoAspect) return {width, height};
  let h = Math.min(height, Math.sqrt(area / logoAspect));
  let w = h * logoAspect;
  if (w > width) {
    w = width;
    h = w / logoAspect;
  }
  return {width: w, height: h};
}

/** The logo's style box for a width × height area (logical px), shared with prefetching. */
export function logoStyle(game, width, height, area = width * height * 0.6) {
  const box = logoBox(game.art, width, height, area);
  return {width: px(box.width), height: px(box.height)};
}

function Title({game, width}) {
  return (
    <Text className="font-sans text-4xl font-semibold tracking-tight text-fg line-clamp-2"
      style={{width: px(width)}}>{game.title}</Text>
  );
}

/**
 * The trimmed game logo (white silhouette when `logoDark`), or the title in large text without one
 * or when it fails. A pulsing block of the logo's size stands in while it loads. `onReady`
 * runs once the logo can be seen: at once for the title, after the image loads or fails.
 */
export function GameLogo({game, width, height, area = width * height * 0.6, onReady}) {
  const {logo} = game.art;
  const [loaded, setLoaded] = useState(null);
  const [failed, setFailed] = useState(null);
  useLayoutEffect(() => {
    if (!logo) onReady?.();
  }, [logo]);
  if (!logo || failed === logo) return <Title game={game} width={width} />;
  const box = logoStyle(game, width, height, area);
  return (
    <>
      {loaded !== logo && <Skeleton pulse style={box} />}
      {/* Hidden until decoded: a fixed-size Image loads without being drawn. */}
      <Image source={{uri: logo}} resizeMode="contain" tintColor={game.art.logoDark ? colors.fg : undefined}
        style={loaded === logo ? box : {...box, display: 'none'}}
        onLoad={() => {
          setLoaded(logo);
          onReady?.();
        }}
        onError={() => {
          setFailed(logo);
          onReady?.();
        }} />
    </>
  );
}
