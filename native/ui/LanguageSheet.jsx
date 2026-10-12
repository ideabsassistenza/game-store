// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {Text, View, useIsFocused} from '@ps5-react/core';
import {LOCALES, chooseLanguage, languageChoice, systemLocale, useT} from '../i18n/index.js';
import {FocusRing} from './FocusRing.jsx';
import {Icon} from './Icon.jsx';
import {SideSheet} from './SideSheet.jsx';
import {colors} from './colors.js';

const nameOf = code => LOCALES.find(locale => locale.code === code).name;

// A language reads as its own name, with the name in the current language under it.
function LanguageFace({name, detail, checked}) {
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[15px] font-semibold text-fg">{name}</Text>
        <Text style={{color: focused ? colors.fg : colors.muted}} className="font-sans text-sm">{detail}</Text>
      </View>
      {checked ? <Icon name="check" color={colors.fg} /> : <View className="size-4" />}
    </>
  );
}

function Row({code, name, detail, checked, onPress}) {
  return (
    <View focusKey={`language:${code}`} autoFocus={checked} onPress={onPress}
      className="relative flex-row items-center gap-4 rounded-lg px-3 py-3 focused:bg-surface-2">
      <LanguageFace name={name} detail={detail} checked={checked} />
    </View>
  );
}

/** The app's language: the console's own, or one picked from the list, which then stays. */
export function LanguageSheet({onClose}) {
  const t = useT();
  const choice = languageChoice();
  const pick = code => {
    chooseLanguage(code);
    onClose();
  };
  return (
    <SideSheet title={t('language.title')} subtitle={t('language.subtitle')} onClose={onClose}>
      <View className="gap-1 p-1.5 pb-8">
        <Row code="system" name={t('language.system')} detail={nameOf(systemLocale())} checked={choice === null} onPress={() => pick(null)} />
        {LOCALES.map(({code, name}) => (
          <Row key={code} code={code} name={name} detail={t(`language.name.${code}`)} checked={choice === code} onPress={() => pick(code)} />
        ))}
      </View>
    </SideSheet>
  );
}
