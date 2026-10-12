// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Updates the installed app from a GitHub release: the latest release's ZIP asset is downloaded,
// checked against the SHA-256 GitHub publishes for it and extracted next to the install. A folder
// install gets the extracted entries swapped in, the folder itself staying since ShadowMount's mount
// points at it; an image install gets the extracted image renamed over it. The new version runs from
// the next launch.

import {formatBytes} from './size.js';

// An exFAT image is whole 512-byte sectors, and the smallest app image is megabytes.
const SECTOR = 512;
const MIN_IMAGE_BYTES = 1024 ** 2;
const MIB = 1024 ** 2;
// exFAT keeps modification times in 2 s steps (plus a 10 ms field not every driver keeps), so the
// time read back after a remount can be off from the one read right after extracting.
const MTIME_SLACK_MS = 2000;
// Launches on the old version over the installed image after which reopening alone is not enough.
const STUCK_LAUNCHES = 2;
// How long an install changes files before it lets a frame draw: a replaced app is thousands of files.
const BUDGET_MS = 8;
// The console's clock does not advance while a frame's JavaScript runs (one cleanup took 21.9 s in a
// single frame by it), so a frame is also let draw after this many permission changes or moves,
// whatever the clock says.
const CHANGES_PER_FRAME = 8;

const log = message => console.log(`overdrive: update ${message}`);

/** Thrown when the image could not be renamed over the installed one, which then needs replacing by hand. */
export class ImageReplaceError extends Error {}

