// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

/**
 * The console's storage roots: the internal drive, then each USB or extended drive `mounts()` lists.
 * Screens call this while rendering, so it never throws: without console access the console refuses
 * the listing (EPERM), and a throw there closed the app on opening Downloads or Files.
 */
export function consoleRoots(mounts) {
  const roots = ['/data'];
  let listed;
  try { listed = mounts(); } catch (error) { console.log(`[downloads] drives not listed: ${error.message}`); return roots; }
  for (const mount of listed) {
    if (/^\/mnt\/(?:usb|ext)\d+$/.test(mount.path) && !roots.includes(mount.path)) roots.push(mount.path);
  }
  return roots;
}
