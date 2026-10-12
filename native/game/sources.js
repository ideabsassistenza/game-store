// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
import {sourceKind} from '../state/download-sources.js';
import {t} from '../i18n/core.js';
import {formatBytes} from '../state/size.js';

// Message keys.
const KIND = {ffpfsc: 'sources.kind.image', ffpfs: 'sources.kind.image', ffpkg: 'sources.kind.image', exfat: 'sources.kind.image',
  pkg: 'sources.kind.package', fpkg: 'sources.kind.package', 'archive-set': 'sources.kind.archive'};

// Feed labels end with the host they came from ("EUR 9.xx Base - Akirabox"), which the row already
// names; sets append their part count, which the row states on its own.
function edition({label, provider}) {
  const text = (label || '').replace(/\s*·\s*\d+ parts$/, '').trim();
  const split = text.lastIndexOf(' - ');
  const host = provider.toLowerCase().replace(/^www\./, '').slice(0, 4);
  const edition = split >= 0 && text.slice(split + 3).toLowerCase().startsWith(host) ? text.slice(0, split) : text;
  // Some feeds put only the host in the label ("AkiraBox", "Viki"), which says nothing new.
  return provider.toLowerCase().startsWith(edition.toLowerCase()) ? '' : edition;
}

// Hosts whose page hides the file link behind a CAPTCHA (Cloudflare Turnstile on VikingFile, a
// Cloudflare challenge on Buzzheavier, checked 2026-10-08): the app reads their page,
// finds no link and asks for one, so they rank with the hosts that need a browser.
const GATED = new Set(['vikingfile', 'buzzheavier']);

// How the app reaches the file: 'direct' links download as they are, a known host's page is read for
// its file link ('page'), and anything else needs a person in a web browser. A set goes the way of its
// first part. The catalog's own requiresBrowser flag is too broad: it marks hosts the app can read.
function access(release) {
  const first = release.parts?.[0]?.sources[0] ?? release;
  let kind;
  try { kind = sourceKind(first); } catch { return 'browser'; }
  if (kind === 'direct' || kind === 'manifest') return 'direct';
  return kind === 'browser' || kind === 'datanodes' || kind === 'unavailable' || GATED.has(kind) ? 'browser' : 'page';
}

// Measured from a wired Mac on 2026-10-07: archive.org gives each connection its own share, so it
// scales with the 64 the app opens (3 to 36 MB/s by time of day); MediaFire caps a client near 3 MB/s
// however many connections it opens. Other hosts are not measured.
const SPEED = {'archive.org': 'sources.speed.archive', mediafire: 'sources.speed.mediafire', 'overdrive cdn': 'sources.cdnFastest'};

/** Overdrive's own servers: the first source wherever a game has one, and the one drawn with an aura. */
export const isOverdriveCdn = provider => /^overdrive\s*cdn$/i.test(provider ?? '');

/**
 * How a source reads in the picker: `{name, detail, size, group, reason}`. `group` is 'direct' (a file
 * link), 'page' (the app reads the file link off the host's page), 'browser' (a person must pass the
 * host's page) or 'unavailable' (`reason` says why).
 */
export function describeSource(release) {
  const parts = release.parts?.length;
  const detail = [
    edition(release),
    release.version ? `v${release.version.replace(/^v/i, '')}` : null,
    KIND[release.format] && t(KIND[release.format]),
    parts ? t('sources.parts', {count: parts}) : null,
  ].filter(Boolean).join(' · ');
  const reach = access(release);
  const speed = SPEED[release.provider.toLowerCase()];
  return {name: release.provider.replace(/^www\./, ''), detail: speed ? [detail, t(speed)].filter(Boolean).join(' · ') : detail, size: release.sizeBytes ? formatBytes(release.sizeBytes) : null,
    group: release.unavailableReason ? 'unavailable' : reach, reason: release.unavailableReason ?? null};
}

// "1.0" and "01.000.000" name the same build; trailing zero parts carry nothing.
const version = value => {
  const parts = (value || '').replace(/^v/i, '').split('.').map(Number);
  while (parts.length > 1 && parts.at(-1) === 0) parts.pop();
  return parts.join('.');
};
const sameSize = (a, b) => Boolean(a && b) && Math.abs(a - b) <= a * 0.01;
// Feeds list each part of a split upload as its own file ("EUR 4.03 Base - Akirabox part 1"), and
// the parts of one upload are often the same size.
const partOf = ({label, filename}) => /\bpart\s*(\d+)\b/i.exec(`${label || ''} ${filename || ''}`)?.[1] ?? '';
// The feed record a source came from: one record lists the mirrors of one upload side by side.
const recordOf = release => (release.parts?.[0].sources[0] ?? release).record;
// Image formats name what the file is; 'binary' is a feed that did not say.
const sameFormat = (a, b) => a.format === b.format || a.format === 'binary' || b.format === 'binary';