/** Whether version `a` ('0.0.87', 'v1.2.0') is above `b`. */
export function newer(a, b) {
  const parts = version => version.replace(/^v/, '').split('.').map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/**
 * `feed` is a GitHub `releases/latest` API URL, `asset` the name of the ZIP to install, either
 * `installDir`, the app's folder, or `image`, its exFAT image, and `workDir` a folder on the same
 * filesystem, outside anything ShadowMount scans. `marker` is a file outside the image that records
 * an image install until its version runs. `now` is the clock a cleanup measures its frame budget by.
 */
export function createUpdater({http, downloads, archives, fs, version, feed, asset, installDir, image, workDir, marker, now = Date.now}) {
  /**
   * The update to offer, null without one. While the image installed last is in place but the version
   * before it runs (the app was reopened before ShadowMount let go of the old image), it is
   * `{version, installed: true, stuck}` instead, which only needs the app reopened; `stuck` once that
   * happened on more than one launch.
   */
  async function check() {
    const installed = installedImage();
    if (installed) return installed;
    const response = await http.request(feed, {headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'Overdrive'}, maxBytes: 1024 ** 2});
    if (!response.ok) throw new Error(`Update feed ${feed} answered HTTP ${response.status}`);
    const release = await response.json();
    if (!release.tag_name || !newer(release.tag_name, version)) return null;
    const file = (release.assets || []).find(item => item.name === asset);
    const sha256 = /^sha256:([0-9a-f]{64})$/i.exec(file?.digest || '')?.[1];
    if (!file || !sha256) return null;
    return {version: release.tag_name.replace(/^v/, ''), notes: release.body || '', url: file.browser_download_url, size: file.size, sha256};
  }

  // Entries of an extracted folder, without the extraction's own receipts (.ps5-react-*).
  const entriesOf = dir => fs.readDir(dir).filter(entry => !entry.name.startsWith('.ps5-react-'));

  // The extracted release's own folder: a ZIP made of the folder itself holds just that folder.
  function contentOf(dir) {
    const entries = entriesOf(dir);
    return entries.length === 1 && entries[0].isDirectory ? contentOf(`${dir}/${entries[0].name}`) : dir;
  }

  // Paces a run of filesystem calls so the screen keeps drawing: `step` before each call lets a frame
  // draw once `perFrame` calls or BUDGET_MS went by, `frame` lets one draw right away (after a listing,
  // which stats every entry).
  function pacer(perFrame) {
    let since = now(), steps = 0;
    async function frame() {
      await new Promise(resolve => setTimeout(resolve, 0));
      since = now();
      steps = 0;
    }
    async function step() {
      if (steps >= perFrame || now() - since >= BUDGET_MS) await frame();
      steps++;
    }
    return {step, frame};
  }

  // The console's launcher reads a title's files as another user: the extracted files, made by this
  // app, open to everyone like the ones an installer writes (closed, it fails with errno 13).
  async function openUp(path, pace) {
    await pace.step();
    fs.chmod(path, 0o777);
    const entries = fs.readDir(path);
    await pace.frame();
    for (const entry of entries) {
      if (entry.isDirectory) await openUp(`${path}/${entry.name}`, pace);
      else {
        await pace.step();
        fs.chmod(`${path}/${entry.name}`, 0o777);
      }
    }
  }

  // Moves each staged entry into the install, the replaced one into `backup`. A failed move puts back
  // what was already moved, without letting a frame draw in between.
  async function swap(staged, backup, pace) {
    fs.mkdir(backup, {recursive: true});
    const done = [];
    try {
      for (const {name} of entriesOf(staged)) {
        await pace.step();
        const replaced = fs.exists(`${installDir}/${name}`);
        if (replaced) fs.rename(`${installDir}/${name}`, `${backup}/${name}`);
        done.push({name, replaced});
        fs.rename(`${staged}/${name}`, `${installDir}/${name}`);
      }
    } catch (error) {
      for (const {name, replaced} of done.reverse()) {
        if (fs.exists(`${installDir}/${name}`)) fs.rename(`${installDir}/${name}`, `${staged}/${name}`);
        if (replaced) fs.rename(`${backup}/${name}`, `${installDir}/${name}`);
      }
      throw error;
    }
  }

  // The ZIP is a few percent of the image it holds, which comes out about the installed one's size (a
  // newer build may be larger); both sit on the image's drive until the rename.
  function ensureRoomForImage(update) {
    const needed = Math.ceil(fs.stat(image).size * 1.1) + update.size + 64 * MIB;
    const {free} = fs.diskUsage(workDir);
    if (free < needed) throw new Error(`The update needs ${formatBytes(needed)} free next to ${image}; ${formatBytes(free)} is`);
  }

  // The image update in place while an older version runs, null otherwise. Each such launch is
  // counted in the marker. A marker whose version runs, whose image was replaced since or that cannot
  // be read is removed: the check goes on as without one.
  function installedImage() {
    if (!fs.exists(marker)) return null;
    let pending;
    try {
      const recorded = JSON.parse(fs.readFile(marker));
      const file = fs.stat(recorded.image);
      if (newer(recorded.version, version) && file?.size === recorded.size && Math.abs(file.modified - recorded.modified) < MTIME_SLACK_MS)
        pending = recorded;
    } catch (error) {
      log(`marker ignored: ${error.message}`);
    }
    if (!pending) {
      try { fs.remove(marker); } catch (error) { log(`marker kept: ${error.message}`); }
      return null;
    }
    const launches = (pending.launches || 0) + 1;
    log(`v${pending.version} is installed but v${version} runs (launch ${launches} since)`);
    try { fs.writeFile(marker, JSON.stringify({...pending, launches})); } catch (error) { log(`marker not counted: ${error.message}`); }
    return {version: pending.version, installed: true, stuck: launches >= STUCK_LAUNCHES};
  }

  // The release's ZIP holds a single image. Renaming it over the installed one is atomic, so the install
  // is always one whole image, and nothing is written into the mounted one: it keeps its file until the
  // app exits.
  function replaceImage(extracted, update) {
    const entries = entriesOf(extracted);
    const [entry] = entries;
    if (entries.length !== 1 || !entry.isFile || !entry.name.endsWith('.exfat') || entry.size < MIN_IMAGE_BYTES || entry.size % SECTOR)
      throw new Error(`The update holds ${entries.map(item => item.name).join(', ') || 'nothing'} instead of one exFAT image`);
    const file = `${extracted}/${entry.name}`;
    // ShadowMount mounts it as root, but the file the app extracted is the app's own: open it like the
    // folder install's files, which root reads either way, so a refusal only gets logged. Before the
    // rename: ShadowMount refuses an image changed in the last 10 s, a chmod included, and the wait the
    // user is given starts at the rename.
    try { fs.chmod(file, 0o777); } catch (error) { log(`image left closed: ${error.message}`); }
    // A launch while ShadowMount still holds the old image runs the old version, which would offer this
    // update again: the marker tells it the image is already in place. Without it the update still works.
    try {
      const {size, modified} = fs.stat(file);
      fs.mkdir(marker.slice(0, marker.lastIndexOf('/')), {recursive: true});
      fs.writeFile(marker, JSON.stringify({version: update.version, image, size, modified}));
      log(`marker written: ${marker}`);
    } catch (error) {
      log(`marker not written: ${error.message}`);
    }
    try {
      fs.rename(file, image);
    } catch (error) {
      // Whatever the console refuses (EBUSY, EPERM, EXDEV...), the installed image is untouched.
      // The marker left behind no longer matches the image, so the next check clears it.
      log(`rename over ${image} failed: ${error.message}`);
      throw new ImageReplaceError(error.message);
    }
    log(`renamed over ${image}`);
  }

  // The work folder, while the dialog says it installs: the replaced app alone is thousands of files,
  // which one removeTree call took 21 s to remove on the console without drawing a frame, so it is
  // removed off the render thread.
  async function clear() {
    await fs.removeAsync(workDir);
  }

  // Leftovers never decide an update: the next launch removes them again.
  async function tidy() {
    try { await clear(); } catch (error) { log(`leftovers kept: ${error.message}`); }
  }

  // The verified release, extracted in the work folder.
  async function fetchRelease(update, onProgress) {
    const zip = `${workDir}/${update.version}.zip`;
    const download = downloads.enqueue({url: update.url, destination: zip, sha256: update.sha256, expectedBytes: update.size, rejectHtml: true});
    const off = download.subscribe(({written}) => onProgress({state: 'downloading', written: written || 0, total: update.size}));
    try { await download.done; } finally { off(); }
    // The download resolves only once its SHA-256 matched.
    log(`v${update.version} downloaded and verified (${update.size} bytes, sha256 ${update.sha256})`);
    onProgress({state: 'installing', written: update.size, total: update.size});
    const extracted = `${workDir}/${update.version}`;
    await archives.extract({sources: [zip], destination: extracted, maxBytes: 4 * 1024 ** 3}).done;
    log(`extracted to ${extracted}`);
    return extracted;
  }

  /**
   * Installs `update`. Resolves `{relaunch}`: whether the app may reopen itself right away. An image
   * install may not: ShadowMount keeps the old image attached for a moment after the app exits, and a
   * launch that soon would run it again; it also refuses to mount a file changed in the last 10 s.
   */
  async function install(update, onProgress = () => {}) {
    const target = image ?? installDir;
    if (!fs.exists(target)) throw new Error(`The app is not installed at ${target}`);
    await cleaning;
    await tidy();
    fs.mkdir(workDir, {recursive: true});
    let extracted;
    try {
      if (image) ensureRoomForImage(update);
      extracted = await fetchRelease(update, onProgress);
      if (image) replaceImage(extracted, update);
    } catch (error) {
      log(`v${update.version} failed: ${error.message}`);
      await tidy();
      throw error;
    }
    if (image) {
      await tidy();
      return {relaunch: false};
    }
    const staged = contentOf(extracted);
    const pace = pacer(CHANGES_PER_FRAME);
    await openUp(staged, pace);
    // The install root stays in place when its entries move in; open it separately.
    await pace.step();
    fs.chmod(installDir, 0o777);
    await swap(staged, `${workDir}/previous`, pace);
    log(`v${update.version} moved into ${installDir}`);
    await tidy();
    return {relaunch: true};
  }

  // What an update left that the launch after it still finds: one interrupted, or installed by a
  // version that left its replaced app behind. An install waits for it.
  let cleaning = Promise.resolve();
  function cleanup() {
    cleaning = cleaning.then(clear)
      .catch(error => log(`leftovers kept: ${error.message}`));
    return cleaning;
  }

  return {check, install, cleanup};
}
