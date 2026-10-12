// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

const TTL_MS = 30_000;

/**
 * Whether ShadowMountPlus's local API answers, asked at most once per TTL so each screen entry
 * reuses a recent answer instead of probing again. Any HTTP reply counts, since only a running
 * ShadowMount listens there, even when it refuses the request. A failed request is not reused: one
 * that never got through (the native request queue full, the listener restarting after rest mode)
 * would otherwise say ShadowMount is off on every screen for the whole TTL.
 */
export function createShadowMountProbe({http, now}) {
  let checkedAt = -Infinity;
  let answer;
  return () => {
    if (now() - checkedAt < TTL_MS) return answer;
    checkedAt = now();
    answer = http.request('http://127.0.0.1:10101/api/v1/version', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}', maxBytes: 64*1024,
    }).then(() => true, () => { checkedAt = -Infinity; return false; });
    return answer;
  };
}

/**
 * A request to ShadowMountPlus's local API; an error status throws with ShadowMount's reason. A request
 * that never got an answer throws marked `unreachable`.
 */
export async function shadowRequest(http, route, body = {}) {
  let response;
  try {
    response = await http.request(`http://127.0.0.1:10101/api/v1/${route}`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), maxBytes: 1024*1024,
    });
  } catch (error) { error.unreachable = true; throw error; }
  if (!response.ok) {
    const reason = await response.json().then(reply => reply?.error, () => '');
    throw new Error(`ShadowMount HTTP ${response.status}${reason ? `: ${reason}` : ''}.`);
  }
  return response.json();
}

/**
 * Whether ShadowMount's `path` is one of `paths` (on drive `root`) or inside one. ShadowMount may name
 * the drive through another of its mounts, so a path that only ends the same way below the drive counts too.
 */
export function within(path, paths, root) {
  const target = path?.replace(/\/+$/, '');
  if (!target) return false;
  return paths.some(base => {
    const tail = base.startsWith(`${root}/`) ? base.slice(root.length) : null;
    return target === base || target.startsWith(`${base}/`) || (tail && (target.endsWith(tail) || target.includes(`${tail}/`)));
  });
}

/**
 * The images (`{path, mount_point}`) ShadowMount has mounted among `paths`, found by path whatever game
 * they hold: a mounted image that is deleted keeps its blocks until the mount is released, so nothing is
 * deleted while one is. Null when ShadowMount is not running, so mounts nothing; throws when it answers
 * with an error.
 */
export async function mountedImages(request, paths, root) {
  let reply;
  try { reply = await request('images'); }
  catch (error) { if (error.unreachable) return null; throw error; }
  return (reply.images ?? []).filter(image => image.mounted && within(image.path, paths, root));
}
