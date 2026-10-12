// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useMemo, useState} from 'react';
import {View, Text, ScrollView, FocusScope, FileSystem, useIsFocused} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {driveName, storageRoots} from '../state/downloads.js';
import {useNavActions} from '../state/nav.jsx';
import {formatBytes} from '../state/size.js';
import {ButtonHints} from '../ui/ButtonHints.jsx';
import {FocusRing} from '../ui/FocusRing.jsx';
import {Icon} from '../ui/Icon.jsx';
import {HINT} from '../ui/Legend.jsx';
import {colors} from '../ui/colors.js';
import {FileRow} from './FileRow.jsx';
import {StorageBar} from './StorageBar.jsx';
import {KINDS, isPackage, totals} from './scan.js';
import {useFiles} from './useFiles.js';

const LIST_WIDTH = 904;
const ARM_MS = 4000;
const RAIL_HINTS = [HINT.select, HINT.back];
const PACKAGE_HINTS = [{button: 'cross', label: 'hints.install'}, {button: 'square', label: 'hints.delete'}, HINT.back];
const FILE_HINTS = [{button: 'square', label: 'hints.delete'}, HINT.back];
const ARMED_HINTS = [{button: 'square', label: 'hints.confirmDelete'}, HINT.back];
const fileKey = path => `files:${path}`;

function RailFace({icon, label, detail, current}) {
  const focused = useIsFocused();
  return (
    <>
      <FocusRing />
      <Icon name={icon} size={18} color={current || focused ? colors.fg : colors.subtle} />
      <View className="flex-1 gap-0.5">
        <Text className={current ? 'font-sans text-[15px] font-semibold text-fg truncate' : 'font-sans text-[15px] text-muted truncate'}>{label}</Text>
        {detail ? <Text className="font-sans text-[13px] text-subtle truncate">{detail}</Text> : null}
      </View>
      {current ? <View className="h-1.5 w-1.5 rounded-full bg-fg" /> : null}
    </>
  );
}

function RailItem({onPress, focusKey, autoFocus, onFocus, ...face}) {
  return (
    <View focusKey={focusKey} autoFocus={autoFocus} onPress={onPress} onFocus={onFocus}
      className={face.current ? 'h-14 flex-row items-center gap-3 rounded-lg bg-surface px-3' : 'h-14 flex-row items-center gap-3 rounded-lg px-3 focused:bg-surface-2'}>
      <RailFace {...face} />
    </View>
  );
}

function Label({children}) {
  return <Text className="px-3 pb-1 font-sans text-[13px] font-semibold tracking-wider text-subtle">{children}</Text>;
}

// Not focusable: it reports, and there is nothing to press until ShadowMount is loaded.
function ShadowMountStatus({up}) {
  const t = useT();
  return (
    <View className="flex-row gap-3 px-3 pt-1">
      <View className={up ? 'mt-1.5 h-2 w-2 rounded-full bg-fg' : 'mt-1.5 h-2 w-2 rounded-full border border-subtle'} />
      <View className="flex-1 gap-0.5">
        <Text className="font-sans text-[13px] text-muted">{t(up ? 'files.shadowMountOn' : 'files.shadowMountOff')}</Text>
        {up ? null : <Text className="font-sans text-[13px] text-subtle line-clamp-3">{t('shadowMount.offAction')}</Text>}
      </View>
    </View>
  );
}

function Empty() {
  const t = useT();
  return (
    <View className="flex-1 items-center justify-center pb-16">
      <Icon name="folder" size={32} color={colors.subtle} />
      <Text className="mt-4 font-sans text-lg font-semibold text-fg">{t('files.empty')}</Text>
      <Text className="mt-1 w-[440px] text-center font-sans text-base text-muted line-clamp-2">{t('files.emptyDetail')}</Text>
    </View>
  );
}

