// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {t} from '../i18n/core.js';
import {capturedVikingFile, describeVikingCapture, linkPageMetadata, validateVikingCapture, vikingLinkPage, VIKING_PREFIX} from './viking-capture.js';
import {MARGIN, spaceShortfall, stillNeeded} from './space.js';
import {archivePassword} from './archive-password.js';
import {readJSON} from './read-json.js';
import {mountedImages, shadowRequest as request, within} from './shadowmount.js';
import {cause, INCOMPLETE_PART, STALE_PARTIAL} from '../downloads/errors.js';

import {BrowserRequired, cancellation, createSourceResolver, sourceKind, webURL} from './download-sources.js';

const ACTIVE = ['resolving', 'connecting', 'downloading', 'verifying', 'extracting', 'installing', 'pausing'];
/** Job states of a download that is waiting or running. */
export const BUSY = ['queued', ...ACTIVE];
/** Job states of a finished download. */
export const COMPLETE = ['downloaded', 'file-downloaded', 'installer-required', 'installed', 'extraction-required', 'extracted'];
const ADOPTED = 'A partial download from another source holds this name. Resume it from its original source, or delete it in Files.';
const DELETED = 'Its partial files were deleted. Restart to download it again, or remove it.';
const REMOVAL_CUT = 'The app closed while deleting its files. Delete it again.';

// Whether the queue can live in `stateDir`. A title left in the sandbox (no console access) sees
// /data through ShadowMountPlus 1.7's nullfs, where stat fails with EPERM: probing it there threw
// out of the constructor and closed the app right after the splash, so the queue stays in `dataDir`.
function durable(fs, stateDir) {
  try {
    fs.mkdir(stateDir, {recursive: true});
    fs.exists(`${stateDir}/downloads.json`);
    return true;
  } catch (error) {
    console.log(`[download-queue] ${stateDir} unavailable, queue kept in the app data: ${error.message}`);
    return false;
  }
}

/** The jobs of a saved queue as they resume. An entry that lost its fields is dropped, not the queue. */
function restore(saved) {
  return saved.jobs.slice(0, 32).filter(job => {
    const valid = job?.release?.id && job.root && job.artifact?.destination;
    if (!valid) console.log(`[download-queue] dropped an invalid queue entry ${job?.id ?? ''}`);
    return valid;
  }).map(job => {
    delete job.captureState; delete job.captureError;
    // An install the app stopped watching may have finished: the page offers it again.
    if (job.state === 'installing') return {...job, state: 'installer-required'};
    // Its figures counted the extraction, which starts over: as paused, the job holds what a
    // downloaded archive still needs, not twice the extraction's size.
    if (job.state === 'extracting') job.written = job.total;
    // A delete the app closed during goes back to where it started, to be done again.
    if (job.state === 'removing') { job.state = job.removingFrom ?? 'failed'; job.error = REMOVAL_CUT; }
    delete job.phase; delete job.removingFrom;
    const interrupted = BUSY.includes(job.state);
    return {...job, state: interrupted ? 'paused' : job.state, error: interrupted ? 'Interrupted. Resume to continue.' : job.error,
      ...(interrupted && job.state !== 'pausing' && {restore: job.state === 'queued' ? 'queued' : 'running'})};
  });
}

/** App-owned queue: task lifetimes survive screen changes, but not process exit. */
/**
 * `stateDir` holds the queue. It belongs beside the downloads, not in the app's own data folder
 * (`dataDir`), which a reinstall wipes: a queue lost that way leaves its partial files without a task.
 * A queue still in `dataDir/overdrive` is moved there on load.
 */
