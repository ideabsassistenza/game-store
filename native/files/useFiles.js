// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useMemo, useState} from 'react';
import {FileSystem, Http, Packages, Platform} from '@ps5-react/core';
import {getGame} from '../state/catalog.js';
import {COMPLETE} from '../state/download-queue.js';
import {downloadQueue, shadowMountUp} from '../state/downloads.js';
import {mountedImages, shadowRequest} from '../state/shadowmount.js';
import {deletionTargets, scanDrive} from './scan.js';

// The console keeps each installed title in /user/app/<title ID>; the preview has none.
function installedTitles() {
  try { return new Set(FileSystem.readDir('/user/app').map(entry => entry.name)); } catch { return new Set(); }
}

const owned = job => [job.artifact?.destination, job.downloadDestination, job.output, ...(job.packages ?? [])];

// The queue and its finished downloads holding `path`; without a queue, none.
function finishedJobs(path) {
  try {
    const queue = downloadQueue();
    return {queue, jobs: queue.snapshot().filter(job => COMPLETE.includes(job.state) && owned(job).includes(path))};
  } catch { return {queue: null, jobs: []}; }
}

// An image ShadowMount mounted keeps its space until the mount is released, so it stays while
// ShadowMount lists it mounted; a ShadowMount that is not running mounts nothing. Errors name
// ShadowMount, so the screen shows them as they are.
async function checkUnmounted(file, root) {
  if (Platform.OS !== 'ps5' || file.kind !== 'images') return;
  let mounted;
  try { mounted = await mountedImages((route, body) => shadowRequest(Http, route, body), deletionTargets(file), root); }
  catch (error) { throw new Error(`ShadowMount could not say whether it is mounted, so it was kept: ${error.message}`); }
  console.log(`[files] ${file.path}: ${mounted === null ? 'ShadowMount is not running, so it is not mounted'
    : mounted.length ? `still mounted (${mounted.map(image => image.path).join(', ')})` : 'not mounted'}`);
  if (mounted?.length) throw new Error('ShadowMount still has it mounted, so it was kept. Close any game and try again.');
}

/**
 * The files on `root`, with each one's game and whether that game is installed, and the actions on
 * them: `install` (one PKG at a time, reporting its progress as `installing`) and `remove`.
 */
export function useFiles(root) {
  const [version, setVersion] = useState(0);
  const rescan = () => setVersion(value => value + 1);
  const files = useMemo(() => {
    const installed = installedTitles();
    return scanDrive(FileSystem, root).map(file => ({...file, game: file.titleId ? getGame(file.titleId) ?? null : null,
      installed: Boolean(file.titleId && installed.has(file.titleId))}));
  }, [root, version]);
  const [installing, setInstalling] = useState(null);
  // Images reach the home screen through ShadowMount; asked again on every rescan.
  const [shadowMount, setShadowMount] = useState(true);
  useEffect(() => {
    let live = true;
    void shadowMountUp().then(up => { if (live) setShadowMount(up); });
    return () => { live = false; };
  }, [version]);

  const install = file => {
    if (installing && !installing.done && !installing.error) return;
    let task;
    try { task = Packages.install({path: file.path, name: file.game?.title ?? file.name}); }
    catch (error) { setInstalling({path: file.path, fraction: 0, error: error.message}); return; }
    setInstalling({path: file.path, fraction: 0});
    task.subscribe(progress => setInstalling(state => state?.path === file.path
      ? {...state, fraction: progress.total ? progress.written / progress.total : 0} : state));
    task.done.then(() => { setInstalling(state => ({...state, fraction: 1, done: true})); rescan(); },
      error => setInstalling(state => ({...state, error: error.message})));
  };

  // An image a finished download holds is deleted through the queue, which uninstalls its game and
  // deletes all the download left. Anything else goes here, and a finished download whose file is gone
  // leaves the queue too, or its page would still offer the file. A folder may be an extracted game of
  // many files: it is deleted off the render thread.
  const remove = async file => {
    const {queue, jobs} = finishedJobs(file.path);
    const image = jobs.find(job => job.artifact.nextAction === 'shadowmount');
    if (image) {
      await queue.deleteFromDisk(image.id);
      rescan();
      return;
    }
    await checkUnmounted(file, root);
    for (const path of deletionTargets(file)) {
      if (!FileSystem.exists(path)) continue;
      try { await FileSystem.removeAsync(path); }
      catch (error) { console.log(`[files] ${path} not deleted: ${error.message}`); throw error; }
      console.log(`[files] deleted ${path}`);
    }
    for (const job of jobs) queue.remove(job.id);
    rescan();
  };

  return {files, installing, install, remove, rescan, shadowMount};
}
