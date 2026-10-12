// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {Text, View, motion} from '@ps5-react/core';
import {colors} from './colors.js';
import {logical, px} from './scale.js';

// Magic UI's Animated Shiny Text: dimmed letters with a soft band of light sweeping across them, then a
// pause. Text cannot be filled with a gradient here, so it is drawn bright and a veil of the colour
// behind it dims it everywhere but where the veil's gradient opens: veil, band, veil, sliding as one.
const BAND = 100;
const SWEEP_S = 2;
const PAUSE_S = 1.6;
// How much the veil hides the letters outside the band (alpha, hex).
const DIM = 'a6';

/**
 * `children` in `textStyle` (a tw`` style), shimmering as a loading indicator. `background` is the
 * solid colour behind it (hex), which the veil takes.
 */
export function ShimmerText({textStyle, background = colors.canvas, children}) {
  const [width, setWidth] = useState(0);
  const veil = `${background}${DIM}`;
  // The band crosses from just before the text to just after it, then travels hidden for the pause.
  const pause = (width + BAND) / SWEEP_S * PAUSE_S;
  const side = width + BAND + pause;
  return (
    <View className="relative self-start overflow-hidden">
      <Text style={[textStyle, {color: colors.fg}]} numberOfLines={1}
        onLayout={event => setWidth(Math.ceil(logical(event.layout.width)))}>{children}</Text>
      {width ? (
        <motion.View key={width} className="absolute inset-y-0 left-0 flex-row"
          initial={{x: -side - BAND - pause}} animate={{x: width - side}}
          transition={{type: 'tween', duration: SWEEP_S + PAUSE_S, ease: 'linear', repeat: Infinity}}>
          <View style={{width: px(side), backgroundColor: veil}} />
          <View style={{width: px(BAND), backgroundGradient: {type: 'linear', angle: 90, stops: [
            {color: veil, offset: 0}, {color: `${background}00`, offset: 0.5}, {color: veil, offset: 1}]}}} />
          <View style={{width: px(side), backgroundColor: veil}} />
        </motion.View>
      ) : null}
    </View>
  );
}