export function createDownloadQueue({fs, downloads, http, formats, dataDir, stateDir = `${dataDir}/overdrive`, platform, notifications, power, linking, sources, archives, packages, releasesOf, browserCapture,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  const legacy = `${dataDir}/overdrive/downloads.json`;
  const directory = stateDir === `${dataDir}/overdrive` || durable(fs, stateDir) ? stateDir : `${dataDir}/overdrive`;
  const file = `${directory}/downloads.json`;
  const listeners = new Set();
  sources ??= createSourceResolver({http});
  const captures = new Map();
  let jobs = [];
  let active = null;
  let ticks = 0;
  let awake = false;

  // A save cut short by a forced close or a power cut can leave an empty or half-written file, and a
  // queue that cannot be read must never keep the app from opening. The candidates are read newest
  // first (both queue files exist when a build that saved in `dataDir` ran after one that moved it,
  // and `.tmp` is a save whose rename never ran); one that does not parse is kept aside for inspection,
  // and with none the queue starts empty while partial files are adopted again.
  const modified = path => { try { return fs.stat(path)?.modified ?? 0; } catch { return 0; } };
  const candidates = [...new Set([file, `${file}.tmp`, legacy])].filter(path => { try { return fs.exists(path); } catch { return false; } })
    .sort((a, b) => modified(b) - modified(a));
  let stored = null;
  for (const path of candidates) {
    const saved = readJSON(fs, path, null, value => value?.version === 1 && Array.isArray(value.jobs),
      message => console.log(`[download-queue] ${message}`));
    if (saved) { jobs = restore(saved); stored = path; break; }
  }

  const snapshot = () => jobs.map(job => ({...job}));
  const emit = () => {
    // Rest mode would stop a download of several hours; stay awake only while one can run.
    const busy = captures.size > 0 || jobs.some(job => BUSY.includes(job.state));
    if (busy !== awake) { awake = busy; power.keepAwake(busy); }
    const value = snapshot();
    for (const listener of listeners) listener(value);
  };
  // A state change is synced before the rename, or a power cut right after could leave the queue
  // empty under its name. The progress saves made every few seconds while a download runs are not:
  // a sync runs on the interface's thread and can take seconds on the console, and losing one only
  // costs the progress since the last change, which the partial file's checkpoint still holds.
  const save = ({sync = true} = {}) => {
    fs.mkdir(directory, {recursive: true});
    fs.writeFile(`${file}.tmp`, JSON.stringify({version: 1, jobs}), {sync});
    fs.rename(`${file}.tmp`, file);
  };
  const change = () => { save(); emit(); };
  // Moved now rather than at the next change, which a reinstall could come before. The old file is
  // renamed once the new one is saved, so it is never read again over a newer queue.
  if (legacy !== file && fs.exists(legacy)) {
    try {
      if (stored === legacy) save();
      fs.rename(legacy, `${legacy}.moved`);
    } catch (error) { console.log(`[download-queue] queue not moved to ${file}: ${error.message}`); }
  }
  if (stored === `${file}.tmp`) {
    try { save(); } catch (error) { console.log(`[download-queue] queue not saved to ${file}: ${error.message}`); }
  }
  const find = id => {
    const job = jobs.find(item => item.id === id);
    if (!job) throw new Error('Download is no longer in the queue.');
    return job;
  };

  const artifactFor = (release, root) => release.parts ? {directory: `${root}/downloads/sets/${release.filename}`,
    destination: `${root}/downloads/extracted/${release.filename}`, nextAction: 'extracted'} : formats.artifact(release, root);

  // Before any byte lands, a source that fails or wants a person in a browser is swapped for the next
  // alternative the page passed in, so the download carries on without asking. Space and drive
  // failures stay: another source would not fix them.
  function failOver(job, error) {
    if (job.written || job.parts?.some(part => part.written) || /space|storage|drive|disconnected/i.test(cause(error.message))) return false;
    while (job.fallbacks?.length) {
      const next = job.fallbacks.shift();
      const artifact = artifactFor(next, job.root);
      if (fs.exists(artifact.destination) || fs.exists(`${artifact.destination}.part`)
        || jobs.some(other => other !== job && other.artifact.destination === artifact.destination)) continue;
      job.message = t('downloads.switchedSource', {failed: job.release.provider, next: next.provider});
      job.release = {...next}; job.artifact = artifact; job.total = next.sizeBytes || null;
      for (const key of ['options', 'browserUrl', 'directURL', 'parts', 'partIndex', 'currentSource', 'downloadDestination', 'inspected', 'adopted']) delete job[key];
      job.error = ''; job.state = 'queued';
      return true;
    }
    return false;
  }

  // A page host's signed link expires (HTTP 401/403) while the page still hands out a fresh one. The
  // native checkpoint names the file by size and validator, not URL, so the partial continues.
  // Twice per resume at most: a page whose links keep failing needs a person.
  function reresolve(job) {
    const source = job.parts ? job.currentSource : job.release;
    if ((job.reresolved || 0) >= 2 || ['direct', 'browser', 'datanodes', 'manifest', 'unavailable'].includes(sourceKind(source))) return false;
    job.reresolved = (job.reresolved || 0)+1;
    delete job.options;
    if (job.parts) delete job.parts[job.partIndex].options;
    job.error = ''; job.state = 'queued';
    return true;
  }

  // A PKG installs through the console's service as soon as it is down. A refused install leaves the
  // file and the job as they were, to retry from the page or the file manager. A dump's backport PKG
  // patches the installed game for older firmware: it goes after the game, and a console that refuses
  // it (a firmware it does not target) still has the game.
  async function install(job) {
    const paths = job.packages ?? [job.downloadDestination || job.artifact.destination];
    const backport = path => /backport/i.test(path);
    try {
      for (const path of [...paths.filter(path => !backport(path)), ...paths.filter(backport)]) {
        job.state = 'installing'; job.written = 0; job.total = null; job.error = ''; job.message = ''; change();
        const task = packages.install({path, name: job.title});
        active.task = task;
        const off = task.subscribe(progress => { job.written = progress.written || 0; job.total = progress.total ?? null; emit(); });
        try { await task.done; } catch (error) {
          console.log(`[download-queue] install refused ${path}:`, error.message);
          if (!backport(path) || paths.every(backport)) throw error;
        } finally { off(); }
      }
      job.state = 'installed'; job.message = t('downloads.installed');
      notifications.show(t('downloads.notice.installed'), job.title);
    } catch (error) {
      job.state = 'installer-required'; job.error = error.message;
      job.message = t('downloads.installFailed');
    }
    job.bytesPerSecond = 0; delete job.install; change();
  }
  const canInstall = () => Boolean(packages) && platform === 'ps5';

  async function execute(job) {
    let task;
    let unsubscribe;
    if (job.install) {
      try { await install(job); } finally { active = null; pump(); }
      return;
    }
    try {
      active.cancel = cancellation();
      const signal = active.cancel.signal;
      job.state = 'resolving'; job.error = ''; change();
      if (job.release.parts) {
        await executeSet(job, signal);
        return;
      }
      job.downloadDestination ||= job.artifact.destination;
      if (job.routing) finishRouting(job);
      if (!job.options) {
        if (job.release.manifestUrl) {
          const response = await http.request(job.release.manifestUrl, {maxBytes: 4*1024*1024, signal});
          if (!response.ok) throw new Error(`Manifest HTTP ${response.status}. Choose another source or retry.`);
          job.options = formats.manifest(await response.json());
        } else {
          if (!job.release.url && !job.release.browserUrl) throw new Error('This release has no download URL.');
          const resolved = job.directURL || sourceKind(job.release) !== 'direct'
            ? await sources.resolve(job.release, {signal, directURL: job.directURL})
            : {url: webURL(job.release.url).url};
          job.options = {...resolved, rejectHtml: true, expectedBytes: job.release.sizeBytes || undefined,
            sha256: job.release.sha256 || undefined};
          delete job.directURL;
        }
        job.total = job.options.expectedBytes || null;
        change();
      }
      if (job.state === 'pausing') return;
      const root = storageIdentity(job);
      if (!job.rootIdentity) { job.rootIdentity = root; change(); }
      const held = Math.max(job.written, fs.stat(`${job.downloadDestination}.part`)?.size || 0);
      if (!fs.exists(job.downloadDestination) && fs.diskUsage(job.root).free < stillNeeded({...job, written: held})+MARGIN)
        throw new Error('Not enough space on the selected drive. Free space and retry.');
      fs.mkdir(job.artifact.directory, {recursive: true});
      // Tasks resolved by an earlier build may carry mirrors; one server keeps the heap's margin for images.
      active.transferring = true;
      task = downloads.enqueue({...job.options, rejectHtml: true, mirrors: undefined, connections: 64, adaptive: true, rangeBytes: 16*1024*1024, destination: job.downloadDestination, storageRoot: job.root, recoverCompleted: true});
      active.task = task;
      unsubscribe = task.subscribe(progress => {
        if (job.state === 'pausing') return;
        if (ACTIVE.includes(progress.state)) job.state = progress.state;
        job.written = progress.written || 0; job.total = progress.total ?? job.total;
        job.received = progress.received || 0; job.connections = progress.connections || 0;
        job.bytesPerSecond = progress.bytesPerSecond || 0;
        // Bytes kept from the partial mean its checkpoint matched this source: the file is the job's.
        if (job.written > 0) delete job.adopted;
        if (++ticks % 20 === 0) {
          delete job.launches;
          try { save({sync: false}); } catch (error) { job.error = `Queue save failed: ${error.message}`; task.cancel(); }
          if (['extraction-required', 'downloaded'].includes(job.artifact.nextAction)) checkHeaders(job, `${job.downloadDestination}.part`, task);
        }
        emit();
      });
      await task.done;
      if (job.artifact.nextAction === 'downloaded') route(job);
      job.state = job.artifact.nextAction === 'shadowmount' ? 'downloaded' : job.artifact.nextAction === 'downloaded' ? 'file-downloaded' : job.artifact.nextAction;
      job.written = job.total || job.written; job.bytesPerSecond = 0;
      // A system notice, since a download of tens of GB ends long after the user left the app's screens.
      if ((job.artifact.nextAction === 'extraction-required' || job.output) && archives) await extract(job, [job.downloadDestination]);
      delete job.reresolved;
      notifications.show(t('downloads.notice.complete'), job.title);
      if (job.state === 'installer-required' && canInstall()) await install(job);
    } catch (error) {
      console.log('[download-queue] transfer stopped:', error.message);
      const browser = error instanceof BrowserRequired || /browser verification required/i.test(cause(error.message));
      // A job that failed over or re-resolves is queued again; the pump below starts it.
      const retried = job.state !== 'pausing' && !job.cancelling && browser && active.transferring && reresolve(job);
      const switched = !retried && job.state !== 'pausing' && !job.cancelling && failOver(job, error);
      if (!retried && !switched && job.state !== 'pausing') {
        job.state = browser ? 'awaiting-browser' : 'failed';
        job.error ||= job.adopted && STALE_PARTIAL.test(cause(error.message)) ? ADOPTED : error.message;
        if (browser) { job.browserUrl = error.url || job.currentSource?.browserUrl || job.currentSource?.url || job.release.browserUrl || job.release.url; delete job.options;
          if (job.parts) delete job.parts[job.partIndex].options; }
        else if (!job.cancelling) notifications.show(t('downloads.notice.failed'), job.title);
      }
    } finally {
      unsubscribe?.();
      if (job.state === 'pausing') job.state = 'paused';
      if (COMPLETE.includes(job.state)) delete job.launches;
      // A cancelled job holds the queue until its partial file is gone.
      if (job.cancelling) { try { await forget(job); } catch (error) { delete job.cancelling; job.error = error.message; } }
      active = null;
      try { change(); } catch (error) { job.error = `Queue save failed: ${error.message}`; emit(); }
      pump();
    }
  }

  // A growing download's headers are read until they say what it is, so an archive the console
  // cannot extract stops after its first bytes rather than after every volume. The read runs on the
  // render thread against a file the download is writing, so a kind it never recognizes stops the
  // retries at three; the finished file is inspected again by route().
  const inspections = new WeakMap();
  function checkHeaders(job, path, task) {
    const tries = inspections.get(job) || 0;
    if (job.inspected || tries >= 3 || !archives?.inspect || !fs.exists(path)) return;
    inspections.set(job, tries+1);
    const started = Date.now();
    const {kind, refusal} = archives.inspect([path]);
    if (Date.now()-started > 250) console.log(`[download-queue] header check took ${Date.now()-started} ms`);
    if (!kind) return;
    job.inspected = kind;
    if (refusal) { job.error = refusal; task.cancel(); }
  }

  // Catalogs without an extension type a release 'binary'; its bytes tell an archive, package or
  // image apart, and it then goes where a correctly typed download of that kind would.
  function route(job) {
    if (!archives?.inspect) return;
    const {kind, refusal} = archives.inspect([job.downloadDestination]);
    if (refusal) throw new Error(refusal);
    if (!kind) return;
    const artifact = formats.detected(job.release, job.root, kind);
    if (artifact.nextAction === 'extraction-required') { job.artifact = {...job.artifact, format: kind, nextAction: artifact.nextAction}; return; }
    if (fs.exists(artifact.destination)) throw new Error('Destination already exists. Choose another release or inspect the existing file.');
    fs.mkdir(artifact.directory, {recursive: true});
    job.routing = artifact; change();
    finishRouting(job);
  }

  // Idempotent, so a move cut short by the app closing completes on the next run.
  function finishRouting(job) {
    const from = job.downloadDestination, to = job.routing.destination;
    if (fs.exists(from)) fs.rename(from, to);
    if (fs.exists(`${from}.complete`)) fs.rename(`${from}.complete`, `${to}.complete`);
    job.artifact = job.routing; job.downloadDestination = to;
    delete job.routing; change();
  }

  // Follow a single chain of archive wrappers to the game, without choosing between folders.
  function gameFolder(output) {
    for (let depth = 0; depth <= 16; depth++) {
      if (fs.exists(`${output}/eboot.bin`) && fs.exists(`${output}/sce_sys/param.json`)) return output;
      let children;
      try { children = fs.readDir(output).filter(entry => entry.isDirectory && !entry.name.startsWith('.ps5-react')); }
      catch { return null; }
      if (children.length !== 1) return null;
      output = `${output}/${children[0].name}`;
    }
    return null;
  }

  // What the engine needs to extract `files` into the job's output folder.
  function extraction(job, files) {
    if (!archives) throw new Error('Archive extraction requires the updated PS5 React runtime.');
    // Jobs saved before passwords were catalogued keep their files and transfer identity.
    // Only hydrate the password of the same URL, never another release of the game.
    if (releasesOf) {
      const stored = job.release.parts ? job.release.parts.flatMap(part => part.sources) : [job.release];
      const current = releasesOf(job.gameId).flatMap(release => release.parts ? release.parts.flatMap(part => part.sources) : [release]);
      for (const source of stored) {
        const match = current.find(item => item.url && item.url === source.url && item.browserUrl === source.browserUrl);
        if (source.archivePassword == null && match?.archivePassword) source.archivePassword = match.archivePassword;
      }
    }
    const password = archivePassword(job.release);
    storageIdentity(job);
    const directory = `${job.root}/downloads/extracted`;
    fs.mkdir(directory, {recursive: true});
    job.output ||= `${directory}/${job.release.filename.replace(/[^a-z0-9_.-]/gi, '_')}`;
    if (job.publishTo && fs.exists(job.publishTo)) job.output = job.publishTo;
    return {sources: files, destination: job.output, ...(password !== undefined ? {password} : {}),
      maxBytes: fs.exists(job.output) ? 1024**4 : Math.min(1024**4, Math.max(1, fs.diskUsage(job.root).free-MARGIN))};
  }

  // Extracting while downloading leans on the RAR worker and its wait for each volume; only when that
  // machinery failed, or the updater took the archive task (a cancel the job did not ask for), is the set
  // worth extracting again. A damaged or incomplete archive, a wrong password or a full drive fails the
  // same way twice, after as long a run.
  const STREAM_FAILURE = /RAR worker|Only a RAR set|extraction thread|archive task is already running|^RAR extraction failed|^Extraction cancelled/;
  // The worker names a volume cut short; it is deleted so that resuming downloads that one again. One
  // that cannot be deleted stays complete, and the extraction's error stands.
  async function forgetPart(job, error) {
    const part = job.parts?.[Number(INCOMPLETE_PART.exec(error.message)?.[1]) - 1];
    if (!part) return false;
    try { await Promise.all(['', '.complete'].map(suffix => fs.removeAsync(part.destination+suffix))); }
    catch (failure) { console.log('[download-queue] incomplete volume not deleted:', failure.message); return false; }
    part.completed = false; part.written = 0; delete part.options;
    return true;
  }

  // `streamed` is the extraction streamSet started while the volumes downloaded. If its machinery failed
  // (STREAM_FAILURE), the set is extracted again now that every volume is there.
  async function extract(job, files, streamed) {
    const options = extraction(job, files);
    // While it extracts, the job's bytes count the extraction, so every progress bar, percentage and time
    // left shows it as it shows a download. Its inputs' size stands in for the output's until the engine
    // says what they unpack to. The download's figures come back once it ends.
    const downloaded = {written: job.written, total: job.total};
    let estimate = files.reduce((sum, path) => sum+(fs.stat(path)?.size || 0), 0) || null;
    job.state = 'extracting'; job.written = 0; job.total = estimate; job.bytesPerSecond = 0; change();
    let sample = {at: Date.now(), bytes: 0};
    const report = bytes => {
      const now = Date.now();
      // Until it ends the bar stops short of full: the output may outgrow the estimate.
      job.written = estimate ? Math.min(bytes, estimate * 0.99) : bytes;
      if (now - sample.at >= 1000) {
        const speed = (bytes - sample.bytes) * 1000 / (now - sample.at);
        job.bytesPerSecond = job.bytesPerSecond ? job.bytesPerSecond * 0.7 + speed * 0.3 : speed;
        sample = {at: now, bytes};
      }
      emit();
    };
    // Once every file is decoded the engine flushes and syncs what it wrote (phase "finishing"), which
    // can take minutes: the bar is full and the row says so rather than sitting at 99%. Engines from
    // before the phase never report it.
    // An engine that knows what the files unpack to (RAR sets: often well over the archive's size) gives
    // the bar its real end.
    const follow = progress => {
      if (progress.total && progress.total !== estimate) job.total = estimate = progress.total;
      if (progress.phase !== 'finishing') { report(progress.written || 0); return; }
      if (job.phase === 'finishing') return;
      job.phase = 'finishing'; job.bytesPerSecond = 0;
      if (job.total) job.written = job.total;
      emit();
    };
    let result;
    try {
      if (streamed) {
        active.task = streamed.task;
        sample = {at: Date.now(), bytes: streamed.written};
        report(streamed.written);
        const off = streamed.task.subscribe(follow);
        const outcome = await streamed.done;
        off();
        if (outcome.error && (job.state === 'pausing' || job.cancelling)) throw outcome.error;
        if (outcome.error && !STREAM_FAILURE.test(cause(outcome.error.message))) throw outcome.error;
        if (outcome.error) {
          console.log('[download-queue] extraction during download stopped, extracting again:', outcome.error.message);
          job.written = 0; delete job.phase; sample = {at: Date.now(), bytes: 0}; emit();
        }
        result = outcome.result;
      }
      if (!result) {
        // Extracted games are about as large as their archives: refuse now rather than at the limit.
        if (!fs.exists(job.output) && fs.diskUsage(job.root).free < (estimate || 0)+MARGIN)
          throw new Error('Not enough space to extract this download. Free space and retry.');
        const task = archives.extract(options);
        active.task = task;
        const off = task.subscribe(follow);
        try { result = await task.done; } finally { off(); }
      }
    } catch (error) {
      if (await forgetPart(job, error)) downloaded.written = job.parts.reduce((sum, part) => sum+part.written, 0);
      throw error;
    } finally {
      Object.assign(job, downloaded, {bytesPerSecond: 0});
      delete job.phase;
    }
    const images = (result.artifacts || []).filter(path => /\.(ffpfsc|ffpfs|ffpkg|exfat)$/i.test(path));
    if (images.length) {
      const destination = `${job.root}/homebrew/${job.release.filename.replace(/[^a-z0-9_.-]/gi, '_')}-extracted`;
      fs.mkdir(`${job.root}/homebrew`, {recursive: true});
      job.publishTo = destination; change();
      if (job.output !== destination) {
        if (fs.exists(destination)) throw new Error('Extracted destination already exists; preserve it and inspect before retrying.');
        storageIdentity(job); fs.rename(job.output,destination); job.output = destination;
      }
      job.artifact.nextAction = 'shadowmount'; job.artifact.destination = `${job.output}/${images[0]}`;
      job.state = 'downloaded'; job.message = t('downloads.extractedReady', {parts: job.parts ? 'all' : 'one'});
    } else {
      job.state = 'extracted'; job.message = t('downloads.extractedTo', {path: job.output});
      const packaged = (result.artifacts || []).filter(path => /\.(pkg|fpkg)$/i.test(path));
      const folder = packaged.length ? null : gameFolder(job.output);
      if (packaged.length) {
        job.packages = packaged.map(path => `${job.output}/${path}`);
        job.state = 'installer-required'; job.message = t('downloads.packagesExtracted', {path: job.output});
      } else if (folder) {
        // A game folder (eboot.bin and sce_sys/param.json) installs through ShadowMount from homebrew,
        // which it scans; left under downloads/extracted it never reached the home screen.
        const destination = `${job.root}/homebrew/${job.release.filename.replace(/[^a-z0-9_.-]/gi, '_')}-app`;
        fs.mkdir(`${job.root}/homebrew`, {recursive: true});
        if (fs.exists(destination)) throw new Error('Extracted destination already exists; preserve it and inspect before retrying.');
        storageIdentity(job); fs.rename(folder, destination);
        if (folder !== job.output) await fs.removeAsync(job.output);
        job.output = destination; job.publishTo = destination;
        job.artifact.nextAction = 'shadowmount'; job.artifact.destination = destination;
        job.state = 'downloaded'; job.message = t('downloads.extractedReady', {parts: job.parts ? 'all' : 'one'});
      }
    }
    // Saved before the inputs go: a job still 'extracting' after a crash would download them again.
    change();
    try {
      await Promise.all(files.flatMap(path => [path, `${path}.complete`]).map(path => fs.removeAsync(path)));
      if (job.release.parts) await fs.removeAsync(setDirectory(job));
    } catch (error) {
      console.log('[download-queue] archive not deleted:', error.message);
      job.message = `${job.message} ${t('downloads.archiveNotDeleted', {error: error.message})}`;
    }
  }

  // A RAR set starts extracting once its first volume is in, while the others download: the engine reads
  // each next volume once its download renames it to its final name. Its result waits in `done`, never
  // rejecting, for extract() after the last volume.
  function streamSet(job) {
    const first = job.parts[0].destination;
    if (!archives?.streams || job.parts.length < 2 || archives.inspect([first]).kind !== 'rar') return null;
    let task;
    try {
      const options = extraction(job, job.parts.map(part => part.destination));
      if (fs.exists(options.destination)) return null;
      change();
      task = archives.extract({...options, stream: true});
    } catch (error) {
      console.log('[download-queue] extraction during download not started:', error.message);
      return null;
    }
    const streamed = {task, written: 0};
    const off = task.subscribe(progress => { streamed.written = progress.written || 0; });
    streamed.done = task.done.then(result => ({result}), error => ({error})).finally(off);
    return streamed;
  }

  const setDirectory = job => `${job.root}/downloads/sets/${job.release.filename}`;

  // Volume sizes are learned as each starts; an unknown one is taken to be as large as the largest
  // known. Until extraction deletes them, the volumes and what they extract to share the drive.
  function setNeed(job, extracted = 0) {
    const sizes = job.parts.map(item => item.total ?? item.options?.expectedBytes ?? null);
    const largest = Math.max(0, ...sizes.filter(Boolean));
    const size = index => sizes[index] ?? largest;
    // What an extraction running alongside has written already takes no more room.
    return Math.max(0, job.parts.reduce((sum, item, index) => sum+size(index)+(item.completed ? 0 : Math.max(0, size(index)-item.written)), 0)-extracted);
  }

  // Everything a finished job put on its drive, receipts and sidecars included. Only paths inside the
  // app's own folders qualify: an image or folder under homebrew/, or an entry of a downloads/ category.
  // An extraction starts under downloads/extracted before moving to homebrew/, and one retried into a
  // folder that was already there leaves its first run behind. A path another task owns stays. A path
  // ShadowMount gives the job's title never joins: once the job's file is gone, that is another dump.
  function ownedPaths(job) {
    const managed = path => {
      const parts = path.startsWith(`${job.root}/`) ? path.slice(job.root.length+1).split('/') : [];
      return !parts.some(part => ['', '.', '..'].includes(part))
        && ((parts[0] === 'homebrew' && parts.length >= 2) || (parts[0] === 'downloads' && parts.length >= 3));
    };
    const extracted = job.output && `${job.root}/downloads/extracted/${job.release.filename.replace(/[^a-z0-9_.-]/gi, '_')}`;
    const paths = [job.artifact.destination, job.downloadDestination, job.output, job.publishTo, extracted,
      job.release.parts && setDirectory(job)]
      .filter(Boolean).flatMap(path => [path, ...['.complete', '.complete.tmp', '.part', '.resume', '.resume.tmp'].map(suffix => path+suffix)]);
    return [...new Set(paths)].filter(path => managed(path)
      && !jobs.some(other => other !== job && [other.artifact.destination, other.downloadDestination, other.output, other.publishTo]
        .some(owned => owned && (owned === path || owned.startsWith(`${path}/`)))));
  }

  async function executeSet(job, signal) {
    if (job.release.unavailableReason) throw new Error(job.release.unavailableReason);
    const root = storageIdentity(job);
    if (!job.rootIdentity) job.rootIdentity = root;
    fs.mkdir(job.artifact.directory, {recursive: true});
    job.parts ||= job.release.parts.map(part => ({number: part.number,
      destination: `${job.artifact.directory}/part-${part.number}.bin`, written: 0, completed: false}));
    let streamed = null;
    try {
      for (let index = 0; index < job.parts.length; index++) {
        if (!streamed && index > 0 && job.parts[0].completed && fs.exists(job.parts[0].destination)) streamed = active.streamed = streamSet(job);
        job.partIndex = index;
        const part = job.parts[index];
        if (job.state === 'pausing') return;
        // A finished volume was verified when it completed; queueing it again would only re-read it.
        if (part.completed && fs.exists(part.destination)) continue;
        if (part.completed) { part.completed = false; part.written = 0; delete part.options; }
        job.state = 'resolving'; job.message = t('downloads.part', {part: index + 1, parts: job.parts.length}); active.transferring = false; change();
        const source = job.release.parts[index].sources[part.sourceIndex || 0]; job.currentSource = source;
        if (!part.options) {
          const resolved = await sources.resolve(source, {signal, directURL: job.directURL});
          part.options = {...resolved, expectedBytes: source.sizeBytes || undefined, sha256: source.sha256 || undefined};
          delete job.directURL; change();
        }
        if (job.state === 'pausing') return;
        storageIdentity(job);
        if (!fs.exists(part.destination) && fs.diskUsage(job.root).free < setNeed(job, streamed?.written)+MARGIN)
          throw new Error('Not enough space for the remaining volumes and their extraction. Free space and resume.');
        active.transferring = true;
        // Same connections as a single file; parts keep the engine's 32 MiB ranges so their checkpoints resume.
        const task = downloads.enqueue({...part.options, rejectHtml: true, connections: 64, adaptive: true,
          destination: part.destination, storageRoot: job.root, recoverCompleted: true});
        active.task = task;
        const off = task.subscribe(progress => {
          if (job.state === 'pausing') return;
          if (ACTIVE.includes(progress.state)) job.state = progress.state;
          part.written = progress.written || 0; part.total = progress.total;
          job.written = job.parts.reduce((sum, item) => sum+item.written,0);
          job.total = job.parts.every(item => item.total != null) ? job.parts.reduce((sum,item) => sum+item.total,0) : null;
          job.received = progress.received || 0; job.connections = progress.connections || 0;
          job.bytesPerSecond = progress.bytesPerSecond || 0;
          if (++ticks % 20 === 0) {
            delete job.launches;
            try { save({sync: false}); } catch (error) { job.error = `Queue save failed: ${error.message}`; task.cancel(); }
            if (index === 0) checkHeaders(job, `${part.destination}.part`, task);
          }
          emit();
        });
        let result;
        try { result = await task.done; } finally { off(); }
        part.written = result.written ?? part.total ?? part.written;
        job.written = job.parts.reduce((sum,item) => sum+item.written,0);
        part.completed = true; change();
        const refusal = index === 0 && archives?.inspect([part.destination]).refusal;
        if (refusal) throw new Error(refusal);
      }
    } finally {
      delete active.streamed;
      // A set that stops downloading stops extracting too, before the job ends.
      if (streamed && (job.state === 'pausing' || job.parts.some(part => !part.completed))) {
        streamed.task.cancel(); await streamed.done; streamed = null;
      }
    }
    if (job.state === 'pausing') return;
    await extract(job, job.parts.map(part => part.destination), streamed);
    notifications.show(t('downloads.notice.complete'), job.title);
    if (job.state === 'installer-required' && canInstall()) await install(job);
  }

  // Whether the bytes a stopped job wrote are gone from its drive, deleted outside the app.
  function lostPartial(job) {
    const kept = path => fs.exists(path) || fs.exists(`${path}.part`);
    if (job.parts) return job.parts.some(part => (part.written || part.completed) && !kept(part.destination));
    return job.written > 0 && !kept(job.downloadDestination || job.artifact.destination);
  }

  // The downloads on `root` that write without the user acting first: waiting, running or paused. A
  // failed job, or one waiting for a browser, holds nothing until it is retried, and the retry checks
  // the space again. Neither does a stopped job whose partial was deleted outside the app, since only
  // a restart downloads it again: its row says so.
  function holding(root) {
    const lost = jobs.filter(job => job.root === root && ['paused', 'failed'].includes(job.state) && lostPartial(job));
    const unmarked = lost.filter(job => job.error !== DELETED);
    for (const job of unmarked) job.error = DELETED;
    if (unmarked.length) change();
    return jobs.filter(job => job.root === root && (BUSY.includes(job.state) || job.state === 'paused') && !lost.includes(job));
  }

  function pump(first) {
    if (active || captures.size) return;
    const job = first?.state === 'queued' ? first : jobs.find(item => item.state === 'queued');
    if (!job) return;
    active = {job, task: null};
    void execute(job);
  }

  function storageIdentity(job) {
    const info = fs.stat(job.root);
    if (!info?.isDirectory) throw new Error('Storage disconnected. Reconnect the selected drive.');
    if (typeof info.device !== 'string' || typeof info.inode !== 'string') throw new Error('Storage identity is unavailable. Update the runtime.');
    const identity = `${info.device}:${info.inode}`;
    if (job.rootIdentity && job.rootIdentity !== identity) {
      // The internal drive cannot be swapped. Its identity changes when a task was saved by a version
      // that ran inside ShadowMountPlus 1.7's sandbox, which shows /data through a mount of its own
      // (another device number), and is read now from outside it.
      if (job.root !== '/data') throw new Error('Storage changed. Reconnect the original drive.');
      job.rootIdentity = identity;
    }
    return identity;
  }

  // The partial files discarding `job` deletes, once the checks that refuse to have passed.
  function partialFiles(job) {
    storageIdentity(job);
    if (!job.rootIdentity) throw new Error('This older task has no storage identity. Preserve and inspect its partial files.');
    // Never discard a final file or its verification receipt.
    if (fs.exists(job.parts?.[job.partIndex]?.destination || job.downloadDestination || job.artifact.destination)) throw new Error('A final file exists. Retry to verify and recover it.');
    const destination = job.parts?.[job.partIndex]?.destination || job.downloadDestination || job.artifact.destination;
    const paths = ['.part', '.resume', '.resume.tmp', '.complete', '.complete.tmp']
      .map(suffix => destination+suffix);
    for (const path of paths) {
      const info = fs.stat(path);
      if (info && !info.isFile) throw new Error(`Cannot discard a non-file: ${path}`);
    }
    return paths;
  }

  // A set's volumes, complete or not, and their sidecars all live in its own folder, which goes whole,
  // and so does what it extracted while downloading until that was published. Nothing another task
  // owns goes.
  function setFiles(job) {
    storageIdentity(job);
    if (!job.rootIdentity) throw new Error('This older task has no storage identity. Preserve and inspect its partial files.');
    const extracted = job.output?.startsWith(`${job.root}/downloads/extracted/`) && !job.publishTo ? [job.output] : [];
    return [setDirectory(job), ...extracted].filter(path => !jobs.some(other => other !== job
      && [other.release.parts && setDirectory(other), other.output, other.publishTo, other.artifact.destination, other.downloadDestination]
        .some(owned => owned && (owned === path || owned.startsWith(`${path}/`)))));
  }

  // A delete the engine refuses keeps the files, and says so.
  const removePath = path => fs.removeAsync(path).catch(error => { throw new Error(`Its files were not deleted: ${error.message}`); });
  const removeAll = paths => Promise.all(paths.map(removePath));

  // A file of several GB takes seconds to delete, so deletes run off the render thread. Meanwhile the job
  // reads 'removing', which no action accepts, so a second press or a retry cannot race the delete. After
  // it the job is back in its state for the caller to move on, with what `work` resolved; a failed delete
  // leaves it there with the failure as its error. Saved first, so a forced close mid-delete brings it
  // back as it was.
  async function removing(job, work) {
    const state = job.state;
    job.state = 'removing'; job.removingFrom = state;
    try { change(); } catch { emit(); }
    let result;
    try { result = await work(); } catch (error) {
      console.log(`[download-queue] ${job.id} not deleted:`, error.message);
      job.state = state; delete job.removingFrom; job.error = error.message;
      try { change(); } catch { emit(); }
      throw error;
    }
    job.state = state; delete job.removingFrom;
    return result;
  }

  const onOriginalStorage = job => { try { storageIdentity(job); return true; } catch { return false; } };

  async function forget(job) {
    // A task that never reached native storage owns no partial file. One whose drive is gone or was
    // replaced is still forgotten, its partial files left where they are, and so is one that took over
    // a partial file another source may have written. A cancelled set takes its complete volumes too.
    if ((job.rootIdentity || job.written) && !job.adopted && onOriginalStorage(job)) {
      const paths = job.release.parts ? setFiles(job) : partialFiles(job);
      // A cancelled task never runs again: a queued one waits as paused, so neither the queue nor a
      // launch after a forced close starts it.
      if (job.state === 'queued') job.state = 'paused';
      await removing(job, () => removeAll(paths));
    }
    const previous = jobs;
    jobs = jobs.filter(item => item !== job);
    try { save(); } catch (error) { jobs = previous; throw error; }
  }

  async function shadowRequest(route, body = {}) {
    if (platform !== 'ps5') throw new Error('ShadowMount registration requires a PS5.');
    return request(http, route, body);
  }

  // ShadowMount's game for a job: the image or folder it downloaded (or one inside it), or, once
  // ShadowMount moved that away, the same title it manages; null when it has none. While the job's file
  // is there, a title elsewhere is another install of the game, not the job's to mark installed or uninstall.
  // A release of another region is registered under the title its image holds (PPSA21567 for a catalog's
  // PPSA21564): ShadowMount's image list finds the job's mounted image by path, and its param.json names
  // the title, kept as `consoleTitleId`. Asked per title, never through the full game list (`games`):
  // ShadowMountPlus 1.7beta4 builds that list inside SceShellCore from every installed game and PKG, and
  // 0.0.103, which asked for it at launch, crashed whole consoles.
  async function registered(job) {
    const paths = [job.artifact.destination, job.output, job.publishTo].filter(Boolean);
    const info = title => shadowRequest('games/info', {title_id: title})
      .catch(error => { if (/HTTP 404/.test(error.message)) return null; throw error; });
    const listed = await info(job.consoleTitleId ?? job.titleId);
    if (within(listed?.path, paths, job.root)) return listed;
    for (const image of await mountedImages(shadowRequest, paths, job.root).catch(() => null) ?? []) {
      const title = mountedTitle(image);
      if (!title || title === listed?.title_id) continue;
      const game = await info(title);
      if (within(game?.path, paths, job.root)) { job.consoleTitleId = title; return game; }
    }
    return !fs.exists(job.artifact.destination) && listed?.managed ? listed : null;
  }

  // The title of the game a mounted image holds, from its param.json at the mount's root or in a folder
  // just below it. Null when neither has one.
  function mountedTitle(image) {
    const titleIn = folder => { try { return JSON.parse(fs.readFile(`${folder}/sce_sys/param.json`)).titleId || null; } catch { return null; } };
    let folders = [];
    try { folders = fs.readDir(image.mount_point).filter(entry => entry.isDirectory).map(entry => `${image.mount_point}/${entry.name}`); }
    catch { /* an unreadable mount names no title */ }
    for (const folder of [image.mount_point, ...folders]) {
      const title = titleIn(folder);
      if (title) return title;
    }
    return null;
  }

  // The engine's disk usage keeps only statfs's block size, block count and available blocks; ShadowMount
  // reads the rest, so the log shows free blocks (the system's reserve included) beside available ones.
  async function logStorage(log) {
    try {
      const {mounts = []} = await shadowRequest('storage');
      for (const mount of mounts) {
        log(`statfs ${mount.mount_point} (${mount.source}, ${mount.filesystem}): total ${mount.total_bytes}, free ${mount.free_bytes}, available ${mount.available_bytes}, used ${mount.used_bytes}`);
      }
    } catch (error) { log(`storage not read: ${error.message}`); }
  }

  // The deleteFromDisk running for each job.
  const deletions = new WeakMap();

  // Everything a finished job left, after ShadowMount let go of it. Resolves the uninstall's error when
  // ShadowMount kept the title but the files went.
  async function deleteJob(job) {
    const log = message => console.log(`[download-queue] delete ${job.id}: ${message}`);
    const paths = ownedPaths(job);
    let uninstall = null;
    if (job.artifact.nextAction === 'shadowmount' && platform === 'ps5') {
      const check = () => mountedImages(shadowRequest, paths, job.root).catch(error => {
        throw new Error(`ShadowMount could not say whether the image is mounted, so its files were kept: ${error.message}`);
      });
      let mounted = await check();
      if (mounted === null) log('ShadowMount is not running, so none of its files is mounted');
      else {
        let released = false;
        // Undefined when ShadowMount cannot be asked; null when it has no game for this job.
        const game = await registered(job).catch(error => { log(`game info failed: ${error.message}`); return undefined; });
        log(game ? `ShadowMount game ${game.title_id} at ${game.path}, runtime ${game.runtime_path || 'none'}, installed ${game.installed}, managed ${game.managed}, mounted ${game.mounted}`
          : `ShadowMount ${game === null ? 'has no game' : 'was not asked about the game'} of ${job.titleId}`);
        log(mounted.length ? `mounted: ${mounted.map(image => image.path).join(', ')}` : 'none of its files is mounted');
        // Uninstall first, so the home screen keeps no tile pointing at a missing image.
        if (game !== null) {
          try { await shadowRequest('games/uninstall', {title_id: game?.title_id ?? job.installedTitleId ?? job.titleId}); log('uninstalled'); released = true; }
          catch (error) {
            log(`uninstall failed: ${error.message}`);
            const unknown = /HTTP 404/.test(error.message);
            // An installed game runs from these files: deleting them would leave its tile broken. One
            // ShadowMount could not be asked about may be installed, unless the uninstall says it does not know it.
            if (game?.installed || (game === undefined && !unknown)) throw new Error(`ShadowMount did not uninstall it, so its files were kept: ${error.message}`);
            if (!unknown) uninstall = error;
          }
        }
        // Each mounted image is unmounted under the title ShadowMount knows it by: the job's game when
        // that is the image, else the one the image holds.
        const titles = new Set(mounted.map(image => (game && within(game.path, [image.path], job.root) ? game.title_id : mountedTitle(image))));
        if (game?.mounted) titles.add(game.title_id);
        titles.delete(null);
        for (const title of titles) {
          await shadowRequest('games/unmount', {title_id: title}).then(() => { log(`unmounted ${title}`); released = true; }, error => log(`unmount of ${title} failed: ${error.message}`));
        }
        // ShadowMount uninstalls after answering, so a mount it just released may take a few seconds to go.
        for (let attempt = 0; mounted.length && released && attempt < 5; attempt++) {
          if (attempt) await wait(1000);
          mounted = await check() ?? [];
        }
        if (mounted.length) {
          log(`still mounted: ${mounted.map(image => image.path).join(', ')}`);
          throw new Error(`ShadowMount still has ${mounted[0].path} mounted, so its files were kept. Close any game and try again; if it stays mounted, delete the game from ShadowMount's web page (port 10101), which unmounts it first.`);
        }
      }
    }
    // What a deletion freed is read from the drive: walking an extracted game's thousands of files to
    // sum them would hold the interface's thread, so a folder is logged without its size.
    const before = fs.diskUsage(job.root).free;
    for (const path of paths) {
      if (!fs.exists(path)) continue;
      const info = fs.stat(path);
      await removePath(path);
      log(`deleted ${path}${info?.isDirectory ? ' (folder)' : `, ${info?.size || 0} bytes`}`);
    }
    const after = fs.diskUsage(job.root).free;
    log(`${job.root} free went from ${before} to ${after} bytes (${after - before} freed)`);
    if (platform === 'ps5') void logStorage(log);
    const previous = jobs;
    jobs = jobs.filter(item => item !== job);
    try { save(); } catch (error) { jobs = previous; throw error; }
    emit();
    return uninstall;
  }

  // ShadowMount registers a scanned image only once no game is open, so after Overdrive closes: the
  // job learns it was installed from ShadowMount on a later visit, not from the scan request. One
  // request at a time, so ShadowMount never answers several at once.
  async function markInstalled(candidates) {
    let found = false;
    let learned = false;
    for (const job of candidates) {
      const known = job.consoleTitleId;
      const game = await registered(job);
      learned ||= job.consoleTitleId !== known;
      if (!game?.installed || !jobs.includes(job) || job.state !== 'downloaded') continue;
      job.state = 'installed'; job.message = t('downloads.installed'); job.error = ''; job.installedTitleId = game.title_id;
      found = true;
    }
    if (found || learned) change();
    return found;
  }

  async function checkInstalls(id) {
    const candidates = jobs.filter(job => job.state === 'downloaded' && job.artifact.nextAction === 'shadowmount' && (id === undefined || job.id === id));
    if (platform !== 'ps5' || !candidates.length) return false;
    try { return await markInstalled(candidates); }
    catch (error) { console.log('[download-queue] ShadowMount install check failed:', error.message); return false; }
  }
  // Asked only when the Downloads screen or a game's page opens, never at launch; while a check runs,
  // another ask shares it.
  let syncing = null;
  const syncInstalls = id => syncing ??= checkInstalls(id).finally(() => { syncing = null; });

  // What was running or waiting when the app closed carries on, unless its drive is missing or
  // changed, or it was running at each of the last two launches without progress (a crash loop,
  // say an extraction that runs out of memory).
  let running;
  for (const job of jobs.filter(item => item.restore)) {
    const was = job.restore;
    delete job.restore;
    try { storageIdentity(job); fs.diskUsage(job.root); } catch { continue; }
    if (was === 'running' && (job.launches || 0) >= 2) continue;
    if (was === 'running') { job.launches = (job.launches || 0)+1; running = job; }
    job.state = 'queued'; job.error = '';
  }
  if (jobs.some(job => job.state === 'queued')) { change(); pump(running); }

  function stopCapture(job) {
    const session = captures.get(job.id);
    if (session) { captures.delete(job.id); session.cancel.cancel(); session.task?.cancel(); }
    delete job.captureState; delete job.captureError;
  }

  function continueJob(job, url, verifiedOptions) {
    if (job.state !== 'awaiting-browser' || active?.job === job) return;
    webURL(url);
    // Nothing was written yet, so what is left is a few bytes at most: deleted in place.
    if (!(job.parts?.[job.partIndex]?.written ?? job.written) && job.rootIdentity && !job.adopted) {
      for (const path of partialFiles(job)) if (fs.exists(path)) fs.remove(path);
    }
    // Complete fallible storage checks while capture still owns the job, so a handoff error
    // reaches the recovery modal. A captured file has already passed its HTTP range check.
    if (job.parts) job.parts[job.partIndex].options = verifiedOptions;
    job.options = job.parts ? undefined : verifiedOptions;
    job.directURL = verifiedOptions ? undefined : url;
    stopCapture(job);
    delete job.reresolved; job.message = ''; job.error = '';
    job.state = 'queued'; change(); pump(job);
  }

  async function captureBrowser(job, source, session) {
    const current = () => captures.get(job.id) === session && jobs.includes(job) && job.state === 'awaiting-browser';
    let handingOff = false;
    try {
      const linkPage = vikingLinkPage(source);
      console.log(linkPage ? '[browser-capture] link page; any Vikingfile file' : '[browser-capture] reading public file metadata');
      const metadata = linkPage ? linkPageMetadata(source) : await describeVikingCapture(http, source, session.cancel.signal);
      if (!current()) return;
      session.task = browserCapture.capture({prefix: VIKING_PREFIX, suffix: `/${metadata.filename}`, timeoutSeconds: 180});
      job.captureState = 'capturing'; change();
      console.log('[browser-capture] capture submitted; opening browser');
      if (!linking?.openURL(webURL(job.browserUrl).url)) throw new Error('The browser could not open. Retry or enter the final file link.');
      const result = await session.task.done;
      if (!current()) return;
      job.captureState = 'validating'; change();
      console.log('[browser-capture] link captured; validating one-byte range');
      const validated = await validateVikingCapture(http, result.url, linkPage ? capturedVikingFile(result.url, metadata) : metadata, session.cancel.signal);
      if (!current()) return;
      // Keep the selected release/destination identity, while giving the native transfer an exact size.
      source.sizeBytes = validated.expectedBytes;
      if (!job.parts) job.total = validated.expectedBytes;
      // The person is still in the browser and can't see the app, so tell them it's safe to come back.
      notifications.show(t('downloads.notice.captured'), job.title);
      console.log('[browser-capture] file validated; handing off to queue');
      handingOff = true;
      continueJob(job, validated.url, {url: validated.url, expectedBytes: validated.expectedBytes,
        sha256: source.sha256 || undefined, rejectHtml: true});
      console.log('[browser-capture] handoff finished; state:', job.state);
    } catch (error) {
      if (!current() && !(handingOff && jobs.includes(job) && job.state === 'queued' && active?.job !== job)) return;
      console.log('[browser-capture] failed:', error.message);
      session.cancel.cancel(); session.task?.cancel(); captures.delete(job.id);
      job.state = 'awaiting-browser';
      job.captureState = 'failed'; job.captureError = error.message; change(); pump();
    }
  }

  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    /** `alternatives`: other sources of the game, best first, tried in order if this one can't start. */
    enqueue(game, release, root, alternatives = []) {
      const id = `${game.id}/${release.id}`;
      const existing = jobs.find(job => job.id === id);
      if (existing) return existing.id;
      if (release.unavailableReason) throw new Error(release.unavailableReason);
      const artifact = artifactFor(release, root);
      if (fs.exists(artifact.destination)) throw new Error('Destination already exists. Choose another release or inspect the existing file.');
      if (jobs.some(job => job.artifact.destination === artifact.destination)) throw new Error('Another queued release owns this filename.');
      // A partial file no task owns was left by a queue that lost its task: the app was reinstalled,
      // or the console stopped before the queue saved. This release would write exactly there, so the
      // new task takes it over: the transfer resumes it only when its checkpoint matches this source.
      // Until then it may be another source's with the same filename, so Cancel and Restart keep it.
      const orphan = fs.exists(`${artifact.destination}.part`);
      if (jobs.length === 32) jobs = jobs.filter(job => !COMPLETE.includes(job.state));
      if (jobs.length === 32) throw new Error('Queue has 32 unfinished downloads. Finish or remove one first.');
      if (release.sizeBytes) {
        const pending = holding(root);
        const held = orphan ? Math.min(fs.stat(`${artifact.destination}.part`)?.size || 0, release.sizeBytes) : 0;
        const need = stillNeeded({release, artifact, total: release.sizeBytes, written: held});
        const shortfall = spaceShortfall(root, need, fs.diskUsage(root).free, pending);
        if (shortfall) throw new Error(shortfall);
      }
      // Bounded: downloads.json keeps every job, and four fallbacks cover a game's usable hosts.
      jobs.push({id, gameId: game.id, titleId: game.titleId || game.id, title: game.title, release: {...release},
        requestedId: release.id, fallbacks: alternatives.slice(0, 4).map(item => ({...item})),
        root, artifact, state: 'queued', written: 0, total: release.sizeBytes || null, error: ''});
      try {
        if (orphan) Object.assign(jobs.at(-1), {rootIdentity: storageIdentity(jobs.at(-1)), adopted: true});
        change();
      } catch (error) { jobs.pop(); throw error; }
      pump(); return id;
    },
    pause(id) {
      const job = find(id);
      if (job.state === 'queued') job.state = 'paused';
      else if (active?.job === job && ACTIVE.includes(job.state)) {
        job.state = 'pausing'; active.cancel?.cancel(); active.task?.cancel();
      }
      change();
    },
    /** Installs a downloaded PKG again, after the console refused it or the app closed while installing. */
    install(id) {
      const job = find(id);
      if (job.state !== 'installer-required' || !canInstall()) return;
      job.install = true; job.state = 'queued'; job.error = ''; change(); pump();
    },
    get installs() { return canInstall(); },
    resume(id) {
      const job = find(id);
      if (job.state !== 'paused' && job.state !== 'failed') return;
      delete job.reresolved;
      job.state = 'queued'; job.error = ''; change(); pump();
    },
    async restart(id) {
      const job = find(id);
      if (!['paused', 'failed', 'awaiting-browser'].includes(job.state) || active?.job === job) return;
      if (job.adopted) throw new Error(ADOPTED);
      const paths = !(job.parts?.[job.partIndex]?.completed) && (job.options || job.rootIdentity || job.written || fs.exists(job.artifact.destination+'.part') || fs.exists(job.artifact.destination+'.resume')) ? partialFiles(job) : [];
      stopCapture(job);
      if (paths.length) await removing(job, () => removeAll(paths));
      delete job.directURL; delete job.reresolved;
      if (job.parts?.[job.partIndex] && !job.parts[job.partIndex].completed) {
        job.parts[job.partIndex].written = 0; delete job.parts[job.partIndex].options;
      }
      job.written = job.parts ? job.parts.reduce((sum,part) => sum+part.written,0) : 0;
      job.bytesPerSecond = 0; delete job.options; delete job.inspected;
      job.state = 'queued'; job.error = ''; change(); pump();
    },
    remove(id) {
      const job = find(id);
      if (!['paused', 'failed', 'awaiting-browser', ...COMPLETE].includes(job.state) || active?.job === job) return;
      stopCapture(job);
      // Removing queue metadata never deletes files, and works with disconnected disks.
      const previous = jobs;
      jobs = jobs.filter(item => item !== job);
      try { save(); } catch (error) { jobs = previous; throw error; }
      emit(); pump();
    },
    /**
     * Uninstalls a finished game from ShadowMount and, once ShadowMount's image list shows none of the
     * task's paths mounted, deletes everything the task put on its drive and forgets it. A ShadowMount
     * that does not answer mounts nothing, so the files go. Each step is logged.
     */
    async deleteFromDisk(id) {
      const job = find(id);
      // A second Delete while one runs ends with it, so Files confirms the delete only once it is done.
      if (deletions.has(job)) return deletions.get(job);
      if (!COMPLETE.includes(job.state)) return;
      const deletion = (async () => {
        // A replaced drive mounted at the same path holds someone else's files.
        storageIdentity(job);
        const uninstall = await removing(job, () => deleteJob(job));
        if (uninstall) throw new Error(`Deleted from disk, but ShadowMount did not uninstall it: ${uninstall.message}`);
      })().finally(() => deletions.delete(job));
      deletions.set(job, deletion);
      return deletion;
    },
    openBrowser(id) {
      const job = find(id);
      if (job.state !== 'awaiting-browser') return;
      const source = job.parts ? job.currentSource : job.release;
      if (browserCapture && (sourceKind(source) === 'vikingfile' || vikingLinkPage(source))) {
        if (captures.has(id)) return;
        if (captures.size || active) throw new Error('Wait for the current queue task before opening Vikingfile, so its captured link can start immediately.');
        const session = {cancel: cancellation(), task: null};
        captures.set(id, session); job.captureState = 'preparing'; delete job.captureError; change();
        void captureBrowser(job, source, session);
        return;
      }
      if (!linking?.openURL(webURL(job.browserUrl).url)) throw new Error('The browser could not open. Open this source on another device.');
      job.message = t('downloads.afterVerification'); change();
    },
    cancelBrowserCapture(id, {manual = false} = {}) {
      const job = find(id);
      stopCapture(job);
      if (manual) job.captureState = 'failed';
      change(); pump();
    },
    continueWithURL(id, url) { continueJob(find(id), url); },
    /** Marks finished images (all, or job `id`'s) ShadowMount has installed since as installed; false when none or it can't be asked. */
    syncInstalls,
    /** Frees the engine's one archive task, for the updater: a set extracting while it downloads extracts after its download instead. */
    async yieldArchives() {
      const streamed = active?.streamed;
      if (streamed) { streamed.task.cancel(); await streamed.done; }
    },
    /** Whether the queue keeps the console awake: some download is queued or running. */
    get awake() { return awake; },
    /** Discards the partial file and forgets the task; an active one is paused first. */
    async cancel(id) {
      const job = find(id);
      if (COMPLETE.includes(job.state) || job.state === 'removing') return;
      if (active?.job === job) { job.cancelling = true; this.pause(id); return; }
      stopCapture(job); await forget(job); emit(); pump();
    },
    async register(id) {
      const job = find(id);
      if (job.artifact.nextAction !== 'shadowmount' || !COMPLETE.includes(job.state)) return;
      try {
        // Already installed (ShadowMount ran while Overdrive was closed): nothing to scan. Versions
        // without game info still scan.
        if (await markInstalled([job]).catch(() => false)) return;
        const version = await shadowRequest('version');
        if (!version.capabilities?.includes('rescan')) throw new Error('This ShadowMount version has no rescan API. Use its automatic scan.');
        await shadowRequest('scan', {reset_attempts: false});
        job.message = t('downloads.installRequested'); job.error = '';
      } catch (error) { job.error = error.message; }
      change();
    },
  };
}
