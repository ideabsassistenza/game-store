// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

const SHADOWMOUNT = 'http://127.0.0.1:10101/api/v1/games/info';
const STORAGE_ROOT = /^(\/data|\/mnt\/(?:usb|ext)\d+)\//;

/**
 * Where the app is installed: `{installDir, workDir}` for a folder install, `{image, workDir}` for an
 * exFAT image ShadowMount mounts. The path is the one ShadowMount registered, as its API reports it,
 * since it scans many folders (/data/games, /mnt/usb0/games...), not only homebrew/. Without the API,
 * the one `<root>/homebrew/<title>` folder or `<root>/homebrew/Overdrive-<title>*.exfat` image among
 * `roots()`. `workDir` is on the same storage, outside the folders ShadowMount scans.
 */
export async function locateInstall({http, fs, roots, title}) {
  const found = await registeredInstall({http, title});
  const install = found ? fromShadowMount(found) : inHomebrew({fs, roots, title});
  if (install.installDir && !fs.exists(`${install.installDir}/eboot.bin`)) throw new Error(`Overdrive's install folder ${install.installDir} has no eboot.bin`);
  if (install.image && !fs.exists(install.image)) throw new Error(`Overdrive's image ${install.image} is missing`);
  const path = install.installDir ?? install.image;
  const root = STORAGE_ROOT.exec(path)?.[1] ?? path.replace(/\/[^/]+\/[^/]+$/, '');
  return {...install, workDir: `${root}/overdrive-update`};
}

/** The install ShadowMount registered for `title`, `{path, type}` (type 'folder', 'image'...), or null without its API. */
async function registeredInstall({http, title}) {
  try {
    const response = await http.request(SHADOWMOUNT, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title_id: title}), maxBytes: 64 * 1024});
    if (!response.ok) return null;
    const info = await response.json();
    return info?.path ? {path: info.path, type: info.source_type} : null;
  } catch {
    return null;
  }
}

function fromShadowMount({path, type}) {
  if (type === 'folder') return {installDir: path};
  // The release ships an exFAT image: another image format at that path would be replaced by one.
  if (type === 'image' && path.endsWith('.exfat')) return {image: path};
  throw new Error(`ShadowMount runs Overdrive from ${path}, an install of type ${type}`);
}

// Testers name the image after its version too (Overdrive-PPSA99058-v0.0.104.exfat).
const imagesIn = ({fs, dir, title}) => fs.exists(dir)
  ? fs.readDir(dir).filter(entry => !entry.isDirectory && new RegExp(`^Overdrive-${title}.*\\.exfat$`, 'i').test(entry.name))
    .map(entry => ({image: `${dir}/${entry.name}`}))
  : [];

function inHomebrew({fs, roots, title}) {
  const found = roots().flatMap(root => [
    ...fs.exists(`${root}/homebrew/${title}/eboot.bin`) ? [{installDir: `${root}/homebrew/${title}`}] : [],
    ...imagesIn({fs, dir: `${root}/homebrew`, title}),
  ]);
  if (found.length !== 1) throw new Error(found.length ? `Overdrive is installed twice: ${found.map(item => item.installDir ?? item.image).join(' and ')}` : 'Overdrive\'s install was not found');
  return found[0];
}
