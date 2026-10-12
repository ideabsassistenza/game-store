// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text} from '@ps5-react/core';
import {useLocale, useT} from '../i18n/index.js';
import {colors} from '../ui/colors.js';
import {formatSpeed} from './format.js';
import {SpeedChart} from './SpeedChart.jsx';
import {useThroughput} from './useThroughput.js';

const CHART = {width: 260, height: 44};

// The hairline sits between the two stats: on the second one's start side.
function Stat({label, value, chart, first}) {
  const {rtl} = useLocale();
  return (
    <View className={`h-[72px] flex-1 flex-row items-center justify-between ${rtl ? 'pr-5 pl-4' : 'pl-5 pr-4'} ${
      first ? '' : rtl ? 'border-r border-line' : 'border-l border-line'}`}>
      <View className="gap-0.5">
        <Text className="font-sans text-sm font-semibold text-fg">{label}</Text>
        <Text className="w-[140px] font-sans text-sm text-muted">{value}</Text>
      </View>
      {chart}
    </View>
  );
}

const latest = samples => samples[samples.length - 1] ?? 0;

/** Under the downloading row: its network and disk speed over the last minute. */
export function StatsStrip({id}) {
  const t = useT();
  const {network, disk} = useThroughput(id);
  const max = Math.max(...network, ...disk, 1);
  return (
    <View className="flex-row border-t border-line">
      <Stat first label={t('downloads.stats.download')} value={formatSpeed(latest(network))}
        chart={<SpeedChart samples={network} max={max} color={colors.fg} {...CHART} />} />
      <Stat label={t('downloads.stats.write')} value={formatSpeed(latest(disk))}
        chart={<SpeedChart samples={disk} max={max} color={colors.muted} {...CHART} />} />
    </View>
  );
}
