// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, useIsFocused} from '@ps5-react/core';
import {formatPercent, useT} from '../i18n/index.js';
import {formatBytes} from '../state/size.js';
import {ButtonGlyph} from '../ui/ButtonHints.jsx';
import {Cover} from '../ui/Cover.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {PlatformBadge} from '../ui/PlatformBadge.jsx';
import {ProgressBar} from '../ui/ProgressBar.jsx';
import {colors} from '../ui/colors.js';
import {px} from '../ui/scale.js';
import {KINDS, isPackage} from './scan.js';

const COVER = {width: px(36), height: px(48), borderRadius: px(4)};
const TEXT_WIDTH = 560;
const ICON_OF = Object.fromEntries(KINDS.map(kind => [kind.key, kind.icon]));

function typeOf(file) {
  if (isPackage(file.name)) return 'files.type.package';
  if (file.kind === 'images') return 'files.type.image';
  if (file.kind === 'archives') return 'files.type.archive';
  return file.isDirectory ? 'files.type.folder' : 'files.type.file';
}

function Thumb({file, dark}) {
  if (file.game?.art?.cover) return <Cover game={file.game} label={false} style={COVER} />;
  return (
    <View className="h-12 w-9 items-center justify-center rounded bg-surface-2" style={dark ? {backgroundColor: '#dcdce0'} : null}>
      <Icon name={ICON_OF[file.kind]} size={18} color={dark ? colors.canvas : colors.muted} />
    </View>
  );
}

// What the file is, then the game it holds and whether that game is on the console.
function detail(t, file, shadowMount) {
  const parts = [t(typeOf(file))];
  if (file.titleId) parts.push(file.titleId);
  if (file.installed) parts.push(t('files.installed'));
  else if (file.kind === 'images') parts.push(t(shadowMount ? 'files.byShadowMount' : 'files.waitingShadowMount'));
  else if (isPackage(file.name)) parts.push(t('files.notInstalled'));
  return parts.join(' · ');
}

function Face({file, armed, installing, shadowMount}) {
  const t = useT();
  const focused = useIsFocused();
  const busy = installing && !installing.done && !installing.error;
  return (
    <>
      {armed ? null : <FocusRing />}
      <Thumb file={file} dark={armed} />
      <View className="gap-1.5" style={{width: px(TEXT_WIDTH)}}>
        <View className="flex-row items-center gap-2.5">
          {file.platform ? <PlatformBadge platforms={[file.platform]} /> : null}
          <Text className={armed ? 'font-sans text-[15px] font-semibold text-canvas truncate' : 'font-sans text-[15px] font-semibold text-fg truncate'}
            style={{width: px(file.platform ? TEXT_WIDTH - 54 : TEXT_WIDTH)}}>{file.game?.title ?? file.name}</Text>
        </View>
        {armed ? (
          <View className="flex-row items-center gap-1.5">
            <ButtonGlyph button="square" size={14} />
            <Text className="font-sans text-[13px] font-semibold text-canvas">{t('files.confirmDelete', {size: formatBytes(file.size)})}</Text>
          </View>
        ) : busy ? (
          <View className="flex-row items-center gap-3">
            <ProgressBar fraction={installing.fraction} width={240} active />
            <Text className="font-sans text-[13px] text-fg">{t('files.installing', {percent: formatPercent(Math.round(installing.fraction * 100))})}</Text>
          </View>
        ) : (
          <Text className={installing?.error ? 'font-sans text-[13px] text-fg truncate' : focused ? 'font-sans text-[13px] text-muted truncate' : 'font-sans text-[13px] text-subtle truncate'}
            style={{width: px(TEXT_WIDTH)}}>
            {installing?.error ? t('files.installFailed') : installing?.done ? t('files.installDone') : file.game ? `${file.name} · ${detail(t, file, shadowMount)}` : detail(t, file, shadowMount)}
          </Text>
        )}
      </View>
      <View className="flex-1" />
      <Text className={armed ? 'font-sans text-[15px] font-semibold text-canvas' : 'font-sans text-[15px] text-fg'}>{formatBytes(file.size)}</Text>
    </>
  );
}

/** One file on the drive. Cross installs a PKG; Square arms the delete, and a second Square confirms it. */
export const FileRow = memo(function FileRow({file, armed, installing, shadowMount, autoFocus, focusKey, onPress, onFocus}) {
  return (
    <View focusKey={focusKey} autoFocus={autoFocus} onPress={onPress} onFocus={onFocus}
      className={armed ? 'h-[68px] flex-row items-center gap-4 rounded-lg bg-fg px-4'
        : 'h-[68px] flex-row items-center gap-4 rounded-lg px-4 focused:bg-surface-2'}>
      <Face file={file} armed={armed} installing={installing} shadowMount={shadowMount} />
    </View>
  );
});
