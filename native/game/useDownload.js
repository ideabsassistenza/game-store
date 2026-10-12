// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useRef, useState} from 'react';
import {fractionOf} from '../downloads/useQueue.js';
import {BUSY} from '../state/download-queue.js';
import {downloadQueue} from '../state/downloads.js';
import {sameRelease} from '../state/release-sets.js';

export function useDownload(game, release, root, alternatives) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  // A download the person just started or resumed opens its host's page in the console's browser as
  // soon as the host turns out to need one (a CAPTCHA before the file link), instead of waiting for
  // another press on "Open host page".
  const started = useRef(false);
  useEffect(() => {
    setError('');
    try {
      return downloadQueue().subscribe(jobs => setJob(jobs.find(item => item.gameId === game.id && release
        && ((item.requestedId ?? item.release.id) === release.id || sameRelease(item.release, release))) || null));
    } catch (failure) { setError(failure.message); return undefined; }
  }, [game.id, release?.id]);
  // ShadowMount installs a finished image once Overdrive closes, so the page asks whether it has since.
  useEffect(() => { try { if (job?.state === 'downloaded') void downloadQueue().syncInstalls(job.id); } catch { /* shown by the subscription */ } }, [job?.id]);
  const advance = () => {
    try {
      setError('');
      const queue = downloadQueue();
      if (!job) { if (release) { started.current = true; queue.enqueue(game, release, root, alternatives); } }
      // The console finishes an install it accepted, so there is nothing to pause.
      else if (BUSY.includes(job.state) && job.state !== 'pausing' && job.state !== 'installing') queue.pause(job.id);
      else if (job.state === 'installer-required') queue.install(job.id);
      else if (job.state === 'paused' || job.state === 'failed') { started.current = true; queue.resume(job.id); }
      else if (job.state === 'awaiting-browser') queue.openBrowser(job.id);
      else if (job.state === 'downloaded') void queue.register(job.id).catch(failure => setError(failure.message));
    } catch (failure) { setError(failure.message); }
  };
  useEffect(() => {
    if (!started.current || !job) return;
    if (job.state === 'awaiting-browser') {
      started.current = false;
      try { downloadQueue().openBrowser(job.id); } catch (failure) { setError(failure.message); }
    } else if (!['queued', 'resolving', 'connecting'].includes(job.state)) started.current = false;
  }, [job?.state]);
  const status = job?.state || (release ? 'idle' : 'unavailable');
  const action = name => {
    try { setError(''); if (job) void Promise.resolve(downloadQueue()[name](job.id)).catch(failure => setError(failure.message)); }
    catch (failure) { setError(failure.message); }
  };
  const deleteFromDisk = () => { setError(''); void downloadQueue().deleteFromDisk(job.id).catch(failure => setError(failure.message)); };
  return {status, progress: fractionOf(job), advance, restart: () => action('restart'), remove: () => action('remove'), deleteFromDisk,
    job, error: error || job?.error || ''};
}
