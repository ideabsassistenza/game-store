// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, Svg, Path} from '@ps5-react/core';
import {colors} from './colors.js';
import {px} from './scale.js';

// A dial ring open at the limit, with the needle crossing the gap: the "overdrive".
export function Logo({color = colors.fg}) {
  return (
    <View className="flex-row items-center gap-2">
      <Svg width={px(28)} height={px(28)} viewBox="0 0 32 32">
        <Path d="M26.34 12.24A11 11 0 1 1 19.76 5.66" fill="none" stroke={color} strokeWidth={4.5} />
        <Path d="M28.4 3.6 17.6 18.1a2.9 2.9 0 1 1-3.7-3.7Z" fill={color} />
      </Svg>
      <Text style={{color}} className="font-sans text-[19px] font-semibold tracking-[-0.57px]">overdrive</Text>
    </View>
  );
}
