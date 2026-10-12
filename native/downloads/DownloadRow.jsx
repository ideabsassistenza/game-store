// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo, useEffect, useState} from 'react';
import {View, Text, tw} from '@ps5-react/core';
import {focusEnd, useLocale, useT} from '../i18n/index.js';
import {BUSY, COMPLETE} from '../state/download-queue.js';
import {Button} from '../ui/Button.jsx';
import {CdnAura, CdnSpark} from '../ui/CdnAura.jsx';
import {Cover} from '../ui/Cover.jsx';
import {px} from '../ui/scale.js';
import {isOverdriveCdn} from '../game/sources.js';
import {STALE_PARTIAL, cause, explainError} from './errors.js';
import {WAITING, clearAction, shownState, stateLabel} from './labels.js';
import {RowProgress} from './RowProgress.jsx';
import {StatsStrip} from './StatsStrip.jsx';
import {PANEL_KEY} from './SummaryPanel.jsx';
import {shapeOf} from './useQueue.js';

const THUMB = {width: px(54), height: px(72), borderRadius: px(4)};
const PRIMARY = tw`w-[132px]`;
const ARM_MS = 3000;

export const primaryKey = id => `downloads:${id}`;

/** The row's main button: one focusable element in every state, so focus survives a pause. `label` is a message key. */
function primary({state, error}, run, openGame) {
  if (state === 'pausing') return {icon: 'pause', label: 'downloads.action.pausing', onPress: () => {}};
  if (BUSY.includes(state)) return {icon: 'pause', label: 'downloads.action.pause', onPress: () => run('pause')};
  if (['paused', 'failed'].includes(state) && STALE_PARTIAL.test(cause(error))) return {icon: 'download', label: 'downloads.action.restart', onPress: () => run('restart')};
  if (state === 'paused') return {icon: 'play', label: 'downloads.action.resume', onPress: () => run('resume')};
  if (state === 'failed') return {icon: 'download', label: 'downloads.action.retry', onPress: () => run('resume')};
  if (state === 'awaiting-browser') return {icon: 'play', label: 'downloads.action.continueOnPage', onPress: openGame};
  if (state === 'downloaded') return {icon: 'circleCheck', label: 'downloads.action.install', onPress: () => run('register')};
  return {icon: 'chevronRight', label: 'downloads.action.gamePage', onPress: openGame};
}

// Cancelling discards a partial download, so the first press only arms the button: it turns white and
// shows a bin until pressed again; taking a finished entry off the list ('remove') keeps every file and
// needs one press. Right from the row's last button goes on to the panel beside the list.
function DeleteButton({id, action, run, onFocus}) {
  const {rtl} = useLocale();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button variant={armed ? 'primary' : 'secondary'} size="icon" icon={armed ? 'delete' : 'x'}
      focusKey={`downloads-cancel:${id}`} {...focusEnd(rtl, PANEL_KEY)} onFocus={onFocus} onBlur={() => setArmed(false)}
      onPress={() => { if (action === 'remove') { run(action); return; } setArmed(!armed); if (armed) run(action); }} />
  );
}

function DownloadRowView({job, game, autoFocus, run, onOpenGame, onFocusRow}) {
  const t = useT();
  const {state, release} = job;
  const shown = shownState(job);
  const complete = COMPLETE.includes(state);
  const openGame = () => onOpenGame(job);
  const main = primary(job, name => run(job, name), openGame);
  const onFocus = () => onFocusRow(job);
  const meta = [(job.artifact.format || release.format).toUpperCase(), `${release.provider} ${release.version || ''}`.trim(), job.root].join(' · ');
  const problem = job.error && explainError(job.error, Boolean(release.parts));
  const note = problem ? problem.action ? t('downloads.problem', {title: problem.title, action: problem.action}) : problem.title
    : state === 'downloaded' ? job.message || t('downloads.installHint') : '';
  const cdn = isOverdriveCdn(release.provider);
  return (
    <View className={cdn ? 'relative rounded-xl bg-surface' : 'overflow-hidden rounded-xl border border-line bg-surface'}>
      {cdn ? <CdnAura radius={12} width={904} /> : null}
      <View className="flex-row items-center gap-5 px-5 py-4">
        <Cover game={game} label={false} style={THUMB} />
        <View className="flex-1 gap-2.5">
          <View className="w-[580px] flex-row items-end justify-between">
            <Text className="w-[360px] font-sans text-lg font-semibold tracking-tight text-fg truncate">{job.title}</Text>
            <View className="w-[210px] flex-row items-center justify-end gap-1.5">
              {cdn ? <CdnSpark size={13} /> : null}
              <Text className={cdn ? 'max-w-[190px] font-sans text-sm text-fg truncate' : 'w-[210px] text-end font-sans text-sm text-subtle truncate'}>{meta}</Text>
            </View>
          </View>
          <RowProgress id={job.id} label={stateLabel(shown)} moving={BUSY.includes(state) && state !== 'pausing'}
            waiting={WAITING.includes(shown)} complete={complete} detail={shown === 'finishing' ? t('downloads.writingToDisk') : null} />
          {note ? <Text className={problem ? 'w-[580px] font-sans text-sm text-fg truncate' : 'w-[580px] font-sans text-sm text-muted truncate'}>{note}</Text> : null}
        </View>
        <View className="flex-row gap-2">
          <Button variant="secondary" icon={main.icon} label={t(main.label)} style={PRIMARY} autoFocus={autoFocus}
            focusKey={primaryKey(job.id)} onFocus={onFocus} onPress={main.onPress} />
          <DeleteButton id={job.id} action={clearAction(state)} run={name => run(job, name)}
            onFocus={onFocus} />
        </View>
      </View>
      {state === 'downloading' ? <StatsStrip id={job.id} /> : null}
    </View>
  );
}

/** Rows skip re-renders unless what they show changes; progress lives in RowProgress. */
export const DownloadRow = memo(DownloadRowView,
  (a, b) => shapeOf(a.job) === shapeOf(b.job) && a.autoFocus === b.autoFocus);
