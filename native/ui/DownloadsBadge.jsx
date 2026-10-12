// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {View, Text, useIsFocused} from '@ps5-react/core';
import {BUSY} from '../state/download-queue.js';
import {downloadQueue} from '../state/downloads.js';
import {colors} from './colors.js';

const IDLE = {count: 0, percent: null};

function summary(jobs) {
  const busy = jobs.filter(job => BUSY.includes(job.state));
  if (!busy.length) return IDLE;
  const sized = busy.filter(job => job.total > 0);
  const total = sized.reduce((sum, job) => sum + job.total, 0);
  const written = sized.reduce((sum, job) => sum + Math.min(job.written, job.total), 0);
  return {count: busy.length, percent: total ? Math.floor(written / total * 100) : null};
}

/**
 * The Downloads item's count and a thin bar of the active downloads' combined progress. A leaf of
 * its own: the queue emits on every progress tick, but this re-renders only when the count or the
 * whole percent changes, and the header never does.
 */
export function DownloadsBadge() {
  const [state, setState] = useState(IDLE);
  const focused = useIsFocused();
  // Compared here, not in the updater: an eagerly bailed-out update stays on the hook until a render.
  useEffect(() => {
    let last = IDLE;
    // Mounted on launch: a queue that cannot load must not take the app down; Downloads says why.
    try {
      return downloadQueue().subscribe(jobs => {
        const next = summary(jobs);
        if (last.count === next.count && last.percent === next.percent) return;
        last = next;
        setState(next);
      });
    } catch (error) {
      console.log(`[downloads] queue unavailable: ${error.message}`);
      return undefined;
    }
  }, []);
  if (!state.count) return null;
  return (
    <>
      <Text style={{color: focused ? colors.fg : '#f2f2f3a6'}} className="font-sans text-[15px]">
        {String(state.count)}
      </Text>
      {state.percent === null ? null : (
        <View className="absolute inset-x-4 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/20">
          <View className="h-full bg-fg" style={{width: `${state.percent}%`}} />
        </View>
      )}
    </>
  );
}
