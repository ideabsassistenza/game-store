// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, tw} from '@ps5-react/core';
import {hasStateLabel, stateLabel} from '../downloads/labels.js';
import {t, useT} from '../i18n/index.js';
import {formatSize} from '../state/catalog.js';
import {BUSY, COMPLETE} from '../state/download-queue.js';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';

/** States with nothing to press: the button reads as disabled. */
export const DISABLED = ['unavailable', 'no-space', 'removing'];

// `text` is a message key.
const CONTENT = {
  idle: {icon: 'download', text: 'download.button.idle'},
  unavailable: {icon: 'download', text: 'download.button.unavailable'},
  'awaiting-browser': {icon: 'external', text: 'download.button.awaiting-browser'},
  'no-space': {icon: 'download', text: 'download.button.no-space'},
  queued: {icon: 'pause', text: 'download.button.queued'},
  resolving: {icon: 'pause', text: 'download.button.pause'},
  connecting: {icon: 'pause', text: 'download.button.pause'},
  downloading: {icon: 'pause', text: 'download.button.pause'},
  verifying: {icon: 'pause', text: 'download.button.verifying'},
  pausing: {icon: 'pause', text: 'download.button.pausing'},
  extracting: {icon: 'pause', text: 'download.button.extracting'},
  // The engine writes the last files to disk: nothing left to count, so no percentage either.
  finishing: {icon: 'pause', text: 'download.button.finishing'},
  extracted: {icon: 'circleCheck', text: 'download.button.extracted'},
  paused: {icon: 'play', text: 'download.button.paused'},
  failed: {icon: 'download', text: 'download.button.failed'},
  // A failure whose saved progress no longer matches the file: only starting over recovers it.
  stale: {icon: 'download', text: 'download.button.stale'},
  'file-downloaded': {icon: 'circleCheck', text: 'download.button.file-downloaded'},
  downloaded: {icon: 'circleCheck', text: 'download.button.downloaded'},
  'installer-required': {icon: 'download', text: 'download.button.installer-required'},
  installing: {icon: 'download', text: 'download.button.installing'},
  installed: {icon: 'circleCheck', text: 'download.button.installed'},
  'extraction-required': {icon: 'circleCheck', text: 'download.button.extraction-required'},
  removing: {icon: 'delete', text: 'download.button.removing'},
};

const INK = {dark: tw`text-accent-fg`, light: tw`text-fg`, disabled: tw`text-muted`};

/** The `[state, detail]` line under the button. */
export function statusLine(status, progress, sizeGb) {
  if (status === 'unavailable') return [t('download.status.unavailable'), null];
  if (status === 'awaiting-browser') return [t('download.status.awaitingLink'), null];
  if (status === 'finishing') return [stateLabel(status), t('downloads.writingToDisk')];
  if (status === 'no-space') return [t('download.status.noSpace'), sizeGb && t('download.status.needs', {size: formatSize(sizeGb)})];
  if (COMPLETE.includes(status)) return [stateLabel(status), sizeGb && formatSize(sizeGb)];
  const of = sizeGb && t('download.status.progress', {done: formatSize(sizeGb * progress), total: formatSize(sizeGb)});
  if (hasStateLabel(status)) return [stateLabel(status), of];
  return [t('download.status.ready'), sizeGb && formatSize(sizeGb)];
}

/**
 * The button's icon and text, and `amount` (the percentage, or bytes so far when the size is unknown)
 * while a download is in progress; `dark` on the accent.
 */
export function DownloadLabel({status, amount, dark}) {
  const t = useT();
  const {icon, text} = CONTENT[status];
  const inProgress = BUSY.includes(status) || status === 'paused';
  const disabled = DISABLED.includes(status);
  const ink = dark ? INK.dark : disabled ? INK.disabled : INK.light;
  return (
    <View className={`h-12 w-[272px] flex-row items-center px-5 ${inProgress ? 'justify-between' : 'justify-center'}`}>
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={16} color={dark ? colors.accentFg : disabled ? colors.muted : colors.fg} />
        <Text className="font-sans text-[15px]" style={ink}>{t(text)}</Text>
      </View>
      {inProgress && <Text className="font-sans text-[15px]" style={ink}>{amount}</Text>}
    </View>
  );
}
