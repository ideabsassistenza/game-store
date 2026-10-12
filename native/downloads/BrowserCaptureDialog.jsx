// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {FocusScope, Text, View, tw} from '@ps5-react/core';
import {useT} from '../i18n/index.js';
import {Button} from '../ui/Button.jsx';
import {ShimmerText} from '../ui/ShimmerText.jsx';
import {colors} from '../ui/colors.js';
import {downloadQueue} from '../state/downloads.js';
import {URLDialog} from './URLDialog.jsx';
const INSTRUCTION = tw`font-sans text-base`;

/** Queue owns the capture; closing this modal cancels it and preserves manual recovery. */
export function BrowserCaptureDialog({job}) {
  const t = useT();
  const close = () => downloadQueue().cancelBrowserCapture(job.id);
  if (job.captureState === 'failed') return <URLDialog title={t('download.fileLink')}
    detail={job.captureError || t('download.fileLinkDetail')}
    submit={url => downloadQueue().continueWithURL(job.id, url)} onClose={close} />;
  return (
    <FocusScope trap autoFocus onBack={() => { close(); return true; }}>
      <View className="absolute inset-0 z-50 items-center justify-center bg-canvas/95">
        <View className="w-[920px] gap-5 rounded-xl border border-line bg-surface p-8">
          <Text className="font-sans text-2xl text-fg">{t('capture.title')}</Text>
          <Text className="w-[840px] font-sans text-base text-muted line-clamp-2">{job.title}</Text>
          <ShimmerText textStyle={INSTRUCTION} background={colors.surface}>{t(`capture.${job.captureState}`)}</ShimmerText>
          <Text className="w-[840px] font-sans text-base text-muted line-clamp-3">{t('capture.detail')}</Text>
          <Button label={t('download.enterLink')} variant="outline" onPress={() => {
            downloadQueue().cancelBrowserCapture(job.id, {manual: true});
          }} />
          <Button label={t('urlDialog.cancel')} variant="outline" onPress={close} />
        </View>
      </View>
    </FocusScope>
  );
}