/** What Overdrive keeps on each drive, by kind, with Install for a PKG and a two-press Delete. */
export function FilesScreen({onBack}) {
  const t = useT();
  const [roots] = useState(storageRoots);
  const [drive, setDrive] = useState(0);
  const [kind, setKind] = useState('all');
  const root = roots[drive];
  const {files, installing, install, remove, shadowMount} = useFiles(root);
  const sums = useMemo(() => totals(files), [files]);
  const shown = kind === 'all' ? files : files.filter(file => file.kind === kind);
  const usage = useMemo(() => { try { return FileSystem.diskUsage(root); } catch { return null; } }, [root, files]);
  const [focused, setFocused] = useState(null);
  const [armed, setArmed] = useState(null);
  const [notice, setNotice] = useState('');
  const {focusLater} = useNavActions();

  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(null), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const focusFile = file => { setFocused(file); if (armed && armed !== file.path) setArmed(null); };
  const onAction = action => {
    if (action !== 'square' || !focused) return false;
    if (armed !== focused.path) { setArmed(focused.path); return true; }
    setArmed(null);
    // The row goes with the file; focus moves to its neighbour, or to the rail when it was the last.
    const index = shown.indexOf(focused);
    const next = shown[index + 1] ?? shown[index - 1];
    const file = focused;
    remove(file).then(() => {
      focusLater(next ? fileKey(next.path) : `files-kind:${kind}`);
      setNotice(t('files.deleted', {name: file.game?.title ?? file.name}));
    }, error => setNotice(/ShadowMount/.test(error.message) ? error.message : t('files.deleteFailed')));
    return true;
  };
  const back = () => {
    if (armed) setArmed(null); else onBack();
    return true;
  };

  const hints = !focused ? RAIL_HINTS : armed === focused.path ? ARMED_HINTS : isPackage(focused.name) ? PACKAGE_HINTS : FILE_HINTS;
  const free = usage ? t('files.free', {free: formatBytes(usage.free), total: formatBytes(usage.total)}) : '';
  return (
    <FocusScope autoFocus onBack={back} onAction={onAction}>
      <View className="flex-1">
        <View className="flex-row items-end justify-between px-8 pt-8 pb-6">
          <Text className="w-[760px] font-sans text-xl font-semibold tracking-tight text-fg truncate">
            {t('files.title')}
            <Text className="font-normal text-subtle">{`  ${t('files.summary', {count: sums.all.count, size: formatBytes(sums.all.size)})}`}</Text>
          </Text>
          <Text className="w-[400px] text-end font-sans text-sm text-muted line-clamp-2">{notice}</Text>
        </View>
        <View className="flex-1 flex-row gap-8 px-8">
          <View className="w-[248px] gap-1">
            <Label>{t('files.drives')}</Label>
            {roots.map((path, index) => (
              <RailItem key={path} icon="hardDrive" label={driveName(path)} current={index === drive}
                detail={index === drive ? free : null} focusKey={`files-drive:${path}`} onFocus={() => setFocused(null)}
                onPress={() => { setDrive(index); setArmed(null); }} />
            ))}
            <ShadowMountStatus up={shadowMount} />
            <View className="h-5" />
            <Label>{t('files.kinds')}</Label>
            {[{key: 'all', icon: 'layers'}, ...KINDS].map(item => (
              <RailItem key={item.key} icon={item.icon} label={t(`files.kind.${item.key}`)} current={kind === item.key}
                detail={sums[item.key].count ? formatBytes(sums[item.key].size) : null} focusKey={`files-kind:${item.key}`}
                onFocus={() => setFocused(null)} onPress={() => setKind(item.key)} autoFocus={!files.length && item.key === 'all'} />
            ))}
          </View>
          <View className="flex-1 gap-6">
            <StorageBar usage={usage} sums={sums} focus={focused?.kind ?? (kind === 'all' ? null : kind)} width={LIST_WIDTH} />
            {shown.length ? (
              <ScrollView className="flex-1">
                <View className="gap-1 pb-8">
                  {shown.map((file, index) => (
                    <FileRow key={file.path} file={file} focusKey={fileKey(file.path)} autoFocus={index === 0}
                      armed={armed === file.path} installing={installing?.path === file.path ? installing : null} shadowMount={shadowMount}
                      onFocus={() => focusFile(file)} onPress={isPackage(file.name) ? () => install(file) : undefined} />
                  ))}
                </View>
              </ScrollView>
            ) : <Empty />}
          </View>
        </View>
        <ButtonHints hints={hints} />
      </View>
    </FocusScope>
  );
}
