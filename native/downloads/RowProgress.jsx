// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {View, Text, tw} from '@ps5-react/core';
import {SPAN_MAX, fitBytes, useT} from '../i18n/index.js';
import {formatBytes} from '../state/catalog.js';
import {ProgressBar} from '../ui/ProgressBar.jsx';
import {ShimmerText} from '../ui/ShimmerText.jsx';
import {colors} from '../ui/colors.js';
import {formatTimeLeft} from './format.js';
import {fractionOf, useProgress} from './useQueue.js';

const TRACK = 580;
const LABEL = tw`font-sans text-sm`;

/** The only part of a row that follows progress ticks: the track, then state and size (or `detail`) beneath it. */
export function RowProgress({id, label, moving, waiting, complete, detail}) {
  const t = useT();
  const progress = useProgress(id);
  const {written = 0, total = null, bytesPerSecond = 0} = progress ?? {};
  const left = moving && total && bytesPerSecond ? formatTimeLeft((total - written) / bytesPerSecond) : '';
  const size = detail ?? (complete ? formatBytes(total || written)
    : total ? t('download.status.progress', {done: formatBytes(written), total: formatBytes(total)})
      : written ? t('download.soFar', {size: formatBytes(written)}) : '');
  return (
    <View className="gap-2">
      <ProgressBar fraction={complete ? 1 : fractionOf(progress)} width={TRACK} active={moving || complete} />
      <View className="w-[580px] flex-row justify-between">
        {waiting ? <View className="w-[360px]"><ShimmerText textStyle={LABEL} background={colors.surface}>{label}</ShimmerText></View> : (
          <Text className="w-[360px] font-sans text-sm text-fg truncate">
            {fitBytes(label, SPAN_MAX)}
            <Text className="text-muted">{left ? fitBytes(`  ${left}`, SPAN_MAX) : ''}</Text>
          </Text>
        )}
        <Text className="w-[210px] text-end font-sans text-sm text-muted">{size}</Text>
      </View>
    </View>
  );
}