/**
 * Whether two sources of one game entry (so one title ID and platform) hold the same build, so a
 * download may switch from one to the other. A catalog lists versions, regions, DLC, backports and the
 * parts of split uploads side by side, so anything known must agree (hash, size, version, format,
 * part, part count, edition label) and there must be positive evidence: the same hash, the same known
 * size, or the same edition label within one feed record, where a record lists one upload's mirrors.
 * Matching on less swapped a chosen file for any other of the game's files.
 */
export function equivalent(a, b) {
  if (Boolean(a.parts) !== Boolean(b.parts) || a.parts?.length !== b.parts?.length || isDlc(a) !== isDlc(b)) return false;
  if (a.sha256 && b.sha256) return a.sha256 === b.sha256;
  const [ea, eb] = [edition(a).toLowerCase(), edition(b).toLowerCase()];
  if (ea && eb && ea !== eb) return false;
  if (a.version && b.version && version(a.version) !== version(b.version)) return false;
  if (a.sizeBytes && b.sizeBytes && !sameSize(a.sizeBytes, b.sizeBytes)) return false;
  if (!a.parts && (!sameFormat(a, b) || partOf(a) !== partOf(b))) return false;
  return sameSize(a.sizeBytes, b.sizeBytes) || (Boolean(ea) && ea === eb && recordOf(a) !== undefined && recordOf(a) === recordOf(b));
}

// Feeds file add-on uploads under the game ("USA 12.xx DLC (@Pkykzhack)", "Only DLCs"); a label that
// also names the game ("Game (v1.008)(DLC)", "Game + DLC") is the game with its add-ons.
export const isDlc = ({label}) => /\bDLCs?\b/i.test(label || '')
  && !/\b(?:game|full)\b|\+\s*(?:all\s+)?DLCs?\b|\bwith\s+(?:all\s+)?DLCs?\b|\bincl/i.test(label);

const GROUP_RANK = {direct: 0, page: 1, browser: 2, unavailable: 3};
// The link audit's last word: a link that answered beats one never checked, which beats one that
// answered with a server error.
const HEALTH_RANK = {ok: 0, flaky: 2};
// A backport rebuilds the game for older firmware; feeds list it after the base game it derives from.
const isBackport = ({label}) => /\bback\s*port\b/i.test(label || '');
// Ties keep the feed's order, which lists the base upload first.
// The default host, whatever else a game offers: Overdrive CDN, then Archive.org (both serve every
// connection the app opens), then MediaFire (one the app reads by itself), then the rest by how the app
// reaches them. A source that cannot be used at all stays last.
const hostRank = ({provider}) => isOverdriveCdn(provider) ? 0 : provider.toLowerCase() === 'archive.org' ? 1
  : provider.toLowerCase() === 'mediafire' ? 2 : 3;
const ranked = (release, index) => ({release, index, rank: [isDlc(release) ? 1 : 0,
  release.unavailableReason ? 1 : 0, hostRank(release), GROUP_RANK[describeSource(release).group], HEALTH_RANK[release.health] ?? 1, isBackport(release) ? 1 : 0, release.source === 'orbit' ? 0 : 1, release.requiresBrowser ? 1 : 0]});
const compare = (a, b) => a.rank.reduce((order, value, i) => order || value - b.rank[i], 0) || a.index - b.index;

/**
 * The source offered first: the game before its add-ons, then the way the app reaches it (a file link,
 * then a host page it reads, then a web browser), then Archive.org, then the link audit's health, then the base game
 * before a backport, then Orbit's own mirrors.
 */
export function preferredRelease(releases) {
  return releases.map(ranked).sort(compare)[0]?.index ?? 0;
}

/** The sources a download of `releases[selected]` may switch to, best first: copies the app reaches by itself. */
export function fallbacks(releases, selected) {
  return releases.map(ranked)
    .filter(({release, index, rank}) => index !== selected && rank[3] <= GROUP_RANK.page && equivalent(releases[selected], release))
    .sort(compare).map(({release}) => release);
}

/**
 * The picker's sections in order, each `{group, items: [{release, index}]}`, empty ones left out;
 * browser sources by fewest parts. Add-ons ('dlc') get their own section, so none reads as the game.
 */
export function sourceSections(releases) {
  const sections = ['direct', 'page', 'browser', 'dlc', 'unavailable'].map(group => ({group, items: []}));
  releases.forEach((release, index) => {
    const {group} = describeSource(release);
    const into = group !== 'unavailable' && isDlc(release) ? 'dlc' : group;
    sections.find(section => section.group === into).items.push({release, index});
  });
  // Every browser part asks for its own typed link, so fewer parts come first.
  const links = ({release}) => release.parts?.length ?? 1;
  sections[2].items.sort((a, b) => links(a) - links(b));
  return sections.filter(section => section.items.length);
}
