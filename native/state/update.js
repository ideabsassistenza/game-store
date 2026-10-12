// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {useEffect, useState} from 'react';
import {Archives, Downloads, FileSystem, Http, Platform} from '@ps5-react/core';
import {VERSION} from '../version.js';
import {downloadQueue, storageRoots} from './downloads.js';
import {locateInstall} from './install-location.js';
import {createUpdater} from './updater.js';

export {ImageReplaceError} from './updater.js';

const TITLE = 'PPSA99058';
const FEED = 'https://api.github.com/repos/overdriveps5/overdrive-releases/releases/latest';
// A URL in either file replaces the feed, to test against a local mock of GitHub. The second is the
// console's data folder outside the title's own download0 image, so a computer can write it.
const FEED_OVERRIDES = [`${FileSystem.dataDir}/overdrive/update-feed`, `/data/ps5-react/${TITLE}/overdrive/update-feed`];

// The desktop preview stands an install in under its data folder.
function location() {
  if (Platform.OS !== 'ps5') return {installDir: `${FileSystem.dataDir}/homebrew/${TITLE}`, workDir: `${FileSystem.dataDir}/overdrive-update`};
  return locateInstall({http: Http, fs: FileSystem, title: TITLE, roots: storageRoots});
}

// Each install type updates from its own release asset: a folder from the zipped folder, an image
// from the zipped image.
function assetFor({image}) {
  if (Platform.OS !== 'ps5') return 'Overdrive-desktop.zip';
  return image ? `Overdrive-${TITLE}.exfat.zip` : `Overdrive-${TITLE}.zip`;
}

// The install the update check found, for the folder-install notice: it waits for that check instead
// of asking ShadowMount again, and stays pending when the install could not be told.
let foundInstall;
const located = new Promise(resolve => { foundInstall = resolve; });

let updater;
async function instance() {
  if (updater) return updater;
  const install = await location();
  foundInstall(install);
  // Without console access, /data refuses stat (EPERM): no override there, and still an update check.
  const override = FEED_OVERRIDES.find(path => { try { return FileSystem.exists(path); } catch { return false; } });
  const feed = override ? FileSystem.readFile(override).trim() : FEED;
  // The data folder is the title's own, which outlives the image an update replaces.
  return updater = createUpdater({http: Http, downloads: Downloads, archives: Archives, fs: FileSystem, version: VERSION, feed,
    asset: assetFor(install), marker: `${FileSystem.dataDir}/overdrive/pending-image.json`, ...install});
}

// Checking waits for the first screen to settle.
const CHECK_DELAY_MS = 4000;

/**
 * The update this launch found, null while there is none: the release is looked up once, a few
 * seconds after launch, while an earlier update's leftovers are removed in the background. `installed`
 * marks an image update already in place that waits for the app to be reopened.
 */
export function useAvailableUpdate() {
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const current = await instance();
        void current.cleanup();
        setUpdate(await current.check());
      } catch (error) {
        console.log(`overdrive: update check failed: ${error.message}`);
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, []);
  return update;
}

// A set extracting while it downloads holds the engine's only archive task, which the update needs.
export async function installUpdate(update, onProgress) {
  // No queue means no streamed set to cancel, and the update that fixes it still has to install.
  try { await downloadQueue().yieldArchives?.(); } catch (error) { console.log(`[update] queue not yielded: ${error.message}`); }
  return (await instance()).install(update, onProgress);
}

/**
 * Whether the app runs from a folder install, the kind that will stop getting updates. False until
 * the update check has located the install, and off the console.
 */
export function useFolderInstall() {
  const [folder, setFolder] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ps5') located.then(install => setFolder(Boolean(install.installDir)));
  }, []);
  return folder;
}
