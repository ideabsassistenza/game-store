// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useState} from 'react';
import {FocusScope, Text, View} from '@ps5-react/core';
import {Keyboard} from '../search/Keyboard.jsx';
import {useT} from '../i18n/index.js';
import {Button} from '../ui/Button.jsx';

/** A controller keyboard using the same focus and styling as store search. */
export function URLDialog({title, detail, initial = 'https://', submit, onClose}) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const done = () => {
    try { submit(value); onClose(); } catch (failure) { setError(failure.message); }
  };
  return (
    // A modal: actions the keyboard leaves (L1/R1, Square outside it) stop here instead of reaching the page.
    <FocusScope trap autoFocus onBack={() => { onClose(); return true; }} onAction={action => {
      if (action === 'r2') done();
      return true;
    }}>
      <View className="absolute inset-0 z-50 items-center justify-center bg-canvas/95">
        <View className="w-[920px] gap-5 rounded-xl border border-line bg-surface p-8">
          <Text className="font-sans text-2xl text-fg">{title}</Text>
          <View className="flex-row gap-8">
            <Keyboard url onChange={setValue} onSubmit={done} />
            <View className="w-[400px] gap-5">
              <Text className="w-[400px] font-sans text-base text-muted line-clamp-5">{detail}</Text>
              <Text className="w-[400px] font-sans text-base text-fg line-clamp-5">{value.slice(-180) || t('urlDialog.empty')}</Text>
              {error ? <Text className="w-[400px] font-sans text-sm text-fg line-clamp-3">{error}</Text> : null}
              <Button label={t('urlDialog.confirm')} onPress={done} />
              <Button label={t('urlDialog.cancel')} variant="outline" onPress={onClose} />
              <Text className="font-sans text-sm text-muted">{t('urlDialog.controls')}</Text>
            </View>
          </View>
        </View>
      </View>
    </FocusScope>
  );
}
