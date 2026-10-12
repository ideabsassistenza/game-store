// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';
import {View, Text, ScrollView, FocusScope} from '@ps5-react/core';
import {SPAN_MAX, fitBytes, formatNumber, useT} from '../i18n/index.js';
import {t} from '../i18n/core.js';
import {Button} from '../ui/Button.jsx';
import {ButtonHints} from '../ui/ButtonHints.jsx';
import {HINT} from '../ui/Legend.jsx';
import {Icon} from '../ui/Icon.jsx';
import {colors} from '../ui/colors.js';
import {getGame} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {BUSY, COMPLETE} from '../state/download-queue.js';
import {downloadQueue} from '../state/downloads.js';
import {DownloadRow, primaryKey} from './DownloadRow.jsx';
import {SummaryPanel} from './SummaryPanel.jsx';
import {useJobs} from './useQueue.js';

const LIST_HINTS = [HINT.select, {button: 'square', label: 'hints.pauseResume'}, {button: 'triangle', label: 'hints.gamePage'},
  HINT.back];
const EMPTY_HINTS = [HINT.select, HINT.back];
const EMPTY_KEY = 'downloads:empty';

function summary(jobs) {
  const count = states => jobs.filter(job => states.includes(job.state)).length;
  return [[count(BUSY), 'inProgress'], [count(['paused', 'awaiting-browser']), 'paused'], [count(['failed']), 'failed'],
    [count(COMPLETE), 'completed']].filter(([n]) => n > 0).map(([n, key]) => t(`downloads.summary.${key}`, {count: n})).join(' · ');
}

function Section({title, jobs, first, handlers}) {
  const t = useT();
  if (!jobs.length) return null;
  return (
    <View className="gap-3">
      <Text className="px-1 font-sans text-[13px] font-semibold tracking-wider text-subtle">{`${t(title)}  ${formatNumber(jobs.length)}`}</Text>
      {jobs.map(job => (
        <DownloadRow key={job.id} job={job} game={getGame(job.gameId) ?? {title: job.title, art: {}}}
          autoFocus={job === first} run={handlers.run} onOpenGame={handlers.openGame} onFocusRow={handlers.focusRow} />
      ))}
    </View>
  );
}

function Empty({error, onBack}) {
  const t = useT();
  return (
    <View className="flex-1 items-center justify-center pb-24">
      <Icon name="download" size={32} color={colors.subtle} />
      <Text className="mt-4 font-sans text-lg font-semibold text-fg">{t(error ? 'downloads.unavailable' : 'downloads.empty')}</Text>
      <Text className="mt-1 w-[480px] text-center font-sans text-base text-muted line-clamp-3">
        {error || t('downloads.emptyDetail')}
      </Text>
      <View className="mt-6">
        <Button variant="outline" label={t('downloads.browseGames')} focusKey={EMPTY_KEY} autoFocus onPress={onBack} />
      </View>
    </View>
  );
}

/** Every queued, active, paused, failed and completed download, in queue order. */
export function DownloadsScreen({onBack, onOpenGame}) {
  const t = useT();
  const {jobs, error} = useJobs();
  // ShadowMount installs a finished image only once Overdrive closes, so it may have done so since.
  useEffect(() => { try { void downloadQueue().syncInstalls(); } catch { /* useJobs shows why there is no queue */ } }, []);
  const [failure, setFailure] = useState('');
  const {focusLater} = useNavActions();
  const focused = useRef(null);
  const latest = useRef(jobs);
  latest.current = jobs;
  // A removed row takes its buttons with it; left alone, focus would fall back to the header.
  const neighbor = job => {
    const index = latest.current.findIndex(item => item.id === job.id);
    const next = latest.current[index + 1] ?? latest.current[index - 1];
    return next ? primaryKey(next.id) : EMPTY_KEY;
  };
  // Stable for the screen's lifetime, so memoized rows never re-render for a new callback.
  const [handlers] = useState(() => ({
    run(job, name) {
      setFailure('');
      const target = ['remove', 'cancel'].includes(name) ? neighbor(job) : null;
      try {
        void Promise.resolve(downloadQueue()[name](job.id)).catch(caught => setFailure(caught.message));
        if (target) focusLater(target);
      } catch (caught) { setFailure(caught.message); }
    },
    openGame: job => { if (getGame(job.gameId)) onOpenGame(job.gameId, primaryKey(job.id)); },
    focusRow: job => { focused.current = job; },
  }));

  const back = () => {
    onBack();
    return true;
  };
  const onAction = action => {
    const job = focused.current && jobs.find(item => item.id === focused.current.id);
    if (!job) return false;
    if (action === 'triangle') handlers.openGame(job);
    else if (action === 'square' && BUSY.includes(job.state)) handlers.run(job, 'pause');
    else if (action === 'square' && ['paused', 'failed'].includes(job.state)) handlers.run(job, 'resume');
    else return false;
    return true;
  };

  // A job deleting its files keeps its place until the delete ends.
  const placed = job => job.removingFrom ?? job.state;
  const active = jobs.filter(job => BUSY.includes(placed(job)));
  const stopped = jobs.filter(job => ['paused', 'failed', 'awaiting-browser'].includes(placed(job)));
  const done = jobs.filter(job => COMPLETE.includes(placed(job)));
  const first = active[0] ?? stopped[0] ?? done[0];
  return (
    <FocusScope autoFocus onBack={back} onAction={onAction}>
      <View className="flex-1">
        {/* Two columns like the body below, at fixed widths: a line that changed size relaid out, and
            repainted, the whole screen. */}
        <View className="flex-row items-end gap-8 px-8 pt-8 pb-6">
          <Text className="w-[904px] font-sans text-xl font-semibold tracking-tight text-fg truncate">
            {fitBytes(t('downloads.title'), SPAN_MAX)}
            <Text className="font-normal text-subtle">{jobs.length ? fitBytes(`  ${summary(jobs)}`, SPAN_MAX) : ''}</Text>
          </Text>
          <Text className="w-[280px] font-sans text-sm text-fg line-clamp-2">{failure}</Text>
        </View>
        <View className="flex-1 flex-row gap-8 px-8">
          {jobs.length > 0 ? (
            <ScrollView className="flex-1">
              <View className="gap-10 pb-10">
                <Section title="downloads.section.active" jobs={active} first={first} handlers={handlers} />
                <Section title="downloads.section.stopped" jobs={stopped} first={first} handlers={handlers} />
                <Section title="downloads.section.completed" jobs={done} first={first} handlers={handlers} />
              </View>
            </ScrollView>
          ) : <Empty error={error} onBack={onBack} />}
          <SummaryPanel error={error} onFocus={() => { focused.current = null; }} />
        </View>
        <ButtonHints hints={jobs.length > 0 ? LIST_HINTS : EMPTY_HINTS} />
      </View>
    </FocusScope>
  );
}
