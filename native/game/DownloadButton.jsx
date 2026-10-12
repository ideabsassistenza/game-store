// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useMemo, useRef, useState} from 'react';
import {View, Text, DownloadFormats, motion, tw} from '@ps5-react/core';
import {STALE_PARTIAL, cause, explainError} from '../downloads/errors.js';
import {WAITING, shownState} from '../downloads/labels.js';
import {formatPercent, useT} from '../i18n/index.js';
import {editionsOf, formatBytes} from '../state/catalog.js';
import {useNavActions} from '../state/nav.jsx';
import {BUSY, COMPLETE} from '../state/download-queue.js';
import {downloadQueue, driveName, freeBytes, storageRoots} from '../state/downloads.js';
import {MARGIN} from '../state/space.js';
import {FocusRing} from '../ui/FocusRing.jsx';
import {glide} from '../ui/ProgressBar.jsx';
import {Shine} from '../ui/Shine.jsx';
import {ShimmerText} from '../ui/ShimmerText.jsx';
import {EASE_OUT} from '../ui/ease.js';
import {Choice, TextAction} from './Choice.jsx';
import {MoreOptions, ProblemNote} from './DownloadProblem.jsx';
import {fallbacks, isOverdriveCdn} from './sources.js';
import {DISABLED, DownloadLabel, statusLine} from './DownloadLabel.jsx';
import {canDownload, preferredRelease, spaceAdvice, spaceNeeded} from './releases.js';
import {useDownload} from './useDownload.js';
import {useFreeSpace} from './useFreeSpace.js';
import {useShadowMount} from './useShadowMount.js';

const WIDTH = 272;
const GB = 1e9;
const STATUS = tw`font-sans text-sm`;


// One focusable element in every state, so controller focus never drops while the label changes.
// The light-on-dark label sits under the accent bar; the bar clips a dark copy of the same label,
// which is what the store did with clip-path. The bar slides in from the left and its copy slides
// back by the same amount, so the copy stays aligned while both move on translate only.
/**
 * `start` begins the download once the page is up: the version picker on the title's other edition
 * opened this page to download it.
 */
