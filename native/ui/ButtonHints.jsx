// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, Svg, Path} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {colors} from './colors.js';
import {px} from './scale.js';

const FACES = {
  cross: ['M7 7 17 17', 'M17 7 7 17'],
  circle: ['M18 12a6 6 0 1 1-12 0a6 6 0 1 1 12 0'],
  triangle: ['M12 6 18.5 17H5.5Z'],
  square: ['M6.5 6.5h11v11h-11Z'],
};
// Shoulders and triggers read as their printed names on a key cap; `l1r1` is the pair.
const CAPS = {l1: ['L1'], r1: ['R1'], l2: ['L2'], r2: ['R2'], l1r1: ['L1', 'R1'], l2r2: ['L2', 'R2']};

function Face({name, size}) {
  return (
    <Svg width={px(size)} height={px(size)} viewBox="0 0 24 24">
      <Path d="M23 12a11 11 0 1 1-22 0a11 11 0 1 1 22 0" fill={colors.surface2} />
      {FACES[name].map(d => (
        <Path key={d} d={d} fill="none" stroke={colors.fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

function Cap({label, size}) {
  return (
    <View className="items-center justify-center rounded bg-surface-2 px-1.5" style={{height: px(size)}}>
      <Text className="font-sans text-[13px] font-semibold text-fg">{label}</Text>
    </View>
  );
}

/** One controller button's glyph, for hints and inline labels; `size` is in logical px. */
export function ButtonGlyph({button, size = 20}) {
  if (FACES[button]) return <Face name={button} size={size} />;
  return <View className="flex-row gap-1">{CAPS[button].map(cap => <Cap key={cap} label={cap} size={size} />)}</View>;
}

/**
 * The controller legend along the bottom edge, like the console's own apps.
 * `hints`: `[{button, label}]`, button one of cross, circle, triangle, square, l1, r1, l2, r2,
 * l1r1, l2r2; `label` is a message key.
 */
export function ButtonHints({hints}) {
  const t = useT();
  return (
    <View className="h-10 flex-row items-center justify-end gap-5 px-8">
      {hints.map(({button, label}) => (
        <View key={button} className="flex-row items-center gap-1.5">
          <ButtonGlyph button={button} size={16} />
          <Text className="font-sans text-sm text-subtle">{t(label)}</Text>
        </View>
      ))}
    </View>
  );
}
