// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {archivePassword} from './archive-password.js';

/** Group only numbered parts of the same feed record, release label and provider.
 * Repeated part-one sequences form separate sets; backports/base/update never share a set. */
function stableKey(value) {
  // Two independent 32-bit hashes keep IDs short and invariant under feed reordering.
  let first = 2166136261, second = 5381;
  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index),16777619);
    second = Math.imul(second,33) ^ value.charCodeAt(index);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}
// One feed spells a host several ways within a set ("www.rootz.so", "rootz.so").
const hostKey = provider => provider.toLowerCase().replace(/^www\./, '').replace(/\.[a-z]+$/, '');
const VOLUME_NAME = /\bpart(\d+)\.(?:rar|7z|zip)\b/i;

/**
 * Why a set's volumes cannot be its whole archive, or null. `parts`: `{number, name, bytes}` in order, the
 * label's volume number and, where known, the file's name and size; `declaredBytes`: the game's size.
 * 'gap': a volume number is missing; 'renumbered': a file is another volume than its label says (the labels
 * count from a later one, or run on into a second archive); 'count': a lone file named as a volume, which
 * has others; 'last': the last volume is as large as the first, so none is short, and together they fall
 * short of the game, by more than a rounding (3%), when its size is known. The digits alone prove nothing: uploaders name 7 volumes part01 to part07 as well.
 */
export function missingVolumes(parts, declaredBytes) {
  if (parts.some((part, index) => part.number !== index+1)) return 'gap';
  const volumes = parts.map(part => VOLUME_NAME.exec(part.name || '')?.[1]);
  if (volumes.some((digits, index) => digits && Number(digits) !== index+1)) return 'renumbered';
  if (parts.length === 1 && volumes[0]) return 'count';
  const [first, last] = [parts[0], parts.at(-1)];
  // Files that are not volumes (a backport's zips) may be equal in size by chance.
  if (volumes[0] && volumes.at(-1) && first.bytes && last.bytes && Math.abs(last.bytes-first.bytes) <= first.bytes/100
    && (!declaredBytes || first.bytes*(parts.length-1)+last.bytes < declaredBytes*0.97)) return 'last';
  return null;
}

export function releaseSets(releases) {
  const groups = new Map();
  const output = [];
  for (const release of releases) {
    const match = /\bpart\s*(\d+)\b/i.exec(release.label || release.volume || '');
    if (!match) { output.push(release); continue; }
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number < 1 || number > 1024) {
      output.push({...release, unavailableReason: 'Invalid volume number.'}); continue;
    }
    const label = (release.label || '').replace(/\bpart\s*\d+\b/i, '').trim();
    // prepare.mjs writes the feed record; older files carry it in the positional id.
    const record = release.record ?? release.id.replace(/-\d+$/, '');
    const key = `${record}/${hostKey(release.provider)}/${label.toLowerCase()}`;
    let group = groups.get(key);
    // A second part one can begin a different archive with an identical label.
    // Never infer that distinct URLs are interchangeable mirrors.
    const first = group?.parts.find(part => part.number === 1);
    if (number === 1 && first && !first.sources.some(source => source.url === release.url && source.browserUrl === release.browserUrl)) group = undefined;
    if (!group) {
      group = {...release, label, format: 'archive-set', parts: [], sizeBytes: null, sha256: undefined, volume: undefined};
      delete group.url; delete group.browserUrl; delete group.manifestUrl;
      groups.set(key, group); output.push(group);
    }
    let part = group.parts.find(part => part.number === number);
    if (!part) { part = {number, sources: []}; group.parts.push(part); }
    if (!part.sources.some(source => source.url === release.url && source.browserUrl === release.browserUrl))
      if (part.sources.length) group.unavailableReason = 'Ambiguous duplicate volume. Choose another complete set.';
      else part.sources.push(release);
  }
  for (const group of output.filter(release => release.parts)) {
    group.parts.sort((a,b) => a.number-b.number);
    // Named by the provider, label and first volume's content-derived id, so it survives feed reordering. A set
    // joined from two spellings of its host is named apart from the half that stood alone before, so a job
    // saved from that half does not stand for the whole set.
    const spellings = [...new Set(group.parts.map(part => part.sources[0].provider))].join('+');
    group.id = group.filename = `set-${stableKey(`${spellings}/${group.label.toLowerCase()}/${group.parts[0].sources[0].id}`)}`;
    // Links that name their file (MediaFire's, Rapidgator's) show the volume behind each label.
    if (missingVolumes(group.parts.map(part => ({number: part.number, name: part.sources[0].url || part.sources[0].browserUrl}))))
      group.unavailableReason = 'This source has missing volumes. Choose another complete set.';
    try {
      const password = archivePassword(group);
      if (password !== undefined) group.archivePassword = password;
    } catch (error) { group.unavailableReason = error.message; }
    group.label = `${group.label} · ${group.parts.length} parts`;
  }
  return output;
}

const link = release => {
  const first = release.parts?.[0]?.sources[0] ?? release;
  return first.manifestUrl || first.url || first.browserUrl;
};

/**
 * Whether a queued job's release is `release`, by id or, for jobs saved before release ids were
 * derived from content (feed-position ids such as "pegasus-2-398-2"), by the link it downloads.
 */
export const sameRelease = (saved, release) => saved.id === release.id
  || (Boolean(link(saved)) && link(saved) === link(release) && saved.parts?.length === release.parts?.length);