export function DownloadButton({game, start, onDownloaded, nextDown, onRequestDialog}) {
  const t = useT();
  const releases = game.releases || [];
  // A download of this game from any of its sources is the one the page shows, rather than offering
  // the preferred source again beside it.
  const [selected, setSelected] = useState(() => {
    let jobs = [];
    try { jobs = downloadQueue().snapshot().filter(job => job.gameId === game.id); } catch { /* no queue: the preferred source */ }
    const owned = jobs.map(job => releases.findIndex(release => release.id === (job.requestedId ?? job.release.id))).find(index => index >= 0);
    return owned ?? preferredRelease(releases);
  });
  const [roots] = useState(() => { try { return storageRoots(); } catch { return ['/data']; } });
  // Start on the first drive the preferred release fits on.
  const [storage, setStorage] = useState(() => {
    const first = releases[preferredRelease(releases)];
    return Math.max(0, roots.findIndex(root => { const need = spaceNeeded(first, root); return !need || freeBytes(root) >= need + MARGIN; }));
  });
  const release = releases[selected];
  // If the chosen source can't start, the queue moves on to copies of the same build that the app
  // reaches by itself.
  const alternatives = useMemo(() => fallbacks(releases, selected), [releases, selected]);
  const download = useDownload(game, release, roots[storage], alternatives);
  const {progress, restart, remove, deleteFromDisk, job, error} = download;
  // Watched while no download exists: the drive choice and the space check are what the page shows then.
  const free = useFreeSpace(roots, download.status, !job);
  const need = spaceNeeded(release, roots[storage]);
  const lacking = download.status === 'idle' && need && free[storage] !== null && free[storage] < need + MARGIN;
  // As the Downloads row: a paused job whose partial was deleted only restarts too.
  const stale = ['paused', 'failed'].includes(download.status) && STALE_PARTIAL.test(cause(error));
  const status = lacking ? 'no-space' : stale ? 'stale' : download.status;
  const begin = () => { if (stale) restart(); else if (!lacking) download.advance(); };
  // A title with a PS4 and a PS5 edition asks which to download first, as the console's store does.
  const {openEdition, focusLater, push} = useNavActions();
  const editions = editionsOf(game);
  const advance = () => {
    if (status !== 'idle' || editions.length < 2) { begin(); return; }
    onRequestDialog({kind: 'version', title: game.title, editions, current: game.id,
      submit: edition => { if (edition.id === game.id) begin(); else openEdition(edition.id, true); }});
  };
  // Read after the queue's first report, so a job already running is not paused.
  const latest = useRef(null);
  latest.current = {status, begin};
  useEffect(() => {
    if (!start) return undefined;
    const id = setTimeout(() => { if (latest.current.status === 'idle') latest.current.begin(); }, 0);
    return () => clearTimeout(id);
  }, []);
  const shadowMount = useShadowMount(DownloadFormats.images.includes(release?.format));
  const browser = status === 'awaiting-browser';
  // A set asks for one link per part, in order; `step` names the part waiting for its link.
  const step = job?.parts ? {part: job.partIndex + 1, parts: job.parts.length} : null;
  const requestFile = () => onRequestDialog({title: step ? t('download.partFileLink', step) : t('download.fileLink'),
    detail: t('download.fileLinkDetail'),
    submit: url => downloadQueue().continueWithURL(job.id, url)});
  const written = (job?.parts?.[job.partIndex]?.written ?? job?.written) > 0;
  const recoverable = ['paused', 'failed', 'stale'].includes(status) || browser;
  // Source and drive are picked before a download starts; afterwards changing them is a recovery step.
  // A source that wants a browser and has no bytes yet is not started: its row stays, so the person can
  // pick another instead of being held on the browser step.
  const choosing = !job || (browser && !written);
  const sizeGb = job?.total ? job.total / GB : release?.sizeBytes ? release.sizeBytes / GB : game.sizeGb;
  const inProgress = BUSY.includes(status) || status === 'paused';
  // Some hosts send no size, so a running download counts bytes instead of a percentage that stays at 0.
  const sizeless = inProgress && !job?.total;
  const amount = sizeless ? formatBytes(job?.written || 0) : formatPercent(Math.round(progress * 100));
  // What the button and the line under it read; an extraction's last writes read as 'finishing'.
  const shown = job && shownState(job) === 'finishing' ? 'finishing' : status;
  const [state, line] = statusLine(stale ? download.status : shown, progress, sizeGb);
  const detail = sizeless ? t('download.soFar', {size: formatBytes(job?.written || 0)}) : line;
  const problem = browser ? {title: step ? t('download.browser.partTitle', step) : t('download.browser.title'),
    action: t('download.browser.action')}
    : error ? explainError(error, Boolean(job?.release.parts))
    : lacking ? {title: t('download.noFit'), action: spaceAdvice(roots, free, storage, need)}
    // An image downloads either way; it reaches the home screen only once ShadowMount runs.
    : shadowMount || status === 'installed' ? null : {title: t('shadowMount.offTitle'), action: t('shadowMount.offAction')};
  const notice = job?.message;
  // `from`: where focus returns when the sheet closes, if not the main button.
  // Another source replaces a job that wrote nothing, which would otherwise stay queued for its browser.
  const pick = index => {
    if (index !== selected && job && !written && ['awaiting-browser', 'failed', 'paused'].includes(job.state)) downloadQueue().remove(job.id);
    setSelected(index);
  };
  const chooseSource = from => onRequestDialog({kind: 'source', title: game.title, releases, selected, submit: pick, from,
    editions, current: game.id, onEdition: id => openEdition(id)});
  const saved = job?.written ? formatBytes(job.written) : null;
  const removal = {icon: 'x', label: t('download.remove.label'), detail: t('download.remove.detail'), onSelect: remove};
  // Asks for a second press: it uninstalls the game too. The only place a finished download's files are
  // deleted from besides Files; leaving the list keeps them.
  const deletion = job && {icon: 'trash', label: t('hints.delete'), detail: job.artifact.destination, onSelect: deleteFromDisk,
    armed: {label: t('hints.confirmDelete'), detail: t('files.confirmDelete', {size: formatBytes(job.total || 0)})}};
  const options = COMPLETE.includes(status) ? [removal, deletion]
    : recoverable ? [
    stale ? null : {icon: 'restart', label: t('download.restart.label'),
      detail: saved ? t('download.restart.detailSaved', {size: saved}) : t('download.restart.detail'), onSelect: restart},
    removal,
    releases.length > 1 ? {icon: 'list', label: t('download.otherSource.label'), detail: t('download.otherSource.detail'),
      onSelect: () => chooseSource(), next: true} : null,
  ].filter(Boolean) : [];
  const openOptions = () => onRequestDialog({kind: 'options', title: game.title, items: options});
  const [pulse, setPulse] = useState(false);
  const hidden = (1 - progress) * WIDTH;
  const sourceFocus = `download-source:${game.id}`;
  const storageFocus = `download-storage:${game.id}`;
  const moreFocus = `download-more:${game.id}`;
  const browserFocus = `download-continue:${game.id}`;
  const queueFocus = `download-queue:${game.id}`;
  const mainFocus = `download:${game.id}`;
  const disabled = DISABLED.includes(status);
  // Selectors with nothing to choose are plain text, so Down skips them.
  // The source row also leads to the other editions, so it opens with one source when there are several.
  const sourceChoice = releases.length > 1 || editions.length > 1;
  const chain = [mainFocus, choosing && release && sourceChoice && sourceFocus,
    !job && roots.length > 1 && storageFocus, browser && browserFocus, job && queueFocus, options.length > 0 && moreFocus].filter(Boolean);
  const after = key => chain[chain.indexOf(key) + 1] ?? nextDown;

  // A download that cannot start opens the page on the hero's favorite button: the first Cross would
  // otherwise land on a button that does nothing.
  useEffect(() => {
    if (canDownload(game) && disabled) focusLater(`favorite:${game.id}`);
  }, []);

  useEffect(() => {
    if (!COMPLETE.includes(status)) return;
    setPulse(true);
    onDownloaded();
  }, [status]);

  return (
    <View className="w-[272px] gap-2">
      <View onPress={advance} autoFocus={canDownload(game) && !disabled} focusKey={mainFocus} nextFocusDown={after(mainFocus)}
        className={`relative h-12 w-[272px] rounded-md ${disabled ? 'border border-line'
          : inProgress ? 'bg-surface-2' : 'bg-accent focused:bg-white'}`}>
        <motion.View className="overflow-hidden rounded-md" initial={false} animate={{scale: pulse ? 1.035 : 1}}
          transition={{duration: 0.225, ease: EASE_OUT}} onAnimationComplete={() => setPulse(false)}>
          <DownloadLabel status={shown} amount={amount} dark={!inProgress && !disabled} />
          {inProgress && (
            <motion.View className="absolute inset-0 overflow-hidden bg-accent"
              initial={{x: -WIDTH}} animate={{x: -hidden}} transition={glide}>
              <motion.View initial={{x: WIDTH}} animate={{x: hidden}} transition={glide}>
                <DownloadLabel status={shown} amount={amount} dark />
              </motion.View>
            </motion.View>
          )}
          <Shine width={WIDTH} />
        </motion.View>
        <FocusRing />
      </View>
      <View className="flex-row justify-between">
        {WAITING.includes(shown) ? <ShimmerText textStyle={STATUS}>{state}</ShimmerText>
          : <Text className="font-sans text-sm text-subtle">{state}</Text>}
        {detail ? <Text className="font-sans text-sm text-subtle">{detail}</Text> : null}
      </View>
      {problem ? <ProblemNote title={problem.title} action={problem.action} />
        : notice ? <Text className="w-[272px] font-sans text-sm text-muted line-clamp-3">{notice.slice(0, 160)}</Text> : null}
      {choosing && release ? (
        <Choice focusKey={sourceFocus} nextFocusDown={after(sourceFocus)} onPress={sourceChoice ? () => chooseSource(sourceFocus) : null}
          magic={isOverdriveCdn(release.provider) ? {name: release.provider,
            detail: [t('sources.cdnFastest'), release.sizeBytes && formatBytes(release.sizeBytes)].filter(Boolean).join(' · ')} : null}
          text={[t('download.source', {source: release.provider}), release.sizeBytes && formatBytes(release.sizeBytes)].filter(Boolean).join(' · ')} />
      ) : null}
      {!job ? (
        <Choice focusKey={storageFocus} nextFocusDown={after(storageFocus)}
          onPress={roots.length > 1 ? () => setStorage(index => (index + 1) % roots.length) : null}
          text={[t('download.saveTo', {drive: driveName(roots[storage])}), free[storage] !== null && t('download.free', {size: formatBytes(free[storage])})].filter(Boolean).join(' · ')} />
      ) : null}
      {browser ? <TextAction focusKey={browserFocus} nextFocusDown={after(browserFocus)} onPress={requestFile}
        text={step ? t('download.enterPartLink', step) : t('download.enterLink')} /> : null}
      {/* Once a download exists, its full progress, speed and the rest of the queue are one press away. */}
      {job ? <TextAction focusKey={queueFocus} nextFocusDown={after(queueFocus)} text={t('download.openQueue')}
        onPress={() => push({name: 'downloads'}, queueFocus)} /> : null}
      {options.length ? <MoreOptions focusKey={moreFocus} nextFocusDown={nextDown} onPress={openOptions} /> : null}
    </View>
  );
}
