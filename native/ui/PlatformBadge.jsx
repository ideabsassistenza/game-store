// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Svg, Path, G} from '@ps5-react/core';
import {CAP, WORDS} from './psLogotype.js';
import {px} from './scale.js';

// The PS Store's platform tag: PS5 white with dark type, PS4 dark with white type and outline, and
// both editions joined in one tag split by a slanted cut. Units are logical px.
const H = 18, W = 44, SLANT = 5, GAP = 2, R = 2.5;
// The logotype's cap height in the tag, in logical px.
const TYPE = 6.5;
const STYLE = {
  ps5: {fill: '#ffffff', ink: '#000000', edge: 'none'},
  ps4: {fill: '#000000b3', ink: '#ffffff', edge: '#ffffff'},
};

// One segment between two edges, each either the tag's rounded end or a slanted cut at `cut`.
function segment(i, count) {
  const left = i === 0 ? null : i * W + GAP / 2, right = i === count - 1 ? null : (i + 1) * W - GAP / 2;
  const top = right == null ? `L${count * W - R} 0A${R} ${R} 0 0 1 ${count * W} ${R}L${count * W} ${H - R}A${R} ${R} 0 0 1 ${count * W - R} ${H}`
    : `L${right + SLANT / 2} 0L${right - SLANT / 2} ${H}`;
  const start = left == null ? `M0 ${R}A${R} ${R} 0 0 1 ${R} 0` : `M${left + SLANT / 2} 0`;
  const end = left == null ? `L${R} ${H}A${R} ${R} 0 0 1 0 ${H - R}Z` : `L${left - SLANT / 2} ${H}Z`;
  return start + top + end;
}

/** The tag for `platforms` (['ps4'], ['ps5'] or both), PS5 first like the store; `style` places it. */
export function PlatformBadge({platforms, style}) {
  const order = [...platforms].sort().reverse();
  const width = order.length * W;
  return (
    <View style={style}>
      <Svg width={px(width)} height={px(H)} viewBox={`0 0 ${width} ${H}`}>
        {order.map((platform, i) => {
          const {fill, ink, edge} = STYLE[platform];
          const word = WORDS[platform], scale = TYPE / CAP;
          const x = i * W + (W - (word.right - word.left) * scale) / 2 - word.left * scale;
          return [
            <Path key={`${platform}-box`} d={segment(i, order.length)} fill={fill} stroke={edge} strokeWidth={1} />,
            <G key={`${platform}-text`} translateX={x} translateY={(H - TYPE) / 2} scale={scale}>
              <Path d={word.d} fill={ink} />
            </G>,
          ];
        })}
      </Svg>
    </View>
  );
}
