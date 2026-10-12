// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.

// QuickJS has no browser URL/DOM globals. Only absolute HTTP(S) URLs are accepted.
export function webURL(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\\\x00-\x1f]/.test(value)) throw new Error('Invalid HTTP URL.');
  const match = /^(https?):\/\/([a-z0-9.-]+)(:\d{1,5})?([/?#].*)?$/i.exec(value);
  if (!match || !match[2] || match[2].startsWith('.')) throw new Error('Invalid HTTP URL.');
  return {url: value, host: match[2].toLowerCase(), origin: `${match[1].toLowerCase()}://${match[2]}${match[3] || ''}`, path: match[4] || '/'};
}
const hosts = {
  mediafire: ['mediafire.com'], buzzheavier: ['buzzheavier.com'],
  vikingfile: ['vikingfile.com', 'vik1ngfile.site'], datanodes: ['datanodes.to'],
};
const isHost = (host, domain) => host === domain || host.endsWith(`.${domain}`);
export function sourceKind(release) {
  if (release.manifestUrl) return 'manifest';
  const value = release.browserUrl || release.url;
  if (!value) return 'unavailable';
  const {host, path} = webURL(value);
  const provider = Object.keys(hosts).find(name => hosts[name].some(domain => isHost(host, domain)));
  // Public download endpoints bypass the landing-page adapter.
  if (provider === 'mediafire' && host.startsWith('download')) return 'direct';
  if (provider === 'vikingfile' && /^\/d\//.test(path) && !release.browserUrl) return 'direct';
  if (provider) return provider;
  if ((host === 'archive.org' && path.startsWith('/download/')) ||
      (host === 'github.com' && path.includes('/releases/download/')) ||
      /\.(?:ffpfsc|ffpfs|ffpkg|exfat|pkg|zip|rar|7z)(?:[?#]|$)/i.test(path)) return 'direct';
  if (release.requiresBrowser || release.source?.startsWith('pegasus')) return 'browser';
  return 'direct';
}
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function absolute(value, base) {
  value = decode(value);
  if (value.startsWith('//')) value = `${webURL(base).origin.split(':')[0]}:${value}`;
  else if (value.startsWith('/')) value = webURL(base).origin + value;
  else if (!/^https?:/i.test(value)) value = base.split(/[?#]/)[0].replace(/[^/]*$/, '') + value;
  webURL(value);
  if (base.startsWith('https:') && !value.startsWith('https:')) throw new Error('Provider attempted an insecure redirect.');
  return value;
}
function attribute(tag, key) {
  return new RegExp(`(?:^|\\s)${key}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
}
function anchor(html, id) {
  const tag = (html.match(/<a\b[^>]*>/gi) || []).find(value => attribute(value, 'id') === id);
  return tag && attribute(tag, 'href');
}
export class BrowserRequired extends Error {
  constructor(url, message = 'Browser verification required. Open the source, then enter its final file URL.') {
    super(message); this.name = 'BrowserRequired'; this.url = webURL(url).url;
  }
}
const htmlResponse = response => /(?:text\/html|application\/xhtml)/i.test(response.headers?.['content-type'] || '');

/** Bounded public provider-page adapters executed inside the native application. */
export function createSourceResolver({http}) {
  async function request(url, options = {}) {
    webURL(url);
    const response = await http.request(url, {maxBytes: 1024*1024, ...options});
    if (response.status === 404 || response.status === 410) throw new Error(`Source unavailable: HTTP ${response.status}. Choose another source.`);
    if ([401, 403, 429].includes(response.status)) throw new BrowserRequired(url);
    if (!response.ok && !(response.status >= 300 && response.status < 400)) throw new Error(`Provider HTTP ${response.status}.`);
    return response;
  }
  async function direct(url, signal, headers) {
    webURL(url);
    const response = await request(url, {method: 'HEAD', signal, headers});
    if (htmlResponse(response)) throw new BrowserRequired(url);
    if (response.status >= 300) throw new BrowserRequired(url, 'The final file redirects with custom headers. Choose another source.');
    return {url: webURL(response.url || url).url, headers, rejectHtml: true};
  }
  async function resolve(release, {signal, directURL} = {}) {
    if (directURL) return direct(directURL, signal);
    const url = release.browserUrl || release.url;
    const kind = sourceKind(release);
    if (kind === 'unavailable') throw new Error('Source unavailable: no download URL.');
    if (kind === 'direct') return {url: webURL(url).url, rejectHtml: true};
    if (kind === 'manifest') throw new Error('Split manifests must be resolved by the queue.');
    if (kind === 'browser' || kind === 'datanodes') throw new BrowserRequired(url);
    const response = await request(url, {signal});
    const base = response.url || url;
    if (response.headers?.['content-disposition']?.includes('attachment')) return direct(base, signal);
    const html = await response.text();
    let candidate;
    if (kind === 'mediafire') candidate = anchor(html, 'downloadButton');
    if (kind === 'vikingfile') candidate = anchor(html, 'download-link');
    if (kind === 'buzzheavier') {
      const button = (html.match(/<[a-z]+\b[^>]*>/gi) || []).find(tag => attribute(tag, 'hx-get')?.includes('/download'));
      const route = button && attribute(button, 'hx-get');
      if (route) {
        const next = await request(absolute(route, base), {signal, followRedirects: false,
          headers: {'HX-Request': 'true', 'HX-Current-URL': base}});
        candidate = next.headers?.['hx-redirect'] || next.headers?.location;
      }
    }
    if (!candidate) throw new BrowserRequired(url);
    return direct(absolute(candidate, base), signal);
  }
  return {resolve};
}

/** Small AbortSignal implementation for QuickJS and dependency-injected queue tests. */
export function cancellation() {
  const listeners = new Set();
  const signal = {aborted: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn)};
  return {signal, cancel() { signal.aborted = true; for (const fn of listeners) fn(); listeners.clear(); }};
}
