// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {memo} from 'react';
import {View, Text, tw, useIsFocused} from '@ps5-react/core';
import {WAITING, shownState, stateLabel} from '../downloads/labels.js';
import {fractionOf, useJobs, useProgress} from '../downloads/useQueue.js';
import {formatPercent, useT} from '../i18n/index.js';
import {getGame} from '../state/catalog.js';
import {BUSY} from '../state/download-queue.js';
import {useNavActions} from '../state/nav.jsx';
import {GameCard} from '../ui/GameCard.jsx';
import {ProgressBar} from '../ui/ProgressBar.jsx';
import {ShimmerText} from '../ui/ShimmerText.jsx';
import {GameRail} from './GameRail.jsx';

// Downloads that still need the user or the network; finished ones live on the Downloads screen.
const UNFINISHED = [...BUSY, 'paused', 'failed'];
const WIDTH = 152;
const STATE = tw`font-sans text-[14px]`;

// The only part of the card that follows progress ticks.
function JobCaption({job}) {
  const t = useT();
  const focused = useIsFocused();
  const progress = useProgress(job.id);
  const fraction = fractionOf(progress);
  const shown = shownState(job);
  const percent = progress?.total && job.state !== 'failed' ? ` · ${formatPercent(Math.floor(fraction * 100))}` : '';
  return (
    <>
      <Text focused={focused} className="mt-3 w-[150px] font-sans text-[15px] text-fg/85 truncate focused:text-fg">
        {job.title}
      </Text>
      <View className="mt-2">
        <ProgressBar fraction={fraction} width={WIDTH} active={job.state === 'downloading'} />
      </View>
      {WAITING.includes(shown) ? <View className="mt-1.5 w-[150px]"><ShimmerText textStyle={STATE}>{stateLabel(shown)}</ShimmerText></View> : (
        <Text className={job.state === 'failed' ? 'mt-1.5 w-[150px] font-sans text-[14px] text-fg truncate'
          : 'mt-1.5 w-[150px] font-sans text-[14px] text-subtle truncate'}>{job.state === 'failed' ? t('browse.continueFailed') : `${stateLabel(job.state)}${percent}`}</Text>
      )}
    </>
  );
}

/** Unfinished downloads, first on the page like the console's "Continue"; absent when there are none. */
export const ContinueRow = memo(function ContinueRow() {
  const t = useT();
  const {jobs} = useJobs();
  const {push, openGame} = useNavActions();
  const entries = jobs.filter(job => UNFINISHED.includes(job.state)).map(job => ({job, game: getGame(job.gameId)}))
    .filter(entry => entry.game);
  if (!entries.length) return null;
  return (
    <GameRail title={t('browse.continueDownloading')} seeAllKey="continue:all"
      onSeeAll={() => push({name: 'downloads'}, 'continue:all')}>
      {entries.map(({job, game}, index) => {
        const key = `continue:${job.id}`;
        return (
          <GameCard key={job.id} game={game} width={WIDTH} detailed focusKey={key} rowEnd={index === entries.length - 1}
            onPress={() => openGame(game.id, key)} caption={<JobCaption job={job} />} />
        );
      })}
    </GameRail>
  );
});
