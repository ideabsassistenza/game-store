// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {View, Text, motion, useIsFocused, LayoutAnimation} from '@ps5-react/core';
import {LATIN_IN_RTL, useLocale, useT} from '../i18n/index.js';
import {FocusRing} from '../ui/FocusRing.jsx';

// Steam marks subheadings as short all-caps lines.
const isHeading = line => line.length < 70 && line === line.toUpperCase() && line !== line.toLowerCase();

function ToggleLabel({expanded}) {
  const t = useT();
  const focused = useIsFocused();
  return (
    <Text focused={focused} className="font-sans text-sm text-muted focused:text-fg">
      {t(expanded ? 'game.showLess' : 'game.showMore')}
    </Text>
  );
}

// Height is not animatable, so LayoutAnimation tweens the text box and everything below it.
export function About({paragraphs}) {
  const t = useT();
  const {rtl} = useLocale();
  const latin = rtl ? LATIN_IN_RTL : undefined;
  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(value => !value);
  };

  return (
    <View scrollAnchor>
      <Text className="font-sans text-xl font-semibold tracking-tight text-fg">{t('game.about')}</Text>
      <View className={`relative mt-4 overflow-hidden ${expanded ? '' : 'h-48'}`}>
        <View className="w-[600px] gap-3">
          {paragraphs.map((paragraph, i) => (isHeading(paragraph) ? (
            <Text key={i} style={latin} className="pt-3 font-sans text-sm font-semibold tracking-[0.06em] text-fg">{paragraph}</Text>
          ) : (
            <Text key={i} style={latin} className="w-[600px] font-sans text-[15px] leading-relaxed text-muted">{paragraph}</Text>
          )))}
        </View>
        <motion.View className="absolute left-0 right-0 bottom-0 h-20 bg-gradient-to-t from-canvas" pointerEvents="none"
          initial={false} animate={{opacity: expanded ? 0 : 1}} />
      </View>
      <View focusKey="game:about" onPress={toggle} className="relative mt-3 self-start rounded">
        <ToggleLabel expanded={expanded} />
        <FocusRing />
      </View>
    </View>
  );
}
