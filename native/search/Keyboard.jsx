// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useCallback, useState} from 'react';
import {View, Text, FocusScope, useIsFocused} from '@ps5-react/core';
import {ButtonGlyph} from '../ui/ButtonHints.jsx';
import {Icon} from '../ui/Icon.jsx';
import {HINT, useHints} from '../ui/Legend.jsx';
import {edit} from './edit.js';
import {focusEnd, useLocale, useT} from '../i18n/index.js';
import {colors} from '../ui/colors.js';

const COLUMNS = 6;
const LTR = {direction: 'ltr'};
const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
export const MAX_QUERY = 40;
const TO_RESULTS = 'search-results';
// The console keyboard's shortcuts: Square deletes, Triangle types a space, R2 submits.
const TYPE = {button: 'cross', label: 'hints.type'};
const DELETE = {button: 'square', label: 'hints.delete'};
const URL_HINTS = [TYPE, DELETE, {button: 'r2', label: 'hints.confirm'}, HINT.back];
const HINTS = [TYPE, DELETE, {button: 'triangle', label: 'hints.space'}, {button: 'r2', label: 'hints.search'},
  HINT.clear, HINT.back];

function KeyFace({label, icon, button, url}) {
  const focused = useIsFocused();
  useHints(focused ? (url ? URL_HINTS : HINTS) : null);
  return (
    <>
      {button ? <View className="absolute right-2.5"><ButtonGlyph button={button} size={18} /></View> : null}
      {icon ? <Icon name={icon} size={20} color={focused ? colors.accentFg : colors.fg} /> : null}
      {label ? <Text focused={focused} className="font-sans text-lg leading-6 text-fg focused:text-accent-fg">{label}</Text> : null}
    </>
  );
}

// Memoized with a stable onKey, so typing re-renders only the keys whose props change. 56 px keys
// read from the couch; the wide ones span three columns.
const Key = memo(function Key({label, icon, button, wide, value, onKey, toResults, compact}) {
  const {rtl} = useLocale();
  return (
    <View onPress={() => onKey(value)} {...focusEnd(rtl, toResults)}
      className={`${wide ? 'w-[184px]' : 'w-14'} ${compact ? 'h-10' : 'h-14'} flex-row items-center justify-center gap-2 rounded-md bg-surface
        focused:bg-accent transition duration-100 pressed:scale-95`}>
      <KeyFace label={label} icon={icon} button={button} url={compact} />
    </View>
  );
});

export {edit} from './edit.js';

// A focusable grid instead of a text field: the console has no keyboard focus for text input.
// `wrap` loops each row; Right from the right column and the action keys goes to the results
// (or the suggestions), whose Left comes back. The keys stay in A–Z order right to left, where the
// results are on the left: Left from the left column goes to them. `onChange` must accept an updater, like a state
// setter; Done calls `onSubmit`.
export const Keyboard = memo(function Keyboard({onChange, onSubmit, url = false}) {
  const t = useT();
  const {rtl} = useLocale();
  const edge = rtl ? 0 : COLUMNS - 1;
  const [upper, setUpper] = useState(false);
  const characters = url ? [...CHARACTERS, ...':/._-?=&%+#@~'.split('')] : CHARACTERS;
  const onKey = useCallback(value => (value === 'case' ? setUpper(value => !value)
    : value === 'done' ? onSubmit() : onChange(query => edit(query, value, url ? 8192 : MAX_QUERY))),
    [onChange, onSubmit, url]);
  const onAction = action => {
    if (action === 'square') onKey('delete');
    else if (action === 'triangle' && !url) onKey(' ');
    else return false;
    return true;
  };
  return (
    <FocusScope wrap onAction={onAction}>
      <View className="w-[376px] flex-row flex-wrap gap-2" style={LTR}>
        {characters.map((character, i) => (
          <Key key={character} label={url && !upper ? character.toLowerCase() : character} value={url && upper ? character : character.toLowerCase()} onKey={onKey} compact={url}
            toResults={!url && i % COLUMNS === edge ? TO_RESULTS : undefined} />
        ))}
        <Key wide compact={url} label={url ? (upper ? t('keyboard.lowercase') : t('keyboard.uppercase')) : t('keyboard.space')} value={url ? "case" : " "}
          button={url ? undefined : 'triangle'} onKey={onKey} toResults={url || !rtl ? undefined : TO_RESULTS} />
        <Key wide compact={url} label={t('keyboard.delete')} icon="delete" button="square" value="delete" onKey={onKey}
          toResults={url || rtl ? undefined : TO_RESULTS} />
        <Key wide compact={url} label={t('keyboard.clear')} icon="x" button={url ? undefined : 'l2'} value="clear" onKey={onKey}
          toResults={url || !rtl ? undefined : TO_RESULTS} />
        <Key wide compact={url} label={t('keyboard.done')} button="r2" value="done" onKey={onKey}
          toResults={url || rtl ? undefined : TO_RESULTS} />
      </View>
    </FocusScope>
  );
});
