// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, FileSystem, ScrollView} from '@ps5-react/core';
import {formatNumber, useT} from '../i18n/index.js';
import {formatBytes} from '../state/catalog.js';
import {downloadQueue, driveName, storageRoots} from '../state/downloads.js';
import {ProgressBar} from '../ui/ProgressBar.jsx';
import {formatDuration, formatSpeed} from './format.js';
import {useActivity} from './useQueue.js';

const WIDTH = 280;
// A focusable entry's inset, so its highlight has room around the text.
const INSET = 8;
const INNER = {width: WIDTH - 2 * INSET};
const ENTRY = 'rounded-lg p-2 focused:bg-surface-2';
const HEADING = 'font-sans text-[13px] font-semibold tracking-wider text-subtle';
/** The column's first entry: Right from a row's last button lands here. */
export const PANEL_KEY = 'downloads:panel';
// Titles sit at the entries' inset, so they line up with the text of the focusable entries below.
// Rendered before useJobs can report a queue that failed to load.
function awake() {
  try { return downloadQueue().awake; } catch { return false; }
}

function Block({title, children}) {
  return (
    <View className="gap-3 border-b border-line pb-5">
      <Text className={`px-2 ${HEADING}`}>{title}</Text>
      {children}
    </View>
  );
}

function Figure({label, value}) {
  return (
    <View className="flex-row justify-between">
      <Text className="font-sans text-sm text-muted">{label}</Text>
      <Text className="font-sans text-sm text-fg">{value}</Text>
    </View>
  );
}

// Ticks every progress update, so it lives apart from the drives, which only change with the list.
// Focusable, so moving back up the column scrolls it into view.
function Activity({onFocus}) {
  const t = useT();
  const {active, speed, left, connections, peak, low, mean} = useActivity();
  return (
    <Block title={t('downloads.panel.activity')}>
      <View focusable focusKey={PANEL_KEY} onFocus={onFocus} className={`gap-3 ${ENTRY}`}>
        <Text className="font-sans text-3xl font-semibold tracking-tight text-fg">{active ? formatSpeed(speed) : t('downloads.panel.idle')}</Text>
        <View className="gap-1.5">
          <Figure label={t('downloads.panel.downloading')}
            value={active ? t('catalog.gameCount', {count: active}) : t('downloads.panel.none')} />
          <Figure label={t('downloads.panel.timeLeft')} value={active && speed && left ? formatDuration(left / speed) : '—'} />
          <Figure label={t('downloads.panel.peak')} value={peak ? formatSpeed(peak) : '—'} />
          <Figure label={t('downloads.panel.low')} value={low ? formatSpeed(low) : '—'} />
          <Figure label={t('downloads.panel.average')} value={mean ? formatSpeed(mean) : '—'} />
          <Figure label={t('downloads.panel.connections')} value={connections ? formatNumber(connections) : '—'} />
        </View>
        <Text style={INNER} className="font-sans text-sm text-subtle">
          {awake() ? t('downloads.panel.awake') : ' '}
        </Text>
      </View>
    </Block>
  );
}

function Drive({root, focusKey, onFocus}) {
  const t = useT();
  let usage = null;
  try { usage = FileSystem.diskUsage(root); } catch { /* A disconnected drive reads as unavailable. */ }
  return (
    <View focusable focusKey={focusKey} onFocus={onFocus} className={`gap-2 ${ENTRY}`}>
      <View className="flex-row justify-between">
        <Text className="font-sans text-sm text-fg">{driveName(root)}</Text>
        <Text className="font-sans text-sm text-muted">{usage ? t('download.free', {size: formatBytes(usage.free)}) : t('downloads.panel.unavailable')}</Text>
      </View>
      <ProgressBar fraction={usage?.total ? 1 - usage.free / usage.total : 0} width={INNER.width} active={false} />
      {usage ? <Text className="font-sans text-sm text-subtle">{t('downloads.panel.used', {used: formatBytes(usage.total - usage.free), total: formatBytes(usage.total)})}</Text> : null}
    </View>
  );
}

/**
 * The right column: what is downloading now, room left on each drive, and how installs finish. Each
 * entry takes focus, Right from the list, so the column scrolls when more drives than fit push the note
 * below the legend. `onFocus` runs as any entry takes focus.
 */
export function SummaryPanel({error, onFocus}) {
  const t = useT();
  return (
    <ScrollView className="w-[280px]">
      <View className="gap-5 pb-6">
        {error ? null : <Activity onFocus={onFocus} />}
        <Block title={t('downloads.panel.storage')}>
          {storageRoots().map((root, index) => <Drive key={root} root={root} onFocus={onFocus}
            focusKey={error && !index ? PANEL_KEY : undefined} />)}
        </Block>
        <View focusable onFocus={onFocus} className={`gap-2 ${ENTRY}`}>
          <Text className={HEADING}>{t('downloads.panel.installing')}</Text>
          <Text style={INNER} className="font-sans text-sm text-subtle">
            {t('downloads.panel.installNote')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
