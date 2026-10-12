// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// Which download sources the shipped catalog keeps. A source left out here is not in the app at all:
// not in the picker, the counts, the host filter or failover. A game left with none is dropped.

/**
 * Hosts that are off, by the provider key the catalog's host filter uses, with the domain their links
 * point at. Add a host here to take every one of its sources out of the next build.
 */
export const DISABLED_HOSTS = {
  // Offline: every manifest answered 403 in the 2026-10-07 audit.
  spectrum: 'spectrumlibrary.online',
};

// Links that open a page asking for a password the catalog does not have: both of Pippo's pages,
// link-lock-pippo and library-decrypt (its "decrypt-public" page asks for one too; checked 2026-10-08).
const LOCKED = [/^https?:\/\/pippo26442999\.github\.io\/(?:link-lock-pippo|library-decrypt)\//i];

// Audit verdicts that mean the link is gone: 404/410, a private item or refused access (401/403),
// or a web page where a file should be.
const DEAD = new Set(['invalid', 'blocked', 'not_direct']);
const HEALTH = {reachable: 'ok', uncertain: 'flaky'};

/** One key per host however the feeds spell it ("AkiraBox", "akirabox.to", "www.rootz.so"). */
export const providerKey = name => name.toLowerCase().replace(/^www\./, '').replace(/\.(?:com|so|to|io|net|co|gg|cc|st|it|nz)$/, '');

const hostOf = url => /^https?:\/\/([^/?#:]+)/i.exec(url || '')?.[1].toLowerCase() ?? '';
const links = release => [release.url, release.browserUrl, release.manifestUrl].filter(Boolean);

/**
 * `audit`: the records of the catalog's audits/direct-link-audit/results.json; `sets`: those of audits/part-audit/results.json.
 * Returns `why(release, gameId)`, the reason a source of that game is left out ('host', 'locked', 'dead', which
 * takes every volume of a set with one gone, 'incomplete', a volume of a set the feed cut short, or 'unproven',
 * one of a set whose only fault is a full last volume) or null, and `health(release)`, the audit's last word on
 * a kept one: 'ok', 'flaky' (a server error) or undefined when it was not checked.
 */
export function sourceRules(audit = [], sets = []) {
  const verdicts = new Map(audit.map(record => [record.url, record.verdict]));
  // By game and link: the feed puts one link in sets of different games, which the audit judges apart.
  const setVerdicts = new Map(sets.flatMap(set => set.parts.map(part => [`${set.gameId}\n${part.url}`, set.verdict])));
  const setVerdict = (release, gameId, verdict) => links(release).some(url => setVerdicts.get(`${gameId}\n${url}`) === verdict);
  const disabled = ([key, domain]) => release => providerKey(release.provider || '') === key
    || links(release).some(url => { const host = hostOf(url); return host === domain || host.endsWith(`.${domain}`); });
  const off = Object.entries(DISABLED_HOSTS).map(disabled);
  return {
    why: (release, gameId) => off.some(test => test(release)) ? 'host'
      : links(release).some(url => LOCKED.some(pattern => pattern.test(url))) ? 'locked'
      : links(release).some(url => DEAD.has(verdicts.get(url))) || setVerdict(release, gameId, 'gone') ? 'dead'
      : setVerdict(release, gameId, 'incomplete') ? 'incomplete'
      : setVerdict(release, gameId, 'unproven') ? 'unproven' : null,
    health: release => links(release).map(url => HEALTH[verdicts.get(url)]).find(Boolean),
  };
}
